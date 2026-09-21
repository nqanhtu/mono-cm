# Permission riêng cho xuất Mục lục hồ sơ toàn bộ

Tính năng xuất Mục lục hồ sơ (Excel, không giới hạn số dòng) cần một permission kiểm soát ai được phép xuất. `manageFiles` đã tồn tại và có vẻ phù hợp, nhưng hiện không nhất quán giữa `lib/rbac.ts` (client: `SUPER_ADMIN, ADMIN`) và `server/lib/rbac.ts` (server: thêm cả `COORDINATOR`). Thay vì tái dùng `manageFiles` và kéo theo phải sửa luôn sự không nhất quán đó, chúng tôi tạo permission mới `exportFiles = [SUPER_ADMIN, ADMIN]`, độc lập với `manageFiles`. Việc sửa `manageFiles` được để lại cho một thay đổi riêng, ngoài phạm vi tính năng này.
