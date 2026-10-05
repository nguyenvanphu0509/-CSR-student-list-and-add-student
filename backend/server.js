// Đọc PORT, kiểm tra cổng hợp lệ, khởi động server trên 127.0.0.1 và báo lỗi khởi động.
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
}

const server = createApp().listen(port, '127.0.0.1');
server.on('listening', () => {
  console.log(`StudentSpace: http://localhost:${port}`);
  console.log('Dừng server bằng Ctrl+C.');
});
server.on('error', (error) => {
  console.error(`Không thể chạy server: ${error.message}`);
  process.exitCode = 1;
});
