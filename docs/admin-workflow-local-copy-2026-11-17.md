# Workflow trên bản sao DB Local — 17/11/2026

## Phạm vi và kết quả

Commit tài liệu triển khai: `96525363cbb17674664f8ff44d798e5a6e732c53`. Bản sửa tiếp theo trên nhánh `codex/admin-locale-unpublish-fix`, chưa push/deploy. Không lặp upload hoặc nâng dependency.

Đã kiểm trên bản sao **Local**, không phải Production: PostgreSQL 17.6, pg 8.20.0, Payload 3.92.1. Nguồn Local được xác minh bằng kết nối thật: database drphynex, 4 sản phẩm, 8 migration. pg_dump chỉ đọc; dump custom 718842 byte, SHA-256 `f8d8caf2c4c84393c21702fd071c67d3d36e562a0ea2a14ee1a20b6ec61abfd6`.

Container mới dùng image ID đã có, loopback 127.0.0.1:55497, network riêng, tmpfs 1 GiB, memory 768 MiB, 1 CPU; không mount volume/bind từ nguồn. Xác minh container ID/port/mount/network trước restore. Tạo role test không superuser, không CREATEDB/CREATEROLE; database drphynex_independent_review_test có marker riêng. Kết nối TCP thật kiểm database, marker, role, IP server trước mọi ghi ứng dụng. Không dùng secret Production, không nạp .env, không SMTP/R2; launcher allowlist biến hệ thống và credential test riêng. Không reset schema, không chạy migration. Account được tạo chỉ trong bản sao; không dùng account thật để kiểm.

## Lỗi đã tái hiện và sửa tối thiểu

**Unpublish toàn tài liệu làm ẩn cả locale khác.** Với Product đã công khai KO/EN/VI, sửa KO, lưu nháp, duyệt riêng và publish KO vẫn giữ EN/VI đúng. Nhưng PATCH ?locale=ko với `_status: draft` không có draft=true khiến Payload chuyển trạng thái dùng chung của tài liệu: guest EN/VI cũng mất. Log trước sửa dừng tại assertion EN expected nội dung công khai nhưng received null. Đây là lỗi mất khả năng truy cập nội dung hợp lệ; không phải bằng chứng lộ nháp.

Sửa tại `src/hooks/publishLocale.ts`: từ chối update `_status: draft` nếu không phải Save Draft, trả 409 có giải thích ảnh hưởng toàn bộ locale. Áp dụng hook chung collection/global, REST và Local API. Không giả rằng publishSpecificLocale sẽ khiến Unpublish của Payload trở thành riêng locale. Save Draft giữ nguyên; đường hạ duyệt có chủ đích qua request publish riêng locale vẫn được kiểm và hoạt động.

**Giới hạn chủ đích:** không triển khai tính năng Unpublish riêng locale hoặc UI thu hồi mới. Nút Unpublish toàn tài liệu sẽ nhận lỗi rõ thay vì làm mất các bản hợp lệ. Không hướng dẫn suy diễn rằng đổi dropdown rồi Save Draft tự thu hồi công khai: thao tác hạ duyệt hợp lệ trong test là request rõ ràng từ revision đang approved, không đổi nội dung, `_status: published` cùng translationStatus thấp hơn. Chuỗi Save Draft trước thu hồi cần nghiệm thu UI riêng; Publish lại revision in-review vẫn bị từ chối, giữ bản công khai cũ.

## Kiểm tra nguồn cuối

