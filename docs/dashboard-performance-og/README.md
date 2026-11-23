# Dashboard performance + Admin OG — 23/11/2026

Nền: `beb7918aba36a5b4e11568de55be88bfff3aa961`, `origin/main` của `drphynex2026-sudo/main-website`. Nhánh sửa: `codex/dashboard-performance-og-fix`. Working tree sạch trước khi tạo nhánh. Hai phần độc lập; chưa merge/deploy. Đây là kết quả tự kiểm bản sửa, chưa phải review độc lập.

## 1. Dashboard: nguyên nhân đã đo và thay đổi

Mã gốc đọc count + inventory, rồi mỗi Product mở 9 Local API finds (3 locale × draft/main/guest). Bốn Product workers có thể mở 36 finds trong khi pool Vercel được cấu hình max 3. Mỗi find riêng còn có count phục vụ pagination. Projection không phải phần tốn thời gian chính trong fixture.

Bản sửa ở `src/lib/dashboard-read.ts`:

- Gom đúng ID của trang hiện tại, tối đa 20 Products, thành 9 Local API finds. `pagination:false` cho các batch này; không thay pagination/count của inventory.
- Tối đa 3 lượt đọc nguồn đồng thời, kể cả Home; không đổi pool hoặc tăng concurrency.
- Staff draft depth 2, staff main depth 0, guest main depth 0; Home giữ depth 1. Mỗi lượt có context riêng, `overrideAccess:false`, đúng một locale và không fallback. Guest không nhận user/req/cookie của staff.
- Map theo ID rồi trả theo thứ tự inventory; không tin thứ tự batch. Không dùng adapter bypass, shared cache hoặc endpoint mới.
- Không đổi `dashboard-snapshot.ts`, guard, access hoặc cách tính số việc. Không thêm suy luận thay đổi chưa xuất bản.
- Nếu một batch lỗi, nguồn tương ứng trên trang giữ error/denied và projection bảo thủ unknown; không biến lỗi thành approved hoặc không có việc. Lỗi batch có phạm vi rộng hơn lỗi đọc một tài liệu; không tự retry hoặc fallback sang bypass.

### Before/after có đối chứng

[benchmark.json](evidence/benchmark.json), [summary.json](evidence/summary.json): PostgreSQL **17.6** disposable, pg **8.20.0**, cùng 4 Products fixture + Home, cùng dữ liệu lưu bền và pool max **3**. Baseline lấy bằng `git show` từ SHA nền, chỉ đổi đường import tương đối của snapshot để chạy test. Cùng process/DB, đảo thứ tự baseline/candidate giữa các round; 3 vai trò × 4 round × 2 bản = **24 mẫu**, không phải 24 test. Toàn bộ DashboardData (trừ observedAt), gồm từng cell, dependency và số đếm, khớp baseline cho từng vai trò.

| Chỉ số mỗi lượt dashboard | Baseline | Sau sửa |
|---|---:|---:|
| Trung vị wall time, 12 mẫu/bản | 589 ms | 243 ms |
| Truy vấn SQL | 80 | 28 |
| SQL lặp cùng text + parameters trong một lượt | 41 | 13 |
| Peak số lượt đang đợi trong pool | 36 | 3 |
| Trung vị tổng thời gian acquire | 7.605 ms | 100 ms |
| Projection, trung vị | 0,52 ms | 0,47 ms |

Tổng acquire cộng các lượt có chồng lấp; **không phải** 7,6 giây wall time. Acquire gồm thiết lập kết nối và chờ pool; queryMs là thời gian phía driver, không phải đo CPU/server execution của PostgreSQL. Helper chỉ xuất số đếm/thời gian; không xuất SQL hoặc parameters.

