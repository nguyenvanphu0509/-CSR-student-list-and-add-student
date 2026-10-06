# Demo bài Browser tự tạo và cập nhật UI

Chạy `npm run dev`, mở `http://localhost:3000/csr`.

## Demo khoảng 10 phút

1. Mở DevTools → Network, bật Preserve log. Reload trang để thấy Document khung và các JavaScript module. Danh sách seed được tạo từ state trong browser; CSR không gửi GET /api/students.
2. Console chạy `getStudentState()`. StudentsApp là state owner, gồm danh sách và giá trị input. Gõ họ tên/email, chạy lại để thấy form thay đổi.
3. Xóa log Network rồi thêm sinh viên với email chưa sử dụng. Dòng mới hiện, tổng số tăng, form reset. Không có POST, Document mới hoặc redirect.
4. Gửi lại email đã có: lỗi hiện tại email, form giữ input và số lượng không tăng. Không có request mạng cho cả submit thành công lẫn submit lỗi.
5. Chuyển vào Thùng rác bằng menu CSR, dùng nút Xóa trên một dòng rồi khôi phục tại Thùng rác. Mở Lịch sử để thấy các thao tác; các view vẫn ở `/csr` và không gửi request mạng.
6. Reload trang: dữ liệu CSR trở về seed ban đầu vì state chỉ tồn tại trong phiên. Tìm kiếm/sắp xếp danh sách để thấy browser render từ state.
7. Chỉ bấm “So sánh bản SSR” để mở `/students`. View Page Source SSR có sẵn tên/email trong HTML; CSR có khung và dựng nội dung từ state.

## Giải thích code

- frontend/js/app.js: StudentsApp, state, hash views, add/delete/restore và activity. State được thay bằng object/mảng mới.
- frontend/js/components/student-list.js: nhận props rồi dựng DOM và gửi callback xóa; không gọi API, không giữ state riêng.
- frontend/js/components/student-form.js: mount một lần, nhận callbacks; input gửi giá trị về cha; update() nhận props mới; submit gọi preventDefault().
- frontend/js/api.js: API helper còn trong dự án cho luồng API riêng; CSR hiện không import hoặc gọi helper này.
- backend/routes/students-api.js: Express routes cho phần API riêng, không thuộc luồng thêm student của CSR.

Frontend nằm trong `frontend/`, backend nằm trong `backend/`. Chạy `npm run dev` từ gốc để Express phục vụ cả frontend và API trên cổng 3000. JavaScript frontend chạy trong browser; code backend chạy trong Node.js.

```text
Browser input / submit event
           ↓
StudentForm → StudentsApp (state owner)
                   ↓ tạo student cục bộ
              state.students mới
                   ↓ props
               StudentList → DOM
```

Trong Vanilla JS, setState() không tự động có sẵn. Project chủ động viết phương thức này để thay state rồi gọi render. Props là tham số object; callback là hàm do cha truyền xuống. Đây là cách thể hiện các khái niệm của slide mà không cần React.

## Bằng chứng nộp bài

- Sơ đồ component và state owner như trên.
- Ghi hình trước/sau thao tác Add Student.
- Chụp Network sau khi xóa log rồi thêm/xóa/khôi phục: không có request API hoặc Document mới.
- Đoạn addStudent() với `students: [...this.state.students, student]` và giải thích state là nguồn dữ liệu của danh sách.
- Bảng SSR/CSR và chi tiết góc bài học được lưu tại [docs/goc-bai-hoc.md](goc-bai-hoc.md).

Ảnh giao diện CSR mới: [desktop](csr-desktop.png), [mobile](csr-mobile.png). Desktop đang lọc danh sách theo tên để thấy rõ cả bảng và form. docs/desktop.png và docs/mobile.png là ảnh giao diện SSR trước khi chỉnh.
