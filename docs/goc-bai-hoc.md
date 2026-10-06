# Góc bài học: State, Component và Luồng Render

## 1. Kiến trúc Component & State Owner

- **`StudentsApp`**: Sở hữu state chính của ứng dụng (danh sách sinh viên, giá trị form, trạng thái lọc/sắp xếp).
- **`StudentList`**: Component con nhận danh sách sinh viên qua `props` để render DOM; không gọi API và không giữ state riêng.
- **`StudentForm`**: Component con nhận giá trị input và callback từ component cha; đồng bộ dữ liệu người dùng nhập.

## 2. Luồng dữ liệu và Render (Data Flow)

1. **Nhập dữ liệu**: Input → `input` event → cập nhật `state.form`.
2. **Submit form**: 
   - Gọi `event.preventDefault()` để ngăn reload trang.
   - Tạo student mới ngay trong browser, không gửi request API.
   - Cập nhật mảng `state.students` mới → render lại danh sách sinh viên.
   - Reset form sau khi cập nhật state thành công; reload trang sẽ khôi phục seed ban đầu.
3. **Debug & Kiểm tra**:
   - Trong **DevTools Console**: chạy hàm `getStudentState()` để xem bản sao hiện tại của state.
   - Trong tab **Network**: thao tác submit không tạo request API hoặc tải lại document HTML.

## 3. Đối chiếu SSR và CSR trong Project

| Tiêu chí đối chiếu | SSR (`/students`) | CSR (`/csr`) |
| :--- | :--- | :--- |
| **Ai dựng danh sách?** | Express + EJS trên server | JavaScript trong browser |
| **Nguồn dữ liệu danh sách** | Express đọc dữ liệu rồi render HTML | Seed data trong state của browser |
| **Submit thêm sinh viên** | POST → redirect (303) → GET HTML | Tạo student cục bộ → cập nhật state và DOM |
| **Khi tắt JavaScript** | Vẫn xem và thêm sinh viên bình thường | Cần bật JavaScript để tải và dựng giao diện |
