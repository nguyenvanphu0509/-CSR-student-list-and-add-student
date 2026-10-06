import { StudentList } from './components/student-list.js';
import { StudentForm } from './components/student-form.js';

const initialStudents = [
  { id: '24127152', name: 'Nguyễn Văn Tiến Đạt', email: 'tiendat@example.com' },
  { id: '24127489', name: 'Nguyễn Văn Phú', email: 'vanphu@example.com' },
  { id: '24127353', name: 'Nguyễn Vũ Duy', email: 'vuduy@example.com' },
].map(student => ({
  studentCode: `SV${student.id}`, phone: '', dob: '', className: '', status: 'studying', ...student,
}));

const emptyForm = () => ({ name: '', email: '', phone: '', dob: '', className: '', status: 'studying' });
const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi');

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validate({ name, email, phone, dob, className, status }) {
  const errors = {};
  if (!name) errors.name = 'Vui lòng nhập họ và tên.';
  else if (name.length > 120) errors.name = 'Họ và tên tối đa 120 ký tự.';
  if (!email) errors.email = 'Vui lòng nhập email.';
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Vui lòng nhập email đúng định dạng.';
  if (phone.length > 254) errors.phone = 'Số điện thoại tối đa 254 ký tự.';
  if (dob && !isValidDate(dob)) errors.dob = 'Ngày sinh không hợp lệ.';
  if (className.length > 254) errors.className = 'Lớp học tối đa 254 ký tự.';
  if (!['studying', 'paused'].includes(status)) errors.status = 'Trạng thái học tập không hợp lệ.';
  return errors;
}

// State owner: component cha quản lý dữ liệu trong browser và truyền props/callback xuống component con.
export class StudentsApp {
  constructor(root) {
    this.root = root;
    this.state = {
      students: initialStudents.map(student => ({ ...student })),
      trash: [], activity: [], view: this.viewFromHash(),
      form: emptyForm(), errors: {},
      submitting: false, submitError: '', notice: '',
      query: '', sort: 'original',
    };
    this.form = StudentForm({
      onInput: (key, value) => {
        const errors = { ...this.state.errors };
        delete errors[key];
        this.setState({ form: { ...this.state.form, [key]: value }, errors, submitError: '', notice: '' }, false);
      },
      onSubmit: () => this.addStudent(),
    });
    root.querySelector('#student-form-content').append(this.form.element);
    const filters = root.querySelector('#student-filters');
    filters.addEventListener('submit', event => event.preventDefault());
    filters.addEventListener('input', () => this.setState({ query: filters.elements.q.value, sort: filters.elements.sort.value }));
    filters.addEventListener('change', () => this.setState({ query: filters.elements.q.value, sort: filters.elements.sort.value }));
    filters.addEventListener('reset', () => this.setState({ query: '', sort: 'original' }));
    window.addEventListener('hashchange', () => this.setState({ view: this.viewFromHash() }));
    this.render();
  }

  viewFromHash() {
    if (window.location.hash === '#trash') return 'trash';
    if (window.location.hash === '#activity') return 'activity';
    return 'students';
  }

  setState(patch, renderList = true) {
    this.state = { ...this.state, ...patch }; // Tạo object mới, không mutate state cũ.
    this.render(renderList);
  }


  addStudent() {
    if (this.state.submitting) return;
    const input = {
      ...this.state.form,
      name: this.state.form.name.trim(),
      email: this.state.form.email.trim(),
      phone: this.state.form.phone.trim(),
      dob: this.state.form.dob.trim(),
      className: this.state.form.className.trim(),
    };
    const errors = validate(input);
    if (this.state.students.some(student => normalize(student.email) === normalize(input.email))) {
      errors.email = 'Email này đã có trong danh sách.';
    }
    this.setState({ form: input, errors, submitError: '', notice: '' }, false);
    if (Object.keys(errors).length) return this.form.focusInvalid(errors);
    this.setState({ submitting: true }, false);
    const nextID = Math.max(0, ...this.state.students.map(student => Number(student.id) || 0)) + 1;
    const id = String(nextID).padStart(3, '0');
    const student = { id, studentCode: `SV${id}`, ...input };
    const event = { id: `${Date.now()}-${this.state.activity.length}`, action: 'created', at: new Date().toISOString(), name: student.name, studentId: student.id };
    this.setState({
      students: [...this.state.students, student],
      activity: [event, ...this.state.activity],
      form: emptyForm(), errors: {}, submitting: false,
      query: '', sort: 'original',
      notice: `Đã thêm ${student.name} vào danh sách.`,
    });
    this.root.querySelector('#student-filters').reset();
    this.form.element.elements.namedItem('name').focus();
  }

  moveToTrash(id) {
    const student = this.state.students.find(item => item.id === id);
    if (!student) return;
    const deletedAt = new Date().toISOString();
    const event = { id: `${Date.now()}-${this.state.activity.length}`, action: 'deleted', at: deletedAt, name: student.name, studentId: student.id };
    this.setState({
      students: this.state.students.filter(item => item.id !== id),
      trash: [{ ...student, deletedAt }, ...this.state.trash],
      activity: [event, ...this.state.activity],
      notice: `Đã chuyển ${student.name} vào thùng rác CSR.`,
    });
  }

