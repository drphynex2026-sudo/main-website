# Chặn tổ hợp draft + unpublishAllLocales

Baseline: `f74c915a14dd67bfdf1a2d23177b5ff1cc70fa5d`, nhánh `codex/admin-locale-unpublish-fix`, PR #1. Working tree sạch trước sửa. Chưa merge/deploy.

## Phát hiện và bằng chứng trước sửa

P1: `draft=true&unpublishAllLocales=true` vượt guard dựa trên `_status` và `!savingDraft`. REST Product PATCH và Brand Page POST đều trả 200. Bảng chính không đổi nhưng bảng version và locale của version đổi checksum, số version không tăng: Payload sửa version mới nhất tại chỗ.

Lưu ý setup: publish riêng locale tạo thêm snapshot draft. Regression cố ý chuẩn bị trạng thái latest-version published bằng SQL fixture có giới hạn đúng ID version trên database disposable, kiểm cả `latest=true` và status trước request. Không gọi đây là trạng thái mặc định sau publish của ứng dụng. Lượt chuẩn bị đầu tiên thất bại ở assertion setup (snapshot vẫn draft), chưa tới request; chỉ lượt sau khi sửa setup mới là bằng chứng tái hiện lỗi.

Nguồn Payload đã đọc: REST endpoint parse `unpublishAllLocales` thành boolean; Local API chuyển option tới operation; collection/global chuyển tiếp tới `saveVersion`, nơi `unpublish` gọi `updateLatestVersion`. Cờ có tác dụng độc lập với `_status` và `draft`.

## Sửa tối thiểu

Hook dùng chung từ chối `unpublishAllLocales === true` hoặc `'true'` trên update trước kiểm locale, bất kể draft/status. Giữ chốt cũ đối với `_status:draft` không có draft=true. Không sửa wrapper, schema, dependency, ACL hoặc quy trình duyệt.

Unit mô phỏng Admin native: không có query locale, `req.locale=ko` mặc định; `locale=all` được giữ thành edge case riêng. Chuỗi `'true'` là phòng vệ tại hook, không khẳng định Local API typed hỗ trợ chuỗi.

## Kiểm thử và cô lập

- Container mới `60f2e746e55c27484b9bf22f409261d38cb407ed37618cfd691441b5052f4747`, network riêng `drphynex-unpublish-20261120-net`, tmpfs, loopback 55497, 768 MiB/1 CPU.
- Trước restore/ghi fixture: kiểm ID, binding, mounts/network; kết nối thật xác minh database `drphynex_independent_review_test`, marker `drphynex-independent-review-disposable-v1`, role `workflow_test` không superuser. Test xác minh thêm endpoint/IP. Không kết nối DB nguồn.
- Dùng dump Local đã có, SHA-256 `eeb8b514f8382010fd07afc337b10b92ee4fea2840d6dbf044c5a73a29d8f5ae`; không phải bản sao Production. Không migration/reset schema.
- Trước sửa: unit mới đỏ vì không throw; hai regression DB đỏ đúng status 200 thay vì 409. Evidence chứa count/hash toàn bộ bảng chính, locale, quan hệ và version; không chứa nội dung bảng hoặc credential.
- Sau sửa: **39/39 PASS** = 16 unit + 23 ca workflow DB. Một worker, heap 2048 MiB, env allowlist, config envDir:false, không nạp .env.
- Typecheck (`tsc --noEmit --incremental false`), ESLint ba file mã/test, Prettier và `git diff --check`: PASS trên nguồn cuối. PostgreSQL 17.6, pg 8.20.0, Payload 3.92.1. File types do Payload tự ghi lại chỉ khác EOL; đã xác minh nội dung chuẩn hóa khớp HEAD và khôi phục CRLF, không đưa vào commit.
- Regression mới so count/hash mọi cột của mọi hàng trong nhóm bảng Product hoặc Brand Page trước/sau REST, Local API có user/access và raw Local API overrideAccess:true; body có hoặc thiếu `_status`. Bao gồm approval, timestamp, ID và số version. Unpublish bulk native và bulk kèm draft/flag đều không ghi dữ liệu. Save Draft và lưu Approved riêng vẫn được; request thực do `buildApprovalRequest` tạo được chạy qua endpoint Home Page và ghi approval thành công.
- Các ca cũ trong suite kiểm publish/approval/thu hồi, giữ locale khác, và hai actor tranh khóa vẫn PASS. Bốn Product gốc trong dump không đổi theo assertion cuối suite.

Evidence ngoài Git tại thư mục visualizations của đợt kiểm: `unpublish-before-20261120.log`, `unpublish-after-20261120.log`. Không đưa file credential hoặc dump vào commit.

Giới hạn: không mở browser mới hoặc build lại trong vòng sửa nhỏ này; request ApprovalPanel được kiểm ở endpoint bằng helper production, không gọi đó là kiểm browser. Kết quả build/browser của baseline chỉ áp dụng nguồn baseline. Không lặp upload. Cấu hình `vercel.json` tắt auto-deploy riêng nhánh PR giữ nguyên. Cần review SHA mới trước merge/deploy.

## Checkpoint siết bulk sau review độc lập

Đổi riêng test: cả request bulk native và tổ hợp draft/unpublish phải trả đúng 409 và đúng toàn bộ thông báo guard, không còn chấp nhận 400 chung. Query dùng `where.and` với `_status.not_equals=draft` và `id.in` theo `@payloadcms/ui/UnpublishMany/DrawerContent`; không dùng ID equals đơn lẻ thay cho request Admin. Count/hash bảng chính và versions vẫn được đối chiếu sau mỗi lần từ chối. Regression liên quan 39/39 PASS trên DB disposable mới đã xác minh. Không đổi runtime, schema, dependency hoặc giới hạn fixture SQL đã nêu.

Kết quả production build và browser tiếp theo được ghi vào PR #1 theo SHA checkpoint cuối; các ghi chú chưa build/browser trong phần lịch sử phía trên mô tả thời điểm trước các lượt xác nhận đó.
