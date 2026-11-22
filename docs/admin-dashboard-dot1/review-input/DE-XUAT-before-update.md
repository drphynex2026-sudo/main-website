# Đề xuất Dashboard Admin đợt 1 — Products + Home (bản chờ Claude review)

Ngày: 21/11/2026. **Chưa implementation; chưa có review Claude độc lập.** Các nhận xét dưới đây là Codex tự đối chiếu mã, không phải finding của Claude. Owner đã đồng ý phạm vi chức năng, chưa duyệt implementation.

## 1. Nền đã xác minh

- Repository: `https://github.com/drphynex2026-sudo/main-website.git`.
- Fetch origin/main trong lượt này: `75b07feed68d6dba833dd730b17e9d74902cac34`.
- Vercel Production tại domain `main-website-orcin-sigma.vercel.app`: READY, deployment `dpl_5qeE338UaNumUqhN994j4NzMGJyD`, metadata githubCommitSha cùng SHA trên. Đây là đối chiếu metadata deployment, không phải một lượt nghiệm thu runtime mới.
- Worktree sạch mới: `C:\Users\THAI\.codex\worktrees\dashboard-spec-review\website-demo`, detached tại đúng SHA origin/main; không dùng checkout phase-3-brand-design hoặc main cũ 5d4d073 làm nền. Không chuyển nhánh các worktree có sẵn.
- Đề xuất cũ được đọc tại `C:\Users\THAI\Websites\website-demo\docs\admin-dashboard-dot1\DE-XUAT.md`; giữ nguyên file và WIP ở đó. Bản này là đề xuất hiệu chỉnh trên nền mới, không mang mockup/runtime cũ sang.

## 2. Phạm vi và nhãn

Chỉ hiển thị thông tin và liên kết tới màn hình xử lý hiện có. Mỗi hàng công việc có khóa tài liệu + locale (ko/en/vi); mỗi ô có ba trục độc lập:

| Trục / nhãn | Nguồn và cách tính | Khi chưa xác định |
|---|---|---|
| Product: Khách đọc được bản hiện tại | Local API guest không user, draft:false, overrideAccess:false, fallbackLocale:false, locale cụ thể, theo ID; ACL main published + translationStatus approved | Lỗi đọc/response không đủ: Chưa xác định, không dùng lịch sử/version/draft suy ra |
| Product: Không có bản đọc được cho khách | Truy vấn khách thành công, không trả tài liệu | Không có nghĩa chưa từng publish, không suy duy nhất nguyên nhân |
| Home: Đang dùng banner CMS | Guest global được đọc và translationStatus approved, đồng thời bannersApprovedFor đúng cho bản guest, locale đó | Đọc lỗi: Chưa xác định; không biến lỗi thành mặc định |
| Home: Đang dùng banner mặc định | Đọc thành công cho thấy không có global được khách đọc hoặc approval không khớp shared revision | Trang chủ 200 không chứng minh CMS public |
| Nội dung: Bản nháp AI / Đang xem xét / Đã duyệt bản nháp | translationStatus chính xác của latest draft locale | Thiếu/sai enum/ACL/lỗi: Chưa đọc được; không nhận default helper là dữ liệu thật |
| Cấu trúc: Đã duyệt / Chưa có duyệt khớp hiện tại | Product landingApprovalState hoặc readApprovals + landingRevision; Home approval map + sharedRevision | Partial/select thiếu dữ liệu: Chưa xác định; `_save` không phải approval |
| Cấu trúc: Không áp dụng | Product cả draft và main đều empty landing theo ngoại lệ guard | Chỉ draft trống chưa đủ; chưa đọc được main thì Chưa xác định |

**Loại khỏi MVP:** nhãn “có thay đổi chưa xuất bản”, “có bản nháp chưa xuất bản” và mọi logic giới hạn việc cần làm bằng `_status === draft`/updatedAt/latest-version. Chưa có phép so nội dung đáng tin theo locale; không triển khai phương án dự phòng R1 cũ. Vẫn hiển thị độc lập public hiện tại và review latest draft, có thể đồng thời public + in-review.

