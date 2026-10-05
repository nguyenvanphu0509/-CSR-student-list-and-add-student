// Đọc input, trim và validate, lấy danh sách, truyền dữ liệu sang template
// và chuyển hướng sau khi lưu thành công.
import { DuplicateEmailError, StudentCapacityError } from '../repositories/student-store.js';

function readForm(body) {
  const form = {
    name: typeof body?.name === 'string' ? body.name.trim() : '',
    email: typeof body?.email === 'string' ? body.email.trim() : '',
  };
  // Hồ sơ phụ là tùy chọn. Chỉ lấy field được gửi để sửa tên inline không xóa hồ sơ.
  for (const key of ['studentCode', 'phone', 'dob', 'className', 'status']) {
    if (body && Object.hasOwn(body, key)) form[key] = typeof body[key] === 'string' ? body[key].trim().slice(0, 254) : '';
  }
  if (form.status !== undefined) form.status = form.status === 'paused' ? 'paused' : 'studying';
  return form;
}

function validate(form) {
  const errors = {};
  if (!form.name) errors.name = 'Vui lòng nhập họ và tên.';
  else if (form.name.length > 120) errors.name = 'Họ và tên tối đa 120 ký tự.';
  if (!form.email) errors.email = 'Vui lòng nhập email.';
  else if (form.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Vui lòng nhập email đúng định dạng, ví dụ an@example.com.';
  }
  return errors;
}

const wantsJSON = (req) => req.get('accept')?.includes('application/json');

// Query string điều khiển SSR: lọc trước, sắp xếp rồi mới chia trang.
const sortOptions = new Set(['original', 'name-asc', 'name-desc', 'email-asc', 'email-desc']);
const normalizeSearch = (value) => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi');
function readListQuery(query = {}) {
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 254) : '';
  const sort = sortOptions.has(query.sort) ? query.sort : 'original';
  const page = typeof query.page === 'string' && /^[1-9]\d*$/.test(query.page)
    && Number.isSafeInteger(Number(query.page)) ? Number(query.page) : 1;
  return { q, sort, page };
}
function listURL({ q, sort, page }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (sort !== 'original') params.set('sort', sort);
  if (page > 1) params.set('page', String(page));
  return `/students${params.size ? `?${params}` : ''}`;
}

export function createStudentController(store) {
  async function renderPage(res, { status = 200, form = { name: '', email: '' }, errors = {}, success = false, query = {} } = {}) {
    const allStudents = await store.list();
    const filters = readListQuery(query);
    const needle = normalizeSearch(filters.q);
    const matches = allStudents.filter((student) => !needle
      || normalizeSearch(student.name).includes(needle) || normalizeSearch(student.email).includes(needle));
    if (filters.sort !== 'original') {
      const [field, direction] = filters.sort.split('-');
      matches.sort((a, b) => (direction === 'desc' ? -1 : 1)
        * a[field].localeCompare(b[field], 'vi', { sensitivity: 'base', numeric: true }));
    }
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
    filters.page = Math.min(filters.page, pageCount);
    const offset = (filters.page - 1) * pageSize;
    const students = matches.slice(offset, offset + pageSize);
    const pagination = { page: filters.page, pageCount, offset, matched: matches.length };
    const pageURL = (page) => `${listURL({ ...filters, page })}#student-list`;
    const detailURL = (id) => {
      const queryString = listURL(filters).split('?')[1];
      return `/students/${encodeURIComponent(id)}${queryString ? `?${queryString}` : ''}`;
    };
    return res.status(status).render('students', {
      students, total: allStudents.length, form, errors, success, filters, pagination, pageURL, detailURL,
    });
  }

  return {
    async apiIndex(_req, res) {
      res.set('Cache-Control', 'no-store');
      return res.json({ students: await store.list() });
    },
    async apiShow(req, res) {
      res.set('Cache-Control', 'no-store');
      return res.json({ student: await store.find(req.params.id) });
    },
    async index(req, res) {
      const success = req.query.created === '1' ? 'Đã thêm sinh viên thành công.'
        : req.query.updated === '1' ? 'Đã cập nhật thông tin sinh viên.'
        : req.query.deleted === '1' ? 'Đã chuyển sinh viên vào thùng rác.'
        : req.query.restored === '1' ? 'Đã khôi phục sinh viên.' : false;
      return renderPage(res, { success, query: req.query });
    },
    async create(req, res) {
      const form = readForm(req.body);
      const errors = validate(form);
      if (Object.keys(errors).length) {
        if (wantsJSON(req)) return res.status(422).json({ errors, message: 'Vui lòng kiểm tra thông tin sinh viên.' });
        return renderPage(res, { status: 422, form, errors });
      }

      try {
        const student = await store.add(form);
        if (wantsJSON(req)) return res.status(201).json({ student, message: 'Đã thêm sinh viên thành công.' });
      } catch (error) {
        if (error instanceof StudentCapacityError) {
          if (wantsJSON(req)) return res.status(400).json({ message: error.message });
          return res.status(400).render('error', { title: 'Không thể cấp ID', message: error.message, status: 400 });
        }
        if (error instanceof DuplicateEmailError) {
          if (wantsJSON(req)) return res.status(422).json({ errors: { email: error.message }, message: error.message });
          return renderPage(res, { status: 422, form, errors: { email: error.message } });
        }
        throw error;
      }
      // Post/Redirect/Get: refresh trang kết quả không submit lại form.
      return res.redirect(303, '/students?created=1');
    },
    async edit(req, res) {
      const student = await store.find(req.params.id);
      return res.render('manage-student', { student, form: student, errors: {}, mode: 'edit' });
    },
    async show(req, res) {
      const student = await store.find(req.params.id);
      return res.render('student-detail', { student, backURL: `${listURL(readListQuery(req.query))}#student-list` });
    },
    async confirmDelete(req, res) {
      const student = await store.find(req.params.id);
      return res.render('manage-student', { student, form: student, errors: {}, mode: 'delete' });
    },
    async update(req, res) {
      const student = await store.find(req.params.id);
      const form = readForm(req.body);
      const errors = validate(form);
      if (Object.keys(errors).length) {
        if (wantsJSON(req)) return res.status(422).json({ errors, message: 'Vui lòng kiểm tra thông tin sinh viên.' });
        return res.status(422).render('manage-student', { student, form, errors, mode: 'edit' });
      }
      try {
        const updated = await store.update(req.params.id, form);
        if (wantsJSON(req)) return res.json({ student: updated, message: 'Đã lưu tên sinh viên.' });
      } catch (error) {
        if (error instanceof DuplicateEmailError) {
          if (wantsJSON(req)) return res.status(422).json({ errors: { email: error.message }, message: error.message });
          return res.status(422).render('manage-student', { student, form, errors: { email: error.message }, mode: 'edit' });
        }
        throw error;
      }
      return res.redirect(303, '/students?updated=1');
    },
    async remove(req, res) {
      await store.remove(req.params.id);
      if (wantsJSON(req)) return res.json({ id: req.params.id, message: 'Đã chuyển sinh viên vào thùng rác.' });
      return res.redirect(303, '/students?deleted=1');
    },
    async trash(_req, res) {
      return res.render('trash', { students: await store.trash() });
    },
    async restore(req, res) {
      await store.restore(req.params.id);
      return res.redirect(303, '/students?restored=1');
    },
    async activity(_req, res) {
      return res.render('activity', { events: await store.activity() });
    },
  };
}
