import moment from 'moment'
import { PrismaClient } from "@prisma/client"
import fs from 'fs'
const progressFilePath = './progress.json';
const progressFilePathTempTable = './populateTempProgress.json';

import CollectiblePrice from "../../models/CollectiblePrices.js"
import ComicPrice from "../../models/CollectiblePrices.js"

const prisma = new PrismaClient();

const batchSize = 1000;

let lastCollectibleData = { valuation: 0, count: 0 };
let lastComicData = { valuation: 0, count: 0 };

function readLastOffset() {
    if (fs.existsSync(progressFilePathTempTable)) {
        const progressData = JSON.parse(fs.readFileSync(progressFilePathTempTable, 'utf8'));
        return progressData.offset || 0;
    }
    return 0;
}

function saveOffset(offset) {
    const progressData = { offset };
    fs.writeFileSync(progressFilePathTempTable, JSON.stringify(progressData), 'utf8');
}

function readLastProgress() {
    if (fs.existsSync(progressFilePath)) {
        const progressData = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
        if (progressData.walletId && progressData.day) {
            return progressData;
        }
    }
    return null;
}

function saveProgress(walletId, day) {
    const progressData = { walletId, day: day.format('YYYY-MM-DD') };
    fs.writeFileSync(progressFilePath, JSON.stringify(progressData), 'utf8');
}

async function populateTempTable() {
    console.log("Starting to populate the temp_wallet_token_ownership table...");

    const chunkSize = 50000
    let offset = readLastOffset();
    let continueProcessing = true;

    while (continueProcessing) {
        const distinctTokenIds = await prisma.$queryRaw`
            SELECT DISTINCT token_id FROM veve_mints UNION SELECT DISTINCT token_id FROM veve_transfers
            LIMIT ${chunkSize} OFFSET ${offset}`;

        if (distinctTokenIds.length === 0) {
            continueProcessing = false;
            break;
        }

        const processingPromises = distinctTokenIds.map(async (tokenId) => {
            console.log(`Processing token: ${tokenId.token_id}`);
            const events = await prisma.$queryRaw`
            SELECT wallet_id, timestamp_dt FROM veve_mints WHERE token_id = ${tokenId.token_id}
            UNION
            SELECT to_wallet AS wallet_id, timestamp_dt FROM veve_transfers WHERE token_id = ${tokenId.token_id}
            ORDER BY timestamp_dt`;

            let previousWalletId = null;
            let previousDate = null;

            for (const event of events) {
                if (previousWalletId && previousDate) {
                    const daysBetween = moment(event.timestamp_dt).diff(moment(previousDate), 'days');

                    for (let i = 0; i < daysBetween; i++) {
                        const date = moment(previousDate).add(i, 'days').format('YYYY-MM-DD');
                        await prisma.temp_wallet_token_ownership.create({
                            data: {
                                wallet_id: previousWalletId,
                                token_id: tokenId.token_id,
                                date: new Date(date),
                                owned: true
                            }
                        });
                    }
                }

                previousWalletId = event.wallet_id;
                previousDate = event.timestamp_dt;
            }

            const daysUntilNow = moment().diff(moment(previousDate), 'days');
            for (let i = 0; i <= daysUntilNow; i++) {
                const date = moment(previousDate).add(i, 'days').format('YYYY-MM-DD');
                await prisma.temp_wallet_token_ownership.create({
                    data: {
                        wallet_id: previousWalletId,
                        token_id: tokenId.token_id,
                        date: new Date(date),
                        owned: true,
                    }
                });
            }

        })

        await Promise.all(processingPromises);
        offset += chunkSize;
        saveOffset(offset)
    }
    console.log("Finished populating the temp_wallet_token_ownership table.");
}

