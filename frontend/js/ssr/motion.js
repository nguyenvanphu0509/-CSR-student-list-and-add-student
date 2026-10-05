function initMotion() {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const targets = [...document.querySelectorAll('.page-heading, .stat-card, .intro-card, .student-panel, .form-panel, .manage-panel')];
  let observer;
  const animations = new Map();
  const revealed = new WeakSet();
  let progress;
  let frame = 0;

  function updateProgress() {
    frame = 0;
    if (!progress) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0})`;
  }
  function scheduleProgress() {
    if (!frame) frame = window.requestAnimationFrame(updateProgress);
  }

  function configureMotion() {
    observer?.disconnect();
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    document.documentElement.classList.remove('motion-ready');
    progress?.remove();
    progress = null;
    if (preference.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;

    // Nội dung luôn hiển thị; JS chỉ chạy animation khi khối đi vào viewport.
    targets.forEach((element) => element.classList.add('scroll-reveal'));
    document.documentElement.classList.add('motion-ready');
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || revealed.has(entry.target)) continue;
        // Ngừng theo dõi TRƯỚC khi clip-path/transform thay đổi vùng giao nhau.
        // Mỗi khối chỉ chạy một lần, không tự kích hoạt lại giữa animation.
        revealed.add(entry.target);
        observer.unobserve(entry.target);
        entry.target.classList.add('reveal-complete');
        const zoom = entry.target.matches('.stat-card, .intro-card');
        const circular = entry.target.matches('.stat-card');
        const clipping = CSS.supports('clip-path', 'inset(0)');
        const fromClip = circular ? 'circle(0% at 15% 50%)' : 'inset(0 100% 0 0 round 20px)';
        const toClip = circular ? 'circle(150% at 15% 50%)' : 'inset(0 0% 0 0 round 20px)';
        const animation = entry.target.animate([
          { opacity: 0.2, transform: `translateY(20px) scale(${zoom ? .94 : .98})`, ...(clipping ? { clipPath: fromClip } : {}) },
          { opacity: 1, transform: 'translateY(0) scale(1)', ...(clipping ? { clipPath: toClip } : {}) },
        ], { duration: 850, easing: 'cubic-bezier(.25,1,.3,1)' });
        animations.set(entry.target, animation);
        animation.onfinish = () => {
          animation.cancel();
          if (animations.get(entry.target) === animation) animations.delete(entry.target);
        };
      }
    }, { threshold: .12 });
    targets.forEach((element) => {
      if (!revealed.has(element)) observer.observe(element);
    });
    progress = document.createElement('div');
    progress.className = 'scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.append(progress);
    updateProgress();
  }

  configureMotion();
  preference.addEventListener('change', configureMotion);
  window.addEventListener('scroll', scheduleProgress, { passive: true });
  window.addEventListener('resize', scheduleProgress);
  document.addEventListener('app:before-replace', () => {
    observer?.disconnect();
    animations.forEach((animation) => animation.cancel());
    progress?.remove();
    window.cancelAnimationFrame(frame);
    preference.removeEventListener('change', configureMotion);
    window.removeEventListener('scroll', scheduleProgress);
    window.removeEventListener('resize', scheduleProgress);
  }, { once: true });
}
initMotion();
document.addEventListener('app:page', (event) => { if (!event.detail?.fragment) initMotion(); });
