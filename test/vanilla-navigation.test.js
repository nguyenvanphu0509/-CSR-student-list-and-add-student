import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';

test('landing animation works with plain JavaScript; entry opens CSR', async () => {
  const dom = new JSDOM('<body><main class="welcome-page"><div class="welcome-reveal" transition-style="out:circle:center"></div><a class="welcome-enter" href="/csr">Vào trang sinh viên</a></main></body>', { runScripts: 'outside-only' });
  try {
    dom.window.matchMedia = () => ({ matches: true, addEventListener() {} });
    dom.window.eval(await readFile(new URL('../frontend/js/ssr/welcome.js', import.meta.url), 'utf8'));
    const layer = dom.window.document.querySelector('.welcome-reveal');
    dom.window.document.body.click();
    assert.equal(layer.getAttribute('transition-style'), 'in:circle:center');
    dom.window.document.body.click();
    assert.equal(layer.getAttribute('transition-style'), 'out:circle:center');
    assert.equal(dom.window.document.querySelector('.welcome-enter').getAttribute('href'), '/csr');
    const footer = await readFile(new URL('../backend/views/partials/footer.ejs', import.meta.url), 'utf8');
    assert.doesNotMatch(footer, /transitions\.js|swup/i);
  } finally {
    dom.window.close();
  }
});