  restoreStudent(id) {
    const student = this.state.trash.find(item => item.id === id);
    if (!student) return;
    const { deletedAt, ...restoredStudent } = student;
    const event = { id: `${Date.now()}-${this.state.activity.length}`, action: 'restored', at: new Date().toISOString(), name: student.name, studentId: student.id };
    this.setState({
      students: [...this.state.students, restoredStudent],
      trash: this.state.trash.filter(item => item.id !== id),
      activity: [event, ...this.state.activity],
      notice: `Đã khôi phục ${student.name} vào danh sách CSR.`,
    });
  }

  renderTrash() {
    const content = this.root.querySelector('#trash-content');
    this.root.querySelector('#trash-count').textContent = this.state.trash.length;
    if (!this.state.trash.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<span class="empty-icon" aria-hidden="true">↺</span><h3>Thùng rác đang trống</h3><p>Các sinh viên được chuyển khỏi danh sách CSR sẽ xuất hiện tại đây.</p>';
      content.replaceChildren(empty);
      return;
    }
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>ID</th><th>SINH VIÊN</th><th>CHUYỂN VÀO THÙNG RÁC</th><th>THAO TÁC</th></tr></thead>';
    const body = document.createElement('tbody');
    this.state.trash.forEach(student => {
      const row = document.createElement('tr');
      const identity = document.createElement('td');
      const name = document.createElement('strong');
      name.textContent = student.name;
      const email = document.createElement('p');
      email.className = 'muted';
      email.textContent = student.email;
      identity.append(name, email);
      row.append(
        this.tableCell(student.studentCode || `SV${student.id}`),
        identity,
        this.tableCell(new Date(student.deletedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })),
      );
      const actions = this.tableCell('');
      const restore = document.createElement('button');
      restore.className = 'button button-primary';
      restore.type = 'button';
      restore.textContent = '↺ Khôi phục';
      restore.setAttribute('aria-label', `Khôi phục ${student.name}`);
      restore.addEventListener('click', () => this.restoreStudent(student.id));
      actions.append(restore);
      row.append(actions);
      body.append(row);
    });
    table.append(body);
    const scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    scroll.append(table);
    content.replaceChildren(scroll);
  }

  renderActivity() {
    const content = this.root.querySelector('#activity-content');
    this.root.querySelector('#activity-count').textContent = this.state.activity.length;
    if (!this.state.activity.length) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.innerHTML = '<span aria-hidden="true">↺</span><p>Chưa có thay đổi nào được ghi nhận.</p>';
      content.replaceChildren(empty);
      return;
    }
    const labels = { created: 'Thêm hồ sơ', deleted: 'Chuyển vào thùng rác', restored: 'Khôi phục hồ sơ' };
    const list = document.createElement('ol');
    list.className = 'activity-list';
    this.state.activity.forEach(event => {
      const item = document.createElement('li');
      const marker = document.createElement('span');
      marker.className = `activity-dot activity-${event.action}`;
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = event.action === 'created' ? '+' : event.action === 'restored' ? '↺' : '−';
      const description = document.createElement('div');
      description.className = 'activity-description';
      const label = document.createElement('strong');
      label.textContent = labels[event.action];
      const detail = document.createElement('p');
      detail.textContent = `${event.name} · SV${event.studentId}`;
      description.append(label, detail);
      const time = document.createElement('time');
      time.dateTime = event.at;
      time.textContent = new Date(event.at).toLocaleString('vi-VN');
      item.append(marker, description, time);
      list.append(item);
    });
    content.replaceChildren(list);
  }

  tableCell(value) {
    const cell = document.createElement('td');
    cell.textContent = value;
    return cell;
  }

  render(renderList = true) {
    const state = this.state;
    this.form.update({ values: state.form, errors: state.errors, submitting: state.submitting,
      ready: true, error: state.submitError });
    const notice = this.root.querySelector('#app-notice');
    notice.textContent = state.notice;
    notice.hidden = !state.notice;
    for (const view of ['students', 'trash', 'activity']) {
      this.root.querySelector(`[data-csr-view="${view}"]`).hidden = state.view !== view;
    }
    this.root.querySelectorAll('[data-csr-nav]').forEach(link => {
      if (link.dataset.csrNav === state.view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (!renderList) return;
    const needle = normalize(state.query.trim());
    const students = state.students.filter(student => !needle
      || [student.name, student.email, student.studentCode, student.phone, student.dob, student.className, student.status]
        .some(value => normalize(value || '').includes(needle)));
    if (state.sort !== 'original') {
      students.sort((a, b) => (state.sort === 'name-desc' ? -1 : 1) * a.name.localeCompare(b.name, 'vi'));
    }
    const content = this.root.querySelector('#student-list-content');
    content.setAttribute('aria-busy', 'false');
    content.replaceChildren(StudentList({
      students, total: state.students.length, filtered: Boolean(needle),
      onDelete: id => this.moveToTrash(id),
    }));
    this.root.querySelector('#student-total').textContent = state.students.length;
    this.root.querySelector('#student-count').textContent = students.length;
    this.renderTrash();
    this.renderActivity();
  }
}

const app = new StudentsApp(document.querySelector('#students-app'));
// Chỉ trả bản sao để quan sát state bằng DevTools, không sửa state qua biến global.
window.getStudentState = () => structuredClone(app.state);
