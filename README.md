# D-ch-truy-n-tranh

## Xưởng dịch truyện

Công cụ web tĩnh để biên tập bản dịch theo chương, chạy trên GitHub Pages. Không cần backend, không có khóa API trong mã nguồn.

### Sử dụng

1. Nhập nhiều ảnh PNG/JPG/WEBP hoặc một ZIP. Trang được sắp theo tên tệp (1, 2, …, 10).
2. Chọn tiếng Anh hoặc tiếng Nhật chữ ngang, chạy OCR hàng loạt. Chọn ô để sửa, kéo trên ảnh để thêm ô bị sót. Xóa rồi vẽ lại nếu vùng OCR quá rộng.
3. Dịch bằng một trong hai cách:
   - Mở **Dịch tự động bằng Gemini**, nhập khóa API cá nhân và ghi chú xưng hô. Công cụ gửi tối đa 30 ô mỗi lô; lần chạy sau bỏ qua ô đã dịch. API có thể phát sinh phí. Mô hình mặc định là `gemini-2.5-flash`, có thể thay đổi trong giao diện.
   - Chọn **Xuất lời thoại JSON**, đưa tệp cho ChatGPT và yêu cầu làm theo trường `instructions`. Nhập JSON kết quả bằng **Nhập bản dịch JSON**. Giữ nguyên `id`; bản dịch nằm trong trường `translated`.
4. Duyệt bản dịch, màu nền và cỡ chữ. Chữ tự thu nhỏ; công cụ chặn xuất nếu vẫn tràn ô.
5. **Lưu dự án** thành ZIP để mở lại, gồm ảnh gốc và toàn bộ chỉnh sửa. Không tự lưu sau khi đóng tab. Khóa API không được đưa vào tệp dự án.
6. **Xuất ảnh ZIP** tạo PNG theo thứ tự, không có khung biên tập. Duyệt lại trước khi đăng.

Giới hạn: 100 trang/chương, 30 MB/ảnh, 24 triệu điểm ảnh/ảnh, tổng ảnh 250 MB. Trình duyệt có ít bộ nhớ nên chia chương thành các phần nhỏ hơn. ZIP có mật khẩu không được hỗ trợ.

### Quyền riêng tư và giới hạn

Ảnh, OCR, ghép chữ và đóng gói ZIP được xử lý trong trình duyệt. Bộ nhận diện tiếng Anh/Nhật và WebAssembly nằm trong `assets/ocr`, không dùng dịch vụ OCR bên ngoài. Khi người dùng bấm dịch Gemini, lời thoại và ghi chú xưng hô được gửi trực tiếp đến Google qua HTTPS; khóa chỉ giữ trong bộ nhớ tab. Không dùng khóa dùng chung cho website công khai. Tiện ích trình duyệt hoặc mã chạy trên máy vẫn có thể truy cập khóa, nên dùng khóa cá nhân có hạn mức phù hợp.

OCR có thể sai với chữ manga, chữ dọc, tiếng động và trang phức tạp. Ứng dụng che chữ bằng nền màu phẳng trong vùng hình chữ nhật, chưa phục hồi nét vẽ dưới chữ. Chữ đè tranh cần xử lý riêng. Không khẳng định bản dịch tự động chính xác nếu chưa được duyệt.

### GitHub Pages

Trang `index.html` và các tệp `assets/` đã được build và commit để phục vụ trực tiếp. Trong **Settings → Pages**, dùng **Deploy from a branch → main → / (root)**. Không cần cài npm trên GitHub Pages. Nếu đã chọn một nguồn Pages khác, cần chuyển sang cấu hình này. Các đường dẫn tài nguyên đều tương đối để hoạt động trong đường dẫn kho mã.

Website: <https://tai23082004l02-svg.github.io/D-ch-truy-n-tranh/>

### Phát triển

Yêu cầu Node.js 22+ và Python 3 để dùng máy chủ tĩnh cục bộ.

```sh
npm ci
npm test
npm run build
npm run dev
```

`npm run build` tạo `assets/app.js`, sao chép worker, WebAssembly và mô hình OCR từ các gói đã khóa phiên bản. Sau khi sửa `src/`, hãy build và commit lại `assets/` cùng mã nguồn. Kiểm thử trình duyệt bổ sung: `python tests/browser_smoke.py` (cần Python Playwright, Pillow và Chromium; máy chủ ở cổng 5173).

### Bản dịch mẫu

Shokugeki no Souma — trang tiếng Việt đã biên tập trước đó:

![Trang 1 tiếng Việt](translations/shokugeki-no-souma/trang-001.vi.png)
