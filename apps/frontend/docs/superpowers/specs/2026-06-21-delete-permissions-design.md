# Design Spec: Restrict Deletion Permissions to SUPER_ADMIN Only

This document specifies the permissions design for restricting both `File` (hồ sơ chính) and `Document` (văn bản con) deletion capabilities exclusively to the `SUPER_ADMIN` role, and ensuring proper auditing (including IP and MAC addresses).

## 1. Backend API Changes

### 1.1 `DELETE /api/files/:id`
- **File**: `src/api-routes/files.routes.ts`
- **Logic**:
  - Restrict access to `SUPER_ADMIN` role only.
  - Return `403 Forbidden` if user is not a `SUPER_ADMIN`.
  - Log the deletion event using `createAuditLog`, passing both `ipAddress` and `macAddress` (retrieved from `x-mac-address` header).
- **Code Change**:
  ```typescript
  if (session!.role !== 'SUPER_ADMIN') {
    return apiError(set, 'Chỉ duy nhất SUPER_ADMIN mới được phép xóa hồ sơ chính', 403)
  }
  ```

### 1.2 `DELETE /api/documents/:id`
- **File**: `src/api-routes/documents.routes.ts`
- **Logic**:
  - Restrict access to `SUPER_ADMIN` role only.
  - Return `403 Forbidden` if user is not a `SUPER_ADMIN`.
  - Log the deletion event using `createAuditLog`, passing both `ipAddress` and `macAddress`.
- **Code Change**:
  ```typescript
  if (session!.role !== 'SUPER_ADMIN') {
    return apiError(set, 'Chỉ duy nhất SUPER_ADMIN mới được phép xóa hồ sơ con', 403)
  }
  ```

---

## 2. Frontend UI Changes

### 2.1 File Detail Page Delete Button
- **File**: `components/files/file-detail-content.tsx`
- **Change**: Replace `canManageFiles` guard for the `Xóa hồ sơ` button with `session?.role === 'SUPER_ADMIN'`.
- **Code Change**:
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

### 2.2 Child Document Workspace List Delete Button
- **File**: `components/files/child-document-workspace.tsx`
- **Change**:
  - Import `useSession` from `@/lib/hooks/use-auth`.
  - Pass `isSuperAdmin={session?.role === 'SUPER_ADMIN'}` to `ChildDocumentTable`.
  - In `ChildDocumentTable`, only render `ChildDocumentDeleteDialog` if `isSuperAdmin` is true.
- **Code Change**:
  ```tsx
  {isSuperAdmin && (
      <ChildDocumentDeleteDialog docId={doc.id} docTitle={doc.title || ''} onMutate={onMutate} />
  )}
  ```

### 2.3 Columns Action Menu (Files & Documents list)
- **File**: `components/files/columns.tsx` and `components/files/file-table.tsx`
- **Change**:
  - Add `isSuperAdmin = false` parameter to `getColumns`.
  - Only render delete actions (both `Lưu trữ hồ sơ` and `Xóa văn bản`) if `isSuperAdmin` is true.
  - In `file-table.tsx`, pass `role === 'SUPER_ADMIN'` as `isSuperAdmin` to `getColumns`.

---

## 3. Auditing & Logging
All delete operations will log to the `AuditLog` table with:
- `action`: `DELETE` (or `UPDATE` with `SOFT_DELETE` detail for files)
- `ipAddress`: Client IP address
- `macAddress`: Client MAC address (retrieved from `x-mac-address` request header)
- `userId`: ID of the SUPER_ADMIN who executed the action
- `detail`: Detail information about the deleted file or document (code, title, parent file ID)
