import {prisma} from "../../index.js";
import mysql from 'mysql'

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mintalysis_local',
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
});

import fs from 'fs'
const progressFilePath = './progress.json';
const batchSize = 1; // Adjust the batch size as needed

async function main() {
    try {
        console.log('Script started.');

        loadProgress();

        const totalPages = Math.ceil(650000 / pageSize);
        console.log('Total pages to process:', totalPages);

        const batchPromises = [];

        for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
            batchPromises.push(processWalletsInBatch(currentPage, totalPages));
        }

        await Promise.all(batchPromises);

        console.log('Valuations calculation completed successfully.');
    } catch (error) {
        console.error('Error calculating valuations:', error);
    }
}

async function processWalletsInBatch(startPage, totalPages) {
    const endPage = Math.min(startPage + batchSize - 1, totalPages);

    const walletPromises = [];

    for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
        walletPromises.push(processWalletsOnPage(currentPage));
    }

    await Promise.all(walletPromises);
}

async function updateWalletValuation(walletId, valuation) {
    const totalValuation = calculateTotalValuation(valuation);

    await prisma.veve_wallets_valuations.upsert({
        where: { wallet_id: walletId },
        update: { total_valuation: totalValuation },
        create: {
            wallet_id: walletId,
            total_valuation: totalValuation
        }
    });
}

function calculateTotalValuation(valuationData) {
    return valuationData.reduce((sum, val) => sum + val, 0);
}

async function processWalletsOnPage(currentPage) {
    const wallets = await getWalletsWithTokens(currentPage, pageSize);

    await Promise.all(wallets.map(async (wallet) => {
        const currentWalletId = wallet.id;
        let totalValuation = 0;

        const totalTokens = await countTokensInWallet(wallet.id);
        console.log('totalTokens', totalTokens)

        const totalTokenPages = Math.ceil(totalTokens / tokenPageSize);

        const tokenPromises = [];

        for (let currentTokenPage = 1; currentTokenPage <= totalTokenPages; currentTokenPage++) {
            tokenPromises.push(processTokensInBatch(wallet.id, currentTokenPage, totalValuation));
        }

        const tokenResults = await Promise.all(tokenPromises);

        // Sum up token results to get the total valuation
        totalValuation = calculateTotalValuation(tokenResults);

        await updateWalletValuation(wallet.id, totalValuation);
        console.log(`Processed wallet ID ${wallet.id}, Total Valuation: ${totalValuation}`);

        saveProgress(currentPage, currentTokenPage, currentWalletId);
    }));
}

async function processTokensInBatch(walletId, currentTokenPage, totalValuation) {
    const tokens = await getTokensInWallet(walletId, currentTokenPage, tokenPageSize);

    const tokenPromises = tokens.map(async (token) => {
        let priceData;
        if (token.collectible_id) {
            priceData = await getFloorPriceFromCollectibles(token.collectible_id);
        } else {
            priceData = await getFloorValueFromComics(token.unique_cover_id);
        }
        return priceData.floor_price || priceData.floor_value;
    });

    const tokenResults = await Promise.all(tokenPromises);

    totalValuation += calculateTotalValuation(tokenResults);

    return totalValuation;
}

async function getFloorPriceFromCollectibles(collectibleId) {
    try {
        const query = `SELECT floor_price FROM veve_collectibles WHERE collectible_id = ${collectibleId}`;
        const [row] = await connection.query(query, [collectibleId]);

        if (row && row.length > 0) {
            const { floor_price } = row[0];
            return floor_price;
        } else {
            console.error(`Collectible with ID ${collectibleId} not found in the database.`);
            return 0; // Return a default value if collectible not found
        }
    } catch (error) {
        console.error(`Error fetching floor price for collectible ${collectibleId}:`, error);
        return 0; // Handle errors gracefully, return 0 or an appropriate value
    }
}

