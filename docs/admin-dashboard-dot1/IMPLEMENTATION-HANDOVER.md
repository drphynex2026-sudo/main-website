# Bàn giao mã Dashboard đợt 1 cho Claude review

Ngày 22/11/2026. **Chưa merge/push/deploy. Không ghi Production.** Owner đã đồng ý implementation theo gói đề xuất được review; bản mã này vẫn cần Claude review độc lập một vòng.

## Nền và diff

- Repository origin: drphynex2026-sudo/main-website. Fetch mới nhất trước implementation: `75b07feed68d6dba833dd730b17e9d74902cac34`.
- Worktree mới sạch `C:\Users\THAI\.codex\worktrees\dashboard-phase-one\website-demo`, nhánh `codex/dashboard-phase-one`. Giữ nguyên gói/WIP worktree dashboard-spec-review và checkout gốc.
- Runtime chỉ: Dashboard.tsx, dashboard-read.ts mới, dashboard-snapshot.ts mới, custom.scss. Test thêm hai file unit/int. Hướng dẫn quản trị và gói docs cập nhật. Không guard/access/factory/collection/global/field/schema/type/dependency/preview/Unpublish/migration/endpoint mới.
- Build tự ghi lại payload-types.ts nhưng không có diff nội dung; giữ nguyên blob HEAD. Không giữ file types tự sinh trong commit.
- Bản diff và SHA checkpoint nằm bàn giao cuối; `IMPLEMENTATION.sha256` ghim byte runtime/test/hướng dẫn. Build không bị dùng chung với server Local khác.

## G1/G2/G3 — đã xác minh trước runtime

Evidence `evidence-db/expected-actual.json`, `vitest.log`, `resource-ledger.json`, RUN-COMPLETE.json. PostgreSQL17.6 disposable, driver pg đang cài, Payload3.92.1. **3/3 tests đạt**; fixture tạo qua Local API, không SQL sửa approval hoặc nội dung.

- G1 ghi actual trước assert: Product create draft có main ban đầu status draft/in-review/empty landing ở cả ba locale; guest docs[] là ok, không denied. ACL Users anonymous403 là đối chứng denied; Products invalid-field QueryError400 là đối chứng read error, **không phải lỗi hạ tầng đã tiêm**. Runtime vẫn hỗ trợ main ok/null theo nhánh guard, không tự coi unknown.
- G2 Home raw{} dùng mặc định; draft/duyệt chưa publish không thành CMS; publish đúng approval mới dùng CMS từng locale. Không dùng homepage200 làm chứng cứ.
- G3 shared edit xóa mọi approval, own approval được kiểm trước. KO cần EN/VI đúng tập missing từ main staff. Request409 giữ nguyên hash main/toàn bộ versions/public; chỉ duyệt EN vẫn bị chặn vì VI; đủ approval publishKO thành công và copy EN/VI không đổi. Home main{} không có approved locale phụ thuộc, so revision mặc định đúng guard.
- Setup trước khi đạt: internal network không publish port (evidence cũ); owner cho phép bridge non-internal. Một lượt đối chiếu inet dạng text không khớp IP đã dừng trước schema; dùng host(inet_server_addr()) để so exact IP, không nới target. Cả lượt lỗi và lượt đạt đã cleanup riêng.

## Thực hiện runtime

Staff đọc main/draft bằng Local API overrideAccess:false, locale rõ ràng/fallback:false, không adapter. Count staff không có fallbackLocale vì API CountOptions không hỗ trợ; count theo quyền, không truy vấn field localized. Guest đọc riêng không user/req/preview. Home context skipApprovalState tránh gọi helper bypass/default in-review. Projection chỉ trả nhãn/reason/link/warnings an toàn, không raw doc/map/basis/token/private URL.

Số việc chỉ theo Products current page20, Home riêng. Main rỗng thành công khác denied/error. Content chưa approved chỉ CONTENT, không thêm SHARED trùng; cấu trúc vẫn riêng về ý nghĩa và theo coupling guard. Missing links sinh từ toàn bộ tập thiếu, không hard-code locale. Ảnh/relation chưa phân giải giữ unknown; xác nhận band ẩn chỉ khi đủ dữ kiện; ingredients/details giữ cảnh báo chưa xác minh trong phạm vi hẹp. Dashboard chỉ GET filter và link, không nút approve/publish/release.

## Kiểm tra tại nguồn đã build

