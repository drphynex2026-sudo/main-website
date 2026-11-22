# Dashboard Admin đợt 1 — đề xuất hiệu chỉnh sau REVIEW-75b07fe

Ngày 21/11/2026. **Đã bắt đầu implementation trên nhánh codex/dashboard-phase-one; chưa merge/deploy.** Hiệu chỉnh theo review người dùng cung cấp và tám quyết định đã chốt. File review không định danh tác giả: không tự gọi là review Claude. Phiên bản này chưa được Claude review độc lập. Bảng finding đã lập trước khi sửa ở [FINDINGS.md](FINDINGS.md). [Mockup](mockup.html) chỉ dùng dữ liệu minh họa, không kết nối CMS.

## 1. Nền và phạm vi

- Nền mã `75b07feed68d6dba833dd730b17e9d74902cac34`, origin/main đã fetch ở lượt chuẩn bị. Khi đó Vercel Production READY cùng SHA, deployment `dpl_5qeE338UaNumUqhN994j4NzMGJyD`. Không coi metadata là nghiệm thu runtime mới.
- Worktree sạch mới `C:\Users\THAI\.codex\worktrees\dashboard-spec-review\website-demo`, detached tại SHA này. Không dùng 5d4d073/phase-3-brand-design làm nền. **Trước implementation phải fetch lại origin/main và đối chiếu diff liên quan.**
- Chỉ Products + Home, chỉ đọc và dẫn tới màn hình xử lý hiện có. Không endpoint, schema, mutation, workflow mới. Giữ nguyên Unpublish/preview đã merge. Không đưa basis/token/_save/raw approval map/private URL/trường bị ACL che ra client.
- Ba mặt thông tin: bản khách đọc được, duyệt nội dung draft, duyệt cấu trúc draft. Ý nghĩa riêng nhưng **hai loại duyệt chịu ràng buộc của guard**, không phải mọi tổ hợp đều hợp lệ.
- Loại hoàn toàn “có thay đổi chưa xuất bản”, “có draft chờ xuất bản” và mọi bộ lọc tương đương suy từ draft._status/updatedAt/version. Chưa có phép so đáng tin theo locale. Không cần chứng minh có diff để hiện review status.

## 2. Hợp đồng đọc dữ liệu

Reader server-only; từng source/locale trả `ok {value}` / `denied {safeReason}` / `error {safeCode}`. Forbidden/status403 là denied, không phải lỗi hạ tầng hoặc bản rỗng. Không trả exception/SQL/URL bí mật ra client. Denied staff: “Không có quyền đọc”. Denied guest do request dashboard: “Bị từ chối đọc bản công khai; cần kiểm tra cấu hình”, log an toàn. Error: “Chưa xác định”, không false.

| Nguồn | Local API và quyền | Dùng để |
|---|---|---|
| Latest draft | user staff hiện tại, overrideAccess:false, draft:true, fallbackLocale:false, locale cụ thể | Nội dung, cấu trúc, cảnh báo preview draft |
| Main | user staff hiện tại, overrideAccess:false, draft:false, fallbackLocale:false, ba lần ko/en/vi riêng | Revision/status main để dependency và N/A; **không payload.db/adapter/bypass** |
| Guest | không user/req staff/preview, overrideAccess:false, draft:false, locale cụ thể, fallbackLocale:false | Khả năng đọc công khai và Home CMS/default |

Không dùng locale:all trong implementation; không mở thêm test đó. Không select draft làm mất landing/approvals trước virtual afterRead. Draft Products depth ≥2, Home depth ≥1 cho media nhưng depth đủ không bảo đảm relation resolved. Kiểm permissions nguồn và field ACL; thiếu field vì ACL/select/resolve => unknown. Main cũng đọc đủ trường cần; không dùng `_status` draft làm main.

Có thể dùng findPublic(publicOnly:true), findGuestGlobal cho guest; không dùng findPublicGlobal có thể nhận preview user. readApprovalState vẫn giữ nguyên cho panel hiện tại nhưng **dashboard mới không dùng bypass của helper hoặc default in-review cho dữ liệu thiếu**. Lấy raw draft status/approval qua staff read, tái dùng revision/readApprovals hiện có. Không tự nhân đôi thuật toán hash.

Promise.allSettled theo nguồn/locale; lỗi một nguồn không biến các nguồn còn lại thành false. Không cache cross-user/locale/persistent public read. Snapshot có thời điểm, không chứng nhận nguyên tử qua nhiều query hoặc quyền Publish lần tới.

### Empty phải diễn giải theo nguồn

