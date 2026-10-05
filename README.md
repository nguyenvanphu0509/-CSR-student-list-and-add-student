# StudentSpace · Vanilla JavaScript + Express

Bài tập **Browser tự tạo và cập nhật UI**: Student List CSR có state, component và form thêm sinh viên không reload. Frontend dùng HTML, CSS, JavaScript thuần; backend dùng Node.js + Express; dữ liệu lưu JSON.

Project tách thành hai thư mục rõ ràng: `frontend/` chứa code chạy trong browser; `backend/` chứa Express, API, dữ liệu JSON và template SSR. Một `package.json` ở gốc quản lý lệnh chạy và dependencies. Frontend thuần không cần cài package riêng: Express phục vụ các file frontend và API trên cùng cổng.

## Chạy project

Yêu cầu Node.js 24 trở lên.

```sh
npm ci
npm run dev
# Hoặc: npm start
```

- `http://localhost:3000/`: trang chào mừng, nút vào bản CSR.
- `http://localhost:3000/csr`: Student List + Add Student bằng JavaScript thuần.
- `http://localhost:3000/students`: Student List SSR để so sánh.
- `http://localhost:3000/api/students`: danh sách JSON dùng chung.

Nếu cổng bận: `PORT=3001 npm run dev`. Server lắng nghe trên `127.0.0.1`. Không mở `frontend/index.html` bằng `file://`: ES modules và API cần được phục vụ qua Express. Frontend và API cùng origin nên không cần CORS.

## Đáp ứng bài tập

| Yêu cầu | Cách triển khai |
| --- | --- |
| Browser tự tạo UI | HTML khung ở `frontend/index.html`; StudentList dựng DOM sau GET JSON |
| State | StudentsApp.state: students, form, errors, loading, submitting, query, sort |
| Component và props | StudentsApp truyền dữ liệu/callback xuống StudentList và StudentForm |
| Input có kiểm soát | Event input cập nhật state.form; StudentForm.update() đồng bộ state → input |
| Thêm không reload | preventDefault() → fetch POST → mảng students mới → render vùng danh sách |
| Dòng mới hiện ngay | Sau thành công reset bộ lọc/sắp xếp để dòng mới luôn hiện |
| Quan sát state | DevTools Console: getStudentState() trả bản sao state |
| SSR vs CSR | /students trả HTML có sẵn dữ liệu; /csr lấy JSON để dựng danh sách |

Luồng dữ liệu một chiều:

```text
StudentsApp (state owner)
├── StudentList({ students, loading, error, onRetry })
└── StudentForm({ onInput, onSubmit })
    └── update({ values, errors, submitting, ready, error })

Input → callback onInput → state.form mới → cập nhật input/thông báo
Submit → preventDefault → validate → POST /api/students
       → Express lưu JSON → response 201 { student }
       → state.students = [...state.students, student]
       → render danh sách + số lượng → reset form
```

Component ở đây là hàm/class JavaScript có trách nhiệm rõ ràng. `setState()` là phương thức do project định nghĩa, không dùng React. Khi gõ chỉ cập nhật form; không dựng lại danh sách hay thay cả form, giúp giữ focus và vị trí con trỏ.

## Cấu trúc

```text
frontend/
├── index.html                         HTML khung cho CSR
├── css/styles.css                     CSS dùng chung, responsive
└── js/
    ├── app.js                         StudentsApp, state, event, render
    ├── api.js                         GET/POST JSON bằng fetch
    ├── components/
    │   ├── student-list.js            Component danh sách nhận props
    │   └── student-form.js            Component form có input kiểm soát
    └── ssr/                           JS bổ sung cho các trang SSR cũ
backend/
├── server.js                          Khởi động Express
├── app.js                             Middleware, static frontend, route SSR/API
├── routes/
│   ├── students-api.js                API JSON
│   └── students.js                    Routes SSR cũ
├── controllers/students.js            Validation, JSON response, render SSR
├── repositories/student-store.js      ID, email unique, lưu JSON tuần tự
├── data/students.json                 Hồ sơ và lịch sử hiện có
└── views/                             EJS chỉ dành cho SSR và hồ sơ
package.json                           Lệnh chạy và dependencies chung
test/                                  API, DOM CSR, SSR và validation tests
docs/README.md                         Hướng dẫn demo và bằng chứng nộp bài
```

`GET /csr` phục vụ `frontend/index.html`. Các asset ở `/assets/css/` và `/assets/js/` được Express phục vụ từ `frontend/`. Browser import các component, gọi `/api/students` và cập nhật DOM. Thư mục `backend/` và dữ liệu JSON không được phục vụ như file tĩnh.

## API

API luôn trả JSON, cả lỗi. Frontend dùng hai endpoint đầu tiên.

| Method | Route | Kết quả |
| --- | --- | --- |
| GET | /api/students | 200 `{ students: [...] }`, không gồm hồ sơ xóa mềm |
| POST | /api/students | 201 `{ student, message }`, không redirect |
| GET | /api/students/:id | 200 `{ student }` |
| PUT | /api/students/:id | 200 `{ student, message }`, yêu cầu name/email |
| DELETE | /api/students/:id | 200 `{ id, message }`, xóa mềm |

POST gửi `Content-Type: application/json`, body `{ "name": "Nguyễn Minh An", "email": "an@example.com" }`. Backend tự cấp ID 001–999. Tên/email được trim; tên bắt buộc và tối đa 120 ký tự; email phải đúng định dạng và tối đa 254 ký tự. Email duy nhất không phân biệt hoa/thường, kể cả hồ sơ trong thùng rác.

Validation/email trùng trả **422** `{ errors, message }`; JSON request hỏng trả **400**; ID không tồn tại **404**; body quá 10 KB **413**; lỗi đọc/ghi JSON **500**. Client cũng validate trước khi gọi API. Lỗi giữ nguyên input và danh sách, mở lại nút để thử lại. Lỗi tải danh sách có nút Thử lại; nút thêm bị khóa khi chưa tải dữ liệu hoặc đang lưu.

Tên/email hiển thị qua `textContent`; `innerHTML` trong component chỉ chứa markup tĩnh. State được thay bằng object/mảng mới. Input bị khóa trong lúc POST để tránh gửi liên tiếp.

## Dữ liệu và các chức năng đã có

CSR và SSR dùng chung repository và backend/data/students.json. Refresh hoặc restart server vẫn giữ sinh viên đã lưu. Các field hồ sơ phụ và lịch sử hiện có được giữ nguyên. JSON được ghi qua file tạm rồi rename, hàng đợi tuần tự hóa ghi trong một tiến trình.

Form CSR tập trung vào name và email theo bài học. Tìm kiếm và sắp xếp chạy từ state trong browser. Liên kết Chi tiết mở hồ sơ SSR; sửa, xóa mềm, khôi phục, lịch sử và phân trang SSR vẫn có ở các trang cũ. Chuyển giữa trang CSR/SSR là điều hướng thông thường; tiêu chí không reload áp dụng cho submit Add Student trên CSR.

## Kiểm tra

```sh
npm test
```

Tests dùng JSON trong thư mục tạm, không ghi vào dữ liệu thật. Bao gồm SSR/CRUD cũ, API JSON và mô phỏng DOM CSR: input → state, submit không điều hướng, không fetch HTML, dòng mới, số lượng, reset form, lỗi mạng, tải lại, email trùng, submit liên tiếp và hiển thị dữ liệu có ký tự HTML an toàn.

Xem [hướng dẫn demo](docs/README.md) để ghi hình thao tác, chụp Network và giải thích state owner.
