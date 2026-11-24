# Đề xuất kiểm chứng region Singapore — chưa triển khai

**Ghi nhận ngày 24/11/2026:** owner đã duyệt thử Production đúng phạm vi kế hoạch này, gồm giữ `sin1` nếu nhanh hơn rõ và chức năng/quyền đạt, hoặc rollback nếu lỗi/không cải thiện. Phần dưới lưu nguyên kế hoạch đã duyệt, không phải báo cáo kết quả thực thi. Patch được áp dụng trong commit cấu hình đi cùng; kết quả đo và rollout được ghi riêng trong evidence của đợt thử.

## 1. Mốc và quyền thực hiện

- Ngày khảo sát: 23/11/2026; nhánh `codex/dashboard-region-proposal`, tạo từ `origin/main` sau fetch.
- SHA nền và Production: `e3e4eb04b8ce5432bad1945bb28cd365da5502d3`.
- Deployment hiện tại: `dpl_Vm1jvrB5kisYZ9hfSn6KboZg5ARY`, READY, region ứng dụng `iad1`.
- Team plan đọc qua API: **Hobby**, billing status **active**. Không suy gói từ ảnh chụp hoặc memory size.
- Lượt này chỉ đọc metadata/tài liệu và tạo proposal. Patch chưa áp dụng; không commit, push, đổi Vercel/Neon/env, build hoặc deploy. Không ghi database.

## 2. Khả năng được hỗ trợ và chi phí

