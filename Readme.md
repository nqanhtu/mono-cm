# Court Management (mono-cm)

Monorepo quản lý hồ sơ tòa án. Frontend là React/Vite, triển khai trên Vercel. Backend là Bun/Elysia, được build thành Docker image qua GitHub Actions và chạy trên VPS; PostgreSQL dùng database riêng cho từng tỉnh.

## Phát triển cục bộ

Yêu cầu Bun, PostgreSQL và các biến môi trường phù hợp với môi trường phát triển. Xem `package.json` và cấu hình môi trường được bàn giao cho dự án trước khi chạy; repo hiện không có `.env.example`.

```bash
bun install --frozen-lockfile
bun run db:generate
bun run dev:server
bun run dev
```

Frontend mặc định ở Vite dev server, backend ở cổng 3001. Vite proxy chuyển `/api` sang backend cục bộ. Production frontend cần `VITE_API_URL` trỏ tới API trên VPS; backend cho phép origin frontend qua `FRONTEND_ORIGIN`.

## Kiểm tra

```bash
bun run test:server
bun run test:frontend
bun run lint
bun run build
```

## Triển khai

- `vercel.json`: build và SPA rewrite cho frontend.
- `.github/workflows/deploy-server.yml`, `server/Dockerfile`, `docker-compose.server.yml`: build image backend, đẩy GHCR và triển khai trên VPS.
- `docs/DEPLOY.md`: mô tả cấu hình deploy frontend và bốn backend service trong repo.

Backend không được triển khai dưới dạng Vercel Function. Không có `server/api-entry.ts` hoặc `api/entry.js` trong cây source hiện tại.

## Tài liệu cần đọc

- `AGENTS.md`: quy tắc làm việc trong repo.
- `docs/dev/borrow-return.md`: trạng thái, quyền và các lỗi đã biết của tính năng mượn/trả hồ sơ.
- `docs/BACKUP-RESTORE.md`: backup/restore PostgreSQL và bàn giao database.
- `docs/DEPLOY.md`: cấu hình deploy và các bước kiểm tra từng backend instance.
- `docs/DOCUMENTATION-CLEANUP-PLAN.md`: kiểm kê tài liệu cũ và kế hoạch dọn dẹp.

## Điểm cần đối chiếu

Source hiện vẫn có đường upload backup lên Vercel Blob và cron Blob. Theo định hướng dự án, phần này sẽ được gỡ trong một phiên sửa mã riêng sau khi kiểm chứng backup/restore cho cả bốn database. Quy trình PostgreSQL ở `docs/BACKUP-RESTORE.md` là phương án vận hành cần xác minh trên VPS.
