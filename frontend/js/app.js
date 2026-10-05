import { getStudents, createStudent } from './api.js';
import { StudentList } from './components/student-list.js';
import { StudentForm } from './components/student-form.js';

const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi');
const messageFor = error => error instanceof TypeError ? 'Không kết nối được server. Vui lòng thử lại.' : error.message;

function validate({ name, email }) {
  const errors = {};
  if (!name) errors.name = 'Vui lòng nhập họ và tên.';
  else if (name.length > 120) errors.name = 'Họ và tên tối đa 120 ký tự.';
  if (!email) errors.email = 'Vui lòng nhập email.';
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Vui lòng nhập email đúng định dạng.';
  return errors;
}

// State owner: component cha gọi API và truyền props/callback xuống hai component con.
export class StudentsApp {
  constructor(root) {
    this.root = root;
    this.state = {
      students: [], form: { name: '', email: '' }, errors: {},
      loading: true, loaded: false, submitting: false, loadError: '', submitError: '', notice: '',
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
    this.loadStudents();
  }

  setState(patch, renderList = true) {
    this.state = { ...this.state, ...patch }; // Tạo object mới, không mutate state cũ.
    this.render(renderList);
  }

  async loadStudents() {
    if (this.state.submitting) return;
    this.setState({ loading: true, loadError: '' });
    try {
      this.setState({ students: await getStudents(), loaded: true, loading: false });
    } catch (error) {
      this.setState({ loading: false, loaded: false, loadError: messageFor(error) });
    }
  }

  async addStudent() {
    if (this.state.submitting || this.state.loading || !this.state.loaded) return;
    const input = { name: this.state.form.name.trim(), email: this.state.form.email.trim() };
    const errors = validate(input);
    this.setState({ form: input, errors, submitError: '', notice: '' }, false);
    if (Object.keys(errors).length) return this.form.focusInvalid(errors);
    this.setState({ submitting: true }, false);
    try {
      const student = await createStudent(input);
      this.setState({
        students: [...this.state.students, student], // Mảng mới kích hoạt render danh sách.
        form: { name: '', email: '' }, errors: {}, submitting: false,
        query: '', sort: 'original', // Dòng mới luôn hiện kể cả khi đang lọc/sắp xếp.
        notice: `Đã thêm ${student.name} vào danh sách.`,
      });
      this.root.querySelector('#student-filters').reset();
      this.form.element.elements.namedItem('name').focus();
    } catch (error) {
      this.setState({ submitting: false, errors: error.errors || {}, submitError: messageFor(error) }, false);
      this.form.focusInvalid(this.state.errors); // Lỗi giữ lại input, cho phép sửa/gửi lại.
    }
  }

  render(renderList = true) {
    const state = this.state;
    this.form.update({ values: state.form, errors: state.errors, submitting: state.submitting,
      ready: state.loaded && !state.loading, error: state.submitError });
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
    content.setAttribute('aria-busy', String(state.loading));
    content.replaceChildren(StudentList({ students, total: state.students.length, loading: state.loading,
      error: state.loadError, filtered: Boolean(needle), onRetry: () => this.loadStudents() }));
    this.root.querySelector('#student-total').textContent = state.loaded ? state.students.length : '—';
    this.root.querySelector('#student-count').textContent = state.loaded ? students.length : '—';
  }
}

const app = new StudentsApp(document.querySelector('#students-app'));
// Chỉ trả bản sao để quan sát state bằng DevTools, không sửa state qua biến global.
window.getStudentState = () => structuredClone(app.state);