Tài liệu cấu hình hiện tại cho phép Hobby chọn **một region bất kỳ**, qua `regions` trong `vercel.json`; giá trị này ghi đè region mặc định của Project Settings. `sin1` là Singapore (`ap-southeast-1`). Không cần nâng gói chỉ để chọn một region này. Không đề xuất nhiều region hoặc failover. [Cấu hình regions](https://vercel.com/docs/project-configuration/vercel-json#regions), [danh sách vùng](https://vercel.com/docs/regions).

Hobby không có phí thuê bao cho thay đổi này; thử nghiệm vẫn tiêu hao hạn mức hiện có: 4 CPU-hours, 360 GB-hours memory và 1 triệu invocation mỗi tháng. Chưa đọc usage còn lại nên không hứa quota vô hạn; kiểm lại trước thử, nếu gói chặn thì dừng, không tự nâng. [Hạn mức Hobby](https://vercel.com/docs/plans/hobby).

Để owner thấy mức giá nếu sau này tự chọn Pro, bảng Fluid Compute công bố:

| Region | CPU USD/giờ | Memory USD/GB-giờ |
|---|---:|---:|
| iad1 | 0,128 | 0,0106 |
| sin1 | 0,160 | 0,0133 |

Đây là đơn giá sử dụng, không phải hóa đơn Hobby hay ước tính chi phí theo reader wall time. Singapore đắt hơn theo đơn vị nhưng tổng tiền còn phụ thuộc thời gian CPU/memory thực. Không lấy tổng driver chồng lấp để tính phí. [Fluid pricing](https://vercel.com/docs/functions/usage-and-pricing). Pro hiện niêm yết từ 20 USD/tháng kèm 20 USD usage credit, chưa tính thuế/usage phát sinh; chỉ là tham chiếu, không phải yêu cầu hoặc thao tác nâng gói trong đề xuất. [Pricing](https://vercel.com/pricing).

## 3. Diff đề xuất và điều giữ nguyên

Patch đầy đủ: `vercel-sin1.patch`, **chưa áp dụng**.

```diff
   "$schema": "https://openapi.vercel.sh/vercel.json",
+  "regions": ["sin1"],
```

Thêm đúng một mục bảo vệ nhánh PR trong map hiện có:

```diff
-      "codex/og-artifact-dashboard-diagnostics": false
+      "codex/og-artifact-dashboard-diagnostics": false,
+      "codex/dashboard-region-proposal": false
```

Region là thay đổi vận hành duy nhất; mục còn lại chỉ tắt Git deployment của nhánh đề xuất. Không đổi region project qua UI/API cùng lúc, không dùng CLI override để tránh nguồn cấu hình khó đối chiếu. Không đổi `preferredRegion` từng route.

Giữ nguyên toàn bộ reader/observer đã review, pool Vercel 3 theo mã hiện có, concurrency reader 3, truy vấn/population/ACL, cache/revalidation, Node runtime, memory 2048 MiB, timeout 300 giây, Next/Payload/dependency, URL/origin/noindex, bucket và email. Không chuyển Neon, không migration/schema sync. `CODE-BASELINE.sha256` ghi bytes mã nền để đối chiếu khi chuẩn bị triển khai.

Fingerprint phủ 313 file tracked nguồn/script/test/config/manifest dependency. Sau apply, chỉ `vercel.json` được phép khác danh sách này, với đúng hai thay đổi JSON nêu trên; 312 file còn lại phải khớp byte. Đây không phải manifest binary artifact của một deployment Singapore đã build.

## 4. Phạm vi Function thực sự bị ảnh hưởng

`FUNCTIONS.md` liệt kê **52 output entries** từ deployment thực: **51 entry ứng dụng** ở `iad1` và **1 Routing Middleware** phân phối nhiều vùng. Đây không phải khẳng định có 52 process hoặc 52 function artifact độc lập; RSC/segment có thể chia sẻ artifact.

Thay project default bằng `sin1` dự kiến tác động:

| Nhóm | Output/đường chạy liên quan |
|---|---|
| Admin | `admin/[[...segments]]` và RSC; dashboard, trang Admin và Server Actions gắn với các trang này |
| Payload REST | `api/[...slug]` và RSC; auth, collection/global, Media/source file, cấp phép upload và `/api/og` thuộc route này |
| GraphQL | `api/graphql`, `api/graphql-playground` và các entry RSC đang được đóng gói; không thay cơ chế bật/tắt hay quyền |
| Frontend động | Home, brand, contact, partnership, Products/line/detail, Ingredients/detail, Journal/detail, Stores, Technology, legal/catch-all ở KO/EN/VI; HTML/RSC tương ứng |
| Phụ trợ | Preview/exit, sitemap, error/not-found và segment fallback đang được đóng gói dạng Lambda |

Vì vậy đây **không phải chỉ đổi riêng dashboard**. Luồng lưu Admin, form và file nếu người dùng khác sử dụng trong cửa sổ thử cũng chạy trên region mới; phép hậu kiểm của tôi không gửi form hoặc lưu dữ liệu để thử các luồng ghi.

Static assets/CDN không bị ép chuyển về Singapore. Routing Middleware là ngoại lệ do Vercel phân phối, kể cả runtime Node: metadata hiện có `bom1,fra1,gru1,iad1,lhr1,sfo1,sin1,syd1`. Không gọi toàn deployment là một region; kiểm riêng entry middleware sau thử. [Region và Routing Middleware](https://vercel.com/docs/functions/configuring-functions/region#limits).

Không đổi vị trí DB/bucket/email provider. Latency các dịch vụ ngoài có thể khác theo region; không hứa mọi route đều nhanh hơn. Cùng vùng Singapore cũng không có nghĩa cùng AZ/VPC.

## 5. Quy trình thử sau khi owner duyệt diff/phạm vi Production

1. Fetch và xác nhận lại main/Production, working tree, gói/quota, phiên Admin; nếu có mã mới thì dừng đối chiếu phần thay đổi. Xác nhận không có deployment khác trong cửa sổ thử. Chốt lại rollback target ngay trước thao tác.
2. Áp dụng đúng patch, kiểm JSON/schema theo tài liệu và fingerprint mã; `src/`, scripts, dependencies, guard/access/migration phải giống SHA nền. Commit/PR chỉ cấu hình và tài liệu. Kiểm rule tắt deployment nhánh và kết quả thực sau push. Chưa tạo Preview dùng credential Production.
3. Khi PR đã đủ điều kiện, đặt đúng các biến server không bí mật của instrumentation đã có: flag 1, cap 8/process, absolute deadline ngắn (dự kiến 10 phút từ trước triển khai). Xác nhận Admin đã đăng nhập trước khi mở cửa sổ; không nới code hoặc bỏ expiry.
4. Merge theo phê duyệt và theo dõi **một deployment main tự động**. Không tạo redeploy song song. Nếu build quá lâu khiến không đủ thời gian lấy bốn mẫu, tắt cấu hình flag và báo phần chưa chạy; không tự lặp deployment để đạt số lượng.
5. Sau READY, kiểm alias/domain đúng SHA mới. Đọc output Lambda **thực**: Admin/API và entry ứng dụng phải `deployedTo:[sin1]`; ghi riêng middleware. Đối chiếu log `VERCEL_REGION=sin1`, SDK timing adapter đã được nạp; đọc lại region project Neon bằng metadata console/API, không lấy URL/mật khẩu để đưa vào báo cáo. Nếu khác thì dừng so sánh, không suy từ `vercel.json` hoặc vùng build.
6. Trên cùng phiên/quyền Admin, locale nội dung VI, `/admin`, Products page 1 với 4 Products + Home: một lượt đầu quan sát và ít nhất ba lượt tiếp theo, tuần tự. Giữ nguyên bộ lọc; không tạo fixture, mở editor có thể ghi lock, save/approve/publish hoặc thay file. Lưu trạng thái/số đếm và kiểm href mẫu theo tài liệu/locale.
7. Thu log ngay trong retention Hobby. Dùng lại allowlist timing và deduplicate UUID; không log SQL/parameters, URL kết nối, cookie/token/email/nội dung. Snapshot khác hoặc có người sửa dữ liệu trong cửa sổ thì không gọi là đối chứng cùng dữ liệu. Status/count trùng không tự chứng minh từng byte nội dung bất biến.
8. Kiểm GET: OG 200 PNG 1200×630 và ảnh render; Home KO/EN/VI/noindex; guest Products và FORMA draft; Media #10 private (metadata 404/file 403) nếu vẫn đúng trạng thái nguồn tại lúc kiểm. Không đổi publicRelease để tạo điều kiện test.
9. Đặt cấu hình flag 0, chờ absolute expiry trên deployment hiện tại; một authenticated read kiểm soát sau expiry và xác nhận không có UUID profile mới. Không deploy thêm chỉ để tắt. Dừng đúng collector do lượt thử tạo và giữ evidence đã lọc.

## 6. Cách so sánh với baseline

Nguồn baseline bốn sample đã lưu của SHA `e3e4eb04b8ce5432bad1945bb28cd365da5502d3`, deployment `dpl_Vm1jvrB5kisYZ9hfSn6KboZg5ARY`; `BASELINE-TIMING.json` là bản sao số đo, không phải test chạy lại.

| Lượt | Server đến dữ liệu (s) | Reader (s) | getPayload (ms) |
|---|---:|---:|---:|
| 1 | 11,868 | 7,046 | 1712,809 |
| 2 | 9,959 | 6,938 | 0,258 |
| 3 | 11,778 | 7,236 | 1499,343 |
| 4 | 9,690 | 6,736 | 0,113 |

Đối chiếu inventory, Products/Home draft/main/guest, projection, queryCount, driver sum/acquire sum/waiting peak, getPayload và root assembly. Baseline có 40 query reader/lượt, hai instance; sample đầu ở instance mới **không được gọi là cold start**. Phân loại instance đầu được quan sát/reused và tách lượt đầu trong kết quả mới, không chọn bỏ các sample chậm.

Server→data không phải full HTTP/React render. Driver/acquire sums chồng lấp, không cộng chúng thành tổng request. Navigation Timing browser baseline chưa lấy được; automation observation không phải TTFB. Nếu lượt mới có HTTP timing thật, báo riêng và không so trực tiếp với automation baseline. Không sửa instrumentation chỉ để có số đẹp.

Chưa đặt phần trăm cải thiện bắt buộc: báo cả bốn giá trị và mức thay đổi theo từng nhóm. Thử n=4 là định hướng, không phải SLA/benchmark toàn diện; khác cache/process/Neon compute state và dữ liệu sống là giới hạn. Nếu chưa tách được nguyên nhân, không tự thay pool/concurrency/cache hoặc truy vấn.

## 7. Rollback

Mốc dự kiến là deployment hiện tại **`dpl_Vm1jvrB5kisYZ9hfSn6KboZg5ARY`**, `iad1`, cùng mã đã kiểm; flag nhúng cũ đã hết hạn. Phải xác minh lại nó còn là **immediately previous Production deployment** sau khi triển khai candidate: Hobby chỉ Instant Rollback về deployment liền trước. Không tạo thêm deployment Production giữa hai mốc. [Instant Rollback](https://vercel.com/docs/instant-rollback).

Nếu Admin không dùng được, snapshot bị lỗi hoặc ACL guest sai: dừng đo, đặt flag cấu hình 0 và rollback deployment theo quyền owner duyệt cho lượt thử. Nếu không lỗi chức năng nhưng số đo không rõ, giữ kết luận chưa chứng minh, không tự tối ưu tiếp. Lệnh dự kiến (chưa chạy):

```powershell
vercel rollback dpl_Vm1jvrB5kisYZ9hfSn6KboZg5ARY --scope dr-phynex
```

Rollback dùng artifact/env cũ, không rebuild, không restore DB hoặc chạy down migration. Sau đó kiểm lại domain/SHA, vùng thực, dashboard/OG/ACL. Nếu có deployment chen giữa, không thử rollback xa hơn hoặc nâng gói; báo target hợp lệ mới trước thao tác. [CLI rollback](https://vercel.com/docs/cli/rollback).

Để giữ rollback lâu dài trong Git, đưa riêng `regions` về `['iad1']` qua commit/PR được duyệt, giữ guard nhánh. Instant Rollback có thể tắt tự gán Production domain cho các lần push sau; cần kiểm trạng thái đó và chỉ promote deployment đã duyệt khi muốn khôi phục auto-assignment. Không âm thầm coi push main sau rollback là đã live. [Hành vi rollback](https://vercel.com/docs/instant-rollback).

## 8. Kiểm tra đã làm / chưa làm

- Đã fetch main; xác minh metadata plan hiện tại, deployment/regions/inventory; rà source không có override preferredRegion/regions; đọc tài liệu chính thức trực tiếp, không dựa vào snippet tìm kiếm cũ.
- Đã kiểm patch bằng `git apply --check`, JSON parse và đối chiếu in-memory chỉ hai thay đổi được liệt kê. Runtime `vercel.json` chưa đổi. Fingerprint mã nền lưu kèm để kiểm lại sau.
- Chưa apply patch, commit/push/PR, đổi cấu hình Vercel/Neon/env, build, chạy lại unit/integration hay thử Singapore. Không cần chạy lại toàn test chỉ cho proposal chưa áp dụng; chưa tuyên bố Vercel đã chấp nhận/deploy `sin1`.
- Chưa có review Claude độc lập cho **proposal region** này; không lấy review OG/instrumentation trước làm review cấu hình mới.

**Phần owner cần duyệt:** một deployment Production đổi mặc định các Function ứng dụng sang Singapore với phạm vi trên, giữ nguyên DB/mã đọc và cơ chế đo đã review; kèm hậu kiểm, tắt đo và phương án rollback. Chưa thực hiện phần này.
