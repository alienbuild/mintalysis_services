import {prisma} from "../../index.js";

async function updateComicStats(comicId, uniqueHolders, totalBurns) {
    await prisma.veve_comics.update({
        where: { unique_cover_id: comicId },
        data: { unique_holders: uniqueHolders, total_burned: totalBurns },
    });
}

async function getComicStats(comicId) {
    // Using `groupBy` for unique holders count
    const uniqueHoldersResult = await prisma.veve_tokens.groupBy({
        by: ["wallet_id"],
        where: {
            unique_cover_id: comicId,
            wallet_id: { not: null }, // Assuming wallet_id is not null for valid tokens
        },
        _count: { wallet_id: true },
    });
    const uniqueHolders = uniqueHoldersResult.length; // Length of the result gives the count of unique holders

    const totalBurns = await prisma.veve_tokens.count({
        where: { unique_cover_id: comicId, is_burned: true },
    });

    return { uniqueHolders, totalBurns };
}

async function updateUniqueHoldersVeveComics() {
    let count = 0;
    const allComicIds = await prisma.veve_comics.findMany({
        select: { unique_cover_id: true },
    });

    for (const { unique_cover_id } of allComicIds) {
        const { uniqueHolders, totalBurns } = await getComicStats(
            unique_cover_id
        );
        await updateComicStats(unique_cover_id, uniqueHolders, totalBurns);
        console.log(
            `Updated Comic ${unique_cover_id} with ${uniqueHolders} unique holders and ${totalBurns} total burns. Count: ${count}/${allComicIds.length}`
        );
        count += 1;
    }
    console.log("Completed updating veve_comics.");
}

export const VEVE_UNIQUE_OWNERS_COMICS = async () => {
    try {
        await updateUniqueHoldersVeveComics();
    } catch (error) {
        console.error("Error updating Comic stats:", error);
    } finally {
        await prisma.$disconnect();
    }
}
