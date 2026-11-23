# Claude review ngắn — OG + đo dashboard

**Kết quả cuối:** Claude Opus 5.5 review qua [phiên này](https://claude.ai/chat/8f109b79-b4e3-4ff4-b7db-02dbd68cf266) đã xác nhận B1 được xử lý, không còn blocker cho PR/merge/deploy và lượt đo. Nội dung bên dưới là yêu cầu review ban đầu; kết quả thực đọc lưu ở `evidence/approved-measurement/claude-review.txt`. Claude chỉ review gói dán, không chạy test hay truy cập repo.

- B1: caller ngoài phiên đo chờ pool bị gán nhầm context khi client được release. Đã đọc `_release`/`_pulseQueue`/`pendingItem.callback` trong pg-pool hiện cài; regression đúng lỗi cho queryCount2 thay vì1 trước sửa, sau bind mọi callback pool.connect thì 55/55 unit đạt. Lỗi setup spy ban đầu không được dùng làm bằng chứng tái hiện.
- Nguồn cuối sau B1: typecheck exit0, lint exit0 (file Admin generated được kiểm --no-ignore riêng), production build webpack exit0, một worker/heap2048 trong workspace riêng. Artifact nguồn cuối lại trả200 image/png1200×630.
- Cờ process `payloadInitAdapter` xác nhận loader initReq đã được nạp; không chứng minh mỗi request đã gọi getPayload. Nếu getPayload chạy trong metadata trước RootPage, payloadGetMs có thể nằm ngoài cửa sổ serverToDashboardDataMs. rootAssemblyMs có thể null khi log. Không cộng/trừ hoặc suy full HTTP từ các trường này.
- Giới hạn không blocker từ Claude: callback client.query nối chuỗi trực tiếp ngoài phép đo chưa bind đối xứng; luồng Pool.query/Drizzle promise đang dùng đã được bảo vệ. `result:ok` chỉ nghĩa reader trả về, không chứng minh mọi safeRead thành công; phải đối chiếu UI/snapshot riêng. Cap theo process có thể bị các lượt Admin khác dùng chung. Chưa có timing Production.
- Neon console đã xác nhận project drphynex ở AWS Singapore. Metadata Production trước merge vẫn SHA5ec6a27, READY, regioniad1. Chưa đối chiếu secret connection URL để chứng minh mapping project/connection; không đổi region.

Nền: `5ec6a27fbcf4c0369a5ad2bc4c10aa83f810402d`; nhánh `codex/og-artifact-dashboard-diagnostics`.

Owner cho phép PR/merge/deploy **sau** review không còn blocker. Chưa có kết luận Claude cho bản này. Không có quyền ghi nội dung/ACL/migration Production.

## Diff hiện tại

1. OG: pre-loader duy nhất cho `@payloadcms/next/dist/routes/rest/og/index.js`, đổi import fs thành adapter; DefinePlugin nhúng chính bytes font vendor. Không sửa node_modules. Public licenses giữ copyright Google 2011 (đọc từ bảng name của WOFF), Apache2 và Payload MIT; không tải/thay font.
2. Dashboard: nối wrapper tại reader, giữ nguyên options/read order/concurrency/ACL/guest context. Observer pg chỉ lấy đồng hồ/count, không đọc SQL hoặc parameters. AsyncLocalStorage tách nhóm/request; React request cache giữ timing Admin, không cache dữ liệu/người dùng giữa request.
3. Root Admin gọi wrapper bắt đầu timing. Pre-loader riêng khớp chính xác SDK `utilities/initReq.js`, chỉ đổi tên import getPayload và bọc lời gọi gốc bằng đồng hồ, kiểm contract để fail build khi SDK thay đổi. Không đổi quyền hoặc cách khởi tạo. File Admin page do Payload sinh có thay một wrapper; khi regenerate phải giữ/kiểm lại wrapper này.
4. Không endpoint chẩn đoán; không metrics trong HTML/RSC/header. Log JSON cố định gồm nhóm, timing/count, UUID ngẫu nhiên, region/process flags và tình trạng đo. Không SQL/parameters/connection URL/cookie/token/email/ID tài liệu/nội dung/stack.
5. Bật phải đồng thời có `DASHBOARD_DIAGNOSTICS=1` và `DASHBOARD_DIAGNOSTICS_UNTIL_MS` hợp lệ trong tương lai. Mặc định tắt, hết hạn tự tắt trên deployment cũ. Cap 8 records/process, tối đa20; không phải quota toàn deployment. Khi kết thúc đo đặt cấu hình flag=0 cho lần deploy sau, đồng thời xác nhận expiry đã dừng log trên deployment hiện tại; không deploy trùng chỉ để đo.

## Ranh giới timing cần review

- `serverToDashboardDataMs`: entry Admin server component → hết dashboard read/projection. Đây là tổng **đến dữ liệu**, không phải tổng HTTP hay toàn React render/stream. `rootAssemblyMs` là await RootPage, không phải render hoàn tất.
- `payloadGetMs`/calls: await getPayload thật do SDK gọi; có thể là instance đã có. Không gọi là cold initialization. Nếu không có lời gọi trong render này, null thay vì 0.
- `appReadTotalMs`: tổng reader; inventory count/list, Products/Home draft/main/guest là wall spans Local API. Projection là snapshot đồng bộ. Không cộng các spans chồng lấp thành total.
- `driverSumMs`/queryCount và `acquireSumMs`: chỉ từ callback/promise pg thật được observer nhìn thấy. Driver gồm network/PostgreSQL/deserialization; acquire gồm chờ và mở kết nối, không đo riêng CPU DB hay thuần queue. Query dạng không quan sát được đánh dấu `unmeasuredQueries`; `driverObserved=false` khi không gắn được pool. Không suy DB từ wall Local API.
- Tổng HTTP/server invocation hoàn chỉnh sẽ chỉ báo nếu Vercel runtime metadata thật cung cấp; không dùng mốc server-to-data hoặc browser completion để giả tổng này. Nếu không có, ghi chưa đo. Browser TTFB/document duration/load được ghi riêng nếu công cụ cung cấp.

## Kế hoạch Production sau review

- Giữ region/pool/concurrency/cache. Xác minh origin/main, PR SHA/checks; bật đúng ba biến không bí mật với expiry ngắn trước merge để chỉ main auto-deploy một lần. Theo dõi Ready/SHA, không tạo deployment song song.
- `/api/og`: 200 image/png1200×630 và mở ảnh; log không còn lỗi font. Artifact Windows trước đó đạt, có giới hạn harness đã ghi; không coi là Production PASS.
- Cùng phiên Admin/dữ liệu, bốn lượt (đầu quan sát +3 tiếp theo), không ghi nội dung. Xuất riêng log metrics allowlist, snapshot/count/link mẫu và mẫu guest draft/private file. Không gọi lượt đầu cold start.
- Function region từ deployment metadata + event VERCEL_REGION; Neon region từ console metadata khi có phiên hợp lệ. Nếu chưa có, giữ chưa xác minh, không đọc hàng loạt env/secret.
- Kết thúc flag=0 trong cấu hình, expiry bảo đảm code ngừng ghi ngay trên deployment hiện tại; xác minh không còn event mới. Không tối ưu tiếp trước số đo.

## Điều cần Claude kiểm

- Scope loader/font và quyền đọc không thay đổi; giấy phép/nguồn giữ đúng.
- Async/callback observer không thay return/error hoặc trộn thông tin request; guard log/expiry/cap không gây lộ dữ liệu.
- React request timing và SDK init timing có ý nghĩa đúng ranh giới; không diễn giải server-to-data thành full HTTP/render.
- Báo blocker cụ thể có file/dòng. Không gán kết quả build/artifact trước wiring cho nguồn này; kết quả cuối và fingerprint kèm bundle sẽ chốt sau kiểm.
