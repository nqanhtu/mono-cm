# Court Management

## Deploy riêng backend API lên Ubuntu

Backend API của dự án chạy bằng Bun/Elysia tại `server/index.ts`. Vercel vẫn có thể tiếp tục chạy frontend và serverless API hiện tại qua `api/entry.js`; khi muốn tách backend ra Ubuntu, chỉ cần trỏ frontend production tới domain API riêng bằng `VITE_API_URL`.

### 1. Chuẩn bị server Ubuntu

Cài các gói cơ bản:

```bash
sudo apt update
sudo apt install -y git curl unzip nginx certbot python3-certbot-nginx
```

Cài Bun:

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

Clone source và cài dependencies:

```bash
git clone <repo-url> mono-cm
cd mono-cm
bun install --frozen-lockfile
```

### 2. Cấu hình biến môi trường backend

Tạo file môi trường cho service:

```bash
sudo nano /etc/mono-cm-api.env
```

Ví dụ nội dung:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app,https://your-frontend-domain.com
SESSION_COOKIE_SAMESITE=None
BLOB_READ_WRITE_TOKEN=replace-if-using-vercel-blob-backup
CRON_SECRET=replace-if-using-backup-cron
```

Lưu ý:

- `FRONTEND_ORIGIN` phải chứa đúng domain frontend để CORS và cookie đăng nhập hoạt động.
- Khi frontend và API khác domain, backend phải chạy HTTPS vì cookie production dùng `SameSite=None; Secure`.
- `BLOB_READ_WRITE_TOKEN` chỉ cần nếu dùng tính năng backup lên Vercel Blob.
- `CRON_SECRET` chỉ cần nếu gọi endpoint `/api/cron/backup`.

### 3. Generate Prisma client và chạy migration

Trong thư mục project:

```bash
bun run db:generate
bun run db:migrate
```

Nếu cần seed dữ liệu ban đầu:

```bash
bun run db:seed
```

### 4. Tạo systemd service

Tạo service để backend tự chạy lại khi server reboot:

```bash
sudo nano /etc/systemd/system/mono-cm-api.service
```

Nội dung mẫu:

```ini
[Unit]
Description=Mono CM Backend API
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/mono-cm
EnvironmentFile=/etc/mono-cm-api.env
ExecStart=/home/ubuntu/.bun/bin/bun server/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Điều chỉnh `WorkingDirectory` và đường dẫn `bun` theo user thực tế trên server.

Khởi động service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mono-cm-api
sudo systemctl start mono-cm-api
sudo systemctl status mono-cm-api
```

Xem log khi cần debug:

```bash
sudo journalctl -u mono-cm-api -f
```

### 5. Cấu hình Nginx reverse proxy

Tạo file site:

```bash
sudo nano /etc/nginx/sites-available/mono-cm-api
```

Nội dung mẫu:

```nginx
server {
  server_name api.your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable site và reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/mono-cm-api /etc/nginx/sites-enabled/mono-cm-api
sudo nginx -t
sudo systemctl reload nginx
```

Cấp HTTPS bằng Certbot:

```bash
sudo certbot --nginx -d api.your-domain.com
```

### 6. Trỏ frontend Vercel sang backend Ubuntu

Trong Vercel Project Settings, thêm biến môi trường production:

```env
VITE_API_URL=https://api.your-domain.com
```

Redeploy frontend sau khi thêm biến môi trường. Khi đó frontend sẽ gọi API qua `https://api.your-domain.com/api/...`.

Nếu bỏ `VITE_API_URL`, frontend production sẽ quay lại gọi API cùng origin trên Vercel như trước.

### 7. Kiểm tra sau deploy

Kiểm tra backend:

```bash
curl https://api.your-domain.com/health
```

Kết quả mong đợi:

```json
{"ok":true}
```

Kiểm tra API route:

```bash
curl -I https://api.your-domain.com/api/auth/session
```

Nếu frontend không đăng nhập được, kiểm tra các điểm sau:

- `FRONTEND_ORIGIN` trên Ubuntu đã đúng domain frontend chưa.
- API domain đã có HTTPS hợp lệ chưa.
- `SESSION_COOKIE_SAMESITE=None` đang được đặt cho production chưa.
- `JWT_SECRET` trên Ubuntu có ổn định và không bị đổi giữa các lần restart không.
- Vercel frontend đã redeploy sau khi thêm `VITE_API_URL` chưa.
