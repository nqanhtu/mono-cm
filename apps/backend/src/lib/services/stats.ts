import { db } from '@/lib/db'

export async function getOverdueCount() {
    const today = new Date()
    const count = await db.borrowSlip.count({
        where: {
            status: 'BORROWING',
            dueDate: { lt: today }
        }
    })
    return count
}