| Nhóm | Local API calls trước → sau | SQL trước → sau | Envelope elapsed trung vị trước → sau |
|---|---:|---:|---:|
| Inventory | 2 → 2 | 3 → 3 | 29,5 → 31,5 ms |
| Products draft | 12 → 3 | 24 → 3 | 441,3 → 44,4 ms |
| Products main | 12 → 3 | 24 → 3 | 333,7 → 38,8 ms |
| Products guest | 12 → 3 | 14 → 4 | 441,0 → 40,8 ms |
| Home draft | 3 → 3 | 6 → 6 | 75,8 → 42,8 ms |
| Home main | 3 → 3 | 3 → 3 | 49,5 → 25,2 ms |
| Home guest | 3 → 3 | 6 → 6 | 60,2 → 28,5 ms |

Envelope là từ call đầu đến call cuối hoàn tất của một nhóm. Các nhóm có thể chồng lấp và trung vị được tính riêng; không cộng bảng thành wall time. Home không giảm số SQL; thay đổi lịch đọc giảm cạnh tranh pool. Không áp dụng thêm tối ưu ở inventory/projection vì chưa có bằng chứng cần thay logic ở đó.

### Cold/follow-up và giới hạn Production

[http.json](evidence/http.json): production build Local, tiến trình Next mới, fixture DB riêng; request Admin đầu **4.047 ms**, tiếp theo **221 / 200 / 190 ms**. Mỗi response thực sự có **5 tài liệu và 15 ô locale**, không fallback. Local HTTP dùng pool mặc định **10**; không dùng số này so trực tiếp với benchmark pool 3.

Đây là fresh-process Local, không phải cold-start Vercel được kiểm soát. Các mẫu Local API được đo sau init/seed nên không gọi là cold start. Số Production 18,4–23,1 giây trước đây gồm overhead browser automation; không so với Local để tuyên bố mức cải thiện Production. Chưa đo riêng cold start, nhóm đọc hoặc pool wait trên Neon/Vercel vì bản sửa chưa được triển khai. Kết quả xác nhận giảm fan-out/SQL và queue trên fixture; chưa chứng minh toàn bộ latency Production đã được giải quyết.

## 2. `/api/og`: font chưa được trace

GET Production trước sửa vẫn **500**, ENOENT tại:

`/vercel/path0/node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff`

[og-production-before.json](evidence/og-production-before.json) lưu status và phân loại, không dump response/log nhạy cảm. File font tồn tại trong package Local (80.304 byte). Implementation Payload 3.92.1 đọc file qua `import.meta.url` + `fs.readFile`; artifact REST trace trước sửa không liệt kê font. API liệt kê file deployment không truy cập được: không khẳng định đã duyệt toàn bộ filesystem Vercel.

