# Lấy ảnh chương Comix

## Cài Chrome/Edge trên máy tính

1. Tải `comix-capture-extension.zip` từ trang hướng dẫn của Xưởng dịch và giải nén vào một thư mục cố định.
2. Mở `chrome://extensions` (Chrome) hoặc `edge://extensions` (Edge).
3. Bật **Developer mode / Chế độ nhà phát triển**.
4. Chọn **Load unpacked / Tải tiện ích đã giải nén**, trỏ vào thư mục có `manifest.json`.
5. Ghim tiện ích nếu muốn. Tiện ích chưa phát hành trên Chrome Web Store; trình duyệt điện thoại thông thường không cài được bản này.

## Dùng trên Comix

1. Mở truyện, chọn **một chương**. URL giới thiệu truyện hoặc bìa chưa có ảnh chương.
2. Trong trình đọc, chọn hướng đọc **Top to bottom / cuộn dọc**.
3. Bấm biểu tượng **Xưởng dịch — Lấy ảnh chương Comix** trên thanh tiện ích. Một tab công cụ mở ra.
4. Nếu còn ảnh chưa có URL, bấm **Cuộn tải toàn bộ chương**. Tiện ích đưa tab truyện lên trước và cuộn từng trang; giữ tab mở, không đổi chương. Khi xong công cụ trở lại và khôi phục vị trí cuộn ban đầu.
5. Kiểm tra ảnh và thứ tự. Bấm **Tải ảnh đã chọn thành ZIP**.
6. Trình duyệt xin quyền đọc đúng các máy chủ ảnh đã liệt kê. Chấp nhận nếu đó là các máy chủ bạn muốn tải.
7. Chọn nơi lưu ZIP. Mở Xưởng dịch → **Nhập ảnh / ZIP** → chọn ZIP vừa tải.

## Phạm vi và giới hạn

- Chỉ đọc DOM của tab Comix được người dùng mở và kích hoạt bằng biểu tượng tiện ích. Không gọi API chương, không đọc cookie hay dữ liệu đăng nhập, không vượt trang đăng nhập/CAPTCHA hoặc phản hồi từ chối truy cập.
- Bộ chọn được kiểm tra từ mã trình đọc công khai của Comix ngày 2026-10-25: `.rpage-page[data-page] img.rpage-page__img`, hướng đọc `.rpage--ttb`, và tổng trang từ `.rpage-progress__seg` khi có. Website có thể thay đổi cấu trúc về sau.
- Trang giới thiệu truyện truy cập được trong môi trường phát triển; API danh sách chương trả 403. Chưa kiểm chứng tải toàn chương thực tế từ Comix trong phiên trình duyệt của người dùng. Kiểm thử tự động dùng DOM mô phỏng cấu trúc trình đọc và ảnh thử, không phải chương truyện thật tải thành công.
- Tải trực tiếp URL ảnh hiển thị trên trang, `credentials: omit` và `no-referrer` giống chính sách ảnh của trình đọc. Nếu máy chủ yêu cầu quyền khác hoặc trả 403, tiện ích báo lỗi, không lấy token/cookie để vượt chặn.
- Ảnh tải về là bản đang được website hiển thị (có thể đã dịch sang tiếng Anh), không có chức năng tìm bản tiếng Hàn hoặc bỏ watermark.
- Tối đa 100 ảnh, 30 MB/ảnh, tổng 250 MB. PNG/JPG/WEBP; giữ nguyên byte ảnh. Không tự cắt ảnh cuộn quá dài. Xưởng dịch có giới hạn riêng 24 triệu điểm ảnh/ảnh.
- ZIP chỉ tạo khi các ảnh đã chọn đều tải thành công. Có thể bỏ chọn ảnh lỗi để xuất một phần; công cụ hỏi xác nhận việc xuất thiếu so với danh sách trang.
- Bộ nhớ tải giữ trong tab để thử lại, không lưu máy chủ. Đóng tab công cụ sẽ mất bộ nhớ tải. Danh sách URL xuất riêng có thể hết hạn.
- `optional_host_permissions: https://*/*` cho phép xin quyền theo máy chủ ảnh động; không được cấp toàn bộ khi cài. Nút tải chỉ yêu cầu đúng các origin ảnh bạn đã chọn. Có thể thu hồi quyền trong cài đặt tiện ích.
- Không tự đăng hoặc đẩy ảnh lên GitHub.

## Phát triển

Từ gốc kho mã: `npm ci`, `npm run build`, `npm test`. Có thể Load unpacked trực tiếp thư mục `extension/` sau khi build. Các tệp `collector.js` và `downloads/comix-capture-extension.zip` được tạo từ nguồn đã commit.