export const VEVE_WALLET_VALUATIONS = async () => {

    console.log('Populating temporary table...');
    await populateTempTable();
    console.log('Temporary table populated.');

    const twentyFourMonthsAgo = moment().subtract(24, 'months').startOf('day');

    let lastProcessedWalletIndex = 0;
    let lastProcessedDay;

    let startFromDate = twentyFourMonthsAgo;
    const lastProgress = readLastProgress();

    if (lastProgress) {
        const lastProcessedWallet = await prisma.veve_wallets.findUnique({
            where: { id: lastProgress.walletId }
        });

        if (lastProcessedWallet) {
            const allWalletsUpToLastProgress = await prisma.veve_wallets.findMany({
                where: {
                    first_activity_date: {
                        lte: lastProcessedWallet.first_activity_date
                    }
                },
                orderBy: {
                    first_activity_date: 'asc'
                }
            });
            lastProcessedWalletIndex = allWalletsUpToLastProgress.length - 1;
        }
    }

    while (true) {
        const walletsBatch = await prisma.veve_wallets.findMany({
            skip: lastProcessedWalletIndex,
            take: batchSize
        });
        console.log(`Found ${walletsBatch.length} wallets to process.`);

        if (walletsBatch.length === 0) break;

        for (const wallet of walletsBatch) {
            console.log(`Starting wallet valuation for ${wallet.id}`);

            lastCollectibleData = { valuation: 0, count: 0 };
            lastComicData = { valuation: 0, count: 0 };

            // const tokens = await prisma.veve_tokens.findMany({
            //     where: { wallet_id: wallet.id },
            //     select: {
            //         collectible_id: true,
            //         unique_cover_id: true,
            //     }
            // });

            for (let day = moment(startFromDate); day.isBefore(moment()); day.add(1, 'days')) {

                let totalValuation = 0;
                let totalCollectiblesCount = 0;
                let totalComicsCount = 0;
                let collectiblesValuation = 0;
                let comicsValuation = 0;

                const ownedTokens = await prisma.temp_wallet_token_ownership.findMany({
                    where: {
                        wallet_id: wallet.id,
                        date: day.toDate(),
                        owned: true
                    },
                    include: {
                        veve_token: {
                            select: {
                                collectible_id: true,
                                unique_cover_id: true
                            }
                        }
                    }
                });

                for (const tokenOwnership of ownedTokens) {
                    const token = tokenOwnership.veve_token;
                    if (token.collectible_id) {
                        const valuation = await calculateCollectibleValuation(token.collectible_id, day);
                        totalValuation += valuation;
                        collectiblesValuation += valuation;
                    } else if (token.unique_cover_id) {
                        const valuation = await calculateComicValuation(token.unique_cover_id, day);
                        totalValuation += valuation;
                        comicsValuation += valuation;
                    }
                }

                console.log(`Calculating valuations for wallet ${wallet.id} on ${day.format('YYYY-MM-DD')}...`);

                await prisma.veve_wallets_valuations.upsert({
                    where: {
                        wallet_id_timestamp: {
                            wallet_id: wallet.id,
                            timestamp: day.toDate()
                        }
                    },
                    update: {
                        total_valuation: totalValuation,
                        collectibles_valuation: collectiblesValuation,
                        comics_valuation: comicsValuation,
                        total_collectibles: totalCollectiblesCount,
                        total_comics: totalComicsCount,
                        total_count: totalCollectiblesCount + totalComicsCount
                    },
                    create: {
                        wallet_id: wallet.id,
                        timestamp: day.toDate(),
                        total_valuation: totalValuation,
                        total_collectibles: totalCollectiblesCount,
                        total_comics: totalComicsCount,
                        collectibles_valuation: collectiblesValuation,
                        comics_valuation: comicsValuation,
                        total_count: totalCollectiblesCount + totalComicsCount
                    },
                });

                saveProgress(wallet.id, day)
                console.log(`Completed calculations for wallet ${wallet.id} on ${day.format('YYYY-MM-DD')}. Total ${totalValuation}. Collectibles ${collectiblesValuation}. Comics: ${comicsValuation}`);

            }
            saveProgress(wallet.id);
        }

        lastProcessedWalletIndex += walletsBatch.length;

    }

    console.log('All wallet valuations calculations are complete.');
}

async function calculateCollectibleValuation(walletId, day) {
    const startOfDay = day.startOf('day').toDate();
    const endOfDay = day.endOf('day').toDate();

    const result = await CollectiblePrice.aggregate([
        { $match: { collectibleId: walletId, date: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, totalValuation: { $sum: '$value' }, count: { $sum: 1 } } }
    ]);

    if (result.length === 0) {
        return lastCollectibleData;
    } else {
        lastCollectibleData = { valuation: result[0].totalValuation, count: result[0].count };
        return lastCollectibleData;
    }
}

async function calculateComicValuation(walletId, day) {
    const startOfDay = day.startOf('day').toDate();
    const endOfDay = day.endOf('day').toDate();

    const result = await ComicPrice.aggregate([
        { $match: { uniqueCoverId: walletId, date: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, totalValuation: { $sum: '$value' }, count: { $sum: 1 } } }
    ]);

    if (result.length === 0) {
        return lastComicData;
    } else {
        lastComicData = { valuation: result[0].totalValuation, count: result[0].count };
        return lastComicData;
    }

}

VEVE_WALLET_VALUATIONS()
    .then(() => console.log('Valuation calculation complete.'))
    .catch(err => console.error('Error calculating valuations:', err));