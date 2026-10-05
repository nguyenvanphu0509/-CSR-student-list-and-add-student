// Mount một lần để giữ focus/con trỏ khi input thay đổi. update() đồng bộ props → UI.
export function StudentForm({ onInput, onSubmit }) {
  const element = document.createElement('form');
  element.noValidate = true;
  element.innerHTML = `
    <div class="field"><label for="name">Họ và tên <span class="required">*</span></label>
      <input id="name" name="name" type="text" maxlength="120" autocomplete="name" placeholder="Ví dụ: Nguyễn Minh An" required aria-describedby="name-error">
      <p class="field-error" id="name-error" hidden></p></div>
    <div class="field"><label for="email">Địa chỉ email <span class="required">*</span></label>
      <input id="email" name="email" type="email" maxlength="254" autocomplete="email" placeholder="sinhvien@example.com" required aria-describedby="email-help email-error">
      <p class="field-help" id="email-help">Mỗi sinh viên sử dụng một email riêng.</p>
      <p class="field-error" id="email-error" hidden></p></div>
    <p class="field-error" id="submit-error" role="alert" hidden></p>
    <button class="button button-primary" type="submit">＋ Thêm vào danh sách</button>
    <p class="form-footnote">Các trường có dấu <span class="required">*</span> là bắt buộc.</p>`;
  element.addEventListener('input', event => {
    if (['name', 'email'].includes(event.target.name)) onInput(event.target.name, event.target.value);
  });
  element.addEventListener('submit', event => {
    event.preventDefault(); // Chặn hành vi submit/điều hướng mặc định của browser.
    onSubmit();
  });

  function update({ values, errors, submitting, ready, error }) {
    element.setAttribute('aria-busy', String(submitting));
    for (const key of ['name', 'email']) {
      const input = element.elements.namedItem(key);
      // Không gán lại value khi đang gõ để giữ vị trí con trỏ.
      if (input.value !== values[key]) input.value = values[key];
      input.disabled = submitting;
      input.setAttribute('aria-invalid', String(Boolean(errors[key])));
      const message = element.querySelector(`#${key}-error`);
      message.textContent = errors[key] || '';
      message.hidden = !errors[key];
    }
    const button = element.querySelector('button');
    button.disabled = submitting || !ready;
    button.textContent = submitting ? 'Đang lưu…' : '＋ Thêm vào danh sách';
    const message = element.querySelector('#submit-error');
    message.textContent = error;
    message.hidden = !error;
  }
  function focusInvalid(errors) {
    const key = ['name', 'email'].find(field => errors[field]);
    if (key) element.elements.namedItem(key).focus();
  }
  return { element, update, focusInvalid };
}
