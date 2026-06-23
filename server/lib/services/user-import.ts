import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { parseUsersExcel } from '@/lib/excel-parser'
import { createAuditLog } from '@/lib/services/audit-log'
import { isUserRole, UserRole } from '@/lib/rbac'
import type { ExtractedUser } from '@/lib/types/excel'
import type { ImportIssue } from '@/lib/validation/import'

export type UserImportPreview = {
  summary: {
    users: number
    errors: number
    warnings: number
  }
  users: Array<{
    username: string
    fullName: string
    role: string
    unit?: string
    status: boolean
    importStatus: 'ready' | 'error'
  }>
  issues: ImportIssue[]
}

function normalizeUsername(username: unknown): string {
  return String(username ?? '').trim()
}

function buildIssue(row: number, column: string, message: string, code?: string): ImportIssue {
  return { row, column, message, code, severity: 'error' }
}

export async function parseUserUpload(file: File): Promise<ExtractedUser[]> {
  const buffer = await file.arrayBuffer()
  return parseUsersExcel(buffer)
}

export async function previewUserImport(payload: ExtractedUser[]): Promise<UserImportPreview> {
  const issues: ImportIssue[] = []
  const usernames = payload.map((u) => normalizeUsername(u.username))
  const usernameCounts = new Map<string, number>()

  usernames.forEach((uname) => {
    if (!uname) return
    usernameCounts.set(uname.toLowerCase(), (usernameCounts.get(uname.toLowerCase()) ?? 0) + 1)
  })

  payload.forEach((user, index) => {
    const row = user.row
    const uname = normalizeUsername(user.username)

    if (!uname) {
      issues.push(buildIssue(row, 'Tên đăng nhập', 'Thiếu tên đăng nhập'))
    } else {
      if (/\s/.test(uname)) {
        issues.push(buildIssue(row, 'Tên đăng nhập', 'Tên đăng nhập không được chứa khoảng trắng', uname))
      }
      if ((usernameCounts.get(uname.toLowerCase()) ?? 0) > 1) {
        issues.push(buildIssue(row, 'Tên đăng nhập', 'Tên đăng nhập bị trùng trong file Excel', uname))
      }
    }

    if (!normalizeUsername(user.fullName)) {
      issues.push(buildIssue(row, 'Họ và tên', 'Thiếu họ và tên', uname))
    }

    if (user.role && !isUserRole(user.role)) {
      issues.push(
        buildIssue(
          row,
          'Vai trò',
          'Vai trò không hợp lệ (hợp lệ: SUPER_ADMIN, ADMIN, COORDINATOR, VIEWER, BASIC_VIEWER)',
          uname
        )
      )
    }
  })

  // Query database to check if usernames already exist
  const uniqueUsernames = Array.from(new Set(usernames.filter(Boolean)))
  const existingUsers = uniqueUsernames.length
    ? await db.user.findMany({
        where: {
          username: {
            in: uniqueUsernames,
            mode: 'insensitive', // Case-insensitive unique check
          },
        },
        select: { username: true },
      })
    : []

  const existingUsernamesSet = new Set(existingUsers.map((u) => u.username.toLowerCase()))

  payload.forEach((user) => {
    const uname = normalizeUsername(user.username)
    if (uname && existingUsernamesSet.has(uname.toLowerCase())) {
      issues.push(buildIssue(user.row, 'Tên đăng nhập', 'Tên đăng nhập đã tồn tại trong hệ thống', uname))
    }
  })

  const errorUsernames = new Set(issues.filter((issue) => issue.code).map((issue) => issue.code?.toLowerCase()))

  return {
    summary: {
      users: payload.length,
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
    },
    users: payload.map((user) => {
      const uname = normalizeUsername(user.username)
      return {
        username: uname,
        fullName: normalizeUsername(user.fullName),
        role: user.role || 'VIEWER',
        unit: user.unit,
        status: user.status !== false,
        importStatus: errorUsernames.has(uname.toLowerCase()) || !uname ? 'error' : 'ready',
      }
    }),
    issues,
  }
}

export async function commitUserImport(payload: ExtractedUser[], userId: string) {
  const preview = await previewUserImport(payload)

  if (preview.summary.errors > 0) {
    return {
      success: false as const,
      preview,
      stats: { success: 0, failure: preview.summary.errors },
    }
  }

  const stats = await db.$transaction(async (tx) => {
    let success = 0

    for (const userData of payload) {
      const uname = normalizeUsername(userData.username)
      // Option B default password: username@123
      const plainPassword = userData.password || `${uname}@123`
      const hashedPassword = await bcrypt.hash(plainPassword, 10)

      const createdUser = await tx.user.create({
        data: {
          username: uname,
          fullName: normalizeUsername(userData.fullName),
          password: hashedPassword,
          role: (userData.role as UserRole) || 'VIEWER',
          unit: userData.unit || null,
          status: userData.status !== false,
        },
      })

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          target: 'User',
          targetId: createdUser.id,
          userId,
          detail: JSON.stringify({ username: createdUser.username, source: 'Excel Import' }),
        },
      })

      success += 1
    }

    return { success, failure: 0 }
  }, {
    maxWait: 10000,
    timeout: 60000 // 60 seconds
  })

  await createAuditLog({
    action: 'UPLOAD',
    target: 'User',
    userId,
    detail: { source: 'Excel Import', stats },
  })

  return { success: true as const, preview, stats }
}
