# OG artifact và đề xuất đo dashboard — 23/11/2026

**Biên bản giai đoạn trước phê duyệt:** các kết quả artifact và 50 unit dưới đây thuộc bản OG trước wiring. Owner sau đó cho phép chuẩn bị instrumentation, Claude review và deploy/đo có điều kiện; đọc `REVIEW-REQUEST.md` cho nguồn hiện tại. Không gán kết quả cũ cho toàn bộ nguồn mới.

## Mốc và phạm vi

- Nền/HEAD: `5ec6a27fbcf4c0369a5ad2bc4c10aa83f810402d`.
- Nhánh mới: `codex/og-artifact-dashboard-diagnostics`; bắt đầu từ origin/main đúng SHA trên, working tree ban đầu sạch.
- Chưa commit/push/merge/deploy. Các thay đổi hiện là working tree cần review, không phải SHA Production mới.
- Không đổi dashboard reader/query, ACL, guest context, workflow, schema, migration, dependency, canonical/noindex, nội dung hoặc quyền file. Không ghi Production.

## OG: nguyên nhân và đối chứng

SDK Payload 3.92.1 tại `node_modules/@payloadcms/next/dist/routes/rest/og/index.js` tính dirname từ `import.meta.url`, rồi `fs.readFile(dirname + roboto-regular.woff)`. Webpack đóng băng URL nguồn thành đường dẫn máy build. Log Production trước đó báo ENOENT tại `/vercel/path0/node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff`.

Thêm `outputFileTracingIncludes` chỉ đưa file vào gói, không đổi biểu thức đường dẫn runtime. Trong Function đóng gói đối chứng, font thực sự nằm tại `node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff`, 80.304 bytes, SHA-256 `717d25464787e5f7fa13f7cb693f12013b6f48136ebfb25c43ee6efc5c9edfe4`. Handler vẫn thử đọc ngoài Function và trả 500. NFT không phải bằng chứng lỗi đã hết.

**Giới hạn về artifact:** API files của deployment Git không cho tải filesystem Lambda trong lượt này; không tuyên bố đã liệt kê filesystem Production. Đối chứng dùng build nguồn nền và builder Vercel chính thức đã cài `@vercel/next` 4.19.1 để materialize các FileFsRef/FileBlob thực thành Function, chạy handler `___next_launcher.cjs`, không dùng `next start`.

Builder chạy trên Windows cần hai điều chỉnh chỉ trong harness: alias lookup dấu phân cách cho NFT và phục hồi đúng entry REST từ manifest Next gốc bị builder Windows loại. Không sửa runtime module, SDK hoặc node_modules. Đây là artifact đại diện xây cục bộ, chưa phải bằng chứng deployment Linux Vercel mới.

Node filesystem permissions giới hạn đọc trong Function; native addons được cho phép nên đây **không phải OS sandbox**. Audit readFile chỉ ghi basename/in-out/success/error-code và chuyển tiếp tới fs thật. Baseline nhận `ERR_ACCESS_DENIED`, khác errno ENOENT trên Vercel nhưng chứng minh cùng lỗi đọc ngoài artifact.

### Sửa tối thiểu

- Bỏ tracingIncludes cũ.
- Webpack pre-loader chỉ khớp đúng file OG của SDK, thay đúng một import `fs/promises` bằng adapter server của dự án. Import đổi/thiếu/trùng sẽ làm build thất bại để yêu cầu review khi nâng SDK.
- DefinePlugin đưa chính bytes font vendor vào server bundle. Adapter chỉ trả Buffer mới cho basename font này; không lookup disk/network. Không thay handler, renderer hoặc các import fs khác.
- Không sửa node_modules; không thêm font/dependency khác.
- Rule tắt auto-deploy thêm đúng tên nhánh này. Chưa push nên chưa có bằng chứng deployment bị skip trong lượt này.

### Kết quả

| Kiểm tra | Nền | Bản sửa |
|---|---|---|
| Font trong artifact | Có file 80.304 bytes | Bytes font nằm trong JS server, hash trùng vendor |
| Runtime đọc font ngoài Function | Có, bị từ chối | Không có lời gọi fs đọc font |
| `/api/og?title=Dr.PhynEX` | 500 JSON | 200 image/png, 23.907 bytes, 1200×630 |
| Quan sát ảnh | Không có ảnh | Mở ảnh thành công, chữ Dr.PhynEX render |

`evidence/artifact-byte-proof.json` ghi hash bundle chứa nguyên base64 font, hash nguồn build và nguồn working tree. Hai nguồn chỉ khác format Prettier và chú thích lint CommonJS; đối chiếu tự động sau đúng hai phép biến đổi này, không coi byte build giống tuyệt đối byte hiện tại.