| Kiểm tra | Kết quả thực chạy |
|---|---|
| Typecheck | exit0 sau sửa kiểu CountOptions và fixture; log typecheck-implementation.log |
| Lint runtime/unit mới | exit0; integration mới lint riêng exit0 |
| Unit nhóm1 | 54/54 = dashboard30 + preview-navigation10 + bulk-unpublish14 |
| Unit bổ sung không trùng nhóm1 | 45/45 = Unpublish16 + preview-public-locale4 + approval-view14 + approval-refresh11 |
| Integration dashboard | 8/8: ba vai trò, pagination20, không quyền, no mutation, guard dependency, fixture inventory |
| Production build | exit0; heap2048MiB, CIRCLE_NODE_TOTAL=2 làm Next16.4.3 dùng1worker; 7static pages. Không npm build heap4096 mặc định. Build dùng DB disposable, không .env/storage/email thật |
| Browser production test | 3vai trò ×390/768/1440 =9observations, 9screenshots; 66URL document/locale mỗi vai trò =198 lượt mở, không sai URL/locale/tên tài liệu |
| Dashboard mutation | Integration chặn/đếm mọi mutation method gọi từ component reader:0; main/versions unchanged. Browser checksum16bảng products/home và bảng version/locales trùng trước/sau; không thử Save/Approve/Publish trên UI |
| Cleanup | Server PID14416 kết thúc; container/network instance thử đã xóa đúng ID; credential test xóa; không tài nguyên tồn tại theo inspect/filter |

99unit là tập liên quan, **không phải toàn suite**. 3gap +8integration là11test khác nhau, không gán evidence cũ vào số này. Tất cả chạy tuần tự một worker; không test/build song song. Không lặp upload/mockup cũ hoặc locale:all.

## Browser: bằng chứng và giới hạn

`evidence-implementation/browser/browser-results.json`: mọi href lấy từ DOM của hai trang thật, sau đó mở từng URL trong browser và kiểm heading + locale. Có actual click pagination/filter; không tuyên bố đã click vật lý từng bản sao link trùng. 66distinct URL =21Products×3locale + Home×3locale. Link dependency Home EN/VI nằm đúng tập thực tế. Không thử mọi shortcut cũ tới collection ngoài phạm vi.

Ở390/768, dashboard cards nằm trong vùng nội dung (right359/737), không có phần tử dashboard vượt viewport. Root scrollWidth bằng innerWidth390/768 nhưng clientWidth nhỏ hơn15px; ghi đúng số đo, không tuyên bố root toàn Payload không có scroll chênh15px. 1440 root client/scroll1425, ba cột427px. Một lần đọc ngay sau soft navigation còn DOM cũ; call sau xác nhận page2/1Product/3việc, không tính DOM cũ là lỗi hoặc PASS.

Nút duy nhất trong `.dx-dash` là Lọc, form GET `/admin`. Translator được nhắc không có quyền duyệt/publish; editor/translator không thấy shortcut hộp thư admin. Auth/session và document locking của Payload khi mở form không phải thao tác ghi dashboard; checksum chỉ so dữ liệu nghiệp vụ/version, không user/session/lock tables. Kiểm console error cuối phiên trả rỗng; không coi đó là nghiệm thu toàn Admin.

## Lỗi harness sau kiểm thành công

Integration và build exit0, browser checksum unchanged=true. Launcher chính exit1 **sau** các bước đó vì `rmSync` xóa thư mục credential đã rỗng trả EISDIR. Container/network được finally dọn. Đã kiểm thư mục rỗng đúng đường dẫn rồi xóa bằng PowerShell; credential file đã bị xóa từ trước. Sửa launcher sang rmdirSync, syntax-check đạt, **không rerun toàn launcher** chỉ vì cleanup. RUN-COMPLETE ghi rõ harnessExit1/manual cleanup/step exits, không che lỗi bằng PASS tổng.

## Giới hạn cần Claude kiểm

- Snapshot đọc nhiều query không nguyên tử; không chứng nhận Publish tương lai hoặc mọi validation/ACL change về sau.
- 20Products hiện khoảng180reads document/locale cộng count/list, Home9reads; localhost integration page1 khoảng1–1.8s. Chưa benchmark Vercel/Neon, không thêm cache làm yếu thu hồi. Có thể tối ưu batching sau review, không thay workflow.
- Renderer warning cố ý conservative: unresolved/null không kết luận thiếu; không quét public relations Ingredients/Line hoặc đánh giá accessibility/legal/SEO đầy đủ. Cảnh báo không phải guard blocker.
- Build có dòng **Compiled with warnings**, log không chứa chi tiết warning. Giữ là giới hạn, không tuyên bố sửa hết webpack warnings; không nâng dependency.
- Chưa deploy, chưa kiểm credentials/dữ liệu Production; đây là fixture test không phải bản sao Production. Không đổi bốn sản phẩm thật.
- Cleanup-only fix của launcher mới kiểm syntax, không có full rerun. Claude kiểm mã thay đổi này riêng với evidence lượt trước.

Claude bắt đầu từ bốn file runtime + hai tests, đối chiếu DE-XUAT/FINDINGS và evidence DB/browser; không coi tự kiểm của Codex là review độc lập. Sau bàn giao dừng chỉnh mã chờ review.

### Chốt byte trước commit
Sau build/browser chỉ bỏ dòng trống EOF ở dashboard-read và hai file test mới; không thay token thực thi. Typecheck/lint cuối chạy lại (log *-final). Không gán build cho một thay đổi logic sau build. Raw log giữ nguyên whitespace/ANSI; diff-check áp dụng code thay đổi, không chỉnh raw log để làm sạch kiểm tra. Launcher cleanup-only đổi sau lượt chạy đã được ghi giới hạn ở trên.
