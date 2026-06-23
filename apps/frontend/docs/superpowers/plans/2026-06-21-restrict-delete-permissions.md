# Restrict Deletion Permissions to SUPER_ADMIN Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict File and Document deletion capabilities strictly to the `SUPER_ADMIN` role and ensure MAC address and IP auditing are logged.

**Architecture:** Block deletions on the API layer (`files.routes.ts` and `documents.routes.ts`) for non-SUPER_ADMINs, audit deletions via `createAuditLog` using `x-mac-address` headers, and conditionally hide delete buttons in the frontend UI based on the user session role.

**Tech Stack:** Elysia, Bun, Prisma (Backend) and React, Vite, Tailwind CSS (Frontend).

## Global Constraints
- Only the `SUPER_ADMIN` role can delete a File (hồ sơ chính) or a Document (văn bản con).
- Regular `ADMIN` and `COORDINATOR` roles are not allowed to delete either model.
- Deletion operations must be logged to the `AuditLog` table with both IP and MAC address auditing.

---

### Task 1: Backend Deletion Permissions and Audit Log Upgrades

**Files:**
- Modify: `src/api-routes/files.routes.ts`
- Modify: `src/api-routes/documents.routes.ts`
- Create: `src/contracts/delete-permissions.contract.test.ts`

- [ ] **Step 1: Write the backend contract tests**
  Create the test file `src/contracts/delete-permissions.contract.test.ts` to test deletion authorization and log entries:
  ```typescript
  import { describe, expect, test } from 'bun:test'
  import { createTestApp, jsonRequest, sessionCookie, setDbForTesting } from './helpers'

  describe('delete permissions and auditing contract', () => {
    test('DELETE /api/files/:id - reject COORDINATOR and regular ADMIN', async () => {
      const app = createTestApp()
      setDbForTesting({
        file: {
          findUnique: async () => ({ id: 'file-1', code: 'FILE001', title: 'File 1', status: 'IN_STOCK', isLocked: false, borrowItems: [] }),
        },
      })

      // Try with COORDINATOR
      const res1 = await app.handle(
        new Request('http://localhost/api/files/file-1', {
          method: 'DELETE',
          headers: { cookie: await sessionCookie('COORDINATOR') },
        })
      )
      expect(res1.status).toBe(403)

      // Try with ADMIN
      const res2 = await app.handle(
        new Request('http://localhost/api/files/file-1', {
          method: 'DELETE',
          headers: { cookie: await sessionCookie('ADMIN') },
        })
      )
      expect(res2.status).toBe(403)
    })

    test('DELETE /api/files/:id - allow SUPER_ADMIN and log audit', async () => {
      const app = createTestApp()
      let logCall: any = null
      setDbForTesting({
        file: {
          findUnique: async () => ({ id: 'file-1', code: 'FILE001', title: 'File 1', status: 'IN_STOCK', isLocked: false, borrowItems: [] }),
          update: async ({ data }: any) => ({ id: 'file-1', ...data }),
        },
        auditLog: {
          create: async ({ data }: any) => {
            logCall = data
            return {}
          },
        },
      })

      const res = await app.handle(
        new Request('http://localhost/api/files/file-1', {
          method: 'DELETE',
          headers: {
            cookie: await sessionCookie('SUPER_ADMIN', 'sa-1'),
            'x-mac-address': 'AA-BB-CC-DD-EE-FF',
          },
        })
      )
      expect(res.status).toBe(200)
      expect(logCall).not.toBeNull()
      expect(logCall.action).toBe('UPDATE') // Soft delete logs as UPDATE
      expect(logCall.macAddress).toBe('AA-BB-CC-DD-EE-FF')
      expect(logCall.userId).toBe('sa-1')
    })

    test('DELETE /api/documents/:id - reject COORDINATOR and regular ADMIN', async () => {
      const app = createTestApp()
      setDbForTesting({
        document: {
          findUnique: async () => ({ id: 'doc-1', title: 'Doc 1', fileId: 'file-1', file: { isLocked: false, createdById: 'creator-1' } }),
        },
      })

      const res1 = await app.handle(
        new Request('http://localhost/api/documents/doc-1', {
          method: 'DELETE',
          headers: { cookie: await sessionCookie('COORDINATOR') },
        })
      )
      expect(res1.status).toBe(403)

      const res2 = await app.handle(
        new Request('http://localhost/api/documents/doc-1', {
          method: 'DELETE',
          headers: { cookie: await sessionCookie('ADMIN') },
        })
      )
      expect(res2.status).toBe(403)
    })

    test('DELETE /api/documents/:id - allow SUPER_ADMIN and log audit', async () => {
      const app = createTestApp()
      let logCall: any = null
      setDbForTesting({
        document: {
          findUnique: async () => ({ id: 'doc-1', title: 'Doc 1', fileId: 'file-1', file: { isLocked: false, createdById: 'creator-1' } }),
          delete: async () => ({ id: 'doc-1' }),
        },
        auditLog: {
          create: async ({ data }: any) => {
            logCall = data
            return {}
          },
        },
      })

      const res = await app.handle(
        new Request('http://localhost/api/documents/doc-1', {
          method: 'DELETE',
          headers: {
            cookie: await sessionCookie('SUPER_ADMIN', 'sa-1'),
            'x-mac-address': 'AA-BB-CC-DD-EE-FF',
          },
        })
      )
      expect(res.status).toBe(200)
      expect(logCall).not.toBeNull()
      expect(logCall.action).toBe('DELETE')
      expect(logCall.macAddress).toBe('AA-BB-CC-DD-EE-FF')
      expect(logCall.userId).toBe('sa-1')
    })
  })
  ```

