# Deploy Flow — mono-cm Server

## Tổng quan kiến trúc

```
VPS Backend (103.152.164.153)              VPS Database (server khác)
┌──────────────────────────────┐          ┌──────────────────────────┐
│  Traefik (reverse proxy)     │          │  PostgreSQL              │
│  dongnai_server              │──────────│    dongnai_db / user     │
│  longan_server  (commented)  │──────────│    longan_db  / user     │
│  cm-redis (shared)           │          └──────────────────────────┘
│  n8n (external)              │
└──────────────────────────────┘

Image Registry: ghcr.io/nqanhtu/cm-server
```

---

## Deploy Flow (tự động qua GitHub Actions)

```
git push origin main
        │
        ▼
[GitHub Actions — Job 1: build]
  - docker build (context: repo root, file: server/Dockerfile)
  - push → ghcr.io/nqanhtu/cm-server:latest
  - push → ghcr.io/nqanhtu/cm-server:<git-sha>
  - Layer cache via GitHub Actions Cache (nhanh từ lần 2 trở đi)
        │
        ▼ (only if build succeeds)
[GitHub Actions — Job 2: deploy]
  - SSH vào VPS
  - git pull origin main (cập nhật docker-compose.server.yml)
  - docker login ghcr.io (dùng GHCR_TOKEN secret)
  - docker pull ghcr.io/nqanhtu/cm-server:latest
  - docker compose up -d (restart các province containers, bỏ cm-redis)
  - docker image prune -f
```

**Trigger**: push lên `main` khi có thay đổi trong:
- `server/**`, `lib/**`, `prisma/**`
- `docker-compose.server.yml`
- `.github/workflows/deploy-server.yml`

---

## Routing Traefik

| URL | Container | Ghi chú |
|-----|-----------|---------|
| `namnn07.zhost.store/dongnai/*` | `dongnai_server:3000` | Strip `/dongnai` prefix |
| `namnn07.zhost.store/longan/*`  | `longan_server:3000`  | Strip `/longan` prefix |

App nhận request tại `/api/...`, `/health` như bình thường (prefix đã bị strip bởi Traefik middleware).

---

## Thêm tỉnh mới

1. Tạo env file: `cp .env.example .env.<tỉnh>`
2. Điền `DATABASE_URL`, `BETTER_AUTH_SECRET`, `JWT_SECRET`
3. Uncomment block `<tỉnh>_server` trong `docker-compose.server.yml` (hoặc copy từ `dongnai_server`)
4. Đổi tên router/middleware/service trong labels (phải unique)
5. `scp .env.<tỉnh>` lên server thủ công (không commit vào git)
6. Push code → CI tự deploy

---

## GitHub Secrets cần thiết

| Secret | Dùng để |
|--------|---------|
| `SSH_HOST` | IP VPS backend |
| `SSH_USER` | User SSH (thường là `root`) |
| `SSH_PRIVATE_KEY` | Private key SSH |
| `GHCR_TOKEN` | PAT với scope `read:packages` — VPS dùng để pull image từ GHCR |

> Tạo `GHCR_TOKEN` tại: github.com/settings/tokens → chọn `read:packages`

---

## Lần deploy đầu tiên (manual)

```bash
# 1. Trên máy local — copy env file lên server
scp .env.dongnai root@103.152.164.153:/opt/mono-cm/

# 2. SSH vào server
ssh root@103.152.164.153

# 3. Clone repo
git clone git@github.com:nqanhtu/cm.git /opt/mono-cm

# 4. Login GHCR
docker login ghcr.io -u nqanhtu
# Nhập GHCR_TOKEN khi hỏi password

# 5. Pull image và chạy
cd /opt/mono-cm
docker compose -f docker-compose.server.yml up -d
```

---

## Files liên quan

- [`docker-compose.server.yml`](../docker-compose.server.yml) — định nghĩa services, Traefik labels
- [`.github/workflows/deploy-server.yml`](../.github/workflows/deploy-server.yml) — CI/CD pipeline
- [`server/Dockerfile`](../server/Dockerfile) — multi-stage build với Bun
- `.env.<tỉnh>` — **không commit**, copy thủ công lên server
- [`.env.example`](../.env.example) — template env file
