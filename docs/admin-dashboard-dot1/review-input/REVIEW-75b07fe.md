# Review độc lập đề xuất Dashboard đợt 1, đối chiếu mã tại `75b07feed68d6dba833dd730b17e9d74902cac34`

Chỉ review. Không sửa runtime, schema, workflow hay dữ liệu Production. Không sửa `DE-XUAT.md` và `mockup.html`.
SHA `75b07fe` là `origin/main` của `website-demo-products` (khác `5d4d073` mà đề xuất ghi: bản mới chỉ thêm điều hướng preview, từ chối bỏ xuất bản toàn tài liệu ở `publishLocale.ts` và `bulkUnpublishError`; dashboard và các guard duyệt không đổi).

## Kết luận

**Chưa đủ điều kiện triển khai phạm vi Products + Home theo đặc tả hiện tại.** Phạm vi (hai nguồn, ba ngôn ngữ, chỉ đọc, không endpoint) đúng hướng và không phải đổi. Nhưng có 5 lỗi thuật toán/ngữ nghĩa phải sửa trong đặc tả trước (H1 đến H5), và 2 điểm chưa kiểm (M2, M3). Sau khi sửa và chốt các quyết định ở mục 3, có thể triển khai.

## Phân loại bằng chứng

| Loại | Nội dung |
|---|---|
| **Đã đọc mã** (tại `75b07fe`) | `lib/content.ts`, `lib/preview.ts`, `access/roles.ts`, `collections/factory.ts`, `Products.ts`, `hooks/guardLanding.ts`, `guardPublishing.ts`, `guardHomeBannerApproval.ts`, `publishLocale.ts`, `lib/landing.ts`, `landing-approval.ts`, `banner-revision.ts`, `approval-basis.ts`, `guest-view.ts`, `ProductLanding.tsx`, `LandingOverview.tsx`, `Media.ts`; mã Payload 3.92.1 trong `node_modules` (`find.js`, `findOne.js`, `executeAccess.js`, `update.js`) |
| **Đã chạy** | Worktree tạm đúng `75b07fe`. 4 file unit (`banner-revision`, `approval-view`, `guest-view`, `admin-vi`): 28/28 qua. Một spec thử một lần trên DB dùng một lần `drphynex_independent_review_test` (marker xác nhận bởi `assertDisposableDatabase`): 2/2 qua. Bằng chứng: [evidence-75b07fe/](evidence-75b07fe/) (spec + đầu ra). Worktree và spec đã gỡ khỏi repo |
| **Chưa kiểm** | Toàn bộ suite unit/int, `tsc`, `eslint`, build tại `75b07fe`; dashboard chạy thật trong Admin; kịch bản Home trên DB; đọc `locale:'all'`; sản phẩm chưa từng xuất bản (hàng main ban đầu); chạy đồng thời; mọi thứ về triển khai (chưa có runtime). **UI:** mockup đi kèm đã đo ở 390/768/1440 từ trước, nhưng chưa có bản cập nhật theo các sửa dưới đây, nên **chưa review UI** ngoài việc đối chiếu dữ liệu mẫu (mục 2) |

## 1. Năm điểm cần chốt

### Điểm 1. Guest read tách khỏi staff không? Từ chối có phân biệt với lỗi hạ tầng không?
- **Tách: có.** `findPublic(..., {publicOnly:true})` và `findGuestGlobal` gọi Local API với `overrideAccess:false`, `draft:false`, không truyền `user` hay `req`, không đọc cookie/header (`content.ts`; `getPreviewUser` chỉ chạy khi không `publicOnly`). Thực nghiệm E1: gọi guest sau một lần đọc admin vẫn ra đúng kết quả của khách, không rò phiên.
- **Từ chối vs rỗng vs lỗi: Payload phân biệt được, nhưng đề xuất thì không.** Thực nghiệm E1:
  - Ngôn ngữ không công khai: trả `docs: []` (không lỗi).
  - `locale:'all'` hoặc `fallbackLocale:'ko'`: ném `Forbidden`, status 403 (`publishedAndApproved` trả `false` khi không phải yêu cầu một ngôn ngữ, `executeAccess` ném `Forbidden`).
  - Trang chủ chưa từng xuất bản: `findGlobal` trả **`{}`** (0 khóa), không `null`, không lỗi; `content.ts` đổi thành `null` nhờ `translationStatus !== 'approved'`.
  - Không truyền `fallbackLocale`: không lỗi ở cấu hình hiện tại, nên đừng dựa vào mặc định.