async function getFloorValueFromComics(uniqueCoverId) {
    try {
        // Query your local MySQL database to fetch the floor_value for the comic
        const query = `SELECT floor_price FROM veve_comics WHERE unique_cover_id = ${uniqueCoverId}`;
        const [row] = await connection.query(query, [uniqueCoverId]);

        if (row && row.length > 0) {
            const { floor_value } = row[0];
            return floor_value;
        } else {
            console.error(`Comic with ID ${uniqueCoverId} not found in the database.`);
            return 0; // Return a default value if comic not found
        }
    } catch (error) {
        console.error(`Error fetching floor value for comic ${uniqueCoverId}:`, error);
        return 0; // Handle errors gracefully, return 0 or an appropriate value
    }
}

async function getTokensInWallet(walletId) {
    return await prisma.veve_tokens.findMany({
        where: { wallet_id: walletId },
        select: { token_id: true, collectible_id: true, unique_cover_id: true }
    });
}

async function getWalletsWithTokens(page, pageSize) {
    const skip = (page - 1) * pageSize;

    const excludedWalletIds = [
        '0x7be178ba43a9828c22997a3ec3640497d88d2fd3',
        '0x39e3816a8c549ec22cd1a34a8cf7034b3941d8b1',
        '0x1400d3c5918187e0f1ac663c17c48acf0c6b12fc',
        '0x10bd9050a25cf5d52732d917f8f1403338733c7c', // TOP 5
        '0xad36f165e95d50793b4f1b7fc2c2ddf996b60b9d',
        '0x2adfd5349732ca939b695b3fa44709502076c1db',
        '0x5c79904bce71ddc6705df696e555d37dbf8e070c',
        '0x82a3c4d6a9149e5f91b1900dcce3459e7eb6503b',
    ];

    return await prisma.veve_wallets.findMany({
        where: {
            NOT: {
                id: {
                    in: excludedWalletIds,
                },
            },
            veve_tokens: {
                some: {},
            },
        },
        select: {
            id: true,
        },
        skip: skip,
        take: pageSize,
    });
}

async function countTokensInWallet(walletId) {
    return await prisma.veve_tokens.count({
        where: { wallet_id: walletId }
    });
}

function loadProgress() {
    try {
        // Read the progress file
        const data = fs.readFileSync(progressFilePath, 'utf8');
        const progress = JSON.parse(data);

        // Update current page, token page, and wallet ID
        currentPage = progress.currentPage || 1;
        currentTokenPage = progress.currentTokenPage || 1;
        currentWalletId = progress.currentWalletId || null;

        console.log('Progress loaded: Current Page:', currentPage, 'Current Token Page:', currentTokenPage, 'Current Wallet ID:', currentWalletId);
    } catch (error) {
        // Handle the error if the progress file doesn't exist or is corrupted
        console.error('Error loading progress:', error);
    }
}

// Save progress
function saveProgress(page, tokenPage, walletId) {
    const progress = {
        currentPage: page,
        currentTokenPage: tokenPage,
        currentWalletId: walletId
    };

    // Write the progress object to the progress file
    fs.writeFileSync(progressFilePath, JSON.stringify(progress, null, 4), 'utf8');

    console.log('Progress saved: Current Page:', page, 'Current Token Page:', tokenPage, 'Current Wallet ID:', walletId);
}

// Initialize total pages and progress
loadProgress();

const pageSize = 10;
const tokenPageSize = 10;
let currentPage = 1;
let currentTokenPage = 1;
let currentWalletId = null;

main();

