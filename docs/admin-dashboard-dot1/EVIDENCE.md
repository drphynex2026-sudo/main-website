# Bằng chứng và giới hạn — gói hiệu chỉnh dashboard

Nền runtime giữ nguyên `75b07feed68d6dba833dd730b17e9d74902cac34`. Chỉ tài liệu/mockup/probe trong docs. Không triển khai dashboard.

## Bằng chứng cũ giữ nguyên

`review-input/evidence-75b07fe/` là bản sao evidence người dùng cung cấp: experiment-output và spec dạng .txt. Đã đọc output E1–E6/E9 và review; không chạy lại. Review ghi 28/28 unit và 2/2 spec DB; không trình bày các số đó như test do lượt này chạy. Evidence E1 Home raw {} chỉ là chưa publish, không đủ đóng mọi ca Home. E2 main khác draft đã có; không suy ra main của Product chưa từng publish.

## Thực chạy mới

1. `tsx --tsconfig tsconfig.json docs/admin-dashboard-dot1/evidence-final/memory-probe.ts`, Node heap 2048 MiB, một tiến trình. **8/8 probe thuần bộ nhớ đạt, exit 0**. Import trực tiếp helper runtime resolveSlot/bannersApprovedFor/sharedRevision/asGuestView/blockIssues. Không dotenv, Payload client, DB, migration hoặc dịch vụ ngoài. Dùng tsx đã cài ở checkout gốc, không cài dependency.
   - Band private vs public; hero ảnh chỉ optional.
   - ID chưa phân giải và private object sau guest filter có thể cùng là ID: không thể suy thiếu/private từ ID.
   - FullBleed imageHasText có ảnh public giữ copyHidden; private fallback không ẩn HTML copy.
   - Packshot đã chọn private không bị thay bằng ảnh sản phẩm khác.
   - Hash cấu hình Home hiện tại/đổi ảnh phân biệt approval.
   - Đây **không** kiểm chứng DB approval/dependency hay dashboard reader mới. Probe có adapter predicate isPublic tương đương mã đã đọc, không phải render toàn React ProductLanding.
2. Lần đầu trong sandbox dừng trước probe vì tsx gọi os.userInfo lỗi uv_os_get_passwd ENOMEM. Chạy lại đúng probe ngoài sandbox theo quyền được duyệt đạt; không coi lỗi đó là thất bại nghiệp vụ hoặc tự kết luận RAM máy thiếu.
3. Browser thực trên server HTML loopback tạm chỉ đọc một file mockup. Không chạy Next/Payload và không dùng cổng Production/Local hiện có. Server đã dừng, tab thử đã đóng, viewport reset.
   - 390px: innerWidth390/client375/scrollWidth375, một cột; không tràn ngang.
   - 768px: innerWidth768/client753/scrollWidth753, một cột; không tràn ngang.
   - 1440px: innerWidth1440/client1425/scrollWidth1425, ba cột 392px; không tràn ngang.
   - Pagination: trang1 có20 Products, 6 cặp có việc (5 review +1 cảnh báo), Home3 tính riêng. Trang2 có1 Product, ở state ok có0 việc, Home vẫn3. Unknown ở trang2 có3 cảnh báo, không bị cộng trang1.
   - Guest denied giữ chữ403/cấu hình; error khác denied; unknown không báo khối ẩn hoặc xanh đủ điều kiện.
   - Translator có nhãn thiếu quyền riêng; cảnh báo không hướng dẫn approve. Tab từ filter tới link task có đúng route `/admin/collections/products/mau-02?locale=vi`.
   - Link Home KO hiển thị đúng `/admin/globals/home-page?locale=ko`, không mở Admin thật. Các ID là mẫu.
   - Screenshot cuối: evidence-final/mockup-1440.png và mockup-390.png. Không tuyên bố nghiệm thu Admin/Payload từ HTML mockup.
   - Một lần đo resize batch lấy lại viewport390 ở bước yêu cầu768 do cập nhật bất đồng bộ; không tính lần đó là kiểm768. Đã đặt lại768 và đọc ở call sau, số đo ở trên là lần xác nhận.
4. `git diff --check` đạt cho tracked diff; runtime diff HEAD trong src/scripts/tests/manifests/config bằng0. File docs mới còn untracked nên hash manifest là bằng chứng byte, không dùng diff-check như lint toàn HTML/Markdown.

## DB gap chưa chạy — chỉ bổ sung các ca này khi có disposable đã xác minh

| Gap | Probe tối thiểu và assertion | Trạng thái |
|---|---|---|
| Home CMS/default | Guest main raw {}, approved+hash khớp, approved+hash lệch; public reader null; denied/error phân biệt. Snapshot + resolveSlot, public draft không bị dùng | Chưa chạy DB; helper fallback mới kiểm thuần bộ nhớ |
| Home dependency | Main KO/EN approved revision A; draft shared B, KO duyệt riêng, EN chưa duyệt: KO publish bị409, main/history giữ nguyên; EN duyệt rồi KO publish hợp lệ. Đọc staff main từng locale, không adapter/locale:all | Chưa chạy DB |
| Product chưa từng publish | Tạo fixture draft mới; đọc staff main draft:false từng locale và guest; ghi rõ rỗng/hàng main thực tế trước tính N/A; không tự giả main.landing=[] | Chưa chạy DB |
| Relation chưa phân giải | Đã kiểm helper trong bộ nhớ; DB test reader sau implementation cần chứng minh null/ID provenance, field ACL/missing và ingredients/line guest access vẫn unknown | Chưa chạy DB/reader mới |

Không kết nối database trong lượt này vì chưa xác minh tài nguyên disposable + marker bằng kết nối thật. Không dùng database đang phục vụ Admin. Kế hoạch khi được thực hiện: instance riêng, tên/role/marker/endpoint được kiểm trước writes; fixture trung tính; không đọc .env Production; không destructive operation trước guard. Không yêu cầu lại locale:all hoặc E1–E6/E9 đã có evidence nếu không phát sinh rủi ro mới.

## Bàn giao

Đặc tả/mockup đã xử lý finding về semantic và phạm vi, nhưng **không tuyên bố đã đóng gap runtime DB hoặc đã có Claude duyệt bản mới**. Trước implementation fetch main lại; review diff liên quan; hoàn tất probe còn thiếu trên disposable rồi chốt mapping empty của staff main. Không sửa guard để ép dữ liệu khớp mockup.

## Cập nhật yêu cầu thực nghiệm DB tiếp theo
Đã thử chuẩn bị PostgreSQL riêng nhưng setup dừng tại kiểm cổng, trước connection/marker. Cả hai gap vẫn NOT RUN; xem DB-GAPS-RESULT.md và evidence-db/setup-attempt1.json. Automatic approval review chặn lần chẩn đoán tiếp theo; không tự retry. Không thay semantic theo dữ liệu chưa quan sát.

Lượt chẩn đoán riêng sau phê duyệt đã hoàn tất: container running nhưng actual published ports rỗng ở hai snapshot, đã cleanup đúng ID. Không có DB connection/test; G1/G2/G3 vẫn NOT RUN. Chi tiết và lựa chọn network cho lượt sau ở DB-GAPS-RESULT.md.
