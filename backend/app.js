// Tạo Express app, chọn view engine EJS và thư mục views, cấu hình middleware đọc form
// và phục vụ CSS tĩnh, gắn router, trang 404 và xử lý lỗi.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createStudentStore } from './repositories/student-store.js';
import { createStudentRouter } from './routes/students.js';
import { createStudentController } from './controllers/students.js';
import { createStudentsAPI } from './routes/students-api.js';

const root = new URL('./', import.meta.url);
const frontend = new URL('../frontend/', import.meta.url);

// Tách app khỏi listen() để kiểm thử bằng server và dữ liệu tạm.
export function createApp({
  dataFile = fileURLToPath(new URL('data/students.json', root)),
  logger = console,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('views/', root)));
  app.use('/api', (req, _res, next) => {
    req.headers.accept = 'application/json';
    next();
  });
  app.use('/assets', express.static(fileURLToPath(frontend), { maxAge: 0 }));
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.formatStudentId = (id) => `SV${String(id).padStart(3, '0')}`;
    res.locals.formatTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }) : 'Chưa có thông tin';
    res.locals.formatDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : (value || 'Chưa cập nhật');
    next();
  });
  const store = createStudentStore(dataFile);
  const controller = createStudentController(store);
  app.get('/', (_req, res) => res.render('welcome'));
  // HTML khung không chứa dữ liệu Student. Browser fetch JSON rồi tự dựng UI.
  app.get('/csr', (_req, res) => res.sendFile(fileURLToPath(new URL('index.html', frontend))));
  app.use('/api/students', createStudentsAPI(store));
  app.use('/students', createStudentRouter(store));
  app.get('/trash', controller.trash);
  app.get('/activity', controller.activity);

  app.use((req, res) => {
    if (req.get('accept')?.includes('application/json')) {
      return res.status(404).json({ message: 'Không tìm thấy thao tác hoặc sinh viên này.' });
    }
    res.status(404).render('error', {
      title: 'Không tìm thấy trang',
      message: 'Địa chỉ bạn truy cập không tồn tại.',
      status: 404,
    });
  });
  app.use((error, req, res, _next) => {
    logger.error(error);
    const status = [400, 404, 413].includes(error.status) ? error.status : 500;
    const message = status === 500
      ? 'Không thể đọc hoặc lưu dữ liệu sinh viên. Vui lòng kiểm tra file JSON và quyền ghi rồi thử lại.'
      : status === 404 ? 'Sinh viên này không tồn tại hoặc đã được xóa. Vui lòng trở lại danh sách.'
      : 'Dữ liệu gửi lên không hợp lệ hoặc vượt quá kích thước cho phép.';
    if (req.get('accept')?.includes('application/json')) return res.status(status).json({ message });
    res.status(status).render('error', { title: 'Không thể xử lý yêu cầu', message, status });
  });
  return app;
}
