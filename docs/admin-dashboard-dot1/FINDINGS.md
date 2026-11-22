# Bảng finding → đặc tả mới nhất → xử lý

Lập trước khi hiệu chỉnh tài liệu/mockup, 21/11/2026. Đây là đối chiếu theo review người dùng cung cấp; không tự gán tác giả review là Claude.

## Phiên bản được đối chiếu

- Review: `review-input/REVIEW-75b07fe.md`, SHA256 `7bf19a600a445045b0ca537ae27cdb42a6c652369ebbb47be3a453afbe859bba`; mã khảo sát trong review: `75b07feed68d6dba833dd730b17e9d74902cac34`.
- Review dẫn đề xuất cũ ở checkout gốc còn ghi 5d4d073: DE-XUAT SHA256 `87a6cec3a4a14c0ce9bedfb1b0536eb0461df915e590b80d02e3a641791a4f94`, mockup SHA256 `5d347821753122d3f5f166c4769e1fb1811a333a8c501bfac7ddce185cf1b400`. Review không ghi hash riêng các tài liệu này: hash trên là byte quan sát trong lượt hiện tại, không chứng minh hồi tố byte reviewer đã đọc.
- Đặc tả mới nhất trước lượt này: bản worktree sạch, snapshot `review-input/DE-XUAT-before-update.md`, SHA256 `108d38e8012b70de2c2c4416640b6ddd3cf6e559e36a6b7c93bed039afb12518`. Tài liệu chưa commit nên không có SHA commit tài liệu; HEAD/main `75b07fe` chỉ là SHA nền mã. Không áp finding đã sửa trong bản mới như thể còn nguyên.

| Finding | Đặc tả mới nhất trước sửa | Còn cần sửa lúc bắt đầu | Xử lý trong gói cuối |
|---|---|---|---|
| H1: R1 dùng draft._status suy diff | §2 đã bỏ nhãn diff và R1 | Đã xử lý đặc tả; mockup cũ chưa | Mockup không có diff; reason chỉ dựa review snapshot |
| H2: hai loại duyệt có ràng buộc | §2 còn gọi ba trục độc lập, §3 cho REVIEW_CONTENT + REVIEW_SHARED đồng thời | Có | Ba mặt thông tin tách biệt nhưng coupled; chưa approved chỉ CONTENT, cấu trúc “Đi cùng lần duyệt nội dung”; không tạo approved structure + in-review trên dữ liệu hợp lệ |
| H3: empty landing thiếu main | §2/6 đã xét draft và main | Đã xử lý đặc tả; cần mockup | Case xóa hết draft nhưng main còn khối không N/A |
| H4: denied vs error vs empty | Có partial errors nhưng chưa union denied riêng | Có | Mỗi nguồn ok/denied/error; phân loại empty theo nguồn, không dùng quy tắc chung |
| H5: ảnh/khối từ staff/depth0 sai | Đã nói guest/unknown nhưng chưa thuật toán đủ chi tiết | Có | Bảng tri-state media, guard đủ dữ liệu trước blockIssues; relation không resolve unknown; không kết luận ingredients/line từ staff |
| M1: inventory/count | Đã cảnh báo bounded read N/M, chưa pagination | Có, owner chốt 20/page | ?page=, sort slug,id; count Products current page, Home riêng |
| M2: dependency Home | §6 đã ghi đúng khác biệt guard | Đã xử lý thuật toán; thiếu thực nghiệm DB | Mockup Home missing EN; pure helper probe bổ sung, DB publish flow còn chưa xác minh |
| M3: nguồn main cho dependency | §4 còn cho internal adapter reader | Có, owner chốt Local API | Staff Local API draft:false, không adapter/bypass; ba locale riêng, không locale:all |
| L4: translator không publish | Có quyền và chỉ dẫn nhưng reason còn trông như việc cấp publish | Cần làm rõ | Thông báo quyền riêng, việc xem xét nội dung vẫn có thể hiện; không count quyền thiếu như task |
| Mockup: FORMA KO và việc trùng | Worktree mới chưa có mockup đồng bộ | Có | Nội dung chưa approved không có structure approved; primary reason độc quyền CONTENT/SHARED/DEPENDENCY |
| Mockup denied, Home dependency, xóa landing | Chưa có | Có | Có ba kịch bản và link locale minh họa |
| Ghi nhận public hashes/_save ngoài phạm vi | Không thay schema/ACL | Không sửa trong MVP | Không đưa các trường đó vào dashboard client; không tuyên bố API hiện có đã được đóng |

## Trạng thái đóng và giới hạn

“Đã xử lý” ở bảng này nghĩa là **đã sửa đề xuất/mockup**, không phải implementation đã qua integration. H1–H5, M1, M3 và L4 có quy tắc cập nhật; M2 có thuật toán/mẫu nhưng vẫn cần xác nhận DB cho Home dependency. Giữ nguyên review đầu vào và evidence cũ; không gán 28/28 hoặc 2/2 cho tài liệu/runtime mới.

Thực nghiệm DB còn thiếu: Home CMS/default + dependency nhiều locale; main của Product chưa từng publish. Không chạy lại E1–E6/E9 đã có bằng chứng, không mở locale:all. Không có DB disposable/credential/marker được xác minh trong lượt này; không kết nối DB để bổ sung. Các gap đó giữ trong EVIDENCE.md, không gọi đã đóng về runtime.


## Tiếp tục kiểm gap DB
Lượt mới dừng ở setup port mismatch trước connection; G1/G2/G3 đều NOT RUN. Không nâng mức đóng M2 hoặc main Product chưa publish. Xem DB-GAPS-RESULT.md; phiên bản/hash cuối theo HANDOFF.sha256.

## Cập nhật implementation 22/11/2026
G1/G2/G3 đã đạt3/3; gap Home dependency/main Product đã có chứng cứ mới tại expected-actual.json. Mapping runtime áp dụng kết quả thật; code chờ Claude review. Đọc IMPLEMENTATION-HANDOVER.md thay cho các nhãn NOT RUN lịch sử phía trên. Không tuyên bố self-review là Claude review.
