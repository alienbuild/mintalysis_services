import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import moment from "moment";
import { time, timeStamp } from "node:console";
import { get } from "node:http";

const prisma = new PrismaClient();

const VEVE_PROJECT_ID = "de2180a8-4e26-402a-aed1-a09a51e6e33d";
const VEVE_TOKEN_ADDRESS = "0xa7aefead2f25972d80516628417ac46b3f2604af";
const BURN_WALLETS = ['0x39e3816a8c549ec22cd1a34a8cf7034b3941d8b1', '0x1400d3c5918187e0f1ac663c17c48acf0c6b12fc']
const BASE_URL = "https://api.x.immutable.com/v1/";
const PAGE_SIZE = "200";
const ORDER_BY = "created_at";
const DIRECTION = "asc";
const STATUS = "success";
let firstRun = true;
let mintsRemaining = null;
let transfersRemaining = null;

let lastMintTimestamp = null;
let lastTransferTimestamp = null;
let lastMintTxnId = null; 
let lastTransferTxnId = null;

const triggerTransferUpdate = async () => {
    const response = await fetch("http://localhost:8001/graphql", { // TODO: Put gql url into env and switch between dev/prod
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `mutation { triggerImxTransfer }` }),
    });

    const responseData = await response.json();
    console.log(responseData);
};

export const GET_VEVE_TRANSACTIONS = async () => {
    const last_mint_timestamp = await prisma.veve_mints.findFirst({
      select: { timestamp: true },
      orderBy: { timestamp: "desc" }
    });

    const formatted_mint_dt = formatDateString(last_mint_timestamp.timestamp)
    setVeveImxStatus('veve_mints', formatted_mint_dt)
    
    const last_transfer_timestamp = await prisma.veve_transfers.findFirst({
      select: { timestamp: true },
      orderBy: { timestamp: "desc" }
    });
    const formatted_transfer_dt = formatDateString(last_transfer_timestamp.timestamp)
    setVeveImxStatus('veve_transfers', formatted_transfer_dt)
  
    while (true) {
      try {
        console.log("\n#####################STARTING#####################");
        const timestampStart = new Date().toISOString();
  
        const veveMints = await fetchFromIMX("mints", "veve_mints");
        const veveTransfers = await fetchFromIMX("transfers", "veve_transfers");
  
        await processVeveTxns(veveMints, veveTransfers);
  
        const timestampEnd = new Date().toISOString();
  
        console.log(`\n[START] ${timestampStart}`);
        console.log(`[END] ${timestampEnd}`);
        console.log("[TOTAL TIME] ", moment(timestampEnd).diff(timestampStart, "seconds"), " seconds\n");

      } catch (e) {
        console.log(`[ERROR] VEVE_IMX_TRANSACTIONS error:`, e);
      } finally {
        console.log('Pausing 2 seconds');
        await sleep(2000);
      }
    }
  };
  
const fetchFromIMX = async (endpoint, tableName) => {
    let retryCount = 3;

    while (retryCount > 0) {
        try {
            const { last_timestamp, next_cursor } = await prisma.veve_imx_status.findFirst({
                select: { last_timestamp: true, next_cursor: true },
                where: { table_name: tableName },
            });

            let queryString = `status=${STATUS}&token_address=${VEVE_TOKEN_ADDRESS}&page_size=${PAGE_SIZE}&order_by=${ORDER_BY}&direction=${DIRECTION}`;

            if (firstRun === true) {
                queryString += `&min_timestamp=${last_timestamp}`;
                // since mints runs first, we can set firstRun to false after the first run of transfers
                if (tableName !== "veve_mints") {
                    firstRun = false;
                }
            } else if (mintsRemaining === 0 && tableName === "veve_mints") {
                queryString += `&min_timestamp=${last_timestamp}`;
            } else if (transfersRemaining === 0 && tableName === "veve_transfers") {
                queryString += `&min_timestamp=${last_timestamp}`;
            } else {
                queryString += `&cursor=${next_cursor}`;
            }

            const FULL_REQ_URL = `${BASE_URL}${endpoint}?${queryString}`;
            console.log(`[INFO] Requesting ${tableName} data using ${FULL_REQ_URL}`);

            const response = await fetch(FULL_REQ_URL, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    api_key: process.env.IMX_PUBLIC_API_KEY,
                },
            });
            
            if (response.status === 429) {
                console.error('Rate limit reached. Pausing for 60 seconds.');
                await new Promise(resolve => setTimeout(resolve, 60000)); // Pause for 60 seconds
                retryCount--;
                continue; // Skip the rest of the loop and retry the request
            }

            if (!response.ok) {
                retryCount = 3; // Reset the retry count
                const errorMsg = await response.text();
                throw new Error(
                    `Unable to fetch IMX ${tableName} transactions. Status: ${response.status}. Message: ${errorMsg}`
                );
            }

            const responseBody = await response.json();

            await prisma.veve_imx_status.update({
                data: { next_cursor: responseBody.cursor },
                where: { table_name: tableName }
            });

            //temp fix
            if (tableName === "veve_mints") {
                mintsRemaining = responseBody.remaining;
            } else if (tableName === "veve_transfers") {
                transfersRemaining = responseBody.remaining;
            }

            return responseBody;

        } catch (error) {
            if (error.message.includes('database connection')) {
                console.error('Database connection error. Pausing for 60 seconds.');
                await new Promise(resolve => setTimeout(resolve, 60000)); // Pause for 60 seconds
                retryCount--;
            } else {
                throw error; // Rethrow the error if it's not a database connection error
            }
        }
    }

    throw new Error('Max retry attempts reached.'); // Throw an error if max retry attempts are reached
};