Các lần thử không đạt được giữ ngoài Git: plugin thay module ban đầu không bắt được built-in fs trước externalization, artifact vẫn 500; thử asset/inline xung đột generator của Next gây build lỗi. Đã bỏ hai cơ chế đó, không đổi expected để đạt. Script đóng gói cũng từng dừng do thiếu import/đường dẫn output không tuyệt đối; sửa harness, không sửa SDK. Bản loader cuối mới là bản có kết quả 200 ở trên.

## Dashboard: chưa đủ bằng chứng để tối ưu tiếp

Metadata deployment `dpl_C4Z7KzTwdpAVPSyLVrepGLqicpjC` xác nhận Function Admin/API `iad1`, Node24; build `sfo1`. Neon Singapore chưa được xác minh độc lập qua console trong lượt này. Lệch vùng là giả thuyết có cơ sở, chưa có thời gian server để định lượng.

Truy vấn Vercel metrics bị `payment_required`/Observability Plus. Không nâng gói. Log hiện có không phân rã DB/pool/init/render. Không gọi số browser trước đây là server duration hoặc cold start.

`src/lib/dashboard-diagnostics.ts` và unit là **proposal chưa được app import**. `diagnostics-wiring.patch` là diff chưa áp dụng, `git apply --check` đạt. Kế hoạch và ranh giới đo nằm trong `MEASUREMENT-PLAN.md`: cap mỗi process, event server allowlist, không SQL/secret/data/endpoint. Unit proposal dùng fake pg, chưa chứng minh adapter trên Vercel/pg thật; phải kiểm lại sau khi duyệt wiring. Chưa tối ưu dashboard thêm, không tăng pool/concurrency/cache hay bỏ ACL.

## Kiểm tra thực chạy và giới hạn

- Unit có mục tiêu: **50/50**, 8 file, Vitest4.1.12, một worker, envDir:false, launcher env allowlist, heap2048MiB.
- Typecheck: exit0. Lint phạm vi sửa, gồm loader: exit0. Diff whitespace: đạt khi kiểm.
- Production build webpack trong workspace vật lý riêng: exit0, một worker/heap2048, DB dummy không khả dụng. Không build cạnh test. Build còn `Compiled with warnings`; thấy cảnh báo webpack cache big strings ~105KiB do font base64. Không tuyên bố mọi warning cũ đã sửa; chưa đo tác động cold-load trên Vercel.
- Artifact runtime dùng PostgreSQL rỗng dùng một lần, endpoint/container/loopback port/network/tmpfs/database/marker/system identity kiểm trước app. Không restore dữ liệu thật, không migration/schema sync hoặc fixture nghiệp vụ. Container/network riêng đã dọn; ledger giữ ngoài Git.
- Không lặp upload, browser Admin, toàn regression hoặc đo dashboard Production. Không có server timing mới, không có phép thử region sin1.

## Điều kiện xác nhận trên Vercel

1. Review bản OG độc lập với instrumentation proposal; chốt SHA/fingerprint cuối.
2. Owner cho phép một deployment thử với DB/storage test riêng, hoặc cho phép phát hành OG riêng; không tự dùng secret Production cho Preview.
3. Xác minh deployment đúng SHA, gọi `/api/og` trên URL đó: 200, image/png, 1200×630, mở ảnh; đọc log không còn ENOENT/font read ngoài Function. Kiểm Admin/guest quyền như smoke chỉ đọc. Nếu khác kết quả artifact, giữ lỗi mở và thu path/error mới.
4. Để đo dashboard, duyệt riêng đúng wiring diff và kế hoạch đo; phải chạy test/build lại sau wiring trước phép đo. Không coi tài liệu này là quyền deploy instrumentation.

**Kết luận:** OG đã có bản sửa qua đối chứng Function artifact; lỗi Production chưa đóng. Dashboard mới xác minh region và khoảng trống observability, chưa xác định nút thắt bằng server timing. Cả hai chờ bước Vercel được duyệt; không merge/deploy trong đợt này.

Evidence đầy đủ: `C:/Users/THAI/.codex/visualizations/2026/10/29/01a1868e-41de-74b0-9ec6-567e8dd9bf68/og-artifact-diagnostics-20261123/` (artifact lớn giữ ngoài Git). Kết quả nhỏ đã lọc trong `evidence/`; `FILES.sha256` phủ tập thay đổi bàn giao, không tự hash chính nó.
