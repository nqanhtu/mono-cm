# Quản lý Loại Bản Án / Vụ Án (Case Types) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bảng `CaseType` vào database, cung cấp API quản lý danh mục và trang giao diện quản trị Super Admin tại `/admin/case-types` để thêm/sửa/xóa loại bản án, đồng thời tích hợp danh sách động này vào gợi ý Autocomplete của hồ sơ.

**Architecture:** Bảng `CaseType` độc lập chứa thông tin `name` và `code`. Trường `File.type` giữ nguyên dạng String. Backend API cung cấp các endpoint admin CRUD và tích hợp danh sách vào API Autocomplete suggestions. Giao diện frontend hiển thị trang quản trị bằng cách dùng component bảng (Table) kết hợp modal form.

**Tech Stack:** React 19, TypeScript, TailwindCSS, Lucide React, Prisma, ElysiaJS, Vitest, Bun.

## Global Constraints
- Tất cả các API quản trị `/api/admin/case-types` phải kiểm tra quyền `SUPER_ADMIN`.
- Trường `code` của `CaseType` khi gửi lên phải được tự động chuẩn hóa sang in hoa và loại bỏ dấu cách.
- Tên file/component tuân thủ cấu trúc của dự án, các liên kết nội bộ sử dụng URL tương đối.

---

### Task 1: Thiết lập Database Schema & Migration

