import {prisma} from "../../index.js";

async function updateCollectibleStats(collectibleId, uniqueHolders, totalBurns) {
    await prisma.veve_collectibles.update({
        where: { collectible_id: collectibleId },
        data: { unique_holders: uniqueHolders, total_burned: totalBurns },
    });
}

async function getCollectibleStats(collectibleId) {
    const uniqueHoldersResult = await prisma.veve_tokens.groupBy({
        by: ["wallet_id"],
        where: {
            collectible_id: collectibleId,
            wallet_id: { not: null }, // Assuming wallet_id is not null for valid tokens
        },
        _count: { wallet_id: true },
    });
    const uniqueHolders = uniqueHoldersResult.length; // Length of the result gives the count of unique holders

    const totalBurns = await prisma.veve_tokens.count({
        where: { collectible_id: collectibleId, is_burned: true },
    });

    return { uniqueHolders, totalBurns };
}

async function updateUniqueHoldersVeveCollectibles() {
    let count = 0;
    const allCollectibleIds = await prisma.veve_collectibles.findMany({
        select: { collectible_id: true },
    });

    for (const { collectible_id } of allCollectibleIds) {
        const { uniqueHolders, totalBurns } = await getCollectibleStats(
            collectible_id
        );
        await updateCollectibleStats(collectible_id, uniqueHolders, totalBurns);
        console.log(
            `Updated collectible ${collectible_id} with ${uniqueHolders} unique holders and ${totalBurns} total burns. Count: ${count}/${allCollectibleIds.length}`
        );
        count += 1;
    }
    console.log("Completed updating veve_collectibles.");
}

export const VEVE_UNIQUE_OWNERS_COLLECTIBLES = async () => {
    try {
        await updateUniqueHoldersVeveCollectibles();
        // Call resetVeveComics() similarly if implemented
    } catch (error) {
        console.error("Error updating collectible stats:", error);
    } finally {
        await prisma.$disconnect();
    }
}
