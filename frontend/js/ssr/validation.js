// Validation phía client: báo lỗi dưới input và chặn gửi form khi dữ liệu chưa hợp lệ.
// Server vẫn kiểm tra lại dữ liệu và email trùng trước khi ghi JSON.
(() => {
  let errorSequence = 0;

  function validate(input) {
    const value = input.value.trim();
    if (input.name === 'name') {
      if (!value) return 'Vui lòng nhập họ và tên.';
      if (value.length > 120) return 'Họ và tên tối đa 120 ký tự.';
    }
    if (input.name === 'email') {
      if (!value) return 'Vui lòng nhập email.';
      if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Vui lòng nhập email đúng định dạng, ví dụ an@example.com.';
      }
    }
    return '';
  }

  function displayError(input, message) {
    const container = input.closest('.field') || input.closest('tr');
    let error = container.querySelector('.field-error');
    if (!error && !message) return;
    if (!error) {
      error = document.createElement('p');
      error.className = 'field-error';
      container.append(error);
    }
    if (!error.id) error.id = `client-field-error-${++errorSequence}`;
    error.setAttribute('role', 'alert');
    error.textContent = message;
    error.hidden = !message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    if (message) describedBy.add(error.id);
    else describedBy.delete(error.id);
    if (describedBy.size) input.setAttribute('aria-describedby', [...describedBy].join(' '));
    else input.removeAttribute('aria-describedby');
  }

  const fields = (form) => [...form.querySelectorAll('input[name="name"], input[name="email"]')];

  // Capture để validation chạy trước handler gửi fetch của form sửa tên trong bảng.
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!form.matches('form[data-student-validation]')) return;
    let firstInvalid;
    for (const input of fields(form)) {
      input.value = input.value.trim();
      const message = validate(input);
      displayError(input, message);
      if (message && !firstInvalid) firstInvalid = input;
    }
    if (firstInvalid) {
      event.preventDefault();
      event.stopImmediatePropagation();
      firstInvalid.focus();
    }
  }, true);

  document.addEventListener('focusout', (event) => {
    const input = event.target;
    if (!input.matches('input[name="name"], input[name="email"]')
      || !input.closest('form[data-student-validation]')) return;
    displayError(input, validate(input));
  });

  // Khi sửa một trường đang báo lỗi, cập nhật thông báo ngay lúc nhập.
  document.addEventListener('input', (event) => {
    const input = event.target;
    if (!input.matches('input[name="name"], input[name="email"]')
      || !input.closest('form[data-student-validation]')
      || input.getAttribute('aria-invalid') !== 'true') return;
    displayError(input, validate(input));
  });
})();