| Source | Kết quả | Diễn giải |
|---|---|---|
| Guest Products | ok docs:[] | Không có bản đọc được cho khách; không suy chưa từng publish |
| Guest Home raw | ok {} | Review E1 đã ghi nhận Home chưa publish trả {}; CMS không được dùng, homepage dùng mặc định |
| Guest Home helper | ok null | findGuestGlobal đã loại bản không approved; không đồng nghĩa query lỗi |
| Staff draft Product đã có trong trang | thiếu đúng ID/status/landing cần thiết | Unknown do dữ liệu không đủ/thay đổi, không tự thay [] |
| Staff main Product chưa từng publish | rỗng hoặc hàng có sẵn | G1 đã xác nhận create draft thường có main draft ban đầu; nếu main read ok nhưng không có hàng thì xử lý null như guard: empty revision, không phải unknown |
| Staff Home main/draft | {} hoặc thiếu required input | Home main {} là bản main rỗng thành công: không có approved locale để phụ thuộc, so revision mặc định như guard; draft thiếu field/status vẫn unknown, không tự cấp duyệt |
| Mọi nguồn | denied/error | Giữ đúng phân loại; không dùng quy tắc empty |

## 3. Từ điển trạng thái và việc cần xử lý

| Nhãn | Tính từ | Unknown / giới hạn |
|---|---|---|
| Product: Khách đọc được bản hiện tại | Guest read đúng ID thành công, main published + approved theo ACL | Không dùng draft/history |
| Product: Không có bản đọc được cho khách | Guest read thành công không có ID | Không khẳng định chưa từng xuất bản |
| Home: Đang dùng banner CMS | Guest global approved + bannersApprovedFor đúng revision locale | HTTP 200 không chứng minh CMS |
| Home: Đang dùng banner mặc định | Guest read thành công nhưng không đủ điều kiện dùng CMS | Read error/denied không được đổi thành mặc định |
| Bản nháp AI / Đang xem xét / Đã duyệt bản nháp | Raw draft translationStatus đúng enum | Thiếu/sai enum => Chưa đọc được; in-review không phải yêu cầu đã gửi |
| Đã duyệt cấu trúc hiện tại | Product map[L] === landingRevision, Home map[L] === sharedRevision | Dữ liệu đủ; không dùng _save như approval |
| Chưa có duyệt khớp cấu trúc hiện tại | Content approved nhưng hash chưa khớp | Không khẳng định vừa bị hạ nếu không có lịch sử |
| Đi cùng lần duyệt nội dung | Content ai-draft/in-review; guard đã xóa approval locale | Không hiện approved structure trái guard |
| Không áp dụng landing | Draft revision và main revision đều EMPTY_LANDING_REVISION | Main chưa đủ dữ liệu => unknown, không N/A |

Thứ tự primary reason cho mỗi document+locale:
1. Content ai-draft/in-review: chỉ REVIEW_CONTENT, không thêm REVIEW_SHARED trùng. N/A vẫn N/A nếu chứng minh được. Nếu gặp dữ liệu cũ in-review + stored approval khớp: “Trạng thái chưa nhất quán, cần kiểm tra”, không trình bày như tổ hợp hợp lệ, không tự sửa.
2. Content approved, structure cần áp dụng nhưng chưa khớp: REVIEW_SHARED.
3. Own approvals khớp, thiếu locale khác theo mục 5: REVIEW_DEPENDENT_LOCALE, nêu locale và link.
4. Đủ thông tin không có reason trên: “Chưa phát hiện điều kiện chặn trong snapshot”. Chưa đủ => “Chưa kiểm đủ điều kiện”. **Không “sẵn sàng xuất bản”.**

Cảnh báo có thể đi kèm: CHECK_PUBLIC_DISPLAY (hiển thị) hoặc DATA_UNAVAILABLE. Ảnh private/khối thiếu dữ liệu không tự thành blocker Publish. Một hàng nhiều reason vẫn tính một document+locale.

Translator luôn có ghi chú quyền riêng “Bạn được soạn nháp; không có quyền duyệt/xuất bản”, không biến việc thiếu quyền thành task ở mọi ô. Reason vẫn cho biết nội dung cần xử lý/chờ editor. Không mô tả guard sẽ cho qua chỉ vì không thấy blocker trong snapshot; validation/ghi cạnh tranh vẫn có thể từ chối.

Không đưa REFRESH_HOME_APPROVAL lên dashboard: docSave/basis cần form đang mở; panel tự xử lý. Dashboard không giữ advisory lock.

## 4. ACL và màn hình xử lý

