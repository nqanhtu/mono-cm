import { db } from '@/lib/db'

interface CreateEventParams {
    borrowSlipId: string
    eventType: string
    description?: string
    details?: unknown
    creatorId?: string
}

export async function createBorrowSlipEvent({ borrowSlipId, eventType, description, details, creatorId }: CreateEventParams) {
    try {
        await db.borrowSlipEvent.create({
            data: {
                borrowSlipId,
                eventType,
                description,
                details: details ? JSON.stringify(details) : undefined,
                creatorId
            }
        })
        return { success: true }
    } catch (error) {
        console.error('Create Event Error:', error)
        return { success: false }
    }
}
