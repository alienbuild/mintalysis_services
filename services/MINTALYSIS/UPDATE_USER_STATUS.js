import fetch from 'node-fetch'

export const UPDATE_USER_STATUS = async (prisma) => {
    try {
        const now = new Date();

        // Fetch IDLE Users
        const idleUsers = await prisma.user.findMany({
            where: {
                last_seen: {
                    lt: new Date(now - 15 * 60 * 1000), // 15 minutes ago
                    gte: new Date(now - 30 * 60 * 1000) // but less than 30 minutes ago
                },
                status: 'ONLINE' // Only fetch users who are currently marked as ONLINE
            }
        });

        // Update IDLE Users' Status and Notify
        for (const user of idleUsers) {
            await prisma.user.update({
                where: { id: user.id },
                data: { status: 'IDLE' },
            });

            await sendStatusUpdate(user.id, 'IDLE');
        }

        // Fetch OFFLINE Users
        const offlineUsers = await prisma.user.findMany({
            where: {
                last_seen: {
                    lt: new Date(now - 30 * 60 * 1000) // 30 minutes ago
                },
                status: { in: ['IDLE', 'ONLINE'] } // Only fetch users who are currently marked as IDLE or ONLINE
            }
        });

        // Update OFFLINE Users' Status and Notify
        for (const user of offlineUsers) {
            await prisma.user.update({
                where: { id: user.id },
                data: { status: 'OFFLINE' },
            });

            await sendStatusUpdate(user.id, 'OFFLINE');
        }

        console.log('[SUCCESS UPDATED USER STATUSES]');
    } catch (error) {
        console.error('[UPDATE_USER_STATUS] FAILED TO UPDATE USER STATUSES: ', error);
    }
};

async function sendStatusUpdate(userId, newStatus) {
    try {
        const response = await fetch('http://localhost:8001/update-user-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, newStatus }),
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    } catch (error) {
        console.error('Failed to send status update:', error);
    }
}
