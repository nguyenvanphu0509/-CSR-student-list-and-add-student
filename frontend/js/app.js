import { StudentList } from './components/student-list.js';
import { StudentForm } from './components/student-form.js';

const initialStudents = [
  { id: '001', name: 'Nguyễn Minh An', email: 'minhan@example.com' },
  { id: '002', name: 'Trần Ngọc Linh', email: 'ngoclinh@example.com' },
  { id: '003', name: 'Lê Hoàng Nam', email: 'hoangnam@example.com' },
];

const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi');

function validate({ name, email }) {
  const errors = {};
  if (!name) errors.name = 'Vui lòng nhập họ và tên.';
  else if (name.length > 120) errors.name = 'Họ và tên tối đa 120 ký tự.';
  if (!email) errors.email = 'Vui lòng nhập email.';
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Vui lòng nhập email đúng định dạng.';
  return errors;
}

// State owner: component cha quản lý dữ liệu trong browser và truyền props/callback xuống component con.
export class StudentsApp {
  constructor(root) {
    this.root = root;
    this.state = {
      students: initialStudents.map(student => ({ ...student })),
      form: { name: '', email: '' }, errors: {},
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
    this.render();
  }

  setState(patch, renderList = true) {
    this.state = { ...this.state, ...patch }; // Tạo object mới, không mutate state cũ.
    this.render(renderList);
  }


  addStudent() {
    if (this.state.submitting) return;
    const input = { name: this.state.form.name.trim(), email: this.state.form.email.trim() };
    const errors = validate(input);
    if (this.state.students.some(student => normalize(student.email) === normalize(input.email))) {
      errors.email = 'Email này đã có trong danh sách.';
    }
    this.setState({ form: input, errors, submitError: '', notice: '' }, false);
    if (Object.keys(errors).length) return this.form.focusInvalid(errors);
    this.setState({ submitting: true }, false);
    const nextID = Math.max(0, ...this.state.students.map(student => Number(student.id) || 0)) + 1;
    const student = { id: String(nextID).padStart(3, '0'), ...input };
    this.setState({
      students: [...this.state.students, student],
      form: { name: '', email: '' }, errors: {}, submitting: false,
      query: '', sort: 'original',
      notice: `Đã thêm ${student.name} vào danh sách.`,
    });
    this.root.querySelector('#student-filters').reset();
    this.form.element.elements.namedItem('name').focus();
  }

  render(renderList = true) {
    const state = this.state;
    this.form.update({ values: state.form, errors: state.errors, submitting: state.submitting,
      ready: true, error: state.submitError });
    const notice = this.root.querySelector('#app-notice');
    notice.textContent = state.notice;
    notice.hidden = !state.notice;
    if (!renderList) return;
    const needle = normalize(state.query.trim());
    const students = state.students.filter(student => !needle
      || normalize(student.name).includes(needle) || normalize(student.email).includes(needle));
    if (state.sort !== 'original') {
      students.sort((a, b) => (state.sort === 'name-desc' ? -1 : 1) * a.name.localeCompare(b.name, 'vi'));
    }
    const content = this.root.querySelector('#student-list-content');
    content.setAttribute('aria-busy', 'false');
    content.replaceChildren(StudentList({ students, total: state.students.length, filtered: Boolean(needle) }));
    this.root.querySelector('#student-total').textContent = state.students.length;
    this.root.querySelector('#student-count').textContent = students.length;
  }
}

const app = new StudentsApp(document.querySelector('#students-app'));
// Chỉ trả bản sao để quan sát state bằng DevTools, không sửa state qua biến global.
window.getStudentState = () => structuredClone(app.state);
