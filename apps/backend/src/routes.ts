import { Elysia } from 'elysia'

import { adminRoutes } from '@/api-routes/admin.routes'
import { auditRoutes } from '@/api-routes/audit.routes'
import { authRoutes } from '@/api-routes/auth.routes'
import { borrowRoutes } from '@/api-routes/borrow.routes'
import { documentRoutes } from '@/api-routes/documents.routes'
import { fileRoutes } from '@/api-routes/files.routes'
import { reportRoutes } from '@/api-routes/reports.routes'
import { systemRoutes } from '@/api-routes/system.routes'
import { uploadRoutes } from '@/api-routes/upload.routes'
import { userRoutes } from '@/api-routes/users.routes'

export const apiRoutes = new Elysia()
  .use(authRoutes)
  .use(userRoutes)
  .use(fileRoutes)
  .use(documentRoutes)
  .use(adminRoutes)
  .use(borrowRoutes)
  .use(auditRoutes)
  .use(reportRoutes)
  .use(systemRoutes)
  .use(uploadRoutes)
