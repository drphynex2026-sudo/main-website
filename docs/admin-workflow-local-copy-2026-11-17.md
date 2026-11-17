# Workflow trên bản sao DB Local — 17/11/2026

## Phạm vi và kết quả

Commit tài liệu triển khai: `96525363cbb17674664f8ff44d798e5a6e732c53`. Bản sửa tiếp theo trên nhánh `codex/admin-locale-unpublish-fix`, chuẩn bị PR; không merge/deploy trong đợt này. Không lặp upload hoặc nâng dependency.

Đã kiểm trên bản sao **Local**, không phải Production: PostgreSQL 17.6, pg 8.20.0, Payload 3.92.1. Nguồn Local được xác minh bằng kết nối thật: database drphynex, 4 sản phẩm, 8 migration. pg_dump chỉ đọc; dump custom 718842 byte, SHA-256 `f8d8caf2c4c84393c21702fd071c67d3d36e562a0ea2a14ee1a20b6ec61abfd6`.

Container mới dùng image ID đã có, loopback 127.0.0.1:55497, network riêng, tmpfs 1 GiB, memory 768 MiB, 1 CPU; không mount volume/bind từ nguồn. Xác minh container ID/port/mount/network trước restore. Tạo role test không superuser, không CREATEDB/CREATEROLE; database drphynex_independent_review_test có marker riêng. Kết nối TCP thật kiểm database, marker, role, IP server trước mọi ghi ứng dụng. Không dùng secret Production, không nạp .env, không SMTP/R2; launcher allowlist biến hệ thống và credential test riêng. Không reset schema, không chạy migration. Account được tạo chỉ trong bản sao; không dùng account thật để kiểm.

## Lỗi đã tái hiện và sửa tối thiểu

**Unpublish toàn tài liệu làm ẩn cả locale khác.** Với Product đã công khai KO/EN/VI, sửa KO, lưu nháp, duyệt riêng và publish KO vẫn giữ EN/VI đúng. Nhưng PATCH ?locale=ko với `_status: draft` không có draft=true khiến Payload chuyển trạng thái dùng chung của tài liệu: guest EN/VI cũng mất. Log trước sửa dừng tại assertion EN expected nội dung công khai nhưng received null. Đây là lỗi mất khả năng truy cập nội dung hợp lệ; không phải bằng chứng lộ nháp.

Sửa tại `src/hooks/publishLocale.ts`: từ chối update `_status: draft` nếu không phải Save Draft, trả 409 có giải thích ảnh hưởng toàn bộ locale. Áp dụng hook chung collection/global, REST và Local API. Không giả rằng publishSpecificLocale sẽ khiến Unpublish của Payload trở thành riêng locale. Save Draft giữ nguyên; đường hạ duyệt có chủ đích qua request publish riêng locale vẫn được kiểm và hoạt động.

**Giới hạn chủ đích:** không triển khai tính năng Unpublish riêng locale hoặc UI thu hồi mới. Nút Unpublish toàn tài liệu nhận lỗi rõ thay vì làm mất các bản hợp lệ. Việc thu hồi được kiểm ở mức backend không phải hướng dẫn vận hành: không đề nghị người quản trị tự gửi API hoặc hạ trạng thái rồi Save Draft để gỡ nội dung. UI thu hồi riêng locale chưa có. Publish lại revision in-review vẫn bị từ chối, giữ bản công khai cũ.

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

## Giới hạn tại checkpoint trước vòng xác nhận cuối

- Chưa build và nghiệm thu nút/error 409 trên hai phiên browser Admin của bản sửa. Không dùng kết quả backend thay cho browser.
- Test lỗi trước sửa xác nhận Product; bản sau sửa kiểm cả Product và Brand. Không tuyên bố đã tái hiện lỗi trước sửa trên mọi collection/global.
- Chưa kiểm HTML/metadata HTTP của server chạy từ bản sao ở lượt này; truy vấn guest dùng overrideAccess=false, fallbackLocale=false, draft=false. Browser nháp ba ngôn ngữ và HTTP guest đã kiểm ở đợt Admin cơ bản trước.
- Chưa mở rộng mọi interleaving/concurrency hoặc lost-update của Product/Brand; hai ca giao dịch thật tập trung lock/approval Home Page.
- Warning webpack chưa có diagnostic vẫn mở. Không nâng dependency để che warning.
- Bản sửa chưa được tích hợp/deploy; Production hiện chưa nhận chốt Unpublish này. Bốn sản phẩm thật vẫn draft theo đợt Admin cơ bản.

## Hoàn thiện phạm vi và Admin production Local

Phạm vi hook là các entity dùng contentCollection/contentGlobal, không tự áp dụng cho mọi collection Payload. Media, Source documents, Users và hai hộp thư không có hook này. Các field dùng chung trong entity nội dung vẫn thuộc workflow của entity. Không có thay đổi schema hoặc dependency.

