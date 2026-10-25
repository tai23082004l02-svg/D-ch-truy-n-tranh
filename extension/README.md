# Lấy ảnh Comix, Naver & HentaiRead — v1.4.0

## Cài hoặc cập nhật

1. Tải ZIP từ trang cài đặt Xưởng dịch và giải nén.
2. Chrome: `chrome://extensions`; Edge: `edge://extensions`. Bật Developer mode.
3. Cài mới: Load unpacked, chọn thư mục có `manifest.json`.
4. Đã cài bản cũ: thay tệp trong thư mục cũ bằng bản mới, bấm Reload trên thẻ tiện ích. Đóng tab công cụ cũ và mở lại bằng biểu tượng tiện ích.

Dùng trên Chrome/Edge máy tính. Chưa phát hành Chrome Web Store; Chrome/Safari điện thoại thông thường không cài được bản này.

## Sử dụng

- **Comix:** mở một chương tại comix.to, chọn Top to bottom / cuộn dọc. Trang giới thiệu truyện chưa có ảnh chương.
- **Naver:** mở tập miễn phí công khai trên comic.naver.com hoặc m.comic.naver.com. Trang chủ/danh sách tập chưa có ảnh nội dung. Ví dụ: https://comic.naver.com/webtoon/detail?titleId=777767&no=1
- **HentaiRead (thử nghiệm):** mở chương truy cập được trong trình duyệt, dùng chế độ liệt kê tất cả ảnh. Bộ nhận diện thử các cấu trúc reader phổ biến; chưa xác minh đúng cấu trúc trên chương thật do Cloudflare trả trang kiểm tra truy cập trong môi trường phát triển, kể cả URL người dùng cung cấp. Không tự giải CAPTCHA, lấy cookie hoặc vượt chặn. Không đưa nội dung chương website này vào kiểm thử.
- Bấm biểu tượng tiện ích. Nếu thiếu URL, dùng Cuộn tải toàn bộ chương; giữ tab nguồn mở và không đổi tập.
- Kiểm tra thứ tự, bấm Tải ảnh đã chọn thành ZIP, cấp quyền cho các máy chủ ảnh được liệt kê.
- Nhập ZIP vào Xưởng dịch. Với tiếng Hàn, chọn OCR Tiếng Hàn.

## Chương lớn và tiếp tục tải

- Tối đa 1.000 ảnh/chương, 30 MB/ảnh. Tự xuất từng ZIP tối đa 100 ảnh hoặc 100 MB dữ liệu ảnh (ZIP có thêm một ít metadata).
- Sau khi một phần tải xong, tiện ích bỏ dữ liệu phần đó khỏi bộ nhớ; không giữ cả chương lớn. Các phần có hậu tố part-001, part-002…; số ảnh bên trong vẫn theo thứ tự toàn chương.
- Khi lỗi hoặc dừng, phần đã lưu không bị mất. Giữ cùng tab, cùng tên ZIP và cùng lựa chọn rồi bấm tải lại để tiếp tục. Đổi tên ZIP để tải lại từ đầu. Đóng tab sẽ mất thông tin tiến độ.
- Dừng ở ảnh lỗi; phần đang làm chưa được xuất, các ảnh tải thành công của phần đó được giữ để thử lại. Các phần đã lưu trước đó vẫn hoàn chỉnh.
- Xưởng dịch cũng hỗ trợ 1.000 ảnh/dự án, nhưng giữ giới hạn tổng ảnh 250 MB và 24 triệu điểm ảnh/ảnh. Nên xử lý riêng từng phần với chương lớn. Không tự cắt ảnh cuộn quá dài.
- PNG/JPG/WEBP, giữ nguyên byte ảnh; bản tiếng Anh trên Comix không tự biến thành raw tiếng Hàn. Không bỏ watermark hoặc tự đăng lên GitHub.

## Bộ nhận diện và phạm vi truy cập

