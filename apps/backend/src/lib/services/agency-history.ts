import { db } from '@/lib/db'

export const getAgencyForYear = async (year: number) => {
    // 1976 - 1996: Sông Bé
    // 1997 - Present: Bình Dương
    // We search based on the year falling within the range.
    const date = new Date(`${year}-01-01`);
    const agency = await db.agencyHistory.findFirst({
        where: {
            startDate: { lte: date },
            OR: [
                { endDate: { gte: date } },
                { endDate: null },
            ],
        },
    });

    return agency;
};

export const getAgencyNameForDate = async (date: Date): Promise<string> => {
    const agency = await db.agencyHistory.findFirst({
        where: {
            startDate: { lte: date },
            OR: [
                { endDate: { gte: date } },
                { endDate: null },
            ],
        },
    })

    return agency?.name || 'Tòa án Nhân dân'
}
