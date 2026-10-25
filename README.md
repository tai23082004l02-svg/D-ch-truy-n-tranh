# D-ch-truy-n-tranh

## Xưởng dịch truyện

Công cụ web tĩnh để biên tập bản dịch theo chương, chạy trên GitHub Pages. Không cần backend, không có khóa API trong mã nguồn.

### Lấy ảnh chương từ Comix

Mở [trang cài tiện ích](https://tai23082004l02-svg.github.io/D-ch-truy-n-tranh/capture.html), tải ZIP và cài Load unpacked trên Chrome/Edge máy tính. Vào một chương Comix, chọn đọc cuộn dọc rồi bấm biểu tượng tiện ích. Công cụ đọc các ảnh trong trang bạn đang mở, có bước cuộn tải lazy-load, xem trước và tải ZIP theo thứ tự để nhập vào xưởng dịch. Không gọi API chương hoặc tự chuyển sang chương khác. Ảnh lấy về giữ nguyên ngôn ngữ đang có trên trang, không tự tìm bản tiếng Hàn.

Đây là bản thử nghiệm: đã kiểm tra bộ chọn DOM trong mã trình đọc công khai, nhưng chưa xác minh tải trọn chương thực tế từ phiên Comix của người dùng. API danh sách chương trả 403 trong môi trường phát triển. Tiện ích không vượt từ chối truy cập; xem [hướng dẫn và phạm vi quyền](extension/README.md). Không tự đăng ảnh tải về lên GitHub.

### Sử dụng

1. Nhập nhiều ảnh PNG/JPG/WEBP hoặc một ZIP. Trang được sắp theo tên tệp (1, 2, …, 10).
2. Chọn tiếng Anh hoặc tiếng Nhật chữ ngang, chạy **OCR ô thoại cả chương**. Công cụ tách ô nền trắng, bỏ viền/nét vẽ, rồi OCR từng vùng và loại kết quả thiếu tin cậy. Trang đã có ô được bỏ qua. Nếu đang có kết quả sai từ bản cũ: chọn **OCR lại trang này** (xác nhận thay kết quả trên trang). Ô bị sót: kéo để khoanh gọn chữ rồi bấm **Đọc ô đang chọn**. Muốn sửa vùng: chọn ô và bấm **Khoanh lại vùng ô này**, kéo khung mới; nội dung và bản dịch được giữ lại.
3. Dịch bằng một trong hai cách:
   - Mở **Dịch tự động bằng Gemini**, nhập khóa API cá nhân và ghi chú xưng hô. Công cụ gửi tối đa 30 ô mỗi lô; lần chạy sau bỏ qua ô đã dịch. API có thể phát sinh phí. Mô hình mặc định là `gemini-2.5-flash`, có thể thay đổi trong giao diện.
   - Chọn **Xuất lời thoại JSON**, đưa tệp cho ChatGPT và yêu cầu làm theo trường `instructions`. Nhập JSON kết quả bằng **Nhập bản dịch JSON**. Giữ nguyên `id`; bản dịch nằm trong trường `translated`.
4. Duyệt bản dịch, màu nền và cỡ chữ. Chữ tự thu nhỏ; công cụ chặn xuất nếu vẫn tràn ô.
5. **Lưu dự án** thành ZIP để mở lại, gồm ảnh gốc và toàn bộ chỉnh sửa. Không tự lưu sau khi đóng tab. Khóa API không được đưa vào tệp dự án.
6. **Xuất ảnh ZIP** tạo PNG theo thứ tự, không có khung biên tập. Duyệt lại trước khi đăng.

Giới hạn: 100 trang/chương, 30 MB/ảnh, 24 triệu điểm ảnh/ảnh, tổng ảnh 250 MB. Trình duyệt có ít bộ nhớ nên chia chương thành các phần nhỏ hơn. ZIP có mật khẩu không được hỗ trợ.

### Quyền riêng tư và giới hạn

Ảnh, OCR, ghép chữ và đóng gói ZIP được xử lý trong trình duyệt. Bộ nhận diện tiếng Anh/Nhật và WebAssembly nằm trong `assets/ocr`, không dùng dịch vụ OCR bên ngoài. Khi người dùng bấm dịch Gemini, lời thoại và ghi chú xưng hô được gửi trực tiếp đến Google qua HTTPS; khóa chỉ giữ trong bộ nhớ tab. Không dùng khóa dùng chung cho website công khai. Tiện ích trình duyệt hoặc mã chạy trên máy vẫn có thể truy cập khóa, nên dùng khóa cá nhân có hạn mức phù hợp.

OCR ưu tiên lời thoại trong các vùng nền trắng khép kín. Ô mở, nền xám/đen, chữ nhỏ, chữ nối nét, chữ dọc, tiêu đề và chữ đè tranh có thể bị bỏ sót; các vùng thiếu tin cậy được báo là bỏ qua, không coi là đã nhận diện đầy đủ. Có thể khoanh và đọc riêng từng ô. Tesseract vẫn có thể đọc sai phông manga: cần duyệt nội dung trước khi dịch. Ứng dụng che chữ bằng nền màu phẳng trong vùng hình chữ nhật, chưa phục hồi nét vẽ dưới chữ. Không khẳng định OCR hay bản dịch tự động chính xác nếu chưa được duyệt.

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

`npm run build` tạo `assets/app.js`, sao chép worker, WebAssembly và mô hình OCR từ các gói đã khóa phiên bản. Sau khi sửa `src/`, hãy build và commit lại `assets/` cùng mã nguồn. Kiểm thử trình duyệt: `python tests/browser_smoke.py` và `python tests/manga_ocr.py` (cần Python Playwright, Pillow và Chromium; máy chủ ở cổng 5173). Kiểm thử manga dùng nền truyện mẫu trong kho với lời thoại tiếng Anh được đặt lại để có đáp án kiểm chứng, cùng bản JPEG thu nhỏ; đây không phải bản scan tiếng Anh gốc của người dùng và không chứng minh độ chính xác với mọi phông chữ. Có thể đặt `TEST_BASE_URL` để kiểm thử đường dẫn con của GitHub Pages.

Build còn tạo `extension/collector.js` và `downloads/comix-capture-extension.zip`. Sau khi sửa tiện ích, commit cả nguồn, bundle và ZIP; riêng tiện ích có thể build bằng `npm run build:extension`. Kiểm thử tiện ích: `CAPTURE_CHROMIUM=/duong-dan/chrome-for-testing python tests/capture_browser.py` (trình đọc/CDN mô phỏng, không phải lượt tải chương thật). Cần bản Chromium/Chrome for Testing hỗ trợ nạp tiện ích unpacked; Chromium hệ thống trong môi trường này không nạp được, nên đã kiểm thử bằng Chrome for Testing do Playwright cài. Bản manifest tạm trong kiểm thử cấp trước quyền cho hai máy chủ giả lập; không thay quyền trong gói cài thực tế.

### Bản dịch mẫu

Shokugeki no Souma — trang tiếng Việt đã biên tập trước đó:

![Trang 1 tiếng Việt](translations/shokugeki-no-souma/trang-001.vi.png)