- `vitest.workflow.config.mts`, envDir:false, một worker, file tuần tự, heap Node 2048 MiB; chỉ hai file có mục tiêu. `tests/workflow/admin-workflow-copy.spec.ts` tách khỏi integration mặc định vì cần đúng bản sao/endpoint đã ghim, không có dropDatabase/migrate.
- **18 integration PASS**: 4 ca thiết lập Product/Brand × admin/editor, 12 chu trình KO/EN/VI, 2 ca cạnh tranh Home Page.
- Mỗi chu trình: sửa + Approved không kế thừa duyệt; full draft form Publish bị 409; nháp và bản công khai cũ giữ nguyên; lưu Approved riêng rồi publish 200; nội dung/SEO và draft locale khác giữ nguyên; translator không thu hồi được (403); admin/editor thu hồi được, locale khác giữ nguyên; republish; Unpublish toàn tài liệu bị từ chối qua REST/Local và không thay dữ liệu.
- Hai writer thực đồng thời (admin/editor): writer thứ hai được quan sát đang chờ advisory lock trong đúng database. Nội dung đi trước khiến approval basis cũ bị từ chối; approval đi trước thì nội dung mới xoá approval cũ. Deadline hữu hạn. Đây là Local API với hai actor, không phải hai browser.
- **8 unit PASS**: collection/global × KO/EN/VI chặn Unpublish toàn tài liệu, không đổi data/context khi từ chối; hai ca Save Draft vẫn hợp lệ.
- Nguồn cuối: tổng **26/26 PASS**, exit 0, 17.59 giây. Log ERROR 409/403 là lỗi dự kiến trong assertions, không phải test thất bại.
- Typecheck `tsc --noEmit --incremental false`: PASS. Lint có mục tiêu: PASS, 0 warning cuối. Prettier và git diff --check: PASS.
- Các lượt setup trước đó đã fail closed do biểu diễn Docker tmpfs và PostgreSQL inet /32; đã đọc metadata thật, sửa chốt của harness cho đúng representation, không bỏ kiểm identity. Một expectation helper global được sửa để xử lý response rỗng `{}` là không có nội dung; không bỏ assertion chống lộ copy/SEO.
- Payload tự sinh lại types chỉ khác EOL, đã đối chiếu git diff và khôi phục EOL; không có thay đổi schema/types có ý nghĩa. Không build hoặc tái chạy toàn bộ unit/upload.

## Bảo toàn dữ liệu và cleanup

Trước cleanup, checksum hàng products và products_locales của 4 ID gốc trên source/copy khớp; cả hai vẫn 8 migration. Hook test cũng kiểm bốn hàng Product gốc trong bản sao không đổi. Chỉ ghi fixture Product/Brand/Home và account test trên bản sao. Không ghi, migrate, publish hay tạo/sửa account trên drphynex/Production.

Container `a5462fe1fe3626e9a319689476c9f7f372019ffaf31a53265ee3a635ff61f437` và network `drphynex-workflow-20261117-net` đã được dừng/xoá sau kiểm chính xác identity và membership. Không tạo volume. Không tác động container Dr.PhynEX Local hoặc Supabase khác. Dump/log/evidence nằm ngoài Git trong thư mục bằng chứng của chat; không đưa file credential test vào repo.

## Giới hạn và việc còn mở

- Chưa build và nghiệm thu nút/error 409 trên hai phiên browser Admin của bản sửa. Không dùng kết quả backend thay cho browser.
- Test lỗi trước sửa xác nhận Product; bản sau sửa kiểm cả Product và Brand. Không tuyên bố đã tái hiện lỗi trước sửa trên mọi collection/global.
- Chưa kiểm HTML/metadata HTTP của server chạy từ bản sao ở lượt này; truy vấn guest dùng overrideAccess=false, fallbackLocale=false, draft=false. Browser nháp ba ngôn ngữ và HTTP guest đã kiểm ở đợt Admin cơ bản trước.
- Chưa mở rộng mọi interleaving/concurrency hoặc lost-update của Product/Brand; hai ca giao dịch thật tập trung lock/approval Home Page.
- Warning webpack chưa có diagnostic vẫn mở. Không nâng dependency để che warning.
- Bản sửa chưa được tích hợp/deploy; Production hiện chưa nhận chốt Unpublish này. Bốn sản phẩm thật vẫn draft theo đợt Admin cơ bản.

