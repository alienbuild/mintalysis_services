import { PrismaClient } from "@prisma/client"
import fetch from 'node-fetch'
import moment from 'moment'
import {setTimeout} from "node:timers/promises";
import {getImxTransactions} from "../../queries/getImxTransactions";

const prisma = new PrismaClient()

const VEVE = "de2180a8-4e26-402a-aed1-a09a51e6e33d";

const fetchIMXTransactions = async (nextToken) => {
    try {
        const response = await fetch('https://3vkyshzozjep5ciwsh2fvgdxwy.appsync-api.us-west-2.amazonaws.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                "x-api-key": process.env.IMX_API
            },
            body: JSON.stringify({
                query: getImxTransactions(),
                variables: { address: "0xa7aefead2f25972d80516628417ac46b3f2604af", pageSize: 1000, nextToken }
            })
        });

        if (!response.ok) throw new Error(`Unable to fetch IMX transactions. Status: ${response.status}`);
        const { data: { listTransactionsV2 } } = await response.json();
        return listTransactionsV2;
    } catch (e) {
        console.error('[ERROR] Fetch IMX transactions failed:', e);
        throw e;
    }
};

const processMintTransaction = (transaction, imxMintsArr, imxWalletsArr) => {
    imxMintsArr.push({
        id: transaction.txn_id,
        wallet_id: transaction.transfers[0].to_address,
        timestamp: moment.unix(Number(transaction.txn_time) / 1000).utc().format(),
        token_id: Number(transaction.transfers[0].token.token_id)
    });

    imxWalletsArr.push({
        id: transaction.transfers[0].to_address,
        first_activity_date: moment.unix(Number(transaction.txn_time) / 1000).utc().format(),
        last_activity_date: moment.unix(Number(transaction.txn_time) / 1000).utc().format(),
        active: true
    });
};

const processTransferTransaction = (transaction, imxTransArr, imxWalletsArr) => {
    imxTransArr.push({
        id: transaction.txn_id,
        from_wallet: transaction.transfers[0].from_address,
        to_wallet: transaction.transfers[0].to_address,
        timestamp: moment.unix(Number(transaction.txn_time) / 1000).utc().format(),
        token_id: Number(transaction.transfers[0].token.token_id)
    });

    imxWalletsArr.push({
        id: transaction.transfers[0].from_address,
        last_activity_date: moment.unix(Number(transaction.txn_time) / 1000).utc().format(),
        active: true,
        KYC: true
    });

    imxWalletsArr.push({
        id: transaction.transfers[0].to_address,
        first_activity_date: moment.unix(Number(transaction.txn_time) / 1000).utc().format(),
        last_activity_date: moment.unix(Number(transaction.txn_time) / 1000).utc().format(),
        active: true
    });
};

const extractUniqueId = (transaction, imxTokensArr) => {
    let unique_cover_id = null;
    let collectible_id = null;

    try {
        const reComic = /comic_cover\.([a-f\d-]+)\./;
        const reCollectible = /collectible_type_image\.([a-f\d-]+)\./;
        const image_url = transaction.transfers[0]?.token?.token_detail?.image_url || null;

        if (image_url && image_url.length > 0) {
            const comicMatch = image_url.match(reComic);
            const collectibleMatch = image_url.match(reCollectible);

            if (comicMatch) unique_cover_id = comicMatch[1];
            if (collectibleMatch) collectible_id = collectibleMatch[1];
        }
    } catch (e) {
        console.error('[ERROR] Unable to extract id from image_url for token:', e);
    }

    imxTokensArr.push({
        token_id: Number(transaction.transfers[0].token.token_id),
        wallet_id: transaction.transfers[0].to_address,
        txn_type: transaction.txn_type,
        mint_date: moment.unix(Number(transaction.txn_time) / 1000).utc().format(),
        unique_cover_id: unique_cover_id || null,
        collectible_id: collectible_id || null
    });
};

const processTransactions = (items) => {
    let imxMintsArr = [];
    let imxTransArr = [];
    let imxWalletsArr = [];
    let imxTokensArr = [];

    items.forEach(transaction => {
        if (transaction.txn_type === "mint") processMintTransaction(transaction, imxMintsArr, imxWalletsArr);
        else if (transaction.txn_type === "transfer") processTransferTransaction(transaction, imxTransArr, imxWalletsArr);
        extractUniqueId(transaction, imxTokensArr);
    });

    return [imxMintsArr, imxTransArr, imxWalletsArr, imxTokensArr];
};

