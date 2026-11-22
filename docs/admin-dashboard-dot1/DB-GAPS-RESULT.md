# Kết quả bổ sung gap DB — lượt setup 21/11/2026

**Chưa chạy test DB. Không đóng hai gap còn mở.** Nguồn vẫn 75b07feed68d6dba833dd730b17e9d74902cac34. Không có kết nối Production hoặc database Local sẵn có.

## Thực hiện và điểm dừng

- Đọc harness/marker hiện có và evidence trước, chuẩn bị 3 case mới trong evidence-db/gaps.int.spec.ts, config envDir:false; không dùng vitest.setup.ts vì nó import dotenv.
- Đọc metadata Docker tại endpoint ghim npipe:////./pipe/dockerDesktopLinuxEngine. Không start/stop/exec container đã có; image postgres:17.6-alpine đã có sẵn.
- Tạo riêng network internal và container PostgreSQL mới, resource ledger có ID. Cấu hình loopback ephemeral port, tmpfs data512MiB, memory768MiB/1CPU/pids128. Không bind mount hoặc volume nghiệp vụ.
- **FAIL setup: Actual port mismatch.** Kiểm actual NetworkSettings.Ports không thỏa kỳ vọng trước bước mở connection PostgreSQL. Chưa ghi được raw actual port vào ledger của lần lỗi này; không kết luận nguyên nhân là internal network hay Docker Desktop khi chưa có metadata. Không nới policy hoặc giả định cổng hợp lệ.
- Marker chưa được tạo/xác minh bằng connection; schema/fixture/test chưa chạy. Do đó không có expected/actual DB mới để kết luận semantic.
- Cleanup đúng container ID918390d4117454fbe5debcb5d1d5c37730797810755b2c15afb8a134b9e31fcf, network ID406a8c0a1c93eb3731c24815242f1f4793a37568e967e3c109b8ab68e6566777 sau đối chiếu ID/label/network membership. `docker ps -a --filter name=dx-dashboard-gap` trả rỗng. Không tạo dependency junction vì chưa đến bước đó.
- setup-attempt1.json giữ ledger trước chỉnh instrumentation; resource-ledger.json cùng nội dung kết quả lượt đã chạy.
- Thêm instrumentation chỉ ghi metadata cổng/State.Status đã lọc vào launcher chuẩn bị. **Lần gọi lại bị automatic approval review từ chối trước khi process chạy**, vì reviewer coi đó là retry sau bất thường và sửa harness. Không có tài nguyên lần2. Chưa chạy phiên bản launcher có instrumentation; không dùng nó làm bằng chứng.

## Ma trận expected/actual

| Gap | Expected cần chứng minh | Actual lượt này | Kết luận |
|---|---|---|---|
| G1 Product chưa từng publish | Staff main có hàng draft ban đầu hay rỗng; guest ok/empty; denied/error phải riêng; N/A xét main+draft | NOT RUN: chưa kết nối DB | Mở; kỳ vọng ban đầu trong spec chỉ là giả thuyết, không phải thực tế đã xác nhận |
| G2 Home CMS/default | Guest raw{} trước publish; draft/approved-only không dùng CMS; publish locale có approval mới dùng CMS; locale khác không bị đưa ra | NOT RUN | Mở |
| G3 Home shared/dependency | Shared edit xóa approvals, own approval và missing EN/VI khớp guard; từ chối giữ main/versions/public, duyệt đủ rồi publish thành công | NOT RUN | Mở |
| Đối chứng denied/error | ACL users anonymous denied và Products invalid-query error là hai đối chứng khác request; không gọi Product guest empty là denied | NOT RUN | Chưa có chứng cứ mới; không diễn giải là lỗi hạ tầng DB đã tiêm |

## Bàn giao Claude

Đọc DE-XUAT/FINDINGS/EVIDENCE trước; gói semantic/mockup đã hiệu chỉnh, nhưng runtime DB chưa được xác minh. Chưa sửa đặc tả về main Product/Home từ dữ liệu suy đoán. Không gán 8/8 memory probes hoặc review cũ thành PASS gap mới. Chưa có dashboard runtime để test; spec đang gọi API/guard/renderer helper thật, không thay guard.