**Finding H4 (cao).** Đề xuất F10 gộp mọi thất bại đọc thành "Chưa xác định bản công khai". Như vậy "bị từ chối" (lỗi do chính yêu cầu của dashboard, ví dụ quên `fallbackLocale:false`) bị hiện giống lỗi hạ tầng.
**Sửa tối thiểu:** mỗi nguồn trả ba trạng thái `ok | denied | error`. Bắt `Forbidden`/status 403 → `denied` (hiện "Bị từ chối đọc bản công khai, lỗi cấu hình", ghi log, không gọi là "chưa có bản công khai"). Lỗi khác → `error` (hiện "Chưa xác định"). `{}` hoặc `docs: []` → "Chưa có bản công khai". Luôn truyền tường minh `locale` và `fallbackLocale:false`, không truyền `user`/`req`.

### Điểm 2. Reader main cho dependency: dùng Local API với quyền hiện tại được không?
**Được, không cần bypass adapter.** Guard dùng `req.payload.db.findOne/findGlobal` (hàng *main*, không phải bản nháp). Dashboard có thể lấy cùng dữ liệu bằng `payload.find({draft:false, overrideAccess:false, user, locale, fallbackLocale:false})`: với staff, `publishedAndApproved` trả `true` nên không lọc. E2: translator đọc được hàng main (`_status:'published'`, `landing` 0 khối) trong khi bản nháp có 2 khối. Draft save không đụng hàng main (`update.js`: `if (!isSavingDraft) updateOne`), nên hàng main đúng là "đã xuất bản".
**Điều kiện kèm theo:**
1. Không dùng `select` trên lần đọc nháp: `landingApprovalState` là trường ảo tính từ `landing` và `landingApprovals` của tài liệu đã đọc, thiếu hai trường này sẽ ra "chưa duyệt" giả. *(Suy ra từ mã, chưa kiểm.)*
2. Chưa kiểm: đọc `locale:'all'` một lần thay cho ba lần; hàng main của sản phẩm chưa từng xuất bản.
3. Ghi chú về bypass đã có: `readApprovalState` (Home) dùng `overrideAccess:true`. Trong `Dashboard.tsx` hiện tại nó chỉ chạy sau khi đã kiểm quyền đọc `home-page`, và chỉ trả `ApprovalState` (không trả nội dung), nên **chấp nhận được** theo tiêu chí của bạn. Không mở rộng kiểu bypass này sang Products.

### Điểm 3. Thuật toán dự đoán có khớp guard không?
Phần khớp: revision cấu trúc (E6: revision từ lần đọc khách depth 2, kể cả ảnh riêng chỉ còn id, **bằng** revision từ hàng main; `landingStructure` chuẩn hóa id), thứ tự kiểm "duyệt của chính nó trước, phụ thuộc sau", nguồn `approvals` của ngôn ngữ khác (lấy từ bản nháp, đúng như guard).
Phần lệch:

- **H1 (cao). R1 sai.** Đề xuất dùng `_status === 'draft'` của bản nháp để biết ô nào "có thay đổi chưa xuất bản". E3: ngay sau khi xuất bản KO (không còn gì chờ), lần đọc nháp của KO vẫn có `_status:'draft'` (phiên bản "snapshot" mà `publishLocale.ts` nói tới). Nên bộ lọc này vừa bỏ sót vừa thừa, và dự phòng "bỏ nhãn" của R1 cũng không cứu được.
  **Sửa tối thiểu:** bỏ R1. Dòng việc sinh thuần từ các trục; đổi câu thành "Nếu xuất bản ngôn ngữ này lúc này, guard sẽ từ chối vì…". Không cần phát hiện "có thay đổi chờ".
- **H2 (cao). Các trục không độc lập.** `guardLanding.ts` và `guardHomeBannerApproval.ts` đều xóa duyệt cấu trúc của ngôn ngữ khi `translationStatus !== 'approved'`. E4: sửa chữ ở KO → trạng thái `in-review` và `landingApprovalState` của **KO về `false`**. Hệ quả: (a) đặc tả §1 gọi ba trục "độc lập" là sai; (b) mockup có ô FORMA KO "Đang xem xét + Đã duyệt cấu trúc" là trạng thái **không thể tồn tại**; (c) một ngôn ngữ chưa duyệt nội dung luôn ra hai việc `REVIEW_CONTENT` và `REVIEW_SHARED` dù chỉ cần một thao tác.
  **Sửa tối thiểu:** nếu nội dung chưa `approved` chỉ phát `REVIEW_CONTENT` (trục cấu trúc hiện "đi cùng lần duyệt nội dung"); chỉ phát `REVIEW_SHARED` khi nội dung đã `approved` mà cấu trúc chưa khớp. Chữ chỉ dẫn Products theo `LandingOverview.tsx`: lưu nháp giữ "Đã duyệt", không sửa gì khác. **Home khác:** duyệt mới bắt buộc qua nút "Duyệt cấu hình" kèm `x-approval-basis`; đổi trạng thái rồi lưu bị 409. Chữ chỉ dẫn Home của đề xuất (giống Products) là sai; lấy chữ từ panel thật.