const performUpserts = async (imxMintsArr, imxTransArr, imxWalletsArr, imxTokensArr) => {
    try {
        await prisma.veve_mints.createMany({ data: imxMintsArr, skipDuplicates: true });
        await prisma.veve_transfers.createMany({ data: imxTransArr, skipDuplicates: true });

        await Promise.all(imxWalletsArr.map(async wallet => {
            const existingWallet = await prisma.veve_wallets.findUnique({ where: { id: wallet.id } });
            await prisma.veve_wallets.upsert({
                where: { id: wallet.id },
                update: {
                    last_activity_date: existingWallet && existingWallet.last_activity_date > wallet.last_activity_date ? existingWallet.last_activity_date : wallet.last_activity_date,
                    first_activity_date: existingWallet ? existingWallet.first_activity_date : wallet.first_activity_date,
                    active: wallet.active,
                    KYC: existingWallet ? existingWallet.KYC || wallet.KYC : wallet.KYC
                },
                create: wallet
            });
        }));

        await Promise.all(imxTokensArr.map(async token => {
            const existingToken = await prisma.veve_tokens.findFirst({
                where: { token_id: token.token_id },
                orderBy: { mint_date: 'desc' }
            });
            await prisma.veve_tokens.upsert({
                where: { token_id: token.token_id },
                update: {
                    wallet_id: token.wallet_id,
                    mint_date: existingToken && token.txn_type === 'mint' ? token.mint_date : existingToken.mint_date,
                    unique_cover_id: token.unique_cover_id || existingToken.unique_cover_id,
                    collectible_id: token.collectible_id || existingToken.collectible_id
                },
                create: token
            });
        }));
    } catch (e) {
        console.error('[ERROR] Prisma Upsert Failed:', e);
    }
};

const updateStats = async (previousMintCount, previousTransferCount, previousWalletCount, previousTokenCount) => {
    try {
        const [currentMintCount, currentTransferCount, currentWalletCount, currentTokenCount] = await Promise.all([
            prisma.veve_mints.count(),
            prisma.veve_transfers.count(),
            prisma.veve_wallets.count(),
            prisma.veve_tokens.count()
        ]);

        const newMints = currentMintCount - previousMintCount;
        const newTransfers = currentTransferCount - previousTransferCount;
        const newWallets = currentWalletCount - previousWalletCount;
        const newTokens = currentTokenCount - previousTokenCount;

        await prisma.imx_stats.update({
            where: { project_id: VEVE },
            data: {
                token_count: currentTokenCount,
                transaction_count: currentTransferCount,
                wallet_count: currentWalletCount,
                new_mints: newMints,
            }
        });

        // Log the new statistics
        console.log(`[INFO] ${newMints} new mints, ${newTransfers} new transfers, ${newWallets} new wallets, ${newTokens} new tokens`);
    } catch (e) {
        console.error('[ERROR] Update Stats Failed:', e);
    }
};

const processIMXTransactions = async (transactions) => {
    try {
        const previousMintCount = await prisma.veve_mints.count();
        const previousTransferCount = await prisma.veve_transfers.count();
        const previousWalletCount = await prisma.veve_wallets.count();
        const previousTokenCount = await prisma.veve_tokens.count();

        const [imxMintsArr, imxTransArr, imxWalletsArr, imxTokensArr] = processTransactions(transactions.items);
        await performUpserts(imxMintsArr, imxTransArr, imxWalletsArr, imxTokensArr);
        await updateStats(previousMintCount, previousTransferCount, previousWalletCount, previousTokenCount);
    } catch (e) {
        console.error('[ERROR] Process Transactions Failed:', e);
    }
};

export const VEVE_IMX_TRANSACTIONS = async () => {
    try {
        let nextToken = null;
        do {
            const imxTransactions = await fetchIMXTransactions(nextToken);
            nextToken = imxTransactions.nextToken;
            await processIMXTransactions(imxTransactions);
        } while (nextToken);
    } catch (e) {
        console.error('[ERROR] VEVE_IMX_TRANSACTIONS Failed:', e);
    }
};

// let metadata

// try {
//     const checkMetaData = await fetch(`https://api.x.immutable.com/v1/assets/0xa7aefead2f25972d80516628417ac46b3f2604af/${transaction.transfers[0].token.token_id}`)
//     metadata = await checkMetaData.json()
// } catch (e) {
// }

// if (metadata && metadata.name){
//     updateObj.mint_date = metadata.created_at
//     if (metadata && metadata.metadata.editionType){
//         let collectibleId = metadata.image_url.split('.')
//         updateObj.edition = metadata.metadata.edition
//         updateObj.rarity = metadata.metadata.rarity
//         updateObj.collectible_id = collectibleId[3]
//         updateObj.type = 'collectible'
//     } else {
//         try {
//             const uniqueCoverId = await prisma.veve_comics.findFirst({
//                 where: {
//                     image_full_resolution_url: metadata.image_url
//                 },
//                 select: {
//                     unique_cover_id: true
//                 }
//             })
//             if (uniqueCoverId){
//                 updateObj.unique_cover_id = uniqueCoverId.unique_cover_id
//                 updateObj.edition = metadata.metadata.edition
//                 updateObj.rarity = metadata.metadata.rarity
//                 updateObj.type = 'comic'
//             }
//         } catch (e) {
//             console.log('[ERROR] could not look up comic ', e)
//         }
//     }
// }

//     } catch (e){
//         console.log('[ERROR] VEVE_IMX_TRANSACTIONS: ', e)
//     }

// }

VEVE_IMX_TRANSACTIONS();