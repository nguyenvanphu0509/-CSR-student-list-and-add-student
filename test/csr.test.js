import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../backend/app.js';

async function fixture(t, seed = [{ id: '001', name: 'Nguyễn Minh An', email: 'an@example.com' }]) {
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
  assert.equal(student.id, '002');
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

async function until(check) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for CSR state');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('browser state, controlled inputs, add, duplicate, retry, empty list and safe rendering work without navigation', async t => {
  const f = await fixture(t, []);
  const dom = new JSDOM(await (await f.request('/csr')).text(), { url: `${f.base}/csr`, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const requests = [];
  let offline = true;
  window.structuredClone = structuredClone;
  window.fetch = (path, options) => {
    requests.push({ path, method: options.method || 'GET' });
    if (offline) return Promise.reject(new window.TypeError('Offline'));
    return fetch(new URL(path, f.base), options);
  };
  // jsdom không thực thi module scripts: giữ nguyên code, chỉ bỏ cú pháp module để chạy chung.
  const modules = await Promise.all(['api.js', 'components/student-list.js', 'components/student-form.js', 'app.js']
    .map(path => readFile(new URL(`../frontend/js/${path}`, import.meta.url), 'utf8')));
  window.eval(modules.map(source => source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')).join('\n'));
  const document = window.document;
  await until(() => window.getStudentState().loadError);
  assert.match(document.querySelector('#student-list-content').textContent, /Không kết nối/);
  offline = false;
  document.querySelector('#student-list-content button').click();
  await until(() => window.getStudentState().loaded);
  assert.match(document.querySelector('#student-list-content').textContent, /thành viên đầu tiên/);
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
  input('name', '');
  input('email', 'bad');
  const before = requests.length;
  submit();
  assert.equal(requests.length, before); // Validation chặn request trước khi gọi API.
  assert.equal(document.activeElement, form.elements.namedItem('name'));
  input('name', '<img src=x onerror=alert(1)>');
  input('email', 'safe@example.com');
  const snapshot = window.getStudentState();
  assert.equal(snapshot.form.name, form.elements.namedItem('name').value);
  snapshot.form.name = 'Không được sửa state thật';
  assert.notEqual(window.getStudentState().form.name, snapshot.form.name);
  submit();
  assert.equal(form.querySelector('button').disabled, true);
  submit(); // Submit liên tiếp khi đang lưu không tạo POST thứ hai.
  await until(() => window.getStudentState().students.length === 1);
  assert.equal(requests.filter(r => r.method === 'POST').length, 1);
  assert.equal(document.querySelector('#student-total').textContent, '1');
  assert.equal(document.querySelector('#student-list-content img'), null);
  assert.match(document.querySelector('#student-list-content').textContent, /<img src=x/);
  assert.equal(form.elements.namedItem('name').value, '');
  assert.equal(form.elements.namedItem('email').value, '');
  assert.equal(document.querySelector('main'), main);
  assert.equal(document.querySelector('#student-form-content form'), form);
  assert.equal(window.location.href, `${f.base}/csr`);
  assert.ok(requests.every(r => r.path === '/api/students')); // Không fetch HTML sau submit.
  input('name', 'Tên mới');
  input('email', 'SAFE@example.com');
  submit();
  await until(() => !window.getStudentState().submitting);
  assert.ok(window.getStudentState().errors.email);
  assert.equal(window.getStudentState().students.length, 1);
  assert.equal(form.elements.namedItem('email').value, 'SAFE@example.com');
  input('email', 'next@example.com');
  offline = true;
  submit();
  await until(() => !window.getStudentState().submitting);
  assert.match(window.getStudentState().submitError, /Không kết nối/);
  assert.equal(form.elements.namedItem('email').value, 'next@example.com');
  assert.equal(window.getStudentState().students.length, 1);
  offline = false;
  const search = document.querySelector('#student-search');
  search.value = 'Không khớp';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.match(document.querySelector('#student-list-content').textContent, /Không tìm thấy/);
  submit();
  await until(() => window.getStudentState().students.length === 2);
  assert.equal(search.value, '');
  assert.equal(document.querySelectorAll('#student-list-content tbody tr').length, 2);
  assert.equal((await (await f.request('/api/students')).json()).students.length, 2);
});
