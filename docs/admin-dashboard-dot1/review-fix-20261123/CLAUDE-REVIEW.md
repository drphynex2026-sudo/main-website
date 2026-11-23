# Yêu cầu Claude review có mục tiêu

Review chỉ đọc nhánh codex/dashboard-phase-one tại SHA cuối Codex bàn giao (kiểm git rev-parse HEAD và status đầu/cuối). Baseline aadbc408438f033eae6abf0d97d89d74275ba2f3. Không sửa, DB writes, test Docker, push hoặc deploy.

Đọc HANDOVER.md trong cùng thư mục, git diff baseline..HEAD cho:
- src/lib/dashboard-read.ts, src/components/admin/Dashboard.tsx
- tests/unit/dashboard-concurrency.spec.ts, dashboard-fallback.spec.ts
- tests/int/dashboard-snapshot.int.spec.ts
- vercel.json
- evidence runtime/real-concurrency.json, product-dependency.json, integration/build logs; browser/results.json; fault-injection.json và preload test-only.

Xác minh:
1. Chỉ4Product worker, thứ tự ổn định, không Promise.all inventory/cache; failure drain đúng; tối đa36top-level finds khác SQL/populate/pool.
2. Aggregate/snapshot/count error vẫn giữ tiêu đề/shortcut đúng quyền, không count0/success hay leak exception. Fallback browser thật có faulttest-only, không productionbackdoor.
3. Productmainpublished/sharedchange/KOapproved/ENmissing: prediction đúngguard409, rejection giữmain/versions; chưapublish staffread/guestempty.
4. Productionbranch deploy chưa được yêu cầu; exact nhánh dashboard deploymentEnabled=false trước bất kỳ push; không ruletrue ghi đè.
5. Không mở rộng finding thấp/guard/schema/workflow, không gán kết quả baseline cho lần sửa mới.

Báo finding có file/dòng/điều kiện/ảnh hưởng và kết luận riêng đủ điều kiện push/mở PR chưa. Review chỉ đúng phần sửa, không cần lặp toàn bộ scope/bộ198link đã có. Không coi self-test Codex là review độc lập.
