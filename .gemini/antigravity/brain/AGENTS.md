# Court Management - Agent Onboarding Document (mono-cm)

Tài liệu này cung cấp cái nhìn tổng quan nhanh chóng và toàn diện về hệ thống Quản lý Hồ sơ Vụ án dành cho các Agent hoặc nhà phát triển trong các phiên làm việc tiếp theo.

> **Lưu ý**: Đây là **monorepo** — frontend (React/Vite) và backend (Elysia.js) nằm cùng trong một repository `mono-cm`.

---

## 1. Công nghệ cốt lõi (Core Stack)

### Backend
- **Runtime**: [Bun](https://bun.sh/) (sử dụng thay thế cho Node.js).
- **Framework**: [Elysia.js](https://elysiajs.com/) (siêu nhanh, hỗ trợ OpenAPI/Swagger).
- **ORM**: [Prisma](https://www.prisma.io/) (với adapter `@prisma/adapter-pg` + `pg` driver cho PostgreSQL).
- **Database**: PostgreSQL (Neon Postgres qua `DATABASE_URL`).
- **Authentication**: Cookie-based JWT (`session` cookie).

### Frontend
- **Framework**: React 19 + Vite
- **Routing**: React Router DOM v7
- **State/Data**: SWR + TanStack Query
- **UI**: shadcn/ui + Radix UI + Tailwind CSS v4
- **Forms**: React Hook Form + Zod

---

## 2. Cấu trúc thư mục dự án (Project Structure)

```text
mono-cm/
├── prisma/
│   ├── schema.prisma              # Khai báo schema database (Tables, Relations, Enums)
│   ├── seed.ts                    # Script seed đầy đủ dữ liệu mẫu
│   ├── seed-superadmin.ts         # Script chỉ seed tài khoản superadmin (mật khẩu mặc định: admin@123)
│   ├── clear-data.ts              # Script xoá sạch dữ liệu mẫu (giữ lại bảng User)
│   └── scripts/
│       ├── export-staging.ts      # Export dữ liệu staging
│       ├── import-to-client.ts    # Import dữ liệu vào client DB
│       └── verify-migration.ts    # Kiểm tra migration
├── server/                        # Backend (Elysia.js)
│   ├── index.ts                   # Entrypoint: CORS, OpenAPI, health check, port config
│   ├── routes.ts                  # Bộ định tuyến trung tâm
│   ├── api-entry.ts               # Entry cho Vercel serverless
│   ├── api-routes/                # API Route theo tính năng
│   │   ├── _shared.ts             # Shared helpers/types cho routes
│   │   ├── auth.routes.ts         # Đăng nhập, đăng xuất, session
│   │   ├── users.routes.ts        # CRUD Người dùng
│   │   ├── files.routes.ts        # CRUD Hồ sơ vụ án
│   │   ├── documents.routes.ts    # CRUD Tài liệu con trong hồ sơ
│   │   ├── borrow.routes.ts       # Quy trình mượn/trả hồ sơ
│   │   ├── reports.routes.ts      # Báo cáo, thống kê, xuất/nhập Excel
│   │   ├── admin.routes.ts        # Quản trị hệ thống, backup
│   │   ├── audit.routes.ts        # Lịch sử thao tác người dùng
│   │   ├── system.routes.ts       # Bảo trì, cấu hình hệ thống
│   │   └── upload.routes.ts       # Upload tài liệu đính kèm
│   ├── contracts/                 # Contract tests
│   └── lib/                       # Utilities backend
│       ├── db.ts                  # PrismaClient singleton (dùng PG Pool adapter)
│       ├── auth-jwt.ts            # JWT encode/decode
│       ├── cookies.ts             # Cookie helper
│       ├── session.ts             # Session helper
│       ├── rbac.ts                # Role-based access control (backend)
│       ├── http.ts                # HTTP helpers
│       ├── request.ts             # Request helpers
│       ├── excel-parser.ts        # Parse Excel upload
│       ├── services/              # Business logic services
│       ├── types/                 # Shared type definitions
│       └── validation/            # Zod validation schemas
├── components/                    # React components (frontend)
├── app/                           # App pages/routes (frontend)
├── lib/                           # Shared utilities (frontend)
│   ├── api/                       # API client, types (DTOs)
│   ├── hooks/                     # Custom React hooks
│   ├── rbac.ts                    # RBAC phía client (ẩn/hiện UI)
│   └── files/                     # File/document utilities
├── src/                           # React entry (main.tsx, router, query client)
├── scripts/
│   └── build-api.ts               # Build API bundle cho Vercel
└── public/                        # Static assets
```

---

## 3. Thiết kế Cơ sở dữ liệu (`prisma/schema.prisma`)

### Phân quyền & Người dùng (`User`)
Hỗ trợ các vai trò (`UserRole`):
- `SUPER_ADMIN`: Toàn quyền quản trị hệ thống.
- `ADMIN`: Chánh án/Lãnh đạo tòa — xem, thêm, sửa, xoá hồ sơ, quản lý kho.
- `COORDINATOR`: Cán bộ lưu trữ — tạo và quản lý hồ sơ của mình, mượn trả.
- `VIEWER`: Thẩm phán/Thư ký — chỉ xem hồ sơ.
- `BASIC_VIEWER`: Người xem cơ bản — quyền hạn chế nhất.

### Phân quyền quản lý tài liệu con (Document)
- `SUPER_ADMIN` và `ADMIN`: Toàn quyền tạo/sửa/xóa tài liệu con.
- `COORDINATOR` tạo file cha: Có quyền tạo/sửa/xóa tài liệu con trong hồ sơ của mình.
- Logic kiểm tra: `canEditFile = canManageFiles || isOwnCoordinatorFile`
  - `canManageFiles`: role thuộc `['SUPER_ADMIN', 'ADMIN']`
  - `isOwnCoordinatorFile`: `role === 'COORDINATOR' && file.createdById === session.id`

### Lưu kho Vật lý
- **`StorageBox`**: Nhà kho → Dãy kệ → Kệ → Ô chứa → Số hộp.
- **`StorageBoxLabel`**: Nhãn dán trên thùng hồ sơ.
- **`AgencyHistory`**: Lịch sử tên cơ quan.

### Quản lý Hồ sơ
- **`File`**: Hồ sơ vụ án (bìa hồ sơ) — `code`, `title`, `type`, `status` (`IN_STOCK`, `BORROWED`, `LOST`), `isLocked`.
- **`Document`**: Tài liệu con trong hồ sơ (Đơn khởi kiện, Bản án...).
- **`FileIndex`**: File đính kèm số hóa (PDF, ảnh).

### Quy trình Mượn Trả
- **`BorrowSlip`**: Phiếu mượn — `status`: `PENDING_APPROVAL` → `APPROVED` → `EXPORTED` → `PARTIAL_RETURN` / `RETURNED` / `OVERDUE`.
- **`BorrowItem`**: Chi tiết hồ sơ trong phiếu mượn.
- **`BorrowSlipEvent`**: Lịch sử thay đổi trạng thái phiếu.

### Giám sát & Logs
- **`AuditLog`**: Ghi nhận hành vi (LOGIN, VIEW, CREATE, UPDATE, DELETE, EXPORT, IMPORT, UPLOAD).
- **`UserAccessLog`**: Log truy cập kèm IP, MAC Address, User Agent.

---

## 4. Các lệnh NPM / Bun hữu ích (`package.json`)

| Lệnh | Mô tả |
|---|---|
| `bun run dev` | Khởi chạy frontend (Vite dev server, port 5173) |
| `bun run dev:server` | Khởi chạy backend (Elysia, port 3001, watch mode) |
| `bun run build` | Build toàn bộ (generate Prisma + build API + Vite build) |
| `bun run db:generate` | Tạo Prisma Client (chạy sau khi sửa schema.prisma) |
| `bun run db:migrate` | Áp dụng migration vào DB |
| `bun run db:seed` | Seed toàn bộ dữ liệu mẫu |
| `bun run db:clear` | Xoá sạch dữ liệu (giữ lại bảng User) |
| `bun run db:export` | Export dữ liệu staging |
| `bun run db:import` | Import dữ liệu vào client DB |
| `bun test server/` | Chạy test backend (Bun test runner) |
| `bun run test:frontend` | Chạy test frontend (Vitest) |

> **Seed superadmin thủ công**: `bun prisma/seed-superadmin.ts` (mật khẩu mặc định: `admin@123`)

---

## 5. Lưu ý quan trọng khi lập trình (Important Gotchas)

1. **Prisma Client**: Luôn import từ `server/lib/db.ts` — không khởi tạo `new PrismaClient()` trực tiếp. Client được config với PG Pool adapter cho môi trường serverless.

2. **Cookie & Credentials**: Frontend phải gửi `credentials: 'include'` (đã config trong `lib/api/client.ts`). Backend CORS cho phép credentials.

3. **RBAC có 2 lớp riêng biệt**:
   - `server/lib/rbac.ts` — backend (middleware, route guards)
   - `lib/rbac.ts` — frontend (ẩn/hiện UI elements)

4. **MAC Address Tracking**: Hệ thống ghi log địa chỉ MAC qua header `x-mac-address` khi đăng nhập/thao tác.

5. **Vercel Deploy**: Backend chạy như serverless function qua `server/api-entry.ts`. Frontend deploy tĩnh. Config trong `vercel.json`.

6. **File Lock**: Hồ sơ có trạng thái `isLocked` — SUPER_ADMIN bypass được lock (`showEditButton` dùng logic riêng), các role khác bị chặn sửa.