const processVeveTxns = async (mints, transfers) => {
  try {
    // const previousMintCount = await prisma.veve_mints.count();
    // const previousTransferCount = await prisma.veve_transfers.count();
    // const previousWalletCount = await prisma.veve_wallets.count();
    // const previousTokenCount = await prisma.veve_tokens.count();
    const prevCounts = await prisma.imx_stats.findFirst({
      select: { mint_count: true, transfer_count: true, wallet_count: true, token_count: true },
    });

    const allTransactions = [...mints.result, ...transfers.result];

    const [imxMintsArr, imxTransArr, imxWalletsArr, imxTokensArr] = processTransactions(allTransactions);
    // const [imxMintsArr, imxTransArr, imxWalletsArr] = processTransactions(allTransactions);
    await performUpserts(imxMintsArr, imxTransArr, imxWalletsArr, imxTokensArr);
    // await performUpserts(imxMintsArr, imxTransArr, imxWalletsArr);
    await updateStats(
      prevCounts.mint_count,
      prevCounts.transfer_count,
      prevCounts.wallet_count,
      prevCounts.token_count
    );

  } catch (e) {
    console.error("[ERROR] Process Transactions Failed:", e);
  }
};

const processTransactions = (allTransactions) => {
  let imxMintsArr = [];
  let imxTransArr = [];
  let imxWalletsArr = [];
  let imxTokensArr = [];

  allTransactions.forEach((transaction) => {
    let timestamp = transaction.timestamp;
    let txn_id = transaction.transaction_id;
    let token_id = Number(transaction.token.data.token_id);

    // MINT
    if (!transaction.receiver) {
      let to_wallet = transaction.user;
      let isBurned = BURN_WALLETS.includes(transaction.user);
      
      imxMintsArr.push({
        id: txn_id,
        wallet_id: to_wallet,
        timestamp: timestamp,
        token_id: token_id,
        timestamp_dt: timestamp,
        to_process: true,
        is_burn: isBurned,
      });

      imxWalletsArr.push({
        id: to_wallet,
        timestamp: timestamp,
        active: true,
      });

      imxTokensArr.push({
        token_id: token_id,
        wallet_id: to_wallet,
        mint_date: timestamp,
        to_process: true,
        is_burned: isBurned,
      });

      if (txn_id > lastMintTxnId || lastMintTxnId == null) {
        lastMintTimestamp = formatDateString(timestamp);
        lastMintTxnId = txn_id;
        }

      // TRANSFER
    } else if (transaction.receiver) {
      let from_wallet = transaction.user;
      let to_wallet = transaction.receiver;
      const isBurned = BURN_WALLETS.includes(transaction.to_wallet);

      imxTransArr.push({
        id: txn_id,
        from_wallet: from_wallet,
        to_wallet: to_wallet,
        timestamp: timestamp,
        token_id: token_id,
        timestamp_dt: timestamp,
        to_process: true,
        is_burn: isBurned,
      });

      imxWalletsArr.push({
        id: from_wallet,
        timestamp: timestamp,
        active: true,
        has_kyc: true,
      });

      imxWalletsArr.push({
        id: to_wallet,
        timestamp: timestamp,
        active: true,
      });

      if (txn_id > lastTransferTxnId || lastTransferTxnId == null) {
        lastTransferTimestamp = formatDateString(timestamp);
        lastTransferTxnId = txn_id;
      }
    }
  });

  return [imxMintsArr, imxTransArr, imxWalletsArr, imxTokensArr];
};

