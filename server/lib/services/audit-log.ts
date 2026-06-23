import { db } from '@/lib/db'
import { AuditAction } from '@/generated/prisma/enums'

interface CreateAuditLogParams {
    action: AuditAction
    target: string
    targetId?: string
    detail?: unknown
    userId?: string
    ipAddress?: string
    macAddress?: string
}

export const createAuditLog = async ({
    action,
    target,
    targetId,
    detail,
    userId,
    ipAddress = 'unknown',
    macAddress,
}: CreateAuditLogParams) => {
    try {
        await db.auditLog.create({
            data: {
                action,
                target,
                targetId,
                detail: detail ? JSON.stringify(detail) : undefined,
                ipAddress,
                macAddress,
                userId,
            },
        })
    } catch (error) {
        console.error('Failed to create audit log:', error)
        // Don't throw error to avoid blocking main action
    }
}
