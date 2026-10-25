# D-ch-truy-n-tranh

## Xưởng dịch truyện

Công cụ web tĩnh để biên tập bản dịch theo chương, chạy trên GitHub Pages. Không cần backend, không có khóa API trong mã nguồn.

### Lấy ảnh Comix, Naver và HentaiRead

Mở [trang cài tiện ích](https://tai23082004l02-svg.github.io/D-ch-truy-n-tranh/capture.html), tải ZIP v1.4.0 và cài Load unpacked trên Chrome/Edge máy tính. Đã cài bản cũ: thay tệp trong thư mục cũ, Reload tiện ích và mở lại tab công cụ. Hỗ trợ chương Comix ở chế độ cuộn dọc và tập Naver Webtoon miễn phí công khai; HentaiRead có thêm bộ nhận diện `img.reading-image[data-page]` với URL ảnh `blob:` dựa trên HTML người dùng cung cấp, cùng bộ dò thử nghiệm cho các kiểu reader khác. Với HentaiRead, Cloudflare chặn trang HTML trong môi trường phát triển nên chưa xác minh trên chương thật; công cụ đọc Blob ngay trong tab người dùng mở được. Nếu thấy chỉ báo tổng trang rõ ràng, nút tải hỏi rồi tự mở từng trang cùng chương; nếu không thì chỉ lấy ảnh đang có. Có tùy chọn CSS cho cấu trúc reader khác và cơ chế PNG dự phòng khi Blob đã thu hồi. Các website khác chưa được hỗ trợ.

Tối đa 1.000 ảnh, tự chia ZIP theo 100 ảnh hoặc 100 MB dữ liệu ảnh mỗi phần và giải phóng dữ liệu phần đã lưu. Khi lỗi, giữ tab và bấm tải lại để tiếp tục. Nhập từng ZIP vào xưởng dịch; vẫn giới hạn 250 MB/dự án. Ảnh tiếng Hàn từ Naver có thể OCR bằng lựa chọn Tiếng Hàn.

Đã kiểm tra HTTP trang Naver tập 1 `titleId=777767&no=1` (106 ảnh), và kiểm thử tiện ích trên DOM/CDN mô phỏng Comix/Naver. Comix thực tế chưa xác minh tải trọn chương vì API trả 403. Xem [phạm vi truy cập và cách gửi nguồn ảnh Naver](extension/README.md). Không hỗ trợ chương khóa/trả phí và không tự đăng ảnh lên GitHub.

### Sử dụng

1. Nhập nhiều ảnh PNG/JPG/WEBP hoặc một ZIP. Trang được sắp theo tên tệp (1, 2, …, 10).
   Với webtoon bị cắt ngang ô thoại: nhập đủ các phần ZIP theo đúng thứ tự rồi dùng **Ghép & chia lại webtoon** trước khi OCR (xem bên dưới).
2. Chọn tiếng Anh, tiếng Hàn hoặc tiếng Nhật chữ ngang, chạy **OCR ô thoại cả chương**. Công cụ tách ô nền trắng, bỏ viền/nét vẽ, rồi OCR từng vùng và loại kết quả thiếu tin cậy. Trang đã có ô được bỏ qua. Nếu đang có kết quả sai từ bản cũ: chọn **OCR lại trang này** (xác nhận thay kết quả trên trang). Ô bị sót: kéo để khoanh gọn chữ rồi bấm **Đọc ô đang chọn**. Muốn sửa vùng: chọn ô và bấm **Khoanh lại vùng ô này**, kéo khung mới; nội dung và bản dịch được giữ lại.
3. Dịch bằng một trong hai cách:
   - Mở **Dịch tự động bằng Gemini**, nhập khóa API cá nhân và ghi chú xưng hô. Công cụ gửi tối đa 30 ô mỗi lô; lần chạy sau bỏ qua ô đã dịch. API có thể phát sinh phí. Mô hình mặc định là `gemini-2.5-flash`, có thể thay đổi trong giao diện.
   - Chọn **Xuất lời thoại JSON**, đưa tệp cho ChatGPT và yêu cầu làm theo trường `instructions`. Nhập JSON kết quả bằng **Nhập bản dịch JSON**. Giữ nguyên `id`; bản dịch nằm trong trường `translated`.
4. Duyệt bản dịch, màu nền và cỡ chữ. Chữ tự thu nhỏ; công cụ chặn xuất nếu vẫn tràn ô.
5. **Lưu dự án** thành ZIP để mở lại, gồm ảnh gốc và toàn bộ chỉnh sửa. Không tự lưu sau khi đóng tab. Khóa API không được đưa vào tệp dự án.
6. **Xuất ảnh ZIP** tạo PNG theo thứ tự, không có khung biên tập. Duyệt lại trước khi đăng.

Giới hạn: 1.000 trang/chương, 30 MB/ảnh, 24 triệu điểm ảnh/ảnh, tổng ảnh 250 MB. Trình duyệt có ít bộ nhớ nên chia chương thành các phần nhỏ hơn. ZIP có mật khẩu không được hỗ trợ.

### Chữ trên nền tranh

Với chữ không nằm trong ô trắng, OCR ô thoại tự động có thể bỏ sót. Nên OCR các ô trắng trước, sau đó kéo khung gọn quanh đoạn chữ trên tranh và chọn **Loại vùng chữ → Chữ trên nền tranh**.

1. Bấm **Tạo mặt nạ & phục hồi nền**. Chọn tìm nét sáng/viền trắng hoặc nét tối, bấm **Tạo mặt nạ gợi ý**. Mặt nạ đỏ cần phủ cả nét chữ và viền, tránh dính nét vẽ.
2. Dùng cọ **Tô vùng cần xóa** và **Gỡ vùng tô nhầm** để sửa. Có thể chỉnh ngưỡng sáng/nở mặt nạ rồi tạo lại gợi ý. Mặt nạ này là gợi ý theo độ sáng và thành phần liên thông, không tự hiểu chữ hay tách chữ chính xác trên mọi nền.
3. Bấm **Xem nền phục hồi**, xem đối chiếu gốc + mặt nạ và nền mới. Chỉ khi ưng ý mới bấm **Áp dụng nền này**. Có nút dừng; đóng hộp xem trước không thay ảnh đang làm.
4. Chọn **Nét chữ gốc để OCR** (đen hoặc sáng), bấm **Đọc ô đang chọn**. OCR dùng ảnh gốc và mặt nạ đã lưu, không đọc trên nền đã xóa chữ. Kiểm tra/sửa nội dung gốc rồi dịch bằng Gemini hoặc xuất/nhập JSON như thường lệ.
5. Chỉnh màu chữ Việt, màu viền và độ dày viền. Chế độ này không tô cả ô bằng màu trắng. **Bỏ nền phục hồi** hoàn tác riêng phần nền; **Xem ảnh gốc** so sánh với nguồn ban đầu. **Lưu dự án** giữ ảnh gốc, nền sửa, mặt nạ và kiểu chữ; ZIP ảnh xuất ra có nền sửa và bản dịch.

Phục hồi dùng **OpenCV Telea**, chạy trong Web Worker với bản OpenCV.js 4.12 được đóng gói tại `assets/inpaint/opencv.js`, chỉ tải khi xem nền phục hồi lần đầu. Không dùng mô hình AI hay gửi ảnh tới máy chủ khác. Thuật toán lan truyền màu từ vùng xung quanh nên hợp nền phẳng/gradient, có thể làm nhòe hoặc làm sai nét tranh phức tạp dưới chữ; không khôi phục được chi tiết thật đã bị chữ che. Chữ dọc, nghiêng và thư pháp vẫn có thể OCR sai; cần chỉnh tay, chưa có dàn chữ theo góc nghiêng.

Mỗi vùng tối đa 2 triệu pixel; mặt nạ không vượt 65% vùng để giữ đủ nền tham chiếu. Chỉ pixel trong mặt nạ bị thay, ảnh nguồn không đổi. Thu nhỏ phạm vi nếu chạy chậm. Khi khoanh lại vùng của ô, nền phục hồi cũ sẽ bị bỏ để tránh lệch vị trí. Tổng dữ liệu ảnh và nền sửa vẫn giới hạn 250 MB. Kiểm thử thực tế: `python tests/art_browser.py` dùng OpenCV WASM thật, kiểm tra cọ/hoàn tác, hủy xử lý, OCR chữ viền, nền gradient, pixel ngoài mặt nạ, xuất PNG và mở lại dự án; không chứng minh chất lượng phục hồi cho mọi nền tranh.

### Ghép và chia lại webtoon

Ảnh Naver thường là các lát liên tiếp của một dải cuộn, nên đường cắt tệp có thể nằm giữa ô thoại. Trong xưởng dịch, bấm **Ghép & chia lại webtoon**, giữ chiều cao mặc định 4.000 px và khoảng trống tối thiểu 40 px để thử trước. Công cụ nối theo thứ tự đang có, tìm dải nền trắng/đen đồng đều trên toàn chiều ngang để chia lại. Các ảnh phải cùng chiều rộng; không tự co giãn, bỏ lề hay xóa pixel. Nhập đủ các phần ZIP trước khi ghép để nối được cả ô thoại ở ranh giới giữa hai ZIP.

Không tạo canvas dài bằng cả chương: quét theo dải 256 hàng và dựng từng đoạn đầu ra. Đoạn có thể dài hơn chiều cao mong muốn để tránh cắt nội dung, tối đa 12.000 px và vẫn trong giới hạn 24 triệu điểm ảnh. Nếu không có khoảng trống an toàn, công cụ giữ vùng chồng lặp (256–600 px tùy chiều rộng), đánh dấu tên `can-kiem-tra` và báo số điểm cần duyệt. Phần chồng lặp có thể làm lặp nội dung/OCR; không bảo đảm mọi ô thoại đều nguyên vẹn trong trường hợp này. Đây là cách chọn điểm chia theo hình ảnh, không phải mô hình hiểu khung truyện.

Bộ ảnh mới chưa có OCR. Dùng **Tải bộ ảnh đã ghép** để tải PNG chưa chèn bản dịch, kèm `webtoon-layout.json` ghi tọa độ đoạn trong dải nguồn; hoặc chạy OCR/dịch trực tiếp trên bộ mới. **Khôi phục ảnh gốc** trở về toàn bộ ảnh cùng OCR/bản dịch trước khi ghép. **Lưu dự án** giữ cả bộ mới và bản gốc dự phòng để khôi phục sau khi mở lại. Tổng ảnh gốc và ảnh mới phải dưới 250 MB. Sau khi ghép, muốn nhập thêm ZIP cần khôi phục ảnh gốc rồi ghép lại.

Kiểm thử: `python tests/webtoon_browser.py` kiểm tra pixel không mất/đổi thứ tự, ô thoại qua đường cắt cũ, bản gốc trong dự án, lỗi khác chiều rộng và trường hợp cần chồng lặp. `WEBTOON_SOURCE_DIR=/duong-dan/anh-jpg python tests/webtoon_live_browser.py` là kiểm tra tùy chọn với ảnh nguồn có sẵn. Bộ Naver công khai 106 ảnh đã được thử thành 42 đoạn ở thiết lập mặc định và kiểm tra pixel qua đường nối ảnh 7/8; ảnh truyện dùng để thử không được đưa vào mã nguồn.

### Quyền riêng tư và giới hạn

Ảnh, OCR, ghép chữ và đóng gói ZIP được xử lý trong trình duyệt. Bộ nhận diện tiếng Anh/Hàn/Nhật và WebAssembly nằm trong `assets/ocr`, không dùng dịch vụ OCR bên ngoài. Khi người dùng bấm dịch Gemini, lời thoại và ghi chú xưng hô được gửi trực tiếp đến Google qua HTTPS; khóa chỉ giữ trong bộ nhớ tab. Không dùng khóa dùng chung cho website công khai. Tiện ích trình duyệt hoặc mã chạy trên máy vẫn có thể truy cập khóa, nên dùng khóa cá nhân có hạn mức phù hợp.

OCR ưu tiên lời thoại trong các vùng nền trắng khép kín. Ô mở, nền xám/đen, chữ nhỏ, chữ nối nét, chữ dọc, tiêu đề và chữ đè tranh có thể bị bỏ sót; các vùng thiếu tin cậy được báo là bỏ qua, không coi là đã nhận diện đầy đủ. Có thể khoanh và đọc riêng từng ô. Tesseract vẫn có thể đọc sai phông manga: cần duyệt nội dung trước khi dịch. Ô thoại dùng nền màu phẳng; chế độ Chữ trên nền tranh có mặt nạ và phục hồi cục bộ, nhưng không khôi phục chính xác chi tiết tranh đã bị che. Không khẳng định OCR hay bản dịch tự động chính xác nếu chưa được duyệt.

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

Hoàn tác: dùng nút **↶ Hoàn tác** hoặc **Ctrl+Z** (Mac: **⌘Z**), tối đa 30 bước trong phiên hiện tại. Hỗ trợ ô thoại, nội dung, kiểu chữ, nền phục hồi, nhập/xóa trang và ghép ảnh. Trong cửa sổ phục hồi nền, phím tắt hoàn tác từng nét cọ/tạo/xóa mặt nạ riêng. Lịch sử không được lưu trong ZIP dự án; tải lại trang sẽ xóa lịch sử.

Chỉnh khung trên ảnh: chọn khung rồi kéo các nút vuông ở 8 góc/cạnh để đổi kích thước, kéo bên trong để di chuyển. Nhấn Delete/Backspace khi ảnh đang được chọn hoặc bấm Xóa ô để xóa. Escape hủy kéo; Ctrl+Z hoàn tác. Lời thoại/bản dịch được giữ khi chỉnh khung; nền phục hồi cũ được bỏ khi đổi vùng và cần tạo lại.