- Admin/editor đọc draft/version, tạo/xóa Product, duyệt/publish qua workflow. Translator đọc/soạn nhưng không tạo/xóa Product, approve/publish. Unpublish toàn tài liệu đơn/bulk bị chặn, kể cả draft=true+unpublishAllLocales; restore bị chặn. Không hướng dẫn API thủ công để thu hồi locale; UI đó chưa triển khai.
- Products: editor-only ghi images, keyIngredients, technologies, INCI, classification, sku, volume, accent, related, slug. Chữ/SEO localized staff. Claims source fields read staff, không tự suy editor-only ghi. editorialNote staff.
- Landing: cấu trúc/order/row, ảnh, hidden/tone/layout/show*, ingredient relation editor-only; chữ localized staff. sourceNote staff nhưng không localized.
- Home: heroImage/featured relations và banner visual/ảnh (kể cả override locale)/position/textDisplay/CTA target/theme/textTone editor-only; title/tagline/ctaLabel/imageAlt localized staff.
- Media publicRelease editor/admin ghi; reviewNote chỉ editor/admin read/write; staff được đọc private. Dashboard không chuyển quyền hoặc mở URL private. Client không nhận trường bị ACL che. Test cấu hình xác minh field dùng cho đánh giá có access.read hay không; undefined không coi rỗng.
- Quyền UI là permissions + field ACL + workflow, không chỉ role. Không bắt các vai trò có output thô giống nhau; chỉ dữ kiện được phép đọc trên cùng input mới phải giống.

URL Product: `/admin/collections/products/{id}?locale=L` (encode ID). Home: `/admin/globals/home-page?locale=L`. Không có hợp đồng mở thẳng tab/field: chỉ dẫn bằng chữ Landing page hoặc Banner trang chủ/panel.

Product: lưu draft → xem lại → Approved trong lần lưu riêng không sửa nội dung → publish đúng locale. Home: lưu draft → xem lại → nút Duyệt cấu hình của panel (basis/marker đúng) → publish locale; không hướng dẫn chỉ đổi dropdown. Link vẫn mở cho translator có read, kèm chỉ dẫn làm phần được phép. Không có nút duyệt/publish/lưu trên dashboard.

## 5. Phụ thuộc locale khác

Products (`guardLanding.ts:61–108`): own approval current revision; nếu main._status=published và main revision khác draft thì các locale khác có **main translationStatus approved** phải có draft approval hash mới. Empty draft nhưng main còn khối vẫn áp dụng, kể cả khi muốn xóa toàn bộ landing. Xóa shared approvals cả ba không đồng nghĩa translationStatus mọi locale bị đổi.

Home (`guardHomeBannerApproval.ts:145–173`): main tồn tại và revision khác thì các locale khác có main status approved phải duyệt revision mới; nhánh này **không có kiểm tra main._status giống Products**. Guest read chỉ dùng public axis, không thay staff main để tính dependency. Đọc ba locale riêng, không cần locale:all.

Home shared hash đúng tám field của năm slot: visualType/desktopImage/mobileImage/imagePosition/textDisplay/ctaTarget/theme/textTone. Locale image override editor-only nhưng không thuộc shared hash; heroImage/featuredProducts/featuredIngredients cũng ngoài hash. Product.images ngoài landing hash. Không tuyên bố mọi shared field đều reset mọi approval. Dùng helper normalize đúng ID/default; gửi lại giá trị không đổi không được xem là shared change. Sửa+Approved một request không thay bước duyệt riêng.

## 6. Cảnh báo ảnh/khối: completeness trước kết luận

| Giá trị nguồn | Kết luận được phép |
|---|---|
| Media object có id/url, publicRelease=true | Ảnh đọc được cho khách |
| Media object đầy đủ publicRelease=false | Biết ảnh private; không đưa URL ra client |
| ID chưa populate, relation=null sau resolve, thiếu url/release, field bị che | Unknown, không gọi thiếu ảnh/khối ẩn |
| Biết chắc field chủ động trống từ dữ liệu đầy đủ | Absent; nếu không phân biệt được resolve thất bại => unknown |

Ghi classification trước asGuestView vì private object biến thành ID; không nhầm nó với ID chưa phân giải. Sau kiểm completeness, dùng asGuestView và điều kiện isPublic đúng ProductLanding: populated có URL + publicRelease=true. Chỉ gọi blockIssues để khẳng định khối ẩn khi đủ input cho nhánh renderer đó. Band ảnh known private/absent => required ảnh, khối ẩn; split còn cần heading/body; hero thiếu ảnh là optional, không gọi khối ẩn. Hidden=true bỏ cảnh báo thiếu nội dung. Missing field/array do select không coi empty thật.

