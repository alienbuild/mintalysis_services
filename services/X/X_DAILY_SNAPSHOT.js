// Daily snapshots of the X accounts followers and following
export const X_DAILY_SNAPSHOT = async (prisma) => {
    const snapshots = await prisma.x_account.findMany({})
    snapshots.map(async snap => {
        await prisma.x_account_snapshot.create({
            data:{
                handle: snap.handle,
                followers: snap.followers,
                following: snap.following
            }
        })
    })
}