# Góc bài học: State, Component và Luồng Render

## 1. Kiến trúc Component & State Owner

- **`StudentsApp`**: Sở hữu state chính của ứng dụng (danh sách sinh viên, giá trị form, trạng thái lọc/sắp xếp).
- **`StudentList`**: Component con nhận danh sách sinh viên qua `props` để render DOM; không gọi API và không giữ state riêng.
- **`StudentForm`**: Component con nhận giá trị input và callback từ component cha; đồng bộ dữ liệu người dùng nhập.

## 2. Luồng dữ liệu và Render (Data Flow)

1. **Nhập dữ liệu**: Input → `input` event → cập nhật `state.form`.
2. **Submit form**: 
   - Gọi `event.preventDefault()` để ngăn reload trang.
   - Gửi request `POST` JSON đến `/api/students`.
   - Khi server lưu thành công: cập nhật mảng `state.students` mới → render lại danh sách sinh viên.
   - Form chỉ được xóa (reset) khi server phản hồi lưu thành công.
3. **Debug & Kiểm tra**:
   - Trong **DevTools Console**: chạy hàm `getStudentState()` để xem bản sao hiện tại của state.
   - Trong tab **Network**: thao tác submit chỉ tạo duy nhất request Fetch/XHR đến `/api/students`, không tải lại document HTML mới.

## 3. Đối chiếu SSR và CSR trong Project

| Tiêu chí đối chiếu | SSR (`/students`) | CSR (`/csr`) |
| :--- | :--- | :--- |
| **Ai dựng danh sách?** | Express + EJS trên server | JavaScript trong browser |
| **Response dữ liệu** | HTML hoàn chỉnh có sẵn sinh viên | Dữ liệu dạng JSON từ API |
| **Submit thêm sinh viên** | POST → redirect (303) → GET HTML | POST JSON → cập nhật state và DOM cục bộ |
| **Khi tắt JavaScript** | Vẫn xem và thêm sinh viên bình thường | Cần bật JavaScript để tải và dựng giao diện |