Không dùng “sẵn sàng xuất bản”. Nếu đủ dữ liệu, có thể ghi “Chưa phát hiện điều kiện chặn trong snapshot”; nếu thiếu thì “Chưa kiểm đủ điều kiện”. Dùng “Đang xem xét”, không gọi in-review là yêu cầu đã gửi duyệt.

## 3. Việc cần xử lý và mức độ

- REVIEW_CONTENT: latest draft status ai-draft/in-review. Là nhắc xem xét nội dung nếu muốn publish, không phải ticket đã gửi duyệt hoặc bằng chứng có diff với public. Không phụ thuộc `_status`/updatedAt.
- REVIEW_SHARED: thiếu approval khớp current structure, ngoại trừ Product empty landing đúng điều kiện.
- REVIEW_DEPENDENT_LOCALE: own approval đã khớp, nhưng thiếu approval của locale khác theo đúng guard (mục 6). Link cùng tài liệu, locale thiếu.
- CHECK_PUBLIC_DISPLAY: ảnh riêng/unresolved hoặc khối không ẩn thiếu required content. **Chỉ cảnh báo**, không biến thành blocker publish.
- DATA_UNAVAILABLE: nguồn liên quan lỗi; không tự điền “chưa duyệt/chưa xuất bản”. Không có thông tin DB/URL private trong lỗi UI.

Bỏ REFRESH_HOME_APPROVAL khỏi dashboard: docSave/basis phải so với form đang mở; dashboard không có form đó. Mở panel hiện có để nó tự kiểm phiên bản. Không giữ advisory lock khi đọc dashboard.

Đếm số cặp document+locale có việc; một cặp nhiều reason vẫn tính một. Nếu có cả blocker dự kiến và cảnh báo, giữ cả hai reason nhưng chỉ tính một hàng. Chỉ gọi “Dự kiến bị chặn” khi điều kiện server tương ứng đã được xác định; đây không thay thế validation/guard tại lần ghi.

## 4. Đọc dữ liệu và quyền

Không cần endpoint mới. Dashboard server component dùng reader server-only, không kế thừa cookie/req staff vào guest request. Guest đọc tách biệt; dùng `findPublic(...,{publicOnly:true})` hoặc explicit Local API, `findGuestGlobal` (không dùng findPublicGlobal vì có thể nhận preview user). Product gắn ID thật; không dùng danh sách productBriefs để xác định toàn bộ CMS hiện có.

Draft đọc với đúng user/req + overrideAccess:false + locale cụ thể, không fallback. Kiểm permissions trước nguồn, field ACL khi select/populate. `readApprovalState` hiện bypass access chủ đích để tính basis, status thiếu còn default in-review; giữ nguyên helper nhưng **không dùng nó như reader tổng hợp ACL** hoặc đưa toàn state/basis ra client. Có thể dùng approvalState virtual từ staff read, chỉ lấy dữ kiện cần thiết sau khi kiểm dữ liệu; không tự thêm bypass hoặc sửa helper để phục vụ dashboard.

Dependency cần main document (không version). Nếu dùng internal adapter read để khớp guard, đặt trong reader hẹp chỉ Products/Home, sau kiểm quyền, trả derived values tối thiểu; không serialize raw main/draft/approval map. Đây là điểm Claude cần duyệt trước implementation. Không có đủ main => dependency chưa xác định.

Promise.allSettled theo nguồn và locale; lỗi một phần không làm các trục khác đổi thành false. Không cache cross-user/locale hoặc persistent public reads. Snapshot không nguyên tử giữa nhiều lần đọc; kèm thời điểm đọc, không hứa quyền publish trong tương lai.

### Quyền trong phạm vi này

| Quyền | Admin/editor | Translator |
|---|---|---|
| Đọc draft/version Product/Home | Có | Có |
| Tạo/xóa Product | Có | Không |
| Sửa/lưu draft | Theo field ACL | Theo field ACL, không đổi cấu trúc |
| Duyệt Approved / shared approval / publish | Theo workflow server | Không |
| Unpublish toàn tài liệu đơn/bulk | Bị guard 409 | Bị guard 409/ACL tương ứng |
| Restore | Bị chặn | Bị chặn |

