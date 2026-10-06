// Component chỉ nhận props, không sở hữu state hay gọi API.
// textContent bảo đảm tên/email được hiển thị như văn bản, không thực thi HTML.
function cell(value, className = '') {
  const node = document.createElement('td');
  node.className = className;
  node.textContent = value;
  return node;
}

export function StudentList({ students, total, filtered, onDelete }) {
  const content = document.createElement('div');
  if (!students.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    message.textContent = filtered ? 'Không tìm thấy tên hoặc email phù hợp.' : 'Lớp học đang chờ thành viên đầu tiên. Điền form để thêm sinh viên.';
    empty.append(message);
    content.append(empty);
    return content;
  }
  const region = document.createElement('div');
  region.className = 'table-scroll';
  region.tabIndex = 0;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', 'Bảng sinh viên, có thể cuộn ngang');
  const table = document.createElement('table');
  // Chỉ markup tĩnh đi qua innerHTML. Dữ liệu người dùng dùng textContent bên dưới.
  table.innerHTML = '<caption class="sr-only">Danh sách sinh viên gồm số thứ tự, họ tên, email, thông tin hồ sơ và thao tác.</caption><thead><tr><th scope="col" class="number-cell">STT</th><th scope="col">SINH VIÊN</th><th scope="col">EMAIL</th><th scope="col">HỒ SƠ</th><th scope="col" class="actions-cell">THAO TÁC</th></tr></thead>';
  const body = document.createElement('tbody');
  students.forEach((student, index) => {
    const row = document.createElement('tr');
    row.dataset.studentId = student.id;
    row.append(cell(String(index + 1).padStart(2, '0'), 'number-cell'));
    const identityCell = cell('');
    const identity = document.createElement('div');
    identity.className = 'student-identity';
    const avatar = document.createElement('span');
    avatar.className = `avatar avatar-${index % 3}`;
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = student.name.split(/\s+/).map(word => word[0]).slice(-2).join('').toUpperCase();
    const name = document.createElement('span');
    name.className = 'student-name';
    name.textContent = student.name;
    const code = document.createElement('small');
    code.className = 'student-code';
    code.textContent = student.studentCode || `SV${student.id}`;
    name.append(code);
    identity.append(avatar, name);
    identityCell.append(identity);
    const profile = cell('', 'profile-cell');
    const details = [student.className && `Lớp: ${student.className}`, student.phone && `SĐT: ${student.phone}`, student.dob && `Ngày sinh: ${student.dob}`]
      .filter(Boolean);
    const detailText = document.createElement('small');
    detailText.className = 'profile-detail';
    detailText.textContent = details.join(' · ') || 'Chưa bổ sung';
    const status = document.createElement('small');
    status.className = `status-pill${student.status === 'paused' ? ' status-paused' : ''}`;
    status.textContent = student.status === 'paused' ? 'Nghỉ học' : 'Đang học';
    profile.append(detailText, status);
    const actions = cell('', 'actions-cell');
    const remove = document.createElement('button');
    remove.className = 'row-action row-action-danger';
    remove.type = 'button';
    remove.textContent = 'Xóa';
    remove.setAttribute('aria-label', `Chuyển ${student.name} vào thùng rác CSR`);
    remove.addEventListener('click', () => onDelete(student.id));
    actions.append(remove);
    row.append(identityCell, cell(student.email, 'email-cell'), profile, actions);
    body.append(row);
  });
  table.append(body);
  region.append(table);
  const footer = document.createElement('div');
  footer.className = 'table-footer';
  footer.textContent = `Hiển thị ${students.length} / ${total} sinh viên`;
  content.append(region, footer);
  return content;
}
