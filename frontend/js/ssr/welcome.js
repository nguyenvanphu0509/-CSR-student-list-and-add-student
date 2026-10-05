// Luân phiên exit/entrance của vòng tròn #dceaaa trên nền --welcome-dark.
(() => {
  document.body.addEventListener('click', (event) => {
    const page = document.querySelector('.welcome-reveal');
    if (!page || event.target.closest('a, button, input, select, textarea')
      || document.documentElement.classList.contains('is-changing')) return;
    const next = page.getAttribute('transition-style') === 'out:circle:center'
      ? 'in:circle:center' : 'out:circle:center';
    page.removeAttribute('transition-style');
    void page.offsetWidth;
    page.setAttribute('transition-style', next);
  });
  window.addEventListener('pageshow', () => {
    const page = document.querySelector('.welcome-reveal');
    if (page) page.setAttribute('transition-style', 'out:circle:center');
  });
})();