- Comix: `.rpage-page[data-page] img.rpage-page__img`, chế độ `.rpage--ttb`; đếm `.rpage-progress__seg` khi có.
- Naver: chỉ lấy `img[id^="content_image_"]` trong `#comic_view_area`, `.wt_viewer` hoặc `#sectionContWide`. Loại thumbnail, bìa, avatar, banner tuổi. Phân biệt tập bằng cả `titleId` và `no` trong query, tránh trộn ảnh khi đổi tập cùng pathname.
- Không đọc cookie/token, không gọi API chương bảo vệ, không tự mở chương khác. Không hỗ trợ đăng nhập, chương khóa hoặc trả phí.
- API danh sách chương Comix trả 403 trong môi trường phát triển; kiểm thử Comix dựa trên mã trình đọc công khai và DOM mô phỏng, chưa xác minh trọn chương Comix thật.
- Đã kiểm tra trang Naver công khai tập 1 titleId=777767 và tải 106 ảnh qua HTTPS với thông tin nguồn trang đọc bình thường, không cookie/xác thực. Đây là kiểm tra truy cập HTTP và dữ liệu trang thực tế, tách biệt với kiểm thử trình duyệt của tiện ích dùng CDN/DOM mô phỏng.
- Ảnh Comix dùng `no-referrer`. Ảnh Naver từ image-comic.pstatic.net cần `Referer: https://comic.naver.com/`, tương tự yêu cầu ảnh từ trình đọc Naver. Quy tắc `declarativeNetRequestWithHostAccess` chỉ áp dụng tạm cho GET ảnh do chính tiện ích khởi tạo đến đúng hostname này, sau khi người dùng cấp quyền host. Quy tắc được xóa khi thao tác xong hoặc tab công cụ đóng.
- `optional_host_permissions: https://*/*` chỉ cho phép xin quyền theo host động; không cấp toàn bộ khi cài. Nút tải chỉ yêu cầu các origin ảnh đã chọn. Có thể thu hồi trong cài đặt tiện ích.
- Khi site vẫn từ chối truy cập, tiện ích báo lỗi, không thử lấy thông tin xác thực để vượt chặn. Cấu trúc trang/quyền truy cập có thể thay đổi theo vùng hoặc thời gian.


## Tùy chọn HentaiRead

- Ưu tiên các vùng cụ thể như `.reading-content img.wp-manga-chapter-img`, `.reading-content .page-break img`, `#readerarea img`, `#chapter-content img`; sau đó thử một số container đọc khác. Đây là giả định cấu trúc phổ biến, không phải kết quả xác minh engine của website bị chặn.
- Lấy URL từ `data-lazy-src`, `data-cfsrc`, `data-original`, `data-src`, `data-url`, rồi mới dùng `currentSrc/src`; chỉ URL HTTPS. Đánh số theo thứ tự ảnh trong DOM của vùng đọc, không tự suy diễn trang thiếu hoặc mở các trang/chương tiếp theo.
- Số ảnh hiển thị là các phần tử ảnh đang có, chưa xác định được tổng trang của chương. Nếu đang đọc từng ảnh hoặc danh sách chưa tải hết, chuyển sang liệt kê/cuộn rồi quét lại. Ảnh blob trong trình đọc `reading-image[data-page]` được hỗ trợ như phần bên dưới; canvas không có phần tử ảnh vẫn chưa được hỗ trợ.
- Nếu chưa thấy ảnh, mở tùy chọn HentaiRead và nhập **CSS vùng ảnh** thực tế, bấm Quét lại. Bộ chọn được giới hạn 300 ký tự, chỉ đọc phần tử IMG, không chạy JavaScript. Không dùng `img` cho toàn trang; kiểm tra danh sách xem trước để tránh bìa/banner. Cú pháp sai được báo và không tự thay bằng quét toàn bộ trang.
- Ô **Gửi nguồn trang đọc** mặc định tắt. Khi bật và bấm tải, tiện ích đặt Referer bằng origin trang nguồn cho GET ảnh từ chính tiện ích đến đúng các máy chủ ảnh đã chọn/cấp quyền; quy tắc tạm được gỡ khi thao tác xong hoặc tab đóng. Đây là thông tin nguồn như yêu cầu ảnh bình thường, không kèm cookie/token. Nếu server vẫn từ chối, công cụ báo lỗi, không thử thông tin xác thực khác.

## Trình đọc blob và chế độ từng trang