const performUpserts = async (
  imxMintsArr,
  imxTransArr,
  imxWalletsArr,
  imxTokensArr
) => {

  try {
    console.log("\nUpdating veve_mints.");
    await prisma.veve_mints.createMany({
      data: imxMintsArr,
      skipDuplicates: true,
    });

    await setVeveImxStatus('veve_mints', lastMintTimestamp, lastMintTxnId);
    console.log("Updated veve_imx_status with Last Mint Timestamp: ", lastMintTimestamp, " and Last Mint Txn Id: ", lastMintTxnId);

    console.log("\nUpdating veve_transfers.");
    await prisma.veve_transfers.createMany({
      data: imxTransArr,
      skipDuplicates: true,
    });

    if (imxTransArr.length > 0) await triggerTransferUpdate()

    await setVeveImxStatus('veve_transfers', lastTransferTimestamp, lastTransferTxnId);
    console.log("Updated veve_imx_status with Last Transfer Timestamp: ", lastTransferTimestamp, " and Last Transfer Txn Id: ", lastTransferTxnId);

    const sortedWalletsArr = imxWalletsArr.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    console.log("\nUpdating veve_wallets.");

    // Wallets needs to update before veve_tokens
    for (const wallet of sortedWalletsArr) {
        const existingWallet = await prisma.veve_wallets.findUnique({
            where: { id: wallet.id },
        });

        await prisma.veve_wallets.upsert({
            where: { id: wallet.id }, //TODO??? Add to_process: true
            update: {
                last_activity_date: existingWallet && existingWallet.last_activity_date > wallet.timestamp
                    ? existingWallet.last_activity_date
                    : wallet.timestamp,
                first_activity_date: existingWallet
                    ? existingWallet.first_activity_date
                    : wallet.timestamp,
                active: wallet.active,
                has_kyc: existingWallet
                    ? existingWallet.has_kyc || wallet.has_kyc
                    : wallet.has_kyc,
            },
            create: {
                id: wallet.id,
                last_activity_date: wallet.timestamp,
                first_activity_date: wallet.timestamp,
                active: wallet.active,
                has_kyc: wallet.has_kyc !== undefined ? wallet.has_kyc : false, // Setting a default value if it doesn't exist
            },
        });
        if (!existingWallet) {
          console.log("\n[NEW WALLET] New veve_wallets added wallet id:", wallet.id, "with timestamp:", wallet.timestamp);
      }
    }

    console.log("\nUpdating veve_tokens.");
    await prisma.veve_tokens.createMany({
      data: imxTokensArr,
      skipDuplicates: true,
    });
    
  } catch (e) {
    console.error("[ERROR] Prisma Upsert Failed:", e);
  }
};

const updateStats = async (
  previousMintCount,
  previousTransferCount,
  previousWalletCount,
  previousTokenCount
) => {
  try {
    const currentCounts = await prisma.imx_stats.findFirst({
      select: { mint_count: true, transfer_count: true, wallet_count: true, token_count: true },
      where: { project_id: VEVE_PROJECT_ID },
    }); 

    const newMints = currentCounts.mint_count - previousMintCount;
    const newTransfers = currentCounts.transfer_count - previousTransferCount;
    const newWallets = currentCounts.wallet_count - previousWalletCount;
    const newTokens = currentCounts.token_count - previousTokenCount;



    // DONE BY TRIGGERS
    // await prisma.imx_stats.update({
    //   where: { project_id: VEVE_PROJECT_ID },
    //   data: {
    //     mint_count: currentMintCount,
    //     transfer_count: currentTransferCount,
    //     wallet_count: currentWalletCount,
    //     token_count: currentTokenCount,
    //     transaction_count: transactionCount,
    //   },
    // });

    // Log the new statistics
    console.log(`\n[COUNTS]\n${newMints} new mints\n${newTransfers} new transfers\n${newWallets} new wallets\n${newTokens} new tokens\n[COUNTS]`);

  } catch (e) {
    console.error("[ERROR] Update Stats Failed:", e);
  }
};

// async function getLastTimestamp(table_name) {
//     if (table_name == "veve_mints") {
//       const result = await prisma.veve_mints.findFirst({
//         select: {
//           timestamp: true,
//         },
//         orderBy: [
//             { timestamp: "desc" }
//         ]
//       });
  
//       return result ? result.timestamp : null;
//     } else if (table_name == "veve_transfers") {
//       const result = await prisma.veve_transfers.findFirst({
//         select: {
//           timestamp: true,
//         },
//         orderBy: [
//             { timestamp: "desc" }
//         ]
//       });
  
//       return result ? result.timestamp : null;
//     }

//   }

async function setVeveImxStatus(table_name, last_timestamp, last_txn_id) {
    await prisma.veve_imx_status.update({
      where: {
        table_name: table_name,
      },
      data: {
        last_txn_id,
        last_timestamp,
      },
    });
  }

function formatDateString(input) {
    const date = new Date(input);
    return date.toISOString().split('.')[0] + 'Z';
  }

//   function formatDateString(input) {
//     const dotIndex = input.indexOf('.');
//     if(dotIndex !== -1) {
//         return input.substring(0, dotIndex) + 'Z';
//     }
//     return input; // if the string does not contain fractional seconds, return it as-is
// }

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

GET_VEVE_TRANSACTIONS();