- **H3 (cao). Quy tắc "Không áp dụng" thiếu một nửa điều kiện.** Guard bỏ qua sản phẩm chỉ khi `before`, `after` **và** `publishedRevision` đều rỗng. Đề xuất F4 chỉ xét bản nháp. E5: xóa hết khối ở bản nháp KO, duyệt KO, rồi xuất bản KO: guard vẫn **từ chối** vì VI đang công khai với cấu trúc cũ chưa duyệt cấu trúc rỗng. Quy tắc theo bản nháp sẽ báo "Không áp dụng".
  **Sửa tối thiểu:** "Không áp dụng" chỉ khi revision bản nháp = `EMPTY_LANDING_REVISION` **và** revision hàng main = `EMPTY_LANDING_REVISION` (cần reader main ở điểm 2).
- **M2 (trung bình). Thiếu luật phụ thuộc của Home.** `guardHomeBannerApproval` có luật tương tự (revision banner đã xuất bản khác bản mới và có ngôn ngữ khác `approved` mà chưa duyệt bản mới), nhưng **không** kiểm `published._status` như Products và lấy `status[l]` từ hàng main. Đề xuất và mockup không có `REVIEW_DEPENDENT_LOCALE` cho Home. **Sửa:** thêm biến thể Home dùng reader main. *Chưa kiểm bằng thực nghiệm.*
- **M3 (trung bình). Nguồn "đang công khai" cho dependency.** Với Products, "ngôn ngữ khác đang công khai" = `statuses[l]==='approved'` ở hàng main **và** `_status==='published'`, tương đương việc khách đọc được. Nhưng với Home guard không đòi `_status`. Dùng hàng main cho cả hai để khớp từng guard; dùng lần đọc khách chỉ cho trục "Công khai".
- **L4 (thấp). Translator.** `guardPublishing` luôn từ chối translator xuất bản (403). Với translator, "dự kiến bị chặn" luôn đúng. Chữ nên là "bạn không có quyền xuất bản" chứ không để như việc cần làm.
- **Phải có test đối chiếu guard thật** (đã nêu ở mục 6 của đề xuất; vẫn bắt buộc): với mỗi ô, thử xuất bản trên DB thử và so với dự đoán, gồm các ca H1/H2/H3/M2 ở trên.

### Điểm 4. Cảnh báo ảnh/khối có đủ dữ liệu để kết luận không?
**Chưa. Đây là finding H5 (cao).** Thực nghiệm E9 trên một khối `band` có ảnh riêng (`publicRelease:false`):
| Cách đọc | `blockIssues(...).required` | Đúng? |
|---|---|---|
| Staff, depth 2 (ảnh được phân giải), quy tắc "đã chọn ảnh" | `[]` (không cảnh báo) | Sai: khách thấy khối bị ẩn |
| Staff, depth 2, qua `asGuestView` + `publicRelease===true` | `["ảnh"]` | Đúng |
| Staff, **depth 0** (chỉ còn id) | `["ảnh"]` | Sai về cơ chế: là *chưa phân giải*, không phải *thiếu* |