Cả khi chỉ có EN công khai, Unpublish toàn tài liệu vẫn bị chặn có chủ đích; KO/VI không tồn tại không làm chức năng này được mở lại. Tạo bản nháp và Save Draft với draft=true vẫn hỗ trợ. Không thêm điều kiện tự đoán số locale công khai hoặc thao tác API thủ công để vượt chốt.

Browser đã chỉ ra nút native Unpublish gửi unpublishAllLocales=true và bỏ locale. Guard Unpublish vì vậy phải chạy trước kiểm tra locale; nếu không sẽ trả thông báo locale chung. Đã thêm unit và REST regression đúng query native này cho collection/global. Không nới kiểm tra locale của Publish.

vercel.json chỉ tắt auto deployment cho đúng nhánh codex/admin-locale-unpublish-fix để push/PR không triển khai Preview ngoài yêu cầu. Main và nhánh khác không đổi hành vi. Quy tắc chính thức: https://vercel.com/docs/project-configuration/git-configuration#git.deploymentEnabled

### Kết quả xác nhận trên nguồn hoàn thiện

- Suite chuyên biệt: **30/30 PASS** (20 ca DB copy/regression, 10 unit), gồm scope ngoài workflow, một locale công khai và query native Admin `unpublishAllLocales=true` không có locale.
- Regression cũ `draft-save-hook` + `publish-intent`: **34/34 PASS**. Nhóm P1 publish/approval/locale có chọn lọc: **8 PASS, 6 SKIPPED** (upload/restore và ca ngoài phạm vi); không gọi ca skip là PASS.
- Build production webpack: exit 0, heap 2048 MiB, CIRCLE_NODE_TOTAL=1 (Next dùng 1 worker), output trong worktree này. Lần build đầu báo Compiled with warnings không có diagnostic; lần build xác nhận từ cache báo Compiled successfully. Không có bằng chứng xác định nguyên nhân hoặc chữa dứt điểm warning cũ.
- App chạy kiểm trên loopback 127.0.0.1:3057, DB drphynex_admin_ui_test có marker drphynex-admin-ui-disposable-20261117 và role không superuser; tách DB regression có reset schema khỏi DB UI copy. Không có .env thật trong checkout; chỉ env allowlist của launcher. Không sửa Next config, dependency hoặc migration để build.
- Browser Admin fixture Product đa locale: Save Draft liên tiếp, reload giữ PRIVATE UI multi ko final save. Bấm menu "Ẩn tài liệu" (Unpublish) → Xác nhận: toast tiếng Việt giải thích chặn toàn tài liệu, giữ public, Save Draft vẫn dùng được và UI thu hồi riêng locale chưa có. Không hướng dẫn API thủ công.
- Browser Product chỉ có EN công khai: cùng thông báo từ chối rõ. Count/hash của 8 bảng nội dung/versions trước-sau mỗi lần Unpublish khớp, không mất bản nháp hoặc bản công khai.
- Brand: Save Draft và reload giữ nháp riêng KO; HTTP khách vẫn thấy bản công khai cũ. **Không có nút Unpublish trên fixture global này**, nên ca bấm Unpublish global qua browser là NOT RUN; native REST/global và unit đã kiểm. Payload getVersions cho global dùng select updatedAt rồi kiểm _status để quyết định hasPublishedDoc; chưa sửa vendor hoặc mở rộng phạm vi này.
- HTTP guest không cookie: 7 trang (Product đa locale KO/EN/VI, Product EN-only, Brand KO/EN/VI) đều 200, không có PRIVATE UI, title/h1/public marker trước-sau khớp. Không chỉ dựa vào mã HTTP.
- Chỉ account fixture trong bản sao được dùng. Đây không phải nghiệm thu toàn diện hoặc hai browser admin/editor; hai actor PostgreSQL concurrency thuộc suite backend.
- scripts/review-http.ts được cập nhật expectation cũ: Unpublish phải bị từ chối và trang công khai được giữ. Không chạy toàn bộ script này vì nó tạo các fixture không liên quan; HTTP/browsers có mục tiêu được chạy riêng như trên.

Bản sao của lượt xác nhận mới: dump 718842 byte, SHA-256 eeb8b514f8382010fd07afc337b10b92ee4fea2840d6dbf044c5a73a29d8f5ae, lưu ngoài Git ở workflow-ui-build-copy-20261117.dump. Hash cũ phía trên thuộc lượt trước; tên artifact workflow-local-copy-20261117.dump đã được helper dùng lại cho lượt mới, không dùng tên đó để xác minh hash lịch sử. Không thay business backup hoặc DB nguồn.


Hậu kiểm cuối: bốn hàng Product gốc và dữ liệu locale của chúng trong UI copy khớp DB Local nguồn; history vẫn 8 migration. Đã dừng đúng app test 3057 và xoá container/network tạm của lượt xác nhận; không tạo volume hoặc staging lâu dài. Log, ảnh và checksum nằm ngoài Git. Typecheck, lint có mục tiêu, Prettier và diff-check đạt.