Sửa tối thiểu `next.config.ts`: thêm đúng font vendor vào `outputFileTracingIncludes` cho route `/api/[...slug]` (escape tên route trong glob). Không sửa node_modules, handler OG, canonical, robots/noindex hoặc font website. Cơ chế include runtime asset theo [tài liệu Next.js chính thức](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

Sau build, REST NFT liệt kê font. HTTP Local `/api/og?title=Dr.PhynEX` trả **200 image/png**, **23.907 byte, 1200×630**; sharp giải mã thành công, entropy > 0; đã xem ảnh [admin-og.png](evidence/admin-og.png). Chưa có bằng chứng 200 trên deployment Vercel mới vì chưa deploy.

## 3. Kiểm tra, timeline và ca lỗi của harness

| Kiểm tra thực chạy | Kết quả |
|---|---|
| Regression batching trên source baseline, thuần bộ nhớ | Đỏ đúng lý do: trang 20 tạo 180 nguồn thay vì 9 |
| Unit liên quan cuối | **43/43**, một worker, không nạp .env |
| Integration dashboard hiện có trên DB disposable | **11/11**: ba vai trò, page20/page2, không mutation, unknown, Home/Product dependency khớp guard 409 và durable state không đổi |
| Benchmark cuối + auth fixture | **2/2**; benchmark có 24 mẫu, auth fixture là ca riêng |
| Typecheck cuối | exit 0 |
| Lint các file ảnh hưởng | exit 0, không warning mới |
| Production build Local | exit 0, heap 2048 MiB, `CIRCLE_NODE_TOTAL=2` → một worker |
| HTTP Local + giải mã OG | Đạt, response/content assertions như trên |

Không chạy lại toàn bộ test/upload/Admin cũ. Build vẫn báo **Compiled with warnings**; log chỉ có tóm tắt, chưa có nội dung để phân loại đầy đủ. Không nâng dependency hoặc tuyên bố warning cũ đã hết.

Các lỗi đo/harness đã phát hiện, không che khỏi báo cáo:

1. Bản instrument đầu mất async context trong callback pool; đã truyền lại context trước callback. Chỉ dùng số nhóm từ bản đã sửa.
2. Bộ đếm SQL lặp ban đầu bỏ qua parameters truyền riêng sau pg query config. Regression hai query cùng text, khác parameters đã đỏ trước sửa và xanh sau sửa. Không dùng chỉ số duplicate của lượt cũ.
3. HTTP test ban đầu chỉ kiểm title/status, thiếu `Sec-Fetch-Site`: Payload `extractJWT` cố ý bỏ cookie khi thiếu cả Origin lẫn header này. Các timing HTTP cũ đó **không phải dashboard**, bị loại. Chỉ harness mô phỏng direct navigation bằng header `none`; không sửa auth/CSRF runtime.
4. Assertion locale ban đầu đếm cả toolbar (KO=7). Đã scope vào `.dx-dash-locale`; kiểm HTTP riêng đạt, sau đó lượt cuối đầy đủ 2 test + HTTP đạt. Không gọi lỗi assertion này là lỗi ứng dụng.

Build chạy trước các sửa cuối **chỉ ở helper/harness**. Hash runtime trước/sau và BUILD_ID được chốt tại [prebuilt-attestation.json](evidence/prebuilt-attestation.json), rồi launcher từ chối reuse nếu runtime bytes hoặc build identity khác. Không build lại chỉ vì chỉnh công cụ đo. Lượt cuối dùng đúng source runtime đó; test/harness cuối có fingerprint kèm theo.

## 4. Cô lập, phạm vi diff và bàn giao

Launcher `scripts/run-dashboard-performance.mjs` tạo container/network mới, endpoint Docker Desktop cố định, loopback cổng ngẫu nhiên, bridge riêng non-internal, tmpfs, không bind mount/volume. Xác minh bindings, membership, actual port, tên DB/role/IP/system identity và marker qua kết nối thật **trước** migrations/fixtures. Không kế thừa DATABASE_URL/S3/email credentials Production vào child, không đọc .env. DB là `drphynex_independent_review_test` trong instance mới; không reuse DB Local khác.

Unit/integration/build chạy tuần tự, heap 2048 MiB. Không test/build song song. [resource-ledger.json](evidence/resource-ledger.json) ghi đúng container/network của lượt cuối, xác nhận server đã kết thúc, auth scratch và tài nguyên fixture đã dọn. Các lượt thử trước cũng được dọn đúng ID riêng; không đụng ứng dụng/container khác.

Runtime/config diff chỉ gồm `src/lib/dashboard-read.ts`, `next.config.ts`, và rule tắt auto-deploy đúng nhánh trong `vercel.json`. Phần còn lại là regression, profiler/launcher và tài liệu/evidence. Không đổi schema, migrations, approved/proposed manifests, generated types, guard/access/preview, dependency, canonical/noindex. Không ghi dữ liệu, đổi tài khoản/approval/quyền file trên Production.

Điều kiện sau review: nếu được owner cho phép triển khai, đo lại Production trên cùng tài khoản/dữ liệu, tách request đầu/các lượt tiếp theo và kiểm `/api/og` tại deployment thực. Giữ giới hạn snapshot không atomic, catch chưa log và bảo vệ render đã công bố; chưa mở rộng sửa các điểm đó.

Kết quả này chuẩn bị cho review PR; **không tự cấp quyền merge/deploy**.

Fingerprint source dùng byte working tree thực đã kiểm (có phân biệt EOL), không chỉ blob HEAD. Các bản log trong gói được bỏ whitespace cuối dòng để diff check sạch; raw log được giữ ngoài Git trong thư mục evidence của lượt kiểm.
