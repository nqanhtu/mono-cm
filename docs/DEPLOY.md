# Triển khai mono-cm

Tài liệu này mô tả cấu hình **trong repo**, cần đối chiếu với VPS và Vercel đang chạy trước mỗi lần vận hành. Frontend React/Vite chạy trên Vercel; backend Bun/Elysia chạy bằng Docker trên VPS, kết nối PostgreSQL riêng theo từng instance.

## Frontend trên Vercel

`vercel.json` build ứng dụng Vite vào `dist/` và rewrite các đường dẫn SPA về `index.html`. Production frontend dùng `VITE_API_URL` để gọi backend trên VPS. Backend cho phép origin frontend qua `FRONTEND_ORIGIN` trong `server/index.ts`.

Không có backend Vercel Function trong cây source hiện tại. `vercel.json` không cấu hình cron backend.

## Backend trên VPS

`.github/workflows/deploy-server.yml` chạy khi nhánh `main` có thay đổi trong `server/**`, `lib/**`, `prisma/**`, `docker-compose.server.yml` hoặc chính workflow. Job build dùng `server/Dockerfile`, đẩy image `ghcr.io/nqanhtu/cm-server` lên GHCR. Job deploy SSH vào VPS, cập nhật repo, pull image và chạy `docker compose -f docker-compose.server.yml up -d` cho các service backend, không restart `cm-redis` trong bước này.

`docker-compose.server.yml` hiện khai báo bốn backend service:

| Service | Env file | Traefik path prefix |
| --- | --- | --- |
| `dongnai_server` | `.env.dongnai` | `/dongnai` |
| `longan_server` | `.env.longan` | `/longan` |
| `dongnai_city_server` | `.env.dongnai_city` | `/dongnai-city` |
| `dongnai_kv1_server` | `.env.dongnai_kv1` | `/dongnai-kv1` |

Traefik bỏ prefix trước khi chuyển tới app trên cổng 3000. Mỗi env file phải trỏ đến database đúng của instance đó. Repo không lưu các env file production; không suy tên database từ tên service.

## Bỏ build/deploy khi commit chỉ đổi Markdown

**Trạng thái:** đã cấu hình trong `.github/workflows/deploy-server.yml` và `vercel.json`; cần kiểm tra một commit Markdown trên Preview/Production sau khi đẩy lên Git.

Backend: workflow giới hạn `paths`, nên Markdown ở gốc repo và `docs/` không kích hoạt nó. Hai mẫu phủ định **sau tất cả mẫu dương** trong `on.push.paths` cũng loại Markdown trong `server/`, `lib/` và `prisma/`:

```yaml
      - "!**.md"
      - "!**.MD"
```

Frontend: `ignoreCommand` trong `vercel.json` (project Vercel phải dùng root directory của repo):

```json
"ignoreCommand": "sh -c 'base=${VERCEL_GIT_PREVIOUS_SHA:-}; [ -n \"$base\" ] && git cat-file -e \"$base^{commit}\" 2>/dev/null || exit 1; git diff --quiet \"$base\" HEAD -- . \":(exclude,glob)**/*.md\" \":(exclude,glob)**/*.MD\"'"
```

Lệnh so với commit triển khai thành công gần nhất, bỏ qua mọi file `.md`/`.MD`. Exit `0` khi chỉ có Markdown thay đổi để Vercel hủy build; exit `1` khi có file khác hoặc không truy cập được commit gốc, để build an toàn. Nếu project Vercel đặt Root Directory khác gốc repo, phải chỉnh đường dẫn `git diff` tương ứng. Kiểm tra cả Preview và Production sau khi cấu hình.

Vercel vẫn nhận sự kiện từ Git và có thể tạo deployment trạng thái `CANCELED`; Ignored Build Step ngăn build và phát hành bản mới, nhưng bản bị hủy vẫn có thể tính vào hạn mức deployment. `.vercelignore` chỉ loại file khỏi gói deploy, không thay cho điều kiện này.

## Kiểm tra trước và sau deploy

1. Kiểm tra diff của workflow, Dockerfile, compose và các biến môi trường cần dùng. Xác nhận bốn env file tồn tại trên VPS, không in giá trị secret ra log.
2. Với thay đổi schema, kiểm tra trạng thái migration và kế hoạch áp dụng trên **từng database** trước khi restart backend.
3. Sau deploy, kiểm tra trạng thái cả bốn container, `/health` và các route nghiệp vụ tương ứng qua từng prefix Traefik. Không coi job CI thành công là bằng chứng cả bốn instance hoạt động.
4. Đối chiếu backup/restore cho từng database theo [BACKUP-RESTORE.md](BACKUP-RESTORE.md). Ví dụ `BACKUP_DATABASES` trong runbook chưa phải cấu hình production.

## Lưu ý về backup cũ

Source vẫn có đường backup JSON gzip lên Vercel Blob và cron endpoint trong backend. Đây là chức năng tồn dư, không phải cách backend được deploy. Định hướng dự án là bỏ Blob trong một phiên sửa mã riêng, sau khi xác minh bản `pg_dump` và restore của bốn database. Xem [kế hoạch tổng hợp](DOCUMENTATION-CLEANUP-PLAN.md).