// import CollectiblePrice from "../../models/CollectiblePrices.js"
// import ComicPrice from "../../models/CollectiblePrices.js"
// import mongoose from "mongoose";
//
// const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
//
// const prisma = new PrismaClient();
//
// const batchSize = 500;
//
// let lastCollectibleData = { valuation: 0, count: 0 };
// let lastComicData = { valuation: 0, count: 0 };
//
// function readLastProgress() {
//     if (fs.existsSync(progressFilePath)) {
//         const progressData = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
//         if (progressData.walletId && progressData.day) {
//             return progressData;
//         }
//     }
//     return null;
// }
//
// function saveProgress(walletId, day) {
//     const progressData = { walletId, day: day.format('YYYY-MM-DD') };
//     fs.writeFileSync(progressFilePath, JSON.stringify(progressData), 'utf8');
// }
//
// const excludedWalletIds = ['0x7be178ba43a9828c22997a3ec3640497d88d2fd3', '0x39e3816a8c549ec22cd1a34a8cf7034b3941d8b1', '0x1400d3c5918187e0f1ac663c17c48acf0c6b12fc'];
//
// export const VEVE_WALLET_VALUATIONS = async () => {
//
//     console.log('[ALICE] Running...')
//
//     const twentyFourMonthsAgo = moment().subtract(1, 'months').startOf('day');
//
//     let lastProcessedWalletIndex = 0;
//
//     let startFromDate = twentyFourMonthsAgo;
//     const lastProgress = readLastProgress();
//
//     if (lastProgress) {
//         const lastProcessedWallet = await prisma.veve_wallets.findUnique({
//             where: { id: lastProgress.walletId }
//         });
//
//         if (lastProcessedWallet) {
//             const allWalletsUpToLastProgress = await prisma.veve_wallets.findMany({
//                 where: {
//                     first_activity_date: {
//                         lte: lastProcessedWallet.first_activity_date
//                     }
//                 },
//                 orderBy: {
//                     first_activity_date: 'asc'
//                 }
//             });
//             lastProcessedWalletIndex = allWalletsUpToLastProgress.length - 1;
//         }
//     }
//
//     while (true) {
//         const walletsBatch = await prisma.veve_wallets.findMany({
//             skip: lastProcessedWalletIndex,
//             take: batchSize,
//             where: {
//                 last_activity_date: {
//                     gte: startFromDate
//                 }
//             },
//         });
//         console.log(`Found ${walletsBatch.length} wallets to process.`);
//
//         if (walletsBatch.length === 0) break;
//
//         for (const wallet of walletsBatch) {
//             console.log(`Starting wallet valuation for ${wallet.id}`);
//
//             lastCollectibleData = { valuation: 0, count: 0 };
//             lastComicData = { valuation: 0, count: 0 };
//
//             for (let day = moment(startFromDate); day.isBefore(moment()); day.add(1, 'days')) {
//
//                 let totalValuation = 0;
//                 let totalCollectiblesCount = 0;
//                 let totalComicsCount = 0;
//                 let collectiblesValuation = 0;
//                 let comicsValuation = 0;
//
//                 const ownedTokens = await prisma.$queryRaw`
//                     SELECT DISTINCT veve_tokens.token_id, veve_tokens.collectible_id, veve_tokens.unique_cover_id
//                     FROM veve_tokens
//                              INNER JOIN (
//                         SELECT token_id
//                         FROM veve_mints
//                         WHERE wallet_id = ${wallet.id} AND timestamp_dt <= ${day.toDate()}
//                         UNION
//                         SELECT token_id
//                         FROM veve_transfers
//                         WHERE to_wallet = ${wallet.id} AND timestamp_dt <= ${day.toDate()}
//                           AND token_id NOT IN (
//                             SELECT DISTINCT token_id FROM veve_transfers WHERE from_wallet = ${wallet.id} AND timestamp_dt <= ${day.toDate()}
//                         )
//                     ) AS owned_tokens ON veve_tokens.token_id = owned_tokens.token_id
//                 `;
//
//                 console.log(`Calculating valuations for wallet ${wallet.id} on ${day.format('YYYY-MM-DD')}...`);
//
//                 for (const token of ownedTokens) {
//                     if (token.collectible_id) {
//                         const comicData = await calculateCollectibleValuation(token.collectible_id, day);
//                         totalValuation += comicData.valuation;
//                         collectiblesValuation += comicData.valuation;
//                         totalCollectiblesCount++;
//                     } else if (token.unique_cover_id) {
//                         const comicData = await calculateComicValuation(token.unique_cover_id, day);
//                         totalValuation += comicData.valuation;
//                         comicsValuation += comicData.valuation;
//                         totalComicsCount++;
//                     }
//                 }
//
//                 await prisma.veve_wallets_valuations.upsert({
//                     where: {
//                         wallet_id_timestamp: {
//                             wallet_id: wallet.id,
//                             timestamp: day.toDate()
//                         }
//                     },
//                     update: {
//                         total_valuation: totalValuation,
//                         collectibles_valuation: collectiblesValuation,
//                         comics_valuation: comicsValuation,
//                         total_collectibles: totalCollectiblesCount,
//                         total_comics: totalComicsCount,
//                         total_count: totalCollectiblesCount + totalComicsCount
//                     },
//                     create: {
//                         wallet_id: wallet.id,
//                         timestamp: day.toDate(),
//                         total_valuation: totalValuation,
//                         total_collectibles: totalCollectiblesCount,
//                         total_comics: totalComicsCount,
//                         collectibles_valuation: collectiblesValuation,
//                         comics_valuation: comicsValuation,
//                         total_count: totalCollectiblesCount + totalComicsCount
//                     },
//                 });
//
//                 saveProgress(wallet.id, day)
//                 console.log(`Completed calculations for wallet ${wallet.id} on ${day.format('YYYY-MM-DD')}. Total ${totalValuation}. Collectibles ${collectiblesValuation}. Collectible Count: ${totalCollectiblesCount}. Comics: ${comicsValuation}. Comic Count: ${totalComicsCount}`);
//                 await delay(100)
//             }
//
//             saveProgress(wallet.id);
//         }
//
//         lastProcessedWalletIndex += walletsBatch.length;
//
//     }
//
//     console.log('All wallet valuations calculations are complete.');
// }
//
// async function getLastKnownPrice(model, queryField, queryValue, beforeDate) {
//     return await model
//         .findOne({ [queryField]: queryValue, date: { $lt: beforeDate } })
//         .sort({ date: -1 })
//         .limit(1);
// }
//
// async function calculateCollectibleValuation(collectibleId, day) {
//     const startOfDay = day.startOf('day').toDate();
//     const endOfDay = day.endOf('day').toDate();
//
//     console.log(startOfDay instanceof Date); // Should log true
//     console.log(endOfDay instanceof Date); // Should log true
//
//     let result = await CollectiblePrice.aggregate([
//         { $match: { collectibleId: collectibleId, date: { $gte: startOfDay, $lte: endOfDay } } },
//         { $group: { _id: null, totalValuation: { $sum: '$value' }, count: { $sum: 1 } } }
//     ]);
//
//     // If no result for the day, find the last known price
//     if (result.length === 0) {
//         const lastPrice = await getLastKnownPrice(CollectiblePrice, 'collectibleId', collectibleId, startOfDay);
//         console.log('no results so last price is: ' ,lastPrice)
//         if (lastPrice) return { valuation: lastPrice.value, count: 1 };
//         return lastCollectibleData;
//     }
//
//     lastCollectibleData = { valuation: result[0].totalValuation, count: result[0].count };
//     return lastCollectibleData;
// }
//
// async function calculateComicValuation(walletId, day) {
//     const startOfDay = day.startOf('day').toDate();
//     const endOfDay = day.endOf('day').toDate();
//
//     try {
//         const result = await ComicPrice.aggregate([
//             { $match: { uniqueCoverId: walletId, date: { $gte: startOfDay, $lte: endOfDay } } },
//             { $group: { _id: null, totalValuation: { $sum: '$value' }, count: { $sum: 1 } } }
//         ]);
//
//         if (result.length === 0) {
//             const lastPrice = await getLastKnownPrice(ComicPrice, 'uniqueCoverId', walletId, startOfDay);
//             if (lastPrice) return { valuation: lastPrice.value, count: 1 };
//         } else {
//             lastComicData = { valuation: result[0].totalValuation, count: result[0].count };
//             return lastComicData;
//         }
//     } catch (e) {
//         console.log('Error: ', e)
//     }
//
// }
//
// VEVE_WALLET_VALUATIONS()
//     .then(() => console.log('Temporary table populated.'))
//     .catch(err => console.error('Something went wrong:', err));
