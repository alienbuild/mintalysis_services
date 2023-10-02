export const UPDATE_USER_STATUS = async (prisma) => {
    console.log('[UPDATING USER STATUSES]')
    const now = new Date();

    // Set users to OFFLINE if they have been inactive for more than 30 minutes
    await prisma.User.updateMany({
        where: {
            last_seen: {
                lt: new Date(now - 30 * 60 * 1000) // 30 minutes ago
            },
        },
        data: {status: 'OFFLINE'},
    });

    // Set users to IDLE if they have been inactive for more than 15 minutes
    await prisma.User.updateMany({
        where: {
            last_seen: {
                lt: new Date(now - 15 * 60 * 1000), // 15 minutes ago
                gte: new Date(now - 30 * 60 * 1000) // but less than 30 minutes ago
            },
        },
        data: {status: 'IDLE'},
    });
    console.log('[SUCCESS UPDATED USER STATUSES]')
}

UPDATE_USER_STATUS()