**Files:**
- Modify: [schema.prisma](file:///Users/anhtu/Projects/mono-cm/prisma/schema.prisma)

**Interfaces:**
- Produces: Model `CaseType` trên client prisma.

- [ ] **Step 1: Khai báo model `CaseType` trong schema**
  Thêm đoạn code sau vào cuối file [schema.prisma](file:///Users/anhtu/Projects/mono-cm/prisma/schema.prisma):
  ```prisma
  model CaseType {
    id        String   @id @default(uuid(7))
    name      String   @unique
    code      String   @unique
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@map("case_type")
  }
  ```

- [ ] **Step 2: Generate Prisma Client**
  Chạy lệnh: `bun run db:generate`
  Xác nhận: Lệnh chạy thành công, Client được cập nhật không có lỗi.

- [ ] **Step 3: Tạo bản ghi di trú database (Migration)**
  Chạy lệnh: `bun prisma migrate dev --name add_case_type`
  Xác nhận: Di chuyển cơ sở dữ liệu thành công.

- [ ] **Step 4: Commit**
  ```bash
  git add prisma/schema.prisma prisma/migrations
  git commit -m "db: add CaseType model to schema"
  ```

---

### Task 2: Cấu hình Seed dữ liệu mẫu

**Files:**
- Modify: [seed.ts](file:///Users/anhtu/Projects/mono-cm/prisma/seed.ts)

- [ ] **Step 1: Bổ sung logic seed cho CaseType**
  Tìm vị trí seed dữ liệu ban đầu và thêm logic khởi tạo `CaseType`:
  ```typescript
  const defaultCaseTypes = [
    { name: "Hình sự sơ thẩm", code: "HSST" },
    { name: "Dân sự sơ thẩm", code: "DSST" },
    { name: "Hình sự phúc thẩm", code: "HSPT" },
    { name: "Dân sự phúc thẩm", code: "DSPT" },
    { name: "Hôn nhân phúc thẩm", code: "HNPT" },
    { name: "Hành chính", code: "HC" },
    { name: "Kinh doanh thương mại", code: "KDTM" },
    { name: "Lao động", code: "LD" },
    { name: "Gia đình và người chưa thành niên", code: "GDNCTN" },
  ];

  console.log("Seeding case types...");
  for (const item of defaultCaseTypes) {
    await db.caseType.upsert({
      where: { name: item.name },
      update: { code: item.code },
      create: { name: item.name, code: item.code }
    });
  }
  ```

- [ ] **Step 2: Chạy seed dữ liệu mẫu**
  Chạy lệnh: `bun run db:seed`
  Xác nhận: Dữ liệu được seed thành công vào DB mới mà không gặp lỗi.

- [ ] **Step 3: Commit**
  ```bash
  git add prisma/seed.ts
  git commit -m "db: add default case types to seed script"
  ```

---

### Task 3: Backend API Routes

**Files:**
- Modify: [admin.routes.ts](file:///Users/anhtu/Projects/mono-cm/server/api-routes/admin.routes.ts)
- Modify: [files.routes.ts](file:///Users/anhtu/Projects/mono-cm/server/api-routes/files.routes.ts)

**Interfaces:**
- Consumes: Khởi tạo database client và các Helper functions cho Elysia.
- Produces: API endpoints `/api/admin/case-types` (GET, POST, PATCH, DELETE) và đề xuất cập nhật Autocomplete.

- [ ] **Step 1: Viết mã cập nhật API Autocomplete Suggestions**
  Sửa đổi trong file [files.routes.ts](file:///Users/anhtu/Projects/mono-cm/server/api-routes/files.routes.ts#L228):
  ```typescript
        // Lấy danh sách case types trong DB
        const dbCaseTypes = await db.caseType.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
        const predefinedTypes = dbCaseTypes.map(c => c.name)
        const predefinedRetentions = ['10 năm', '15 năm', '20 năm', '70 năm', 'Vĩnh viễn']
  ```

- [ ] **Step 2: Khai báo các route quản trị trong `admin.routes.ts`**
  Thêm các route sau vào Elysia app trong [admin.routes.ts](file:///Users/anhtu/Projects/mono-cm/server/api-routes/admin.routes.ts):
  ```typescript
    .get('/api/admin/case-types', async ({ request, set }) => {
      try {
        const { denied } = await sessionOrDenied({ request, set }, 'manageAgencies')
        if (denied) return denied

        const caseTypes = await db.caseType.findMany({
          orderBy: { name: 'asc' }
        })
        return caseTypes
      } catch (error) {
        console.error('Error fetching case types:', error)
        return jsonError(set, 'Internal Server Error', 500)
      }
    })
    .post('/api/admin/case-types', async ({ request, set }) => {
      try {
        const { denied, session } = await sessionOrDenied({ request, set }, 'manageAgencies')
        if (denied) return denied

        const data = await request.json() as { name: string, code: string }
        const name = (data.name || '').trim()
        const code = (data.code || '').trim().toUpperCase().replace(/\s+/g, '')

        if (!name || !code) {
          return jsonError(set, 'Tên và mã loại bản án không được để trống', 400)
        }

        const duplicate = await db.caseType.findFirst({
          where: { OR: [{ name }, { code }] }
        })
        if (duplicate) {
          return jsonError(set, 'Tên hoặc mã loại bản án đã tồn tại', 409)
        }

        const newType = await db.caseType.create({
          data: { name, code }
        })

        await createAuditLog({
          action: 'CREATE',
          target: 'CaseType',
          targetId: newType.id,
          userId: session?.id,
          ipAddress: getClientIp(request),
          detail: { name, code }
        })

        return newType
      } catch (error) {
        console.error('Error creating case type:', error)
        return jsonError(set, 'Internal Server Error', 500)
      }
    })
    .patch('/api/admin/case-types/:id', async ({ request, set, params }) => {
      try {
        const { denied, session } = await sessionOrDenied({ request, set }, 'manageAgencies')
        if (denied) return denied

        const id = params.id
        const data = await request.json() as { name?: string, code?: string }
        const name = typeof data.name === 'string' ? data.name.trim() : undefined
        const code = typeof data.code === 'string' ? data.code.trim().toUpperCase().replace(/\s+/g, '') : undefined

        const existing = await db.caseType.findUnique({ where: { id } })
        if (!existing) {
          return jsonError(set, 'Không tìm thấy loại bản án', 404)
        }

        if (name || code) {
          const duplicate = await db.caseType.findFirst({
            where: {
              id: { not: id },
              OR: [
                ...(name ? [{ name }] : []),
                ...(code ? [{ code }] : [])
              ]
            }
          })
          if (duplicate) {
            return jsonError(set, 'Tên hoặc mã loại bản án đã tồn tại', 409)
          }
        }

        const updated = await db.caseType.update({
          where: { id },
          data: {
            ...(name ? { name } : {}),
            ...(code ? { code } : {})
          }
        })

        await createAuditLog({
          action: 'UPDATE',
          target: 'CaseType',
          targetId: id,
          userId: session?.id,
          ipAddress: getClientIp(request),
          detail: { before: existing, after: updated }
        })

        return updated
      } catch (error) {
        console.error('Error updating case type:', error)
        return jsonError(set, 'Internal Server Error', 500)
      }
    })
    .delete('/api/admin/case-types/:id', async ({ request, set, params }) => {
      try {
        const { denied, session } = await sessionOrDenied({ request, set }, 'manageAgencies')
        if (denied) return denied

        const id = params.id
        const existing = await db.caseType.findUnique({ where: { id } })
        if (!existing) {
          return jsonError(set, 'Không tìm thấy loại bản án', 404)
        }

        await db.caseType.delete({ where: { id } })

        await createAuditLog({
          action: 'DELETE',
          target: 'CaseType',
          targetId: id,
          userId: session?.id,
          ipAddress: getClientIp(request),
          detail: { name: existing.name, code: existing.code }
        })

        return { success: true }
      } catch (error) {
        console.error('Error deleting case type:', error)
        return jsonError(set, 'Internal Server Error', 500)
      }
    })
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add server/api-routes/files.routes.ts server/api-routes/admin.routes.ts
  git commit -m "feat: implement dynamic case types API and autocomplete updates"
  ```

---

### Task 4: Backend Tests & Autocomplete Test Refactoring

**Files:**
- Modify: [files.contract.test.ts](file:///Users/anhtu/Projects/mono-cm/server/contracts/files.contract.test.ts)
- Create: `server/contracts/case-types.contract.test.ts`

- [ ] **Step 1: Refactor autocomplete suggestions test**
  Chỉnh sửa mock hoặc thiết lập DB test trong [files.contract.test.ts](file:///Users/anhtu/Projects/mono-cm/server/contracts/files.contract.test.ts) để mock việc gọi `db.caseType.findMany()` nhằm tránh lỗi test khi thực thi API autocomplete.
  ```typescript
        caseType: {
          findMany: async () => [
            { name: 'Hình sự' },
            { name: 'Dân sự' },
            { name: 'Hành chính' },
            { name: 'Kinh doanh thương mại' },
            { name: 'Lao động' },
            { name: 'Hôn nhân gia đình' }
          ]
        },
  ```

- [ ] **Step 2: Viết test cho API quản lý loại bản án mới**
  Tạo tệp `server/contracts/case-types.contract.test.ts`:
  ```typescript
  import { describe, expect, it, mock } from 'bun:test'
  import { app } from '../../index'
  import { jsonRequest, sessionCookie } from '../_test-helpers'

  describe('case types admin contract', () => {
    it('GET /api/admin/case-types returns list of case types', async () => {
      const response = await app.handle(jsonRequest('/api/admin/case-types', {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') }
      }))
      expect(response.status).toBe(200)
      expect(await response.json()).toBeArray()
    })
  })
  ```

- [ ] **Step 3: Chạy test backend**
  Chạy lệnh: `bun test server/`
  Xác nhận: Tất cả các test đều vượt qua.

- [ ] **Step 4: Commit**
  ```bash
  git add server/contracts
  git commit -m "test: add test suite for case-types API and mock suggestions"
  ```

---

### Task 5: Giao diện quản lý Frontend & Tích hợp Sidebar

**Files:**
- Modify: [app.tsx](file:///Users/anhtu/Projects/mono-cm/src/app.tsx)
- Modify: [app-sidebar.tsx](file:///Users/anhtu/Projects/mono-cm/components/app-sidebar.tsx)
- Modify: [header.tsx](file:///Users/anhtu/Projects/mono-cm/components/header.tsx)
- Create: `src/routes/admin/case-types-page.tsx`
- Create: `components/admin/case-type-list.tsx`
- Create: `components/admin/case-type-form-modal.tsx`

- [ ] **Step 1: Tạo component modal nhập liệu `case-type-form-modal.tsx`**
  Viết logic form modal (Thêm/Sửa) và xử lý chuẩn hóa chuỗi `code` đầu vào.

- [ ] **Step 2: Tạo component danh sách `case-type-list.tsx`**
  Bao gồm bảng hiển thị danh sách, tìm kiếm, nút Sửa/Xóa, và hộp thoại cảnh báo xóa.

- [ ] **Step 3: Tạo trang `case-types-page.tsx`**
  Chứa trang chính nạp component danh sách và thực hiện kiểm tra quyền Super Admin.

- [ ] **Step 4: Đăng ký Router & Sidebar**
  Đăng ký tuyến đường `/admin/case-types` trong [app.tsx](file:///Users/anhtu/Projects/mono-cm/src/app.tsx). Thêm liên kết vào Sidebar trong [app-sidebar.tsx](file:///Users/anhtu/Projects/mono-cm/components/app-sidebar.tsx). Đăng ký breadcrumbs mô tả trong [header.tsx](file:///Users/anhtu/Projects/mono-cm/components/header.tsx).

- [ ] **Step 5: Chạy thử và test frontend**
  Chạy: `bun run test:frontend` và chạy dev server để xác minh thủ công.

- [ ] **Step 6: Commit**
  ```bash
  git add src/ components/
  git commit -m "feat: complete frontend page, lists and forms for case types management"
  ```
