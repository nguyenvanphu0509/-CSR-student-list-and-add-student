function initStudentList() {
  const list = document.querySelector('#student-list');
  if (!list || list.dataset.bound === 'true') return;
  list.dataset.bound = 'true';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function transition(element, frames, duration = 250) {
    if (reducedMotion.matches || !element?.animate) return Promise.resolve();
    return element.animate(frames, { duration, easing: 'cubic-bezier(.2,.7,.2,1)' }).finished.catch(() => {});
  }

  // Server tính lại kết quả, thứ tự và trang sau khi sửa/xóa; giữ query hiện tại.
  function refreshList(action) {
    const url = new URL(window.location.href);
    for (const key of ['created', 'updated', 'deleted']) url.searchParams.delete(key);
    url.searchParams.set(action, '1');
    url.hash = 'student-list';
    window.location.assign(url.href);
  }
  function errorMessage(row, message = '') {
    const error = row.querySelector('.inline-row-error');
    error.textContent = message;
    error.hidden = !message;
  }
  function editMode(row, enabled) {
    row.querySelector('.student-name').hidden = enabled;
    row.querySelector('.inline-name-form').hidden = !enabled;
    row.querySelector('[data-action="edit"]').hidden = enabled;
    row.classList.toggle('is-editing', enabled);
    errorMessage(row);
    if (enabled) {
      const input = row.querySelector('input[name="name"]');
      input.value = row.querySelector('.student-name-label').textContent;
      input.focus();
      input.select();
      transition(row.querySelector('.inline-name-form'), [
        { opacity: .2, transform: 'translateY(5px) scale(.97)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ]);
    }
  }
  function busy(row, enabled) {
    row.dataset.busy = enabled ? 'true' : 'false';
    row.setAttribute('aria-busy', String(enabled));
    row.querySelectorAll('button, input').forEach((control) => { control.disabled = enabled; });
  }
  async function request(row, method, values) {
    const response = await fetch(`/students/${encodeURIComponent(row.dataset.studentId)}`, {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: values ? new URLSearchParams(values) : undefined,
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Server chưa tải bản cập nhật. Vui lòng tải lại trang rồi thử lại.');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.errors?.name || data.errors?.email || data.message || 'Không thể lưu thay đổi.');
    return data;
  }

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('tr[data-student-id]');
    if (!row || row.dataset.busy === 'true') return;
    if (button.dataset.action === 'edit') return editMode(row, true);
    if (button.dataset.action === 'cancel') return editMode(row, false);
    if (button.dataset.action !== 'delete') return;
    if (!await window.confirmStudentRemoval() || !row.isConnected) return;
    busy(row, true);
    errorMessage(row);
    try {
      await request(row, 'DELETE');
      await transition(row, [
        { opacity: 1, transform: 'translateX(0) scale(1)' },
        { opacity: 0, transform: 'translateX(18px) scale(.97)' },
      ], 220);
      refreshList('deleted');
    } catch (error) {
      errorMessage(row, error instanceof TypeError ? 'Không kết nối được server. Vui lòng thử lại.' : error.message);
      busy(row, false);
    }
  });

  list.addEventListener('submit', async (event) => {
    const form = event.target.closest('.inline-name-form');
    if (!form) return;
    event.preventDefault();
    const row = form.closest('tr');
    if (row.dataset.busy === 'true') return;
    const name = form.elements.namedItem('name').value.trim();
    if (!name) return errorMessage(row, 'Vui lòng nhập tên sinh viên.');
    busy(row, true);
    errorMessage(row);
    try {
      const result = await request(row, 'PUT', { name, email: row.dataset.email });
      row.querySelector('.student-name-label').textContent = result.student.name;
      row.querySelector('.avatar').textContent = result.student.name.split(/\s+/).map(word => word[0]).slice(-2).join('').toUpperCase();
      row.querySelector('[data-action="edit"]').setAttribute('aria-label', `Sửa thông tin ${result.student.name}`);
      row.querySelector('[data-action="delete"]').setAttribute('aria-label', `Xóa sinh viên ${result.student.name}`);
      editMode(row, false);
      await transition(row, [{ backgroundColor: '#e2edcf' }, { backgroundColor: 'transparent' }], 350);
      refreshList('updated');
    } catch (error) {
      errorMessage(row, error instanceof TypeError ? 'Không kết nối được server. Vui lòng thử lại.' : error.message);
    } finally {
      busy(row, false);
    }
  });
}
initStudentList();
document.addEventListener('app:page', initStudentList);
