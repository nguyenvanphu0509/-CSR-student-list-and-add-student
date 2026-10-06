// Component chỉ nhận props, không sở hữu state hay gọi API.
// textContent bảo đảm tên/email được hiển thị như văn bản, không thực thi HTML.
function cell(value, className = '') {
  const node = document.createElement('td');
  node.className = className;
  node.textContent = value;
  return node;
}

export function StudentList({ students, total, filtered }) {
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
  table.innerHTML = '<caption class="sr-only">Danh sách sinh viên gồm số thứ tự, họ tên và email.</caption><thead><tr><th scope="col" class="number-cell">STT</th><th scope="col">SINH VIÊN</th><th scope="col">EMAIL</th></tr></thead>';
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
    code.textContent = `SV${student.id}${student.className ? ` · ${student.className}` : ''}`;
    name.append(code);
    identity.append(avatar, name);
    identityCell.append(identity);
    row.append(identityCell, cell(student.email, 'email-cell'));
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