Field ACL đối chiếu nguồn: Product images, ingredients/technology relations, INCI, classification, sku, volume, accent, related, slug chỉ editor/admin ghi. Landing ảnh, layout, hidden, tone, show*, ingredient relation và cấu trúc/row/order chỉ editor/admin; localized copy staff. Home heroImage/featured relations chỉ editor/admin; banner visual, ảnh (kể cả override theo locale), position/textDisplay/CTA target/theme/textTone chỉ editor/admin; title/tagline/ctaLabel/imageAlt localized staff. Nội dung text/SEO, editorialNote staff theo schema. claims source fields read staff (không mặc định editor-only ghi); landing sourceNote staff read/write nhưng không localized. Media reviewNote editor/admin-only, publicRelease editor/admin ghi, staff đọc private; không cung cấp thao tác ACL Media trên dashboard.

Phải đối chiếu permissions runtime và field ACL, không chỉ role name. Không đặt tiêu chí “mọi dữ liệu ba vai trò luôn giống nhau”; chỉ các derived status được phép đọc và cùng dữ liệu đầu vào mới phải giống nhau. Trường bị che => unknown hoặc loại khỏi projection, không coi rỗng. Client không nhận private URL hoặc ghi chú không có quyền.

## 5. Link và chỉ dẫn hiện có

- Products: `/admin/collections/products/{id}?locale=L` (encode ID).
- Home: `/admin/globals/home-page?locale=L`.
- Chưa có hợp đồng deep link ổn định tới tab/accordion/field. Chỉ dẫn bằng chữ: mở tab Landing page hoặc Banner trang chủ/panel duyệt.
- Product: lưu draft → xem lại → Approved trong lần lưu riêng → publish đúng locale.
- Home: lưu draft → xem lại → nút Duyệt cấu hình trong panel (basis/marker đúng) → publish locale. Không hướng dẫn chỉ đổi dropdown Approved rồi lưu.
- Translator vẫn được mở document nếu có quyền đọc; hướng dẫn tiếp tục dịch/chờ người có quyền duyệt, không có nút duyệt khóa giả.
- Không có nút ghi trên dashboard, không hướng dẫn thu hồi bằng API thủ công; UI thu hồi riêng locale chưa triển khai.

## 6. Phụ thuộc cấu trúc và những giới hạn phải giữ đúng

Products (`guardLanding.ts:61–108`): own approval khớp revision hiện tại; nếu main `_status=published` và main landing revision khác draft, các locale khác có **main translationStatus approved** phải đã duyệt revision mới. Draft và main đều empty landing mới không áp dụng. Đổi shared structure xóa approvals cả ba; chỉ locale đang sửa bị đặt in-review. Text-only thay đổi qua guardPublishing. Không suy Product.images hoặc mọi shared Product field đều nằm landing hash.

Home (`guardHomeBannerApproval.ts:145–173`): own approval khớp; nếu main tồn tại và revision khác, các locale khác có main translationStatus approved phải duyệt revision mới. Nhánh Home không có cùng kiểm tra `_status` như Product; không tự đồng nhất thuật toán. Shared hash chỉ tám field của năm slot: visualType, desktopImage, mobileImage, imagePosition, textDisplay, ctaTarget, theme, textTone. Locale image override không nằm shared hash, dù vẫn editor-only. heroImage/featuredProducts/featuredIngredients ngoài banner hash. Không ghi “mọi shared Home field đều vô hiệu approval mọi locale”.

Normalize bằng helper hiện có, không hash lại thuật toán khác; gửi lại ID/populated object không đổi không được coi đổi shared. Chỉnh + Approved cùng request không thay bước duyệt. Approval JSON server-owned, không tin client. Trạng thái duyệt cấu trúc không bao hàm mọi validation/schema/media/legal check.

Cảnh báo khách dùng blockIssues(required) cho khối không hidden; kiểm media theo khả năng guest, không chỉ staff populated/chosen. Không thể chứng minh đủ từ dữ liệu hiện có => Chưa xác minh hiển thị. Không nâng private image/missing block thành blocker server nếu guard không chặn.

