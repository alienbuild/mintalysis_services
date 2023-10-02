export const UPDATE_USER_STATUS = async (prisma) => {
    try {
        console.log('[UPDATE_USER_STATUS] Function Entered');

        const now = new Date();

        console.log('[UPDATE_USER_STATUS] About to update OFFLINE users');
        await prisma.User.updateMany({
            where: {
                last_seen: {
                    lt: new Date(now - 30 * 60 * 1000) // 30 minutes ago
                },
            },
            data: {status: 'OFFLINE'},
        });
        console.log('[UPDATE_USER_STATUS] OFFLINE users updated');

        console.log('[UPDATE_USER_STATUS] About to update IDLE users');
        await prisma.User.updateMany({
            where: {
                last_seen: {
                    lt: new Date(now - 15 * 60 * 1000), // 15 minutes ago
                    gte: new Date(now - 30 * 60 * 1000) // but less than 30 minutes ago
                },
            },
            data: {status: 'IDLE'},
        });
        console.log('[UPDATE_USER_STATUS] IDLE users updated');

        console.log('[SUCCESS UPDATED USER STATUSES]');
    } catch (error) {
        console.error('[UPDATE_USER_STATUS] FAILED TO UPDATE USER STATUSES: ', error);
    }
};
