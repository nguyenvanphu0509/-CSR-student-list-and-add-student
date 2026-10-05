# Demo bài Browser tự tạo và cập nhật UI

Chạy `npm run dev`, mở `http://localhost:3000/csr`.

## Demo khoảng 10 phút

1. Mở DevTools → Network, bật Preserve log. Reload trang để thấy Document khung, các JavaScript module và GET /api/students dạng Fetch/XHR, response là JSON.
2. Console chạy `getStudentState()`. StudentsApp là state owner, gồm danh sách và giá trị input. Gõ họ tên/email, chạy lại để thấy form thay đổi.
3. Xóa log Network rồi thêm sinh viên với email chưa sử dụng. Có một POST /api/students, response 201. Dòng mới hiện, tổng số tăng, form reset. Không có Document mới hoặc redirect. Không phát sinh GET HTML để thay danh sách.
4. Gửi lại email đã có: 422, thông báo tại email, form giữ nguyên input, số lượng không tăng. Tắt mạng trong DevTools rồi submit dữ liệu khác để xem lỗi và thử lại.
5. Reload trang và kiểm tra sinh viên mới vẫn còn vì Express lưu JSON. Tìm theo tên không dấu và sắp xếp để thấy browser render từ state.
6. Mở /students và View Page Source: có sẵn tên/email trong HTML. Form thêm ở đây POST → 303 → GET, khác CSR. View Page Source /csr chỉ có khung và script, chưa có tên/email từ dữ liệu.
7. Tắt JavaScript rồi reload /students: vẫn có danh sách và form thêm. Với /csr, thông báo cần JavaScript và liên kết bản SSR xuất hiện. Bật lại JavaScript khi kết thúc.

## Giải thích code

- frontend/js/app.js: StudentsApp, setState, addStudent, render. State được thay bằng object/mảng mới.
- frontend/js/components/student-list.js: nhận props rồi dựng DOM; không gọi API và không giữ state riêng.
- frontend/js/components/student-form.js: mount một lần, nhận callbacks; input gửi giá trị về cha; update() nhận props mới; submit gọi preventDefault().
- frontend/js/api.js: fetch JSON, truyền lỗi field về component cha.
- backend/routes/students-api.js: Express routes; controller validate và repository ghi JSON.

Frontend nằm trong `frontend/`, backend nằm trong `backend/`. Chạy `npm run dev` từ gốc để Express phục vụ cả frontend và API trên cổng 3000. JavaScript frontend chạy trong browser; code backend chạy trong Node.js.

```text
Browser input / submit event
           ↓
StudentForm → StudentsApp (state owner)
                   ↓ POST JSON
              Express → JSON repository
                   ↓ student đã cấp ID
              state.students mới
                   ↓ props
               StudentList → DOM
```

Trong Vanilla JS, setState() không tự động có sẵn. Project chủ động viết phương thức này để thay state rồi gọi render. Props là tham số object; callback là hàm do cha truyền xuống. Đây là cách thể hiện các khái niệm của slide mà không cần React.

## Bằng chứng nộp bài

- Sơ đồ component và state owner như trên.
- Ghi hình trước/sau thao tác Add Student.
- Chụp Network trước/sau submit: một POST JSON, không Document mới.
- Đoạn addStudent() với `students: [...this.state.students, student]` và giải thích vì sao chỉ reset form khi thành công.
- Bảng SSR/CSR và chi tiết góc bài học được lưu tại [docs/goc-bai-hoc.md](goc-bai-hoc.md).

Ảnh giao diện CSR mới: [desktop](csr-desktop.png), [mobile](csr-mobile.png). Desktop đang lọc danh sách theo tên để thấy rõ cả bảng và form. Thao tác thử thêm Student đã được kiểm tra trên bản sao JSON tạm; dữ liệu thật không bị thêm hồ sơ demo. docs/desktop.png và docs/mobile.png là ảnh giao diện SSR trước khi chỉnh.
