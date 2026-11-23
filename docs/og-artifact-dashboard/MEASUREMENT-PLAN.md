# Kế hoạch đo dashboard

**Cập nhật sau phê duyệt owner:** được phép chốt mã, Claude review, sau đó PR/merge/main deployment và đo Production chỉ đọc. Nội dung proposal bên dưới lưu lại ranh giới ban đầu; wiring đã được áp dụng trong working tree. `REVIEW-REQUEST.md` mô tả bản hiện tại và điều kiện trước deploy, không coi phê duyệt owner là kết quả review Claude.

Nền Production: `5ec6a27fbcf4c0369a5ad2bc4c10aa83f810402d`.

## Những gì đã đọc được

- `vercel inspect` và deployment metadata xác nhận các Lambda Admin/API `deployedTo: [iad1]`, runtime Node 24. `createdIn: sfo1` là vị trí build, không dùng làm vùng Function.
- Neon Singapore là thông tin đầu vào của owner. Chưa đọc credential/connection URL để tự xác minh Neon project; cần owner đối chiếu region không bí mật trên Neon console trước phép thử vùng.
- CLI metrics schema có function duration, TTFB và CPU time. Truy vấn `/admin` tại deployment hiện tại bị từ chối `payment_required` / yêu cầu Observability Plus. Không nâng gói hoặc phát sinh phí.
- Runtime log đã có không cung cấp timing riêng DB/pool/init/render. Không dùng số browser 9,6–12 giây làm SQL time; chưa có bằng chứng định lượng phần thời gian do lệch vùng.

## Diff đề xuất, chưa wired

`src/lib/dashboard-diagnostics.ts` là thư viện đề xuất **chưa được Dashboard/readDashboard import**. `diagnostics-wiring.patch` chỉ rõ thay đổi cần áp dụng sau review, không thêm endpoint. Hiện tại chưa có instrumentation nào hoạt động trong ứng dụng.

Sau khi được duyệt và nối patch:

- Chỉ bật bằng biến server `DASHBOARD_DIAGNOSTICS=1`; mặc định tắt. Cap mặc định 8, tối đa 20 records **mỗi process**, không phải cap toàn deployment.
- Ghi một event `DX_DASHBOARD_PROFILE` mỗi lượt đọc: inventory count/list, Products draft/main/guest, Home draft/main/guest, projection, tổng read work; count SQL, tổng thời gian driver và acquire, observed waiting queue.
- Không ghi SQL/parameters, dữ liệu, user/ID/email, URL/file URL, approval basis/token, error message/stack. UUID chỉ để phân biệt sample/process. Không trả metrics ra HTML/RSC/response header.
- Không đổi access, options Local API, context guest, query/filter, pool max, concurrency hoặc caching. Wrapper pool/client được gắn một lần, request dùng AsyncLocalStorage riêng, request ngoài phép đo đi thẳng qua driver.
- Acquire gồm chờ + mở kết nối. Driver time gồm PostgreSQL/network/deserialize, **không phải** server CPU PostgreSQL. Sums có thể chồng lấp. Queue observed có thể gồm request khác trong cùng process.
- Projection chỉ là hàm snapshot đồng bộ; **không phải React render/serialization**. `appReadTotalMs` không phải tổng HTTP request.
- Init Payload, React render hoàn chỉnh và full HTTP request được đánh dấu chưa đo; không thay bằng 0 hoặc gọi request đầu là cold start. Process uptime/first measured chỉ là dấu quan sát.

## Kế hoạch cần owner duyệt

1. Review OG và proposal độc lập; apply đúng wiring patch trên nhánh riêng, chạy lại regression ACL/unknown/snapshot/dependency và test async hai request chung pool, typecheck/lint/build. Không tự gộp proposal vào bản sửa OG đã kiểm artifact.
2. Chốt SHA + fingerprint và kiểm lại Production/Neon region. Nếu cần deployment thử, owner duyệt rõ deployment, DB và storage; không tự dùng credential Production cho Preview.
3. Nếu owner chọn pilot Production, duyệt riêng việc deploy SHA instrumentation và bật flag có cap. Khoảng đo 5 phút, cùng phiên Admin/quyền, 4 lượt reload; không lưu/approve/publish/form/upload. Thu log ngay trong thời hạn retention, chỉ xuất metrics allowlist.
4. Ghi riêng HTTP TTFB/tổng tải document (Network Timing nếu công cụ/browser cho phép), thời gian browser hoàn tất và app read spans. Nếu không lấy được full HTTP/server/init/render thì để unknown, không suy từ phép trừ các sums hoặc process uptime.
5. Đọc dữ liệu trước khi quyết định tối ưu. Nếu driver time chiếm phần lớn và DB Singapore được xác nhận, trình **diff riêng** đổi Function sang `sin1` để thử đối chứng cùng instrumentation/data; chưa thay region trong bản sửa này. Không tăng pool/concurrency hoặc cache chung.
6. Tắt flag sau pilot bằng cấu hình/deployment được owner duyệt; xác nhận không còn event. Nếu log có dữ liệu ngoài allowlist, ACL sai, fallback hoặc app lỗi: dừng đo, quay về deployment trước theo phê duyệt. Không tự retry/tăng giới hạn đo.

Instrumentation proposal chưa được duyệt chạy trên Vercel. Hai vấn đề chỉ được đóng khi có bằng chứng deployment thật/phép đo phù hợp; artifact Local không đủ để tuyên bố Production đã hết lỗi.