Bước kế tiếp cần cho phép: một lượt chẩn đoán setup riêng chỉ tạo disposable/inspect metadata cổng rồi cleanup, chưa DB/test. Sau khi xác minh actual endpoint/binding hợp lệ, mới xin tiếp tục marker/fixture đúng phạm vi. Không dùng tài nguyên cũ hoặc bỏ chốt để chạy.

## Chẩn đoán setup riêng được owner cho phép — hoàn tất

Evidence: `evidence-db/setup-diagnostic.json`; script `diagnose-setup.mjs` không import pg/Payload/test runner, không có SQL hoặc DB connection.

- Lượt mới 98f257ee-2785-4be7-ab68-18a24bb8de68, cùng endpoint Docker đã ghim.
- Hai snapshot 14:47:13 và 14:47:22 UTC: container running, State.Error rỗng, HostConfig.PortBindings yêu cầu127.0.0.1 và ephemeral host port; nhưng NetworkSettings.Ports = {"5432/tcp":[]} và `docker port` rỗng ở cả hai lần.
- Network internal riêng chỉ có đúng container vừa tạo; không attachment khác. Không có bind/volume trong Mounts; tmpfs data được yêu cầu ở argv. Giới hạn memory768MiB/1CPU/pids128.
- Kết luận đã chứng minh: **cấu hình setup này không có published endpoint thực tế**, nên chốt dừng trước DB là đúng. Không gán lỗi marker/schema/guard hoặc coi test nghiệp vụ FAIL. Hai snapshot không chứng minh nguyên nhân tổng quát cho mọi Docker version; chưa so đối chứng network non-internal.
- Cleanup đúng container cc247f93de8a19da1240ff8de48ee33d926dff8915240e7ebfb090b86a0fe1e7 và network a0811af976112f0d7325e73a841ba5b35a61cfc2fe3ae44750cab50bce1462e6; không volume/file nghiệp vụ phải dọn.

Hai gap DB vẫn NOT RUN. Bước đề nghị (chưa thực hiện): dùng bridge disposable **riêng nhưng non-internal**, chỉ publish loopback, không shared network/volume, env allowlist và credential test ngẫu nhiên; xác minh actual binding trước connection, xác minh DB/role/instance/marker trước schema/fixture. Network này có khả năng outbound khác internal nên phải được owner chốt trước lượt test kế tiếp; không tự sửa harness để nới và chạy ngay. Phương án khác là chạy app test trong cùng network internal, không cần host publication, nhưng cần thiết kế launcher riêng.

## Đối chiếu DB mới sau phê duyệt implementation

Nền mới fetch vẫn 75b07feed68d6dba833dd730b17e9d74902cac34; nhánh codex/dashboard-phase-one trên worktree sạch dashboard-phase-one. Đã cho phép bridge riêng non-internal, giữ loopback/actual port/membership/tmpfs/marker/RUN-COMPLETE.

G1/G2/G3 đạt 3/3, xem evidence-db/expected-actual.json + vitest.log + resource-ledger.json. G1 ghi actual trước assertion: draft create có main draft/in-review/empty landing ở cả3locale; guest ok/docs[]; ACL Users anonymous denied403; query Products field sai error400 QueryError (không phải lỗi hạ tầng đã tiêm). G2 Home raw{} default, draft/approval chưa publish vẫn default, publish mới CMS đúng locale; đủ3locale publish CMS cả3. G3 shared edit reset mọi approvals, own approval trước; missing EN/VI từ main staff; từ chối409 giữ main + toàn history + public summary; duyệt EN vẫn cần VI; đủapproval publishKO đưa shared mới và giữ copy EN/VI.

Mapping runtime thêm nhánh đọc main Product ok/null => empty main theo guard, không unknown; Home main{} => so revision default, không có locale approved để phụ thuộc. Không mở locale:all. Không thay guard để có PASS. Ghi nhận lỗi setup tách khỏi kết quả test: lượt đầu non-internal đối chiếu inet text có netmask không khớp, chuẩn hóa bằng host(inet_server_addr()) vẫn so exact IP; instance đó đã cleanup trước lượt đạt.