- [ ] **Step 2: Run the test to verify it fails**
  Run: `bun test src/contracts/delete-permissions.contract.test.ts`
  Expected: Fail (since permissions are not yet restricted to SUPER_ADMIN only).

- [ ] **Step 3: Modify `files.routes.ts`**
  Modify `.delete('/api/files/:id')` in `/Users/anhtu/Projects/court-management-api/src/api-routes/files.routes.ts`:
  Replace the permission logic:
  ```typescript
      .delete('/api/files/:id', async ({ request, set, params }) => {
        try {
          const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
          if (denied) return denied

          if (session!.role !== 'SUPER_ADMIN') {
            return apiError(set, 'Chỉ duy nhất SUPER_ADMIN mới được phép xóa hồ sơ chính', 403)
          }

          const file = await db.file.findUnique({ where: { id: params.id }, include: { borrowItems: { select: { id: true, status: true } } } })
          if (!file) return apiError(set, 'Không tìm thấy hồ sơ', 404)
          if (file.status === 'BORROWED' || file.borrowItems.some((item) => item.status === 'BORROWING')) {
            return apiError(set, 'Không thể lưu trữ hồ sơ đang được mượn.', 409)
          }

          await db.file.update({ where: { id: params.id }, data: { status: 'ARCHIVED', isLocked: true } })
          await createAuditLog({
            action: 'UPDATE',
            target: 'File',
            targetId: params.id,
            userId: session!.id,
            ipAddress: getClientIp(request),
            macAddress: request.headers.get('x-mac-address') || undefined,
            detail: { code: file.code, title: file.title, status: 'ARCHIVED', action: 'SOFT_DELETE' },
          })
          return { success: true, message: 'Đã lưu trữ hồ sơ' }
        } catch (error) {
          console.error('Error archiving file:', error)
          return apiError(set, 'Không thể lưu trữ hồ sơ', 500)
        }
      })
  ```

- [ ] **Step 4: Modify `documents.routes.ts`**
  Modify `.delete('/api/documents/:id')` in `/Users/anhtu/Projects/court-management-api/src/api-routes/documents.routes.ts`:
  Replace the permission logic:
  ```typescript
      .delete('/api/documents/:id', async ({ request, set, params }) => {
        try {
          const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
          if (denied) return denied

          if (session!.role !== 'SUPER_ADMIN') {
            return apiError(set, 'Chỉ duy nhất SUPER_ADMIN mới được phép xóa hồ sơ con', 403)
          }

          // Retrieve document
          const docToDelete = await db.document.findUnique({
            where: { id: params.id },
            include: { file: true }
          })
          if (!docToDelete) return apiError(set, 'Document not found', 404)

          await db.document.delete({ where: { id: params.id } })
          await createAuditLog({
            action: 'DELETE',
            target: 'Document',
            targetId: params.id,
            detail: { title: docToDelete.title, fileId: docToDelete.fileId },
            userId: session!.id,
            ipAddress: getClientIp(request),
            macAddress: request.headers.get('x-mac-address') || undefined,
          })
          return { success: true }
        } catch (error) {
          console.error('Delete document error:', error)
          return apiError(set, 'Failed to delete document', 500)
        }
      })
  ```

- [ ] **Step 5: Run contract tests to verify they pass**
  Run: `bun test src/contracts/delete-permissions.contract.test.ts`
  Expected: PASS