Ingredients/keyIngredients/line phụ thuộc quyền public collection khác: staff populated không chứng minh khách đọc được. Đợt 1 unknown/ngoài đánh giá visibility khối phụ thuộc relation; không mở guest scan toàn quan hệ. Details cần volume/INCI/rich text đủ và cùng hasRich của renderer mới kết luận; không đủ thì unknown. Không tính số khối bị ẩn bằng số ảnh private.

Home depth ≥1 nhưng relation chưa phân giải vẫn unknown. Áp resolveSlot trên guest-safe dữ liệu đủ: packshot/fullBleed/brandOptics khác fallback; title trống dùng copy mặc định, imageHasText giữ HTML cho accessibility và chỉ copyHidden khi fullBleed thật. Cảnh báo slot, không gọi cả Home bị ẩn. Không coi fallback/ảnh riêng là guard blocker.

## 7. Phân trang, số đếm và mockup

20 Products/trang, sort slug rồi id. ?page= nguyên dương; thiếu/sai về 1, vượt totalPages clamp sau count, giữ query an toàn. Count inventory riêng theo staff ACL. Chọn ID của trang rồi đọc main/draft/guest ba locale; không cắt im lặng ở helper limit24 và không hardcode productBriefs/bốn tài liệu.

Nhãn: “Trang 1/2 · 20/21 sản phẩm; số đếm việc chỉ tính trang này”. Bộ lọc chỉ lọc việc của Products đang ở trang đó, không đổi inventory. Không cộng count trang trước/sau. Home khu riêng, count riêng, không cộng Products. Mockup 21 sản phẩm đều minh họa, 20 trang1/1 trang2; không dùng như inventory thực tế.

Mockup có trạng thái bình thường, guest denied, read error, relation unknown; Home dependency riêng; Product draft landing rỗng nhưng main còn khối. Không có tổ hợp in-review + approved structure. Link dùng ID mẫu và ?locale, không thật Production; không hứa deep-tab. Chỉ vùng nội dung dashboard, không vẽ sidebar Payload giả.

## 8. Phạm vi diff implementation dự kiến (chưa làm)

| File | Phạm vi |
|---|---|
| src/components/admin/Dashboard.tsx | Products/Home status, việc, pagination/filter read-only; giữ shortcut |
| src/lib/dashboard-read.ts (mới) | Staff main/draft + guest reader, ACL, union kết quả |
| src/lib/dashboard-snapshot.ts (mới) | Pure projection/coupling/reason/count/unknown |
| src/app/(payload)/custom.scss | Style dashboard responsive/a11y |
| tests/unit/dashboard-snapshot.spec.ts (mới) | Semantic, count/page, unknown, ACL projection |
| tests/int/dashboard-snapshot.int.spec.ts (mới) | DB marker fixture cho read/guard đối chiếu |
| tests/unit/admin-vi.spec.ts | Chỉ assertion bị ảnh hưởng |
| docs/huong-dan-quan-tri.md | Hướng dẫn đúng workflow hiện có |

Không sửa guard/access/factory/preview/schema/types/importMap/migration/manifest/dependency/vercel.json. Không thêm seed vận hành chỉ để mockup. Nếu cần ngoài phạm vi, dừng xin review riêng.

## 9. Tiêu chí nghiệm thu và gap

- Public cũ + draft in-review vẫn hiển thị đúng hai mặt; CONTENT không trùng SHARED; main/draft empty N/A đúng; old inconsistent input unknown, không tự sửa.
- Guest không nhận staff session; read ok/denied/error và empty từng nguồn đúng; Home default/CMS không suy HTTP200; không dùng helper default in-review cho missing.
- Staff main qua Local API không bypass, ba locale cụ thể; dependency khớp guard Product/Home, own approval trước missing locales. “Không thấy blocker” không đồng nghĩa guard chắc cho qua.
- Media private/absent/unknown, relation public chưa biết và hidden block không bị gộp. Không đưa URL/token/ACL-hidden fields ra client. Validation config field-read regression khi implementation.
- Trang 20, ?page=, count current Products, Home riêng; link đúng ID/locale, keyboard/responsive 390/768/1440. Không mutation khi load/refresh/filter/page.
- Giữ hồi quy Unpublish/SaveDraft/ApprovalPanel và preview lp/lpOrigin/guest access đã tích hợp; chỉ chạy phần bị tác động khi implementation, không lặp upload.
- EVIDENCE.md phân biệt bằng chứng cũ, probe mới và DB chưa chạy. Chỉ bổ sung gap Home CMS/default/dependency, Product chưa từng publish, media/khối unknown; không mở locale:all hoặc lặp toàn suite. Mockup không phải chứng cứ guard runtime.

Dừng tại gói đặc tả/mockup để review trước implementation. Chưa có phê duyệt triển khai phiên bản hiệu chỉnh này.

