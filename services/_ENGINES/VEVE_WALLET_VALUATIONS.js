import moment from 'moment'
import { Prisma, PrismaClient } from "@prisma/client"
import fs from 'fs'
const progressFilePath = './progress.json';

try {
    await mongoose.connect(process.env.MONGO_DB, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('[CONNECTED] MongoDB');
} catch (error) {
    console.log('[ERROR] MongoDB connection', error);
}


import CollectiblePrice from "../../models/CollectiblePrices.js"
import ComicPrice from "../../models/CollectiblePrices.js"
import mongoose from "mongoose";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const prisma = new PrismaClient();

const batchSize = 500;

let lastCollectibleData = { valuation: 0, count: 0 };
let lastComicData = { valuation: 0, count: 0 };

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

const excludedWalletIds = ['0x7be178ba43a9828c22997a3ec3640497d88d2fd3', '0x39e3816a8c549ec22cd1a34a8cf7034b3941d8b1', '0x1400d3c5918187e0f1ac663c17c48acf0c6b12fc'];

export const VEVE_WALLET_VALUATIONS = async () => {

    console.log('[ALICE] Running...')

    const twentyFourMonthsAgo = moment().subtract(1, 'months').startOf('day');

    let lastProcessedWalletIndex = 0;

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
            take: batchSize,
            where: {
                last_activity_date: {
                    gte: startFromDate
                }
            },
        });
        console.log(`Found ${walletsBatch.length} wallets to process.`);

        if (walletsBatch.length === 0) break;

        for (const wallet of walletsBatch) {
            console.log(`Starting wallet valuation for ${wallet.id}`);

            lastCollectibleData = { valuation: 0, count: 0 };
            lastComicData = { valuation: 0, count: 0 };

            for (let day = moment(startFromDate); day.isBefore(moment()); day.add(1, 'days')) {

                let totalValuation = 0;
                let totalCollectiblesCount = 0;
                let totalComicsCount = 0;
                let collectiblesValuation = 0;
                let comicsValuation = 0;

                console.log(`Fetching owned tokens for ${wallet.id}`)

                const ownedTokens = await prisma.$queryRaw`
                    SELECT DISTINCT veve_tokens.token_id, veve_tokens.collectible_id, veve_tokens.unique_cover_id
                    FROM veve_tokens
                             INNER JOIN (
                        SELECT token_id
                        FROM veve_mints
                        WHERE wallet_id = ${wallet.id} AND timestamp_dt <= ${day.toDate()}
                        UNION
                        SELECT token_id
                        FROM veve_transfers
                        WHERE to_wallet = ${wallet.id} AND timestamp_dt <= ${day.toDate()}
                          AND token_id NOT IN (
                            SELECT DISTINCT token_id FROM veve_transfers WHERE from_wallet = ${wallet.id} AND timestamp_dt <= ${day.toDate()}
                        )
                    ) AS owned_tokens ON veve_tokens.token_id = owned_tokens.token_id
                `;

                console.log('owned tokens is: ', ownedTokens)

                console.log(`Calculating valuations for wallet ${wallet.id} on ${day.format('YYYY-MM-DD')}...`);

                for (const token of ownedTokens) {
                    if (token.collectible_id) {
                        const comicData = await calculateCollectibleValuation(token.collectible_id, day);
                        totalValuation += comicData.valuation;
                        collectiblesValuation += comicData.valuation;
                        totalCollectiblesCount++;
                    } else if (token.unique_cover_id) {
                        const comicData = await calculateComicValuation(token.unique_cover_id, day);
                        totalValuation += comicData.valuation;
                        comicsValuation += comicData.valuation;
                        totalComicsCount++;
                    }
                }

                console.log(`Saving data for wallet ${wallet.id}`)

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
                console.log(`Completed calculations for wallet ${wallet.id} on ${day.format('YYYY-MM-DD')}. Total ${totalValuation}. Collectibles ${collectiblesValuation}. Collectible Count: ${totalCollectiblesCount}. Comics: ${comicsValuation}. Comic Count: ${totalComicsCount}`);
                await delay(100)
            }

            saveProgress(wallet.id);
        }

        lastProcessedWalletIndex += walletsBatch.length;

    }

    console.log('All wallet valuations calculations are complete.');
}

async function getLastKnownPrice(model, queryField, queryValue, beforeDate) {
    return await model
        .findOne({ [queryField]: queryValue, date: { $lt: beforeDate } })
        .sort({ date: -1 })
        .limit(1);
}

async function calculateCollectibleValuation(collectibleId, day) {
    const startOfDay = day.startOf('day').toDate();
    const endOfDay = day.endOf('day').toDate();

    console.log(startOfDay instanceof Date); // Should log true
    console.log(endOfDay instanceof Date); // Should log true

    let result = await CollectiblePrice.aggregate([
        { $match: { collectibleId: collectibleId, date: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, totalValuation: { $sum: '$value' }, count: { $sum: 1 } } }
    ]);

    console.log('collectible price result is: ', result)

    // If no result for the day, find the last known price
    if (result.length === 0) {
        const lastPrice = await getLastKnownPrice(CollectiblePrice, 'collectibleId', collectibleId, startOfDay);
        console.log('no results so last price is: ' ,lastPrice)
        if (lastPrice) return { valuation: lastPrice.value, count: 1 };
        return lastCollectibleData;
    }

    lastCollectibleData = { valuation: result[0].totalValuation, count: result[0].count };
    return lastCollectibleData;
}

async function calculateComicValuation(walletId, day) {
    const startOfDay = day.startOf('day').toDate();
    const endOfDay = day.endOf('day').toDate();

    try {
        const result = await ComicPrice.aggregate([
            { $match: { uniqueCoverId: walletId, date: { $gte: startOfDay, $lte: endOfDay } } },
            { $group: { _id: null, totalValuation: { $sum: '$value' }, count: { $sum: 1 } } }
        ]);

        if (result.length === 0) {
            const lastPrice = await getLastKnownPrice(ComicPrice, 'uniqueCoverId', walletId, startOfDay);
            if (lastPrice) return { valuation: lastPrice.value, count: 1 };
        } else {
            lastComicData = { valuation: result[0].totalValuation, count: result[0].count };
            return lastComicData;
        }
    } catch (e) {
        console.log('Error: ', e)
    }

}

VEVE_WALLET_VALUATIONS()
    .then(() => console.log('Temporary table populated.'))
    .catch(err => console.error('Something went wrong:', err));