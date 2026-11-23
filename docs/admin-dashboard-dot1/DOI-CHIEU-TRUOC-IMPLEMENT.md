> LỊCH SỬ: biên bản trước REVIEW-75b07fe, giữ để truy vết; các đề nghị adapter/bounded read và nhận định chưa có review đã được thay thế bởi DE-XUAT.md + FINDINGS.md hiện hành.

# Biên bản chuyển nền và tự đối chiếu trước Claude review

Ngày 21/11/2026. Không phải review Claude độc lập. Chưa implementation.

## Nền

Fetch origin/main = `75b07feed68d6dba833dd730b17e9d74902cac34`; Production READY cùng SHA, deployment `dpl_5qeE338UaNumUqhN994j4NzMGJyD`. Không deploy lại. Worktree dashboard-spec-review tạo mới detached tại SHA đó, sạch trước khi thêm tài liệu. Giữ nguyên worktree nguồn và các WIP; không copy code/mockup từ 5d4d073/phase-3-brand-design.

Đã đọc trực tiếp Dashboard, factory, access/roles, translationStatus, Products, Home globals/banner fields, approval-basis/view, banner/landing revision, guardPublishing/guardLanding/guardHomeBannerApproval/publishLocale/bulkUnpublishError, content/preview và helper hiển thị. Hash byte nguồn được ghi trong SOURCE.sha256. Đây là fingerprint các file được đối chiếu, không tự nhận bao phủ toàn repository hoặc artifacts Production.

## Điều chỉnh đề xuất cũ

| Mục cũ | Kết quả tự đối chiếu | Bản điều chỉnh |
|---|---|---|
| Baseline mục 0/5/7/8 = 5d4d073 | Lỗi thời; mới có PR Unpublish và preview đã tích hợp trên main | Đổi nền đúng SHA 75b07fe; worktree mới |
| R1 và REVIEW_CONTENT chỉ khi draft._status=draft | Chưa chứng minh semantic per-locale; không phù hợp ràng buộc owner | Bỏ khỏi MVP, không thử suy lại bằng updatedAt/version; reason dựa review snapshot, không khẳng định có diff chưa xuất bản |
| “Có thay đổi chưa xuất bản” | Không có phép đối chiếu đáng tin per-locale đã duyệt | Không hiển thị |
| F1 bỏ docSave mismatch khỏi dashboard | Hợp lý: cần form thật mới so basis/docSave | Giữ; panel xử lý riêng, dashboard không giữ lock |
| F2 CMS/default Home | Hợp lý khi read thành công | Bổ sung unknown khi read lỗi, không gọi mọi failure là default |
| F3/F4 dependency/empty landing | Đúng hướng nhưng cần main thật | Ghi thuật toán Product và Home riêng; không mặc định draft empty = N/A |
| F5 “Dự kiến bị chặn” | Chỉ là precheck snapshot | Ghi rõ chưa đủ điều kiện không đồng nghĩa sẵn sàng; quyền/validation/ghi cạnh tranh vẫn guard quyết định |
| R3/R4 helper không hash lại, giữ readApprovalState bypass | Helper có bypass có chủ đích, nhưng không phải reader ACL tổng quát | Không đổi helper; reader riêng kiểm quyền và chỉ project dữ kiện cần thiết; không serialize basis/map/raw main |
| R5/test ba vai trò giống hoàn toàn | Không thể dùng làm tiêu chí chung nếu field ACL che dữ liệu | So derived facts được phép đọc; dữ liệu thiếu unknown; hướng dẫn theo quyền khác nhau |
| F8 dùng staff media để cảnh báo | Không đủ chứng minh kết quả hiển thị guest | Phân biệt private/không phân giải/chưa kiểm; không rò URL và không thành publish blocker |
| F11 chỉ bốn products | productBriefs không chứng minh inventory CMS | Bounded read + N/M và tổng trong phạm vi đã đọc; không báo tổng toàn bộ nếu chưa scan |
| Chỉ dẫn Home Approved riêng qua dropdown | Không khớp proof guard Home | Dẫn ApprovalPanel; Product vẫn workflow hiện có |
| Review Claude | Chưa có | Ghi rõ mọi nhận xét là Codex tự đối chiếu, chờ Claude một vòng |

## Sửa đã tích hợp phải giữ nguyên

So `5d4d073..75b07fe` trong nhóm Dashboard/guard/access/approval/content/preview/vercel: Dashboard/access/approval không đổi trong nhóm đó, nhưng publishLocale, bulkUnpublishError, content, preview, preview-navigation và vercel.json đã đổi. Không thay các file này trong đợt đặc tả.

- Unpublish guard chạy trước locale checks, kể cả draft=true + unpublishAllLocales; global dùng hook chung. Ordinary Save Draft vẫn được hỗ trợ; UI riêng thu hồi locale chưa có. Bulk response chỉ làm rõ lỗi 409, không trả thành công giả.
- Preview xác thực staff; guest mode trên các trang không phải original product dùng guest read. Không sửa lp/lpOrigin, reporter, redirects hoặc quyền anonymous để dựng dashboard.
- Chưa chạy lại regression/build/browser: không có runtime diff; owner chỉ yêu cầu chuẩn bị đặc tả. Không có kết luận PASS runtime mới.

## Phạm vi thực đổi / dự kiến

Thực đổi ở worktree mới: chỉ `docs/admin-dashboard-dot1/DE-XUAT.md`, `DOI-CHIEU-TRUOC-IMPLEMENT.md`, `SOURCE.sha256`, `HANDOFF.sha256` (đều chưa commit). Không có file runtime/schema/migration/config/test đổi. Diff implementation dự kiến nằm mục 7 DE-XUAT: Dashboard, hai helper mới, stylesheet, unit/int, tài liệu; chưa áp dụng.

Dừng tại đây để Claude review. Không tự dùng kết quả tự đối chiếu này làm review độc lập hoặc quyền bắt đầu implementation.

