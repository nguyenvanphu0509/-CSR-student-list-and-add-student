import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, chmod, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../backend/app.js';

// Fixture độc lập: không đọc hoặc phụ thuộc dữ liệu thật của người dùng.
const seed = [
  { id: 'seed-1', name: 'Nguyễn Minh An', email: 'minhan@example.com' },
  { id: 'seed-2', name: 'Trần Ngọc Linh', email: 'ngoclinh@example.com' },
  { id: 'seed-3', name: 'Lê Hoàng Nam', email: 'hoangnam@example.com' },
];

async function fixture(t, students = seed) {
  const directory = await mkdtemp(join(tmpdir(), 'students-ssr-test-'));
  const dataFile = join(directory, 'students.json');
  await writeFile(dataFile, JSON.stringify(students));
  let server;
  let base;
  const logs = [];
  async function start() {
    server = createApp({ dataFile, logger: { error: (error) => logs.push(error) } }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    if (!server?.listening) return;
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  t.after(async () => {
    await stop();
    await chmod(directory, 0o700);
    await rm(directory, { recursive: true, force: true });
  });
  await start();
  return {
    directory, dataFile, logs,
    restore: (id) => fetch(`${base}/students/${encodeURIComponent(id)}/restore`, { method: 'POST', redirect: 'manual' }),
    get: (path = '/students') => fetch(`${base}${path}`, { redirect: 'manual' }),
    post: (values) => fetch(`${base}/students`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values), redirect: 'manual',
    }),
    manage: (id, values) => fetch(`${base}/students/${encodeURIComponent(id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values), redirect: 'manual',
    }),
    read: async () => JSON.parse(await readFile(dataFile, 'utf8')),
    restart: async () => { await stop(); await start(); },
  };
}

test('GET renders seed students as HTML; CSS is public, JSON is private; root renders welcome', async (t) => {
  const f = await fixture(t);
  const response = await f.get();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  for (const student of seed) {
    assert.ok(html.includes(student.name));
    assert.ok(html.includes(student.email));
  }
  assert.match(html, /<form action="\/students" method="post"/);
  const root = await f.get('/');
  assert.equal(root.status, 200);
  const welcome = await root.text();
  assert.match(welcome, /transition-style="out:circle:center"/);
  assert.match(welcome, /href="\/csr">Vào trang sinh viên/);
  assert.equal((await f.get('/assets/js/ssr/welcome.js')).status, 200);
  const css = await f.get('/assets/css/styles.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
  assert.equal((await f.get('/data/students.json')).status, 404);
  assert.equal((await f.get('/missing')).status, 404);
});

test('valid POST trims fields, persists, redirects; reload and restart preserve a single record', async (t) => {
  const f = await fixture(t);
  const response = await f.post({ name: '  Phạm Gia Hân  ', email: '  han@example.com  ' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/students?created=1');
  let students = await f.read();
  assert.equal(students.length, seed.length + 1);
  const added = students.at(-1);
  assert.equal(added.name, 'Phạm Gia Hân');
  assert.equal(added.email, 'han@example.com');
  assert.match(added.id, /^\d{3}$/);
  assert.equal(added.activity[0].action, 'created');
  const html = await (await f.get(response.headers.get('location'))).text();
  assert.match(html, /Đã thêm sinh viên thành công/);
  assert.match(html, /Phạm Gia Hân/);
  await f.get(response.headers.get('location'));
  assert.equal((await f.read()).length, seed.length + 1);
  await f.restart();
  assert.match(await (await f.get()).text(), /han@example.com/);
  assert.deepEqual(await f.read(), students);
});

test('edit updates the selected student and delete soft-deletes it from active HTML', async (t) => {
  const f = await fixture(t);
  const updated = await f.manage('seed-2', {
    _method: 'PUT',
    name: 'Trần Ngọc Linh đã sửa',
    email: 'linh-updated@example.com',
  });
  assert.equal(updated.status, 303);
  assert.equal(updated.headers.get('location'), '/students?updated=1');

  let students = await f.read();
  const edited = students.find((student) => student.id === 'seed-2');
  assert.deepEqual({ id: edited.id, name: edited.name, email: edited.email }, {
    id: 'seed-2',
    name: 'Trần Ngọc Linh đã sửa',
    email: 'linh-updated@example.com',
  });
  assert.equal(students.length, seed.length);

  const removed = await f.manage('seed-2', { _method: 'DELETE' });
  assert.equal(removed.status, 303);
  assert.equal(removed.headers.get('location'), '/students?deleted=1');
  students = await f.read();
  assert.ok(students.find((student) => student.id === 'seed-2').deletedAt);
  assert.equal(students.length, seed.length);

  const html = await (await f.get()).text();
  assert.doesNotMatch(html, /Trần Ngọc Linh đã sửa|linh-updated@example\.com/);
  assert.match(html, /Nguyễn Minh An/);
});

test('empty names, malformed email, duplicate email and repeated fields return 422 without writes', async (t) => {
  const f = await fixture(t);
  const original = await readFile(f.dataFile, 'utf8');
  const cases = [
    { name: '   ', email: 'new@example.com' },
    { name: 'Tên giữ lại', email: '' },
    { name: 'Tên giữ lại', email: 'invalid-email' },
    { name: 'Trùng email', email: seed[0].email.toUpperCase() },
    { name: 'a'.repeat(121), email: 'long@example.com' },
    [['name', 'One'], ['name', 'Two'], ['email', 'array@example.com']],
  ];
  for (const values of cases) {
    const response = await f.post(values);
    assert.equal(response.status, 422);
    const html = await response.text();
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /Chưa thể thêm sinh viên/);
    if (values.name === 'Tên giữ lại') assert.match(html, /value="Tên giữ lại"/);
    assert.equal(await readFile(f.dataFile, 'utf8'), original);
  }
});

test('concurrent requests retain both students; concurrent duplicate email saves only once', async (t) => {
  const f = await fixture(t);
  const responses = await Promise.all([
    f.post({ name: 'Sinh viên A', email: 'a@example.com' }),
    f.post({ name: 'Sinh viên B', email: 'b@example.com' }),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [303, 303]);
  assert.equal((await f.read()).length, seed.length + 2);
  const duplicates = await Promise.all([
    f.post({ name: 'Sinh viên C', email: 'c@example.com' }),
    f.post({ name: 'Sinh viên C khác', email: 'C@example.com' }),
  ]);
  assert.deepEqual(duplicates.map((response) => response.status).sort(), [303, 422]);
  assert.equal((await f.read()).length, seed.length + 3);
  assert.deepEqual(await readdir(f.directory), ['students.json']);
});

test('user HTML is escaped in list and form; empty list renders a helpful state', async (t) => {
  const f = await fixture(t, []);
  assert.match(await (await f.get()).text(), /Lớp học đang chờ thành viên đầu tiên/);
  const name = '<script>alert("x")</script>';
  assert.equal((await f.post({ name, email: 'safe@example.com' })).status, 303);
  const html = await (await f.get()).text();
  assert.match(html, /&lt;script&gt;alert\(&#34;x&#34;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal((await f.read())[0].name, name);
  const invalid = await f.post({ name: '"><script>alert(1)</script>', email: 'invalid' });
  assert.equal(invalid.status, 422);
  assert.doesNotMatch(await invalid.text(), /<script>/);
});

test('corrupt or invalid JSON returns 500 without replacing the file; queue recovers after repair', async (t) => {
  const f = await fixture(t);
  for (const invalid of ['{broken', '{}', '[{"id": "a"}]', JSON.stringify([seed[0], seed[0]])]) {
    await writeFile(f.dataFile, invalid);
    assert.equal((await f.get()).status, 500);
    assert.equal((await f.post({ name: 'Test', email: 'test@example.com' })).status, 500);
    assert.equal(await readFile(f.dataFile, 'utf8'), invalid);
  }
  assert.ok(f.logs.length);
  await writeFile(f.dataFile, JSON.stringify(seed));
  assert.equal((await f.post({ name: 'Đã sửa', email: 'fixed@example.com' })).status, 303);
});

test('write failure preserves JSON, returns 500 and permits retry after permission repair', {
  skip: process.platform === 'win32' || process.getuid?.() === 0,
}, async (t) => {
  const f = await fixture(t);
  const original = await readFile(f.dataFile, 'utf8');
  await chmod(f.directory, 0o500);
  assert.equal((await f.post({ name: 'Test', email: 'failure@example.com' })).status, 500);
  assert.equal(await readFile(f.dataFile, 'utf8'), original);
  await chmod(f.directory, 0o700);
  assert.deepEqual(await readdir(f.directory), ['students.json']);
  assert.equal((await f.post({ name: 'Test', email: 'failure@example.com' })).status, 303);
});

// Kiểm tra HTML SSR thực tế, không phụ thuộc JavaScript phía browser.
const rowIDs = (html) => [...html.matchAll(/<tr data-student-id="([^"]+)"/g)].map((match) => match[1]);

test('SSR search matches Vietnamese names without accents and email; empty results and query escaping', async (t) => {
  const f = await fixture(t);
  const original = await readFile(f.dataFile, 'utf8');
  let html = await (await f.get('/students?q=NGUYEN')).text();
  assert.deepEqual(rowIDs(html), ['seed-1']);
  assert.match(html, /<b>3<\/b>/);
  html = await (await f.get('/students?q=NGOCLINH%40EXAMPLE')).text();
  assert.deepEqual(rowIDs(html), ['seed-2']);
  html = await (await f.get('/students?q=no-match')).text();
  assert.deepEqual(rowIDs(html), []);
  assert.match(html, /Không tìm thấy sinh viên/);
  html = await (await f.get(`/students?q=${encodeURIComponent('<script>alert(1)</script>')}`)).text();
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(await readFile(f.dataFile, 'utf8'), original);
});

test('SSR sorts names and emails in both directions without changing persisted order', async (t) => {
  const f = await fixture(t);
  for (const [sort, expected] of [
    ['name-asc', ['seed-3', 'seed-1', 'seed-2']],
    ['name-desc', ['seed-2', 'seed-1', 'seed-3']],
    ['email-asc', ['seed-3', 'seed-1', 'seed-2']],
    ['email-desc', ['seed-2', 'seed-1', 'seed-3']],
  ]) {
    assert.deepEqual(rowIDs(await (await f.get(`/students?sort=${sort}`)).text()), expected);
  }
  assert.deepEqual(await f.read(), seed);
});

test('SSR paginates after filtering and sorting; retains filters and clamps invalid pages', async (t) => {
  const students = Array.from({ length: 23 }, (_, index) => ({
    id: `item-${index + 1}`, name: `Sinh viên ${String(index + 1).padStart(2, '0')}`,
    email: `sv${index + 1}@example.com`,
  }));
  const f = await fixture(t, students);
  let html = await (await f.get('/students?q=sinh&sort=name-desc&page=2')).text();
  assert.deepEqual(rowIDs(html), students.slice(3, 13).reverse().map((s) => s.id));
  assert.match(html, /Trang 2 \/ 3/);
  assert.match(html, /q=sinh&amp;sort=name-desc&amp;page=3#student-list/);
  assert.match(html, /class="number-cell">11<\/td>/);
  assert.match(html, /href="\/students\/item-13\?q=sinh&amp;sort=name-desc&amp;page=2"/);
  html = await (await f.get('/students?page=999')).text();
  assert.equal(rowIDs(html).length, 3);
  assert.match(html, /Trang 3 \/ 3/);
  for (const query of ['page=-1', 'page=NaN', 'page=1.5', 'page=99999999999999999999', 'page=2&page=3', 'sort=bad&q=a&q=b']) {
    const response = await f.get(`/students?${query}`);
    assert.equal(response.status, 200);
    assert.deepEqual(rowIDs(await response.text()), students.slice(0, 10).map((s) => s.id));
  }
  // Trang cuối hết dữ liệu sau xóa phải lùi về trang còn tồn tại.
  await f.manage('item-23', { _method: 'DELETE' });
  await f.manage('item-22', { _method: 'DELETE' });
  await f.manage('item-21', { _method: 'DELETE' });
  html = await (await f.get('/students?page=3')).text();
  assert.match(html, /Trang 2 \/ 2/);
  assert.equal(rowIDs(html).length, 10);
});

test('student detail renders SSR, preserves list context, escapes content and returns 404 for missing IDs', async (t) => {
  const f = await fixture(t, [{ id: 'detail-1', name: '<img src=x onerror=alert(1)>', email: 'detail@example.com' }]);
  const response = await f.get('/students/detail-1?q=detail&sort=email-desc&page=2');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  assert.match(html, /detail@example.com/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /href="\/students\?q=detail&amp;sort=email-desc&amp;page=2#student-list"/);
  assert.match(html, /href="\/students\/detail-1\/edit"/);
  assert.match(html, /href="\/students\/detail-1\/delete"/);
  assert.equal((await f.get('/students/not-found')).status, 404);
  assert.equal((await f.get('/students/detail-1/edit')).status, 200);
  assert.equal((await f.get('/students/detail-1/delete')).status, 200);
});

test('profile fields persist; optional fields do not add validation; inline rename preserves the profile', async (t) => {
  const f = await fixture(t, []);
  const response = await f.post({ name: 'Hồ sơ mới', email: 'profile@example.com', studentCode: 'SV2026', phone: '0901234567', dob: '2004-05-20', className: 'JavaScript 02', status: 'paused' });
  assert.equal(response.status, 303);
  const [added] = await f.read();
  assert.equal(added.id, '001');
  assert.equal(added.phone, '0901234567');
  assert.equal(added.dob, '2004-05-20');
  assert.equal(added.className, 'JavaScript 02');
  const html = await (await f.get('/students/001')).text();
  assert.match(html, /20\/05\/2004/);
  assert.match(html, /Nghỉ học/);
  assert.match(html, /<span>Mã sinh viên<\/span><strong>SV001<\/strong>/);
  assert.doesNotMatch(html, /SV2026|ID sinh viên|Block 2/);
  const editHTML = await (await f.get('/students/001/edit')).text();
  assert.doesNotMatch(editHTML, /name="studentCode"/);
  assert.equal((await f.manage('001', { _method: 'PUT', name: 'Tên mới', email: added.email })).status, 303);
  const [edited] = await f.read();
  for (const key of ['studentCode', 'phone', 'dob', 'className', 'status']) assert.equal(edited[key], added[key]);
  assert.equal(edited.activity.at(-1).action, 'updated');
  assert.deepEqual(edited.activity.at(-1).fields, ['name']);
  assert.equal((await f.post({ name: 'Tùy chọn', email: 'optional@example.com', phone: 'chưa rõ', dob: '', className: '' })).status, 303);
});

test('trash reserves IDs/emails, restores the same profile, and history survives restart', async (t) => {
  const f = await fixture(t, []);
  await f.post({ name: 'An', email: 'an@example.com', phone: '123' });
  assert.equal((await f.manage('001', { _method: 'DELETE' })).status, 303);
  let html = await (await f.get()).text();
  assert.deepEqual(rowIDs(html), []);
  assert.equal((await f.get('/students/001')).status, 404);
  html = await (await f.get('/trash')).text();
  assert.match(html, /an@example.com/);
  assert.match(html, /\/students\/001\/restore/);
  assert.equal((await f.post({ name: 'Trùng', email: 'AN@example.com' })).status, 422);
  await f.post({ name: 'Bình', email: 'binh@example.com' });
  assert.equal((await f.read())[1].id, '002');
  const restored = await f.restore('001');
  assert.equal(restored.status, 303);
  assert.equal(restored.headers.get('location'), '/students?restored=1');
  assert.equal((await f.restore('001')).status, 404);
  assert.equal((await f.restore('missing')).status, 404);
  const [student] = await f.read();
  assert.equal(student.deletedAt, null);
  assert.equal(student.phone, '123');
  assert.deepEqual(student.activity.map(event => event.action), ['created', 'deleted', 'restored']);
  assert.ok(student.activity.every(event => Number.isFinite(Date.parse(event.at))));
  await f.restart();
  assert.equal((await f.get('/students/001')).status, 200);
  html = await (await f.get('/activity')).text();
  assert.match(html, /Thêm hồ sơ/);
  assert.match(html, /Chuyển vào thùng rác/);
  assert.match(html, /Khôi phục hồ sơ/);
  assert.deepEqual(rowIDs(await (await f.get()).text()), ['001', '002']);
});

test('concurrent IDs are unique and capacity errors preserve data and activity', async (t) => {
  const f = await fixture(t, []);
  await Promise.all(Array.from({ length: 12 }, (_, n) => f.post({ name: `SV ${n}`, email: `sv${n}@example.com` })));
  const students = await f.read();
  assert.equal(new Set(students.map(s => s.id)).size, 12);
  assert.ok(students.every(s => /^\d{3}$/.test(s.id)));
  const full = Array.from({ length: 999 }, (_, n) => ({ id: String(n + 1).padStart(3, '0'), name: `SV ${n}`, email: `full${n}@example.com` }));
  await writeFile(f.dataFile, JSON.stringify(full));
  const original = await readFile(f.dataFile, 'utf8');
  const response = await f.post({ name: 'Hết ID', email: 'capacity@example.com' });
  assert.equal(response.status, 400);
  assert.match(await response.text(), /001 đến 999/);
  assert.equal(await readFile(f.dataFile, 'utf8'), original);
});

test('legacy links still find migrated student; writes keep canonical 3-digit ID', async (t) => {
  const f = await fixture(t, [{ id: '001', legacyId: 'old-uuid', name: 'An', email: 'a@example.com' }]);
  assert.equal((await f.get('/students/old-uuid')).status, 200);
  await f.manage('old-uuid', { _method: 'PUT', name: 'An mới', email: 'a@example.com' });
  assert.equal((await f.read())[0].id, '001');
  await f.manage('old-uuid', { _method: 'DELETE' });
  assert.equal((await f.get('/students/001')).status, 404);
  await f.restore('old-uuid');
  assert.equal((await f.get('/students/001')).status, 200);
});