- [ ] **Step 6: Run full backend test suite to check for regressions**
  Run: `bun test`
  Expected: 101/101 tests pass.

- [ ] **Step 7: Commit backend changes**
  ```bash
  git add src/api-routes/files.routes.ts src/api-routes/documents.routes.ts src/contracts/delete-permissions.contract.test.ts
  git commit -m "feat: restrict file and document deletion to SUPER_ADMIN only with auditing"
  ```

---

### Task 2: Frontend Deletion UI Updates

**Files:**
- Modify: `components/files/file-detail-content.tsx`
- Modify: `components/files/child-document-workspace.tsx`
- Modify: `components/files/columns.tsx`
- Modify: `components/files/file-table.tsx`

- [ ] **Step 1: Update `file-detail-content.tsx`**
  Modify `/Users/anhtu/Projects/court-management/components/files/file-detail-content.tsx` to guard "Xóa hồ sơ" button under `session?.role === 'SUPER_ADMIN'`:
  ```tsx
  {session?.role === 'SUPER_ADMIN' && (
      <AlertDialog>
          <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full text-destructive hover:text-destructive sm:w-auto">
                  <Trash2 className="h-4 w-4" />
                  Xóa hồ sơ
              </Button>
          </AlertDialogTrigger>
          ...
      </AlertDialog>
  )}
  ```

- [ ] **Step 2: Update `child-document-workspace.tsx`**
  Modify `/Users/anhtu/Projects/court-management/components/files/child-document-workspace.tsx`:
  - Import `useSession` from `@/lib/hooks/use-auth`:
    ```typescript
    import { useSession } from '@/lib/hooks/use-auth';
    ```
  - Call it in `ChildDocumentWorkspace`:
    ```typescript
    const { session } = useSession();
    const isSuperAdmin = session?.role === 'SUPER_ADMIN';
    ```
  - Pass `isSuperAdmin={isSuperAdmin}` to `ChildDocumentTable` rendering.
  - In `ChildDocumentTable` rendering, only show the `ChildDocumentDeleteDialog` if `isSuperAdmin` is true:
    ```tsx
    {isSuperAdmin && (
        <ChildDocumentDeleteDialog docId={doc.id} docTitle={doc.title || ''} onMutate={onMutate} />
    )}
    ```

- [ ] **Step 3: Update `columns.tsx`**
  Modify `/Users/anhtu/Projects/court-management/components/files/columns.tsx`:
  - Update `getColumns` signature to accept `isSuperAdmin = false` as parameter:
    ```typescript
    export const getColumns = (
      fileId: string | undefined,
      mutate: () => void,
      canManageFiles = false,
      onDeleteFile?: (file: FileDocument) => void,
      onPrintFile?: (file: FileDocument) => void,
      isSuperAdmin = false
    ): ColumnDef<FileDocument>[] => {
    ```
  - Guard the file delete button (`Lưu trữ hồ sơ` Alert Dialog) with `isSuperAdmin`:
    ```tsx
    {onDeleteFile && isSuperAdmin && (
      <AlertDialog>
        ...
      </AlertDialog>
    )}
    ```
  - Guard the child document delete button (`Xóa văn bản` Alert Dialog) with `isSuperAdmin`:
    ```tsx
    {isSuperAdmin && (
      <AlertDialog>
        ...
      </AlertDialog>
    )}
    ```

- [ ] **Step 4: Update `file-table.tsx`**
  Modify `/Users/anhtu/Projects/court-management/components/files/file-table.tsx` to pass `role === 'SUPER_ADMIN'` as `isSuperAdmin` to `getColumns`:
  ```typescript
  const columns = React.useMemo<ColumnDef<FileWithBox>[]>(
    () => getColumns(
      undefined,
      () => { },
      canManageFiles,
      handleDeleteFile,
      (file) => handlePrintCovers([file as unknown as FileWithBox]),
      role === 'SUPER_ADMIN'
    ) as unknown as ColumnDef<FileWithBox>[],
    [canManageFiles, handleDeleteFile, handlePrintCovers, role]
  )
  ```

- [ ] **Step 5: Run tests and TypeScript checks**
  Run: `pnpm exec tsc --noEmit`
  Run: `pnpm test`
  Expected: PASS

- [ ] **Step 6: Commit frontend changes**
  ```bash
  git add components/files/file-detail-content.tsx components/files/child-document-workspace.tsx components/files/columns.tsx components/files/file-table.tsx
  git commit -m "feat: update UI delete file and document triggers to show only for SUPER_ADMIN"
  ```
