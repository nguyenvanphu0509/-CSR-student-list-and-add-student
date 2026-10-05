// Dialog xác nhận xóa dùng JavaScript thuần trên các trang SSR.
(() => {
  const dialog = document.querySelector('#delete-dialog');
  if (!dialog) return;

  window.confirmStudentRemoval = () => {
    if (dialog.open) return Promise.resolve(false);
    return new Promise((resolve) => {
      dialog.returnValue = 'cancel';
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
      dialog.showModal();
    });
  };
  dialog.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-answer]');
    if (button) return dialog.close(button.dataset.deleteAnswer);
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close('cancel');
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dialog.close('cancel');
  });
  document.addEventListener('app:before-replace', () => {
    if (dialog.open) dialog.close('cancel');
  });

  // Trang xác nhận xóa riêng cũng dùng cùng popup trước khi gửi form.
  const approved = new WeakSet();
  const waiting = new WeakSet();
  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[data-confirm-delete]');
    if (!form || approved.delete(form)) return;
    event.preventDefault();
    if (waiting.has(form)) return;
    waiting.add(form);
    const accepted = await window.confirmStudentRemoval();
    waiting.delete(form);
    if (accepted && form.isConnected) {
      approved.add(form);
      form.requestSubmit(event.submitter || undefined);
    }
  });
})();
