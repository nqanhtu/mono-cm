-- CreateIndex
CREATE INDEX "StorageBox_agencyId_idx" ON "StorageBox"("agencyId");

-- CreateIndex
CREATE INDEX "StorageBoxLabel_storageBoxId_idx" ON "StorageBoxLabel"("storageBoxId");

-- CreateIndex
CREATE INDEX "File_createdAt_idx" ON "File"("createdAt");

-- CreateIndex
CREATE INDEX "File_status_idx" ON "File"("status");

-- CreateIndex
CREATE INDEX "File_type_idx" ON "File"("type");

-- CreateIndex
CREATE INDEX "File_year_idx" ON "File"("year");

-- CreateIndex
CREATE INDEX "File_boxId_idx" ON "File"("boxId");

-- CreateIndex
CREATE INDEX "File_createdById_createdAt_idx" ON "File"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "Document_fileId_order_idx" ON "Document"("fileId", "order");

-- CreateIndex
CREATE INDEX "Document_createdById_createdAt_idx" ON "Document"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "BorrowSlip_createdAt_idx" ON "BorrowSlip"("createdAt");

-- CreateIndex
CREATE INDEX "BorrowSlip_status_dueDate_idx" ON "BorrowSlip"("status", "dueDate");

-- CreateIndex
CREATE INDEX "BorrowSlip_lenderId_idx" ON "BorrowSlip"("lenderId");

-- CreateIndex
CREATE INDEX "BorrowItem_fileId_status_idx" ON "BorrowItem"("fileId", "status");

-- CreateIndex
CREATE INDEX "BorrowSlipEvent_borrowSlipId_idx" ON "BorrowSlipEvent"("borrowSlipId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

