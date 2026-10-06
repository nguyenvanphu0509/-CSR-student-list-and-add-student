import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../backend/app.js';

async function fixture(t, seed = [{ id: '24127152', name: 'Nguyễn Văn Tiến Đạt', email: 'tiendat@example.com' }]) {
  const directory = await mkdtemp(join(tmpdir(), 'students-csr-'));
  const dataFile = join(directory, 'students.json');
  await writeFile(dataFile, JSON.stringify(seed));
  const server = createApp({ dataFile, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, dataFile,
    request: (path, options) => fetch(`${base}${path}`, { redirect: 'manual', ...options }),
    post: values => fetch(`${base}/api/students`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values), redirect: 'manual' }),
  };
}

test('CSR serves an empty shell; API returns JSON, persists, validates and reports JSON errors', async t => {
  const f = await fixture(t);
  const csr = await f.request('/csr');
  assert.equal(csr.status, 200);
  const html = await csr.text();
  assert.match(html, /type="module" src="\/assets\/js\/app.js"/);
  assert.match(html, /class="brand-icon bubble"/);
  assert.match(html, /class="brand" href="#student-list"/);
  assert.match(html, /class="nav-link" href="#student-list" data-csr-nav="students">Danh sách<\/a>/);
  assert.match(html, /href="#trash" data-csr-nav="trash">Thùng rác<\/a>/);
  assert.match(html, /href="#activity" data-csr-nav="activity">Lịch sử<\/a>/);
  assert.doesNotMatch(html, /href="\/(trash|activity)"/);
  assert.match(html, /<a href="\/students">So sánh bản SSR/);
  assert.doesNotMatch(html, /class="nav-link" href="\/students">Danh sách/);
  assert.doesNotMatch(html, /Nguyễn Minh An|an@example.com|transitions\.js/);
  assert.match(await (await f.request('/students')).text(), /Nguyễn Minh An/);
  assert.equal((await (await f.request('/api/students')).json()).students.length, 1);
  assert.equal((await f.request('/backend/data/students.json')).status, 404);
  assert.equal((await f.request('/assets/data/students.json')).status, 404);
  for (const path of ['/assets/js/app.js', '/assets/js/components/student-list.js', '/assets/js/components/student-form.js', '/assets/js/api.js']) {
    assert.equal((await f.request(path)).status, 200);
  }
  const added = await f.post({ name: '  Lê Hoàng Nam ', email: ' nam@example.com ' });
  assert.equal(added.status, 201);
  assert.equal(added.headers.get('location'), null);
  const { student } = await added.json();
  assert.equal(student.name, 'Lê Hoàng Nam');
  assert.equal(student.id, '001');
  assert.equal(JSON.parse(await readFile(f.dataFile, 'utf8')).length, 2);
  const duplicate = await f.post({ name: 'Tên khác', email: 'NAM@example.com' });
  assert.equal(duplicate.status, 422);
  assert.ok((await duplicate.json()).errors.email);
  for (const input of [{ name: '', email: 'bad' }, { name: ['An'], email: {} }, { name: 'a'.repeat(121), email: 'valid@example.com' }]) {
    const invalid = await f.post(input);
    assert.equal(invalid.status, 422);
    assert.ok((await invalid.json()).errors.name);
  }
  const malformed = await f.request('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(malformed.status, 400);
  assert.match(malformed.headers.get('content-type'), /application\/json/);
  const missing = await f.request('/api/students/999');
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type'), /application\/json/);
  await writeFile(f.dataFile, '{broken');
  const failure = await f.request('/api/students');
  assert.equal(failure.status, 500);
  assert.ok((await failure.json()).message);
});

test('browser renders local seed and adds students without network requests or navigation', async t => {
  const f = await fixture(t, []);
  const dom = new JSDOM(await (await f.request('/csr')).text(), { url: `${f.base}/csr`, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const requests = [];
  window.structuredClone = structuredClone;
  window.fetch = (...args) => {
    requests.push(args);
    throw new Error('CSR không được gọi network');
  };
  // jsdom không thực thi module scripts: giữ nguyên code, chỉ bỏ cú pháp module để chạy chung.
  const modules = await Promise.all(['components/student-list.js', 'components/student-form.js', 'app.js']
    .map(path => readFile(new URL(`../frontend/js/${path}`, import.meta.url), 'utf8')));
  window.eval(modules.map(source => source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')).join('\n'));
  const document = window.document;
  const initialStudents = window.getStudentState().students;
  assert.equal(initialStudents.length, 3);
  assert.deepEqual(initialStudents.map(student => student.id), ['24127152', '24127489', '24127353']);
  for (const student of initialStudents) {
    assert.equal(student.studentCode, `SV${student.id}`);
    assert.equal(student.phone, '');
    assert.equal(student.dob, '');
    assert.equal(student.className, '');
    assert.equal(student.status, 'studying');
  }
  assert.ok(window.eval("validate({ name: 'An', email: 'an@example.com', phone: '', dob: '2026-02-30', className: '', status: 'studying' }).dob"));
  assert.ok(window.eval("validate({ name: 'An', email: 'an@example.com', phone: '', dob: '', className: '', status: 'unknown' }).status"));
  assert.equal(document.querySelectorAll('#student-list-content tbody tr').length, 3);
  assert.equal(document.querySelector('#student-total').textContent, '3');
  const main = document.querySelector('main');
  const form = document.querySelector('#student-form-content form');
  function input(key, value) {
    form.elements.namedItem(key).value = value;
    form.elements.namedItem(key).dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  function submit() {
    const event = new window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  }
  async function navigateTo(selector) {
    const changed = new Promise(resolve => window.addEventListener('hashchange', resolve, { once: true }));
    document.querySelector(selector).click();
    await changed;
  }
  input('name', '');
  input('email', 'bad');
  submit();
  assert.equal(requests.length, 0);
  assert.equal(document.activeElement, form.elements.namedItem('name'));
  input('name', '<img src=x onerror=alert(1)>');
  input('email', 'safe@example.com');
  input('phone', '090 123 4567');
  input('dob', '2004-05-20');
  input('className', 'JavaScript 02');
  input('status', 'paused');
  const snapshot = window.getStudentState();
  assert.equal(snapshot.form.name, form.elements.namedItem('name').value);
  snapshot.form.name = 'Không được sửa state thật';
  assert.notEqual(window.getStudentState().form.name, snapshot.form.name);
  submit();
  assert.equal(window.getStudentState().students.length, 4);
  const addedStudent = window.getStudentState().students.at(-1);
  assert.equal(addedStudent.id, '24127490');
  assert.equal(addedStudent.studentCode, 'SV24127490');
  assert.equal(addedStudent.phone, '090 123 4567');
  assert.equal(addedStudent.dob, '2004-05-20');
  assert.equal(addedStudent.className, 'JavaScript 02');
  assert.equal(addedStudent.status, 'paused');
  assert.equal(document.querySelector('#student-total').textContent, '4');
  assert.match(document.querySelector('#student-list-content').textContent, /Lớp: JavaScript 02/);
  assert.match(document.querySelector('#student-list-content').textContent, /Nghỉ học/);
  assert.equal(document.querySelector('#student-list-content img'), null);
  assert.match(document.querySelector('#student-list-content').textContent, /<img src=x/);
  assert.equal(form.elements.namedItem('name').value, '');
  assert.equal(form.elements.namedItem('email').value, '');
  assert.equal(form.elements.namedItem('phone').value, '');
  assert.equal(form.elements.namedItem('dob').value, '');
  assert.equal(form.elements.namedItem('className').value, '');
  assert.equal(form.elements.namedItem('status').value, 'studying');
  assert.equal(document.querySelector('main'), main);
  assert.equal(document.querySelector('#student-form-content form'), form);
  assert.equal(window.location.href, `${f.base}/csr`);
  assert.equal(requests.length, 0);
  input('name', 'Email trùng');
  input('email', initialStudents[0].email.toUpperCase());
  submit();
  assert.ok(window.getStudentState().errors.email);
  assert.equal(window.getStudentState().students.length, 4);
  assert.equal(form.elements.namedItem('email').value, initialStudents[0].email.toUpperCase());
  input('name', 'Tên mới');
  input('email', 'next@example.com');
  const search = document.querySelector('#student-search');
  search.value = 'Không khớp';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.match(document.querySelector('#student-list-content').textContent, /Không tìm thấy/);
  submit();
  assert.equal(window.getStudentState().students.length, 5);
  assert.equal(search.value, '');
  assert.equal(document.querySelectorAll('#student-list-content tbody tr').length, 5);
  assert.equal(requests.length, 0);

  await navigateTo('[data-csr-nav="trash"]');
  assert.equal(document.querySelector('[data-csr-view="students"]').hidden, true);
  assert.equal(document.querySelector('[data-csr-view="trash"]').hidden, false);
  document.querySelector('tr[data-student-id="24127491"] .row-action-danger').click();
  assert.equal(window.getStudentState().students.length, 4);
  assert.equal(window.getStudentState().trash.length, 1);
  await navigateTo('[data-csr-nav="activity"]');
  assert.match(document.querySelector('#activity-content').textContent, /Thêm hồ sơ/);
  assert.match(document.querySelector('#activity-content').textContent, /Chuyển vào thùng rác/);
  assert.match(document.querySelector('#activity-content').textContent, /SV24127491/);
  assert.doesNotMatch(document.querySelector('#activity-content').textContent, /SVundefined/);
  await navigateTo('[data-csr-nav="trash"]');
  document.querySelector('#trash-content button').click();
  assert.equal(window.getStudentState().students.length, 5);
  assert.equal(window.getStudentState().trash.length, 0);
  await navigateTo('[data-csr-nav="students"]');
  assert.equal(document.querySelector('[data-csr-view="students"]').hidden, false);
  assert.equal(document.querySelectorAll('#student-list-content tbody tr').length, 5);
  assert.equal(window.location.pathname, '/csr');
  assert.equal(requests.length, 0);
});