## 7. Phạm vi diff implementation dự kiến — chưa thực hiện

| File | Thay đổi dự kiến |
|---|---|
| src/components/admin/Dashboard.tsx | Bảng ba trục Products/Home, việc theo locale, giữ shortcut và ACL |
| src/lib/dashboard-read.ts (mới) | Reader server-only có ACL, guest/draft/main dependency riêng, lỗi từng nguồn |
| src/lib/dashboard-snapshot.ts (mới) | Pure projection/status/reason/count/unknown, không IO |
| src/app/(payload)/custom.scss | Style vùng dashboard, responsive/a11y, không sửa layout khác |
| tests/unit/dashboard-snapshot.spec.ts (mới) | Trạng thái, unknown, count, quyền, bỏ suy diff |
| tests/int/dashboard-snapshot.int.spec.ts (mới) | DB fixture có marker, public/draft/dependency/ACL thật |
| tests/unit/admin-vi.spec.ts | Chỉ nếu assertion giao diện bị thay đổi |
| docs/huong-dan-quan-tri.md | Chỉ dẫn dashboard và giới hạn, không hướng dẫn bypass |

Không sửa guard/factory/access/preview, collection/global/schema/types, importMap, migration/manifest, dependency, vercel.json hoặc cấu hình Production. Nếu cần ngoài phạm vi, dừng và xin review riêng.

MVP có giới hạn số Products được đọc, hiện rõ “Đang hiển thị N/Tổng M; thống kê chỉ tính phần đã đọc” nếu chưa làm pagination. Không hardcode chỉ bốn CMS products hoặc trình bày tổng đã đọc như toàn bộ. Giới hạn page size và thuật ngữ count cần Claude chốt; pagination có thể tách đợt sau. Không cache, auto-refresh, deep tabs, thao tác approve/publish, nguồn ngoài Products/Home.

## 8. Tiêu chí nghiệm thu và điểm Claude cần review

1. Public cũ + draft in-review vẫn hiện hai trục đúng; không có nhãn diff/chưa publish theo `_status`, updatedAt hoặc version. Không phụ thuộc R1 cũ.
2. Guest reads thật không user trên DB disposable có marker; KO/EN/VI không fallback; Home default vs CMS phân biệt được. Lỗi đọc không biến thành chưa public/default.
3. Đối chiếu dependency với guard bằng fixture trên DB test; own approval thiếu, shared đổi, locale public khác thiếu, empty landing và Home/Product branch khác nhau. Không coi “không báo blocker” là guard chắc cho qua.
4. Ba vai trò và field ACL, không lộ dữ liệu bị che/private URL; không dùng bypass để “làm trạng thái giống nhau”. Claude chốt reader main hẹp và projection cần trả.
5. Private media/missing block chỉ warning; thiếu dữ liệu phân giải => unknown. Không tự sửa quyền/guard để phù hợp dashboard.
6. Link đúng ID/locale; không hứa mở thẳng tab. Home chỉ dẫn panel riêng, không dropdown approve. Không có mutation/lock/approve request khi dashboard tải.
7. Lỗi riêng từng nguồn/locale, unknown enum/partial selects, count không trùng và giới hạn inventory rõ; keyboard/responsive 390/768/1440 trên UI sau implementation.
8. Giữ nguyên hồi quy Unpublish đã merge: draft=true+unpublishAllLocales, bulk 409/message, Save Draft/ApprovalPanel. Giữ preview guest context lp/lpOrigin qua breadcrumb/Journal/language/same URL/anchor; không cấp draft/private cho anonymous. Chỉ chạy regression bị tác động khi có implementation.

**Claude cần review một vòng trước implementation**: semantic nhãn/việc (không diff), ACL và reader main/guest, ngoại lệ Home/Product, giới hạn inventory/count, kế hoạch fixture/regression. Chưa có kết quả Claude; tài liệu này không phải sự phê duyệt kỹ thuật độc lập.