HTML do người dùng cung cấp cho thấy ảnh có lớp `reading-image`, `data-page="3"`, và `src="blob:https://hentairead.com/..."`; URL trang có dạng `/hentai/<tên>/<ngôn-ngữ>/p/3/`, thanh điều hướng hiển thị `3/35`. Bộ nhận diện mới ưu tiên cấu trúc thực tế này thay cho phỏng đoán các container phổ biến.

- Blob URL là địa chỉ tạm trong phiên trang, không phải URL CDN. Tiện ích dùng script trong tab nguồn để đọc Blob, chuyển dữ liệu ảnh về tab công cụ, xác minh định dạng PNG/JPG/WEBP rồi đóng ZIP. Không đọc cookie/token và không cần quyền host CDN cho nhánh này.
- Nếu Blob URL đã bị thu hồi nhưng ảnh còn hiển thị, thử xuất lại ảnh đang hiển thị bằng canvas PNG (tối đa 24 triệu pixel). Giao diện ghi rõ các ảnh được xuất lại PNG: giữ kích thước/ảnh hiển thị, không giữ định dạng nén hoặc byte của tệp ban đầu. Không thay đổi quy tắc bảo mật canvas/CORS khi trình duyệt từ chối đọc.
- Khi tổng trang xác định được duy nhất từ chỉ báo current/total, tối đa 1.000 trang, công cụ lập danh sách từ trang 1. Bấm tải sẽ hỏi xác nhận rồi tự mở lần lượt URL `/p/N/` trong cùng chương, chờ ảnh Blob xuất hiện và đọc ngay trước khi chuyển tiếp. Các địa chỉ Blob tạm không được dùng lại sau khi rời trang.
- Các URL điều hướng phải cùng origin và nằm trong đường dẫn chương đã quét. Sau khi tải, tab nguồn ở trang cuối đã đọc; công cụ đưa tab quản lý lên trước. Nếu người dùng đổi chương, công cụ dừng. Nếu trang hiện kiểm tra truy cập hoặc không có ảnh sau thời gian chờ, báo lỗi và chờ người dùng xử lý bình thường, không vượt kiểm tra.
- Nếu không chắc tổng số trang, chỉ lấy các ảnh Blob hiện có; không tự đoán tổng hoặc dò các chương khác. Danh sách URL xuất riêng là URL trang đọc, không phải link tải Blob bền vững.
- Vẫn chia ZIP theo 100 ảnh/100 MB, giữ các phần đã lưu để thử tiếp khi lỗi. Chỉ giữ thumbnail nhỏ để xem lại và dữ liệu của phần chưa lưu; không giữ byte cả chương trong RAM. Giữ tab nguồn/tab công cụ mở trong lúc làm; đóng tab mất tiến độ chưa lưu.
- Nếu DevTools làm trang đứng ở Paused in debugger, tiếp tục hoặc đóng DevTools rồi quét lại. Các lệnh đọc tab có thời hạn chờ và có thể dừng từ công cụ.

Kiểm thử `tests/blob_capture_browser.py` dùng Blob URL thật tạo trong trang mẫu không có nội dung truyện: quét từ trang 3 rồi lấy 1–4, kiểm tra đúng byte và thứ tự, Blob bị thu hồi và PNG dự phòng, chưa biết tổng trang, dừng/tiếp tục và chặn đổi chương. Kiểm thử này không phải xác minh lượt tải chương thật trên website đang chặn môi trường phát triển.

## Phát triển và kiểm thử

Từ gốc kho mã: `npm ci`, `npm run build`, `npm test`. Riêng tiện ích: `npm run build:extension`. Build tạo bundle và ZIP có metadata thời gian cố định để tái lập được.

Kiểm thử: `CAPTURE_CHROMIUM=/path/to/chrome-for-testing python tests/capture_browser.py`. Cần Playwright, Pillow, Chrome for Testing hỗ trợ nạp unpacked. Manifest tạm trong kiểm thử cấp trước quyền cho các host giả lập và thêm quyền debug DNR; các quyền thử nghiệm này không có trong ZIP phát hành. DevTools trả fixture trước giai đoạn sửa header mạng, nên kiểm tra DNR dùng API testMatchOutcome của Chrome và việc dọn quy tắc tạm. Kiểm tra thực tế HTTP Naver được thực hiện riêng.
