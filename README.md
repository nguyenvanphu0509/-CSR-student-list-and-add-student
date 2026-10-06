# StudentSpace · Vanilla JavaScript + Express

Bài tập **Browser tự tạo và cập nhật UI**: Student List CSR có state, component và form thêm sinh viên không reload. CSR dùng seed data và cập nhật state ngay trong browser, không gọi API hay database. Frontend dùng HTML, CSS, JavaScript thuần; Node.js + Express phục vụ trang và giữ các chức năng SSR/API riêng.

Project tách thành hai thư mục rõ ràng: `frontend/` chứa code chạy trong browser; `backend/` chứa Express, API, dữ liệu JSON và template SSR. Một `package.json` ở gốc quản lý lệnh chạy và dependencies. Frontend thuần không cần cài package riêng: Express phục vụ các file frontend và API trên cùng cổng.

## Chạy project

Yêu cầu Node.js 24 trở lên.

```sh
npm ci
npm run dev
# Hoặc: npm start
```

- `http://localhost:3000/`: trang chào mừng, nút vào bản CSR.
- `http://localhost:3000/csr`: Student List dùng seed data và state trong browser.
- `http://localhost:3000/students`: Student List SSR để so sánh.
- `http://localhost:3000/api/students`: endpoint JSON riêng của backend.

Nếu cổng bận: `PORT=3001 npm run dev`. Server lắng nghe trên `127.0.0.1`. Không mở `frontend/index.html` bằng `file://`: ES modules cần được phục vụ qua HTTP server.

## Đáp ứng bài tập

| Yêu cầu | Cách triển khai |
| --- | --- |
| Browser tự tạo UI | HTML khung ở `frontend/index.html`; StudentList dựng DOM từ state cục bộ |
| State | StudentsApp.state: seed students, form, errors, submitting, query, sort |
| Component và props | StudentsApp truyền dữ liệu/callback xuống StudentList và StudentForm |
| Input có kiểm soát | Event input cập nhật state.form; StudentForm.update() đồng bộ state → input |
| Thêm không reload | preventDefault() → validate → tạo student trong browser → cập nhật state và render |
| Dòng mới hiện ngay | Thêm vào state, reset bộ lọc/form; không gửi request mạng |
| Quan sát state | DevTools Console: getStudentState() trả bản sao state |
| SSR vs CSR | /students trả HTML có sẵn dữ liệu; /csr dựng danh sách từ seed trong state browser |

Luồng dữ liệu một chiều:

```text
StudentsApp (state owner)
├── StudentList({ students, total, filtered })
└── StudentForm({ onInput, onSubmit })
    └── update({ values, errors, submitting, ready, error })

Input → callback onInput → state.form mới → cập nhật input/thông báo
Submit → preventDefault → validate → tạo student trong browser
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
    ├── api.js                         API helper riêng, CSR không import
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

`GET /csr` phục vụ `frontend/index.html`. Các asset ở `/assets/css/` và `/assets/js/` được Express phục vụ từ `frontend/`. CSR không gọi `/api/students`; thao tác thêm chỉ cập nhật state trong browser. Thư mục `backend/` và dữ liệu JSON không được phục vụ như file tĩnh.

## API

API luôn trả JSON, cả lỗi; các endpoint này thuộc backend/API riêng, không được gọi từ luồng CSR.

| Method | Route | Kết quả |
| --- | --- | --- |
| GET | /api/students | 200 `{ students: [...] }`, không gồm hồ sơ xóa mềm |
| POST | /api/students | 201 `{ student, message }`, không redirect |
| GET | /api/students/:id | 200 `{ student }` |
| PUT | /api/students/:id | 200 `{ student, message }`, yêu cầu name/email |
| DELETE | /api/students/:id | 200 `{ id, message }`, xóa mềm |

POST gửi `Content-Type: application/json`, body `{ "name": "Nguyễn Minh An", "email": "an@example.com" }`. Backend tự cấp ID 001–999. Tên/email được trim; tên bắt buộc và tối đa 120 ký tự; email phải đúng định dạng và tối đa 254 ký tự. Email duy nhất không phân biệt hoa/thường, kể cả hồ sơ trong thùng rác.

Validation/email trùng trả **422** `{ errors, message }`; JSON request hỏng trả **400**; ID không tồn tại **404**; body quá 10 KB **413**; lỗi đọc/ghi JSON **500**. CSR validate ở browser và kiểm tra email trùng trong state cục bộ.

Tên/email hiển thị qua `textContent`; `innerHTML` trong component chỉ chứa markup tĩnh. State được thay bằng object/mảng mới; email trùng trong seed hiện tại bị chặn ngay ở browser.

## Dữ liệu và các chức năng đã có

CSR dùng seed data giả lập trong `frontend/js/app.js`; dữ liệu thêm chỉ tồn tại trong state và trở về seed ban đầu khi reload. SSR và API riêng vẫn dùng `backend/data/students.json`; các field hồ sơ phụ và lịch sử hiện có được giữ nguyên. JSON được ghi qua file tạm rồi rename, hàng đợi tuần tự hóa ghi trong một tiến trình.

Form CSR tập trung vào name và email theo bài học. Tìm kiếm và sắp xếp chạy từ state trong browser. Các chức năng sửa, xóa mềm, khôi phục, lịch sử và phân trang SSR vẫn có ở các trang cũ. Chuyển giữa trang CSR/SSR là điều hướng thông thường; tiêu chí không reload áp dụng cho submit Add Student trên CSR.

## Kiểm tra

```sh
npm test
```

Tests dùng JSON trong thư mục tạm, không ghi vào dữ liệu thật. Bao gồm SSR/CRUD và API JSON, cùng mô phỏng DOM CSR: seed ban đầu, input → state, submit không điều hướng hay gọi mạng, dòng mới, ID kế tiếp, reset form/bộ lọc, email trùng và hiển thị dữ liệu có ký tự HTML an toàn.

Xem [hướng dẫn demo](docs/README.md) để ghi hình thao tác, chụp Network và giải thích state owner.
