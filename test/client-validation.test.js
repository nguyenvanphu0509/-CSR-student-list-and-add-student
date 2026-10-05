import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../frontend/js/ssr/validation.js', import.meta.url), 'utf8');

// DOM tối thiểu để kiểm tra hành vi chặn submit và cập nhật lỗi của script browser.
function setup(values, { marked = true } = {}) {
  const handlers = {};
  const form = { matches: () => marked, querySelectorAll: () => inputs };
  const inputs = Object.entries(values).map(([name, value]) => {
    const attributes = new Map(name === 'email' ? [['aria-describedby', 'email-help']] : []);
    const container = { error: null, querySelector() { return this.error; }, append(error) { this.error = error; } };
    return {
      name, value, container, focused: false,
      matches: () => true,
      closest: (selector) => selector.startsWith('form') ? (marked ? form : null) : container,
      getAttribute: (key) => attributes.get(key) ?? null,
      setAttribute: (key, value) => attributes.set(key, value),
      removeAttribute: (key) => attributes.delete(key),
      focus() { this.focused = true; },
    };
  });
  vm.runInNewContext(script, {
    document: {
      addEventListener: (type, handler, capture) => { handlers[type] = handler; if (type === 'submit') assert.equal(capture, true); },
      createElement: () => ({ id: '', hidden: false, textContent: '', setAttribute() {} }),
    },
  });
  const submit = () => {
    const event = {
      target: form, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
    };
    handlers.submit(event);
    return event;
  };
  return { inputs, handlers, submit };
}

test('client blocks invalid submissions and focuses the first invalid field before fetch handlers', () => {
  for (const values of [
    { name: '   ', email: 'valid@example.com' },
    { name: 'a'.repeat(121), email: 'valid@example.com' },
    { name: 'Tên hợp lệ', email: '' },
    { name: 'Tên hợp lệ', email: 'bad@domain' },
    { name: 'Tên hợp lệ', email: `${'a'.repeat(243)}@example.com` },
    { name: '   ' }, // Form sửa tên trong bảng không có trường email.
  ]) {
    const { inputs, submit } = setup(values);
    const event = submit();
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    const invalid = inputs.find((input) => input.getAttribute('aria-invalid') === 'true');
    assert.ok(invalid.focused);
    assert.ok(invalid.container.error.textContent);
    assert.equal(invalid.container.error.hidden, false);
  }
});

test('client allows valid forms and trims values; search and delete forms are unaffected', () => {
  const valid = setup({ name: ' Nguyễn An ', email: ' an@example.com ' });
  assert.equal(valid.submit().prevented, false);
  assert.deepEqual(valid.inputs.map((input) => input.value), ['Nguyễn An', 'an@example.com']);
  assert.equal(setup({ name: 'An' }).submit().prevented, false);
  assert.equal(setup({ name: '' }, { marked: false }).submit().prevented, false);
});

test('blur shows errors and typing fixes them while preserving email help text', () => {
  const { inputs, handlers } = setup({ name: 'An', email: 'bad' });
  const email = inputs[1];
  handlers.focusout({ target: email });
  assert.equal(email.getAttribute('aria-invalid'), 'true');
  assert.match(email.getAttribute('aria-describedby'), /^email-help client-field-error-/);
  email.value = 'an@example.com';
  handlers.input({ target: email });
  assert.equal(email.getAttribute('aria-invalid'), 'false');
  assert.equal(email.getAttribute('aria-describedby'), 'email-help');
  assert.equal(email.container.error.hidden, true);
});