Đề xuất F7/F8 nói "dùng lại `blockIssues`" nhưng không chỉ rõ quy tắc ảnh và depth.
**Sửa tối thiểu:**
1. Đọc nháp với depth đủ (≥ 2 cho ảnh trong khối), áp `asGuestView`, và dùng quy tắc `isPublic` của `ProductLanding.tsx` (`publicRelease===true` và có `url`).
2. Giá trị ảnh còn là id ở nơi lẽ ra đã phân giải, hoặc quan hệ phân giải ra `null` → **`unknown`**, không phải "thiếu".
3. Khối `ingredients` và nhãn dòng (`line`) phụ thuộc việc tài liệu liên quan **công khai cho khách** (collection `ingredients`/`product-lines` cũng lọc published+approved). Lần đọc nháp của staff không biết điều đó. **Đợt 1 nên chỉ cảnh báo dựa trên ảnh (media)**; các khối phụ thuộc quan hệ ghi `unknown` hoặc để ngoài đợt 1.
4. Trường bị ACL che: các trường được kiểm (`images`, `inci`, `volume`, `keyIngredients`, `howToUse`, `cautions`, trường ảnh trong khối) hiện chỉ giới hạn `create/update` cho editor, **không** giới hạn `read` (đã đọc `Products.ts`, `fields/landing.ts`). Thêm một test duyệt cấu hình khẳng định không trường nào được kiểm có `access.read`; nếu sau này có thì giá trị `undefined` phải là `unknown`.
5. Ảnh banner Trang chủ: `readApprovalState` đọc depth 0 (id). Nếu dashboard cảnh báo ảnh Trang chủ phải đọc depth ≥ 1 và cùng quy tắc; nếu không, bỏ ảnh Trang chủ khỏi đợt 1.

### Điểm 5. Giới hạn inventory và số đếm
**Chưa rõ (M1, trung bình).** Đề xuất F11 chỉ nói "hiện dòng báo còn N sản phẩm" nhưng bộ lọc và số đếm ("Tất cả (10)", "9 mục dự kiến bị chặn") vẫn trông như tổng toàn website; `findPublic` mặc định `limit:24` và có thể cắt im lặng.
**Sửa tối thiểu (đơn giản nhất):** cỡ trang cố định 20 sản phẩm, sắp theo `slug`, tham số `?page=`. Một `count` riêng cho tổng số sản phẩm người dùng được đọc. Tiêu đề phần việc ghi rõ **"Trang 1/2 (20/27 sản phẩm); số đếm chỉ tính các sản phẩm trên trang này, không phải toàn website"**. Trang chủ luôn được tính, vì là một tài liệu đơn. Không cộng số đếm giữa các trang.

## 2. Đối chiếu mockup (dữ liệu và logic, không phải thẩm mỹ)
Mockup hiện tại **chưa** theo các sửa trên, nên chưa review UI cho bản đã sửa. Các chỗ lệch đã thấy:
- FORMA KO: "Đang xem xét + Đã duyệt cấu trúc" (trạng thái không thể có, H2).
- Một số ô vừa `REVIEW_CONTENT` vừa `REVIEW_SHARED` dù cùng một thao tác sửa (H2).
- Không có trạng thái "bị từ chối" tách khỏi "Chưa xác định" (H4).
- Không có `REVIEW_DEPENDENT_LOCALE` cho Trang chủ (M2); không có ca "xóa hết khối nhưng vẫn bị chặn" (H3).
- Cảnh báo "khối thiếu dữ liệu" ở LUMA VI chưa nói cách xác định, và ví dụ khối `ingredients` thuộc loại không kết luận được từ đọc staff (H5).
- Số đếm và bộ lọc không có nhãn trang/giới hạn (M1).

## 3. Quyết định còn cần chốt
1. Nền triển khai: `75b07fe` (hoặc nhánh đã gộp nó), thay cho `5d4d073` trong đề xuất.
2. Bỏ R1 (không lọc theo "có bản nháp chờ"), đổi nhãn thành "nếu xuất bản lúc này guard sẽ từ chối".
3. Một lần đọc main bằng quyền staff (khuyến nghị) cho cả hai nguồn, thay vì adapter; riêng Home có giữ `readApprovalState` (bypass đã có, đã kiểm quyền trước) hay chuyển sang đọc theo quyền.
4. Phạm vi cảnh báo đợt 1: chỉ ảnh (media), hay có cả khối phụ thuộc quan hệ (cần guest read riêng, tốn hơn).
5. Cỡ trang (đề nghị 20) và có hiện ảnh Trang chủ trong cảnh báo hay không.
6. Chữ chỉ dẫn cho Trang chủ: lấy từ panel "Duyệt cấu hình" thật, không dùng chữ chung với Products.

## 4. Ghi nhận ngoài phạm vi (không sửa ở đợt này)
- Khách đọc được các trường `landingApprovalState` (E2) và, theo cấu hình, `landingApprovals`/`bannerApprovals` (băm revision, `_save`) qua API công khai, vì các trường này không có `access.read`. Rủi ro thấp (chỉ băm và cờ đúng/sai) nhưng nên được chủ dự án biết và quyết riêng.
