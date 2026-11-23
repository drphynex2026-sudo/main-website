# Sửa review Dashboard tại aadbc408 — bàn giao Claude

Ngày 23/11/2026. Baseline `aadbc408438f033eae6abf0d97d89d74275ba2f3`, nhánh `codex/dashboard-phase-one`. SHA cuối được chốt bằng commit local trong bàn giao; không chỉnh runtime sau checkpoint. Chưa push/PR/merge/deploy, không ghi Production.

## Finding → sửa → bằng chứng

| Yêu cầu | Sửa | Bằng chứng mới |
|---|---|---|
| Products đọc tuần tự | mapProducts có4worker, giữ index input, dừng xếp Product mới khi gặp lỗi và drain worker còn chạy trước throw; không Promise.all inventory/cache | unit dashboard-concurrency3/3; integration peak36 top-level finds và thứ tự1..20 |
| Tổng hợp làm sập dashboard | try/catch bao readDashboard (gồm snapshot) và taskCounts; fallback giữ header/shortcut theo permissions, không dựng count0 | unit fallback4/4, ba role + projection error; browser production process test tiêm lỗi tổng hợp giữ7shortcut admin |
| Product dependency chưa có int | Fixture app thật: main KO/EN published, shared đổi, KO duyệt mới, EN chưa duyệt | missing=[EN], href đúng ID22+localeEN; guard409 thật; durable hash main/versions không đổi |
| Chưa publish | Assertion staff main và guest từng locale | staff có1main statusdraft, guest0documents ởKO/EN/VI; không suy guest denied từ rỗng |
| Auto-deploy trước push | Thêm git.deploymentEnabled["codex/dashboard-phase-one"]=false, giữ rule cũ, không ruletrue chồng | vercel.json + tài liệu chính thức; chưa push nên chưa kích hoạt Vercel |

## Concurrency thực tế

Một Product chạy9Local API finds cấp cao nhất: draft/main/guest ×3locale. Tối đa4Product => **36 top-level Product finds** đang chờ. Unit với gate và integration proxy đều đo peak36. Không có nghĩa36SQL chạy đồng thời: populate có thể tạo thêm truy vấn, pool adapter là giới hạn khác (Local max10; Vercel3 theo config hiện có). Home9reads chạy sau Products; count/list trước map. Không cache hoặc Promise.all toàn bộ inventory; Promise.all chỉ4worker và fan-out9 trong mỗi Product. Không tuyên bố benchmark Production hoặc latency chắc cải thiện.

## Kiểm tra thực chạy

- Typecheck exit0, lint phần sửa exit0.
- Unit **37/37**: snapshot30 cũ liên quan + concurrency3 mới + fallback4 mới. Không gọi toàn suite.
- Integration **11/11**:8ca trước +3ca mới. Database disposable PostgreSQL17.6; marker/name/server IP/system_identifier xác minh trước schema. Tạo fixture qua Payload Local API. Không restore/import Production hoặc SQL sửa nội dung/approval.
- Production build exit0, heap2048MiB,1worker,7static pages. Lượt này ghi Compiled successfully; **không sửa hoặc tuyên bố đã khắc phục warning build cũ**.
- Browser normal: dashboard có20/22Products ởtrang1, Home riêng, formGET,7shortcut admin; không fallback.
- Browser fallback: title Bảng điều khiển, alert chính xác “Chưa đọc được bảng việc. Hãy tải lại.”,7shortcut đúng quyền admin,0cards, không nhãn count0/success và không sentinel lỗi. Không lặp198link/9viewport; mã sinh href không đổi, mới chạy ca ngắn theo yêu cầu.
- Checksum16bảng nội dung/version trước/sau normal và fallback giống nhau; launcher exit0, server/container/network/credential test được cleanup. RUN-COMPLETE giữ latch, không xóa để tự rerun.

## Cách thử fallback không tạo production backdoor

`aggregate-fault.cjs` là preload **chỉ process test**; parent đã xác minh DB disposable/marker. Hook kiểm DBURL loopback + tên test + runId/evidence flag, parse bundle với acorn đã cài, tìm duy nhất async function chứa readDashboard logic, ghi hash bundle nguyên bản rồi inject throw **trong bộ nhớ**. Không sửa bundle trên đĩa, không endpoint/query/env flag trong src, không đổi guard. `runtime/fault-injection.json` ghim hash/path/offset. Normal process và fault process dùng cùng build, DB, origin; fault chỉ thử catch của tổng hợp, không giả lỗi hạ tầng PostgreSQL. Secret sentinel test không chứa credential thật và không xuất hiện ởUI.

Các harness/evidence mới nằm trong thư mục này; không chạy lại launcher cũ hoặc ghi đè RUN-COMPLETE cũ. File test có evidence-dir để không overwrite evidence trước.

## Phạm vi và giới hạn giữ nguyên

Runtime chỉ dashboard-read.ts + Dashboard.tsx. Thêm2unit, bổ sung integration hiện có; vercel.json chỉchốt nhánh. Không diff guard/access/preview/schema/migration/dependency hoặc snapshot business rules. Các finding thấp/cảnh báo cũ không mở rộng xử lý. Test concurrency không đếm truy vấn populate; snapshot nhiều query vẫn không atomic. Browser chỉadmin ca thường/fallback; unit kiểm quyền fallback ba role, bằng chứng browser ba role/198link tại baseline vẫn là lịch sử, không gán cho bản mới.

Sau build chỉ bỏ blank linesEOF, không đổi token thực thi; fingerprint nguồn cuối trong runtime.sha256. Raw logs giữ nguyên. Tự kiểm không phải Claude review.

## Chốt trước push/PR

CLI Claude không có trong PATH. Đã thử cửa sổ Claude Desktop qua Computer Use: chỉ nhận pane rỗng; screenshot FrameArrived timeout, recovery Raise báo thiếu geometry; **chưa gửi được yêu cầu review, chưa có kết luận Claude**. Không thao tác mù và không tự coi blocker đã đóng độc lập. Prompt chuyển giao ở CLAUDE-REVIEW.md. Chỉ push/mở PR khi Claude kiểm đúng SHA cuối và không còn blocker; verify lại head/status và ruleVercel trước push. Không merge/deploy.

Tài liệu Vercel đã đối chiếu: https://vercel.com/docs/project-configuration/git-configuration — git.deploymentEnabled map cho exact branch false; nhánh không khai báo mặc định true. Không thay cấu hình dịch vụ/cloud secrets.
