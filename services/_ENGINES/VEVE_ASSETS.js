import { PrismaClient } from "@prisma/client";
// import { setTimeout } from "node:timers/promises";
import fetch from "node-fetch";
import moment from "moment";
// import { time, timeStamp } from "node:console";
// import { get } from "node:http";
// import { transferableAbortSignal } from "node:util";
// import { listenerCount } from "node:process";

const prisma = new PrismaClient();

// node services/_engines/running/veve_assets.js

const VEVE_PROJECT_ID = "de2180a8-4e26-402a-aed1-a09a51e6e33d";
const VEVE_TOKEN_ADDRESS = "0xa7aefead2f25972d80516628417ac46b3f2604af";
const BASE_URL = "https://api.x.immutable.com/v1/";
const PAGE_SIZE = "200";
const ORDER_BY = "updated_at";
const DIRECTION = "asc";
const STATUS = "imx";
const BURN_WALLETS = ['0x39e3816a8c549ec22cd1a34a8cf7034b3941d8b1', '0x1400d3c5918187e0f1ac663c17c48acf0c6b12fc']
// let WAIT_TIME = 5000
let firstRun = true;


// let imxTokensArr = [];
// let imxWalletsArr = [];
// let tokensRemaining = null;
let lastTokenTimestamp = null;
// let lastTokenId = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const GET_VEVE_TOKENS = async () => {
  const MINIMUM_TIME_MS = 5000;

  do {
    const timestampStart = Date.now();

    try {
      // Get IMX data for VeVe tokens
      console.log("\n[INFO] Fetching VeVe tokens from IMX.");
      const veveAssets = await fetchFromIMX("assets", "veve_tokens");
      const allTokens = [...veveAssets.result];
      console.log(`[INFO] ${allTokens.length} VeVe tokens fetched from IMX. Processing...`);
      await processAssets(allTokens);
      console.log(`[INFO] ${allTokens.length} VeVe tokens processed.`);

    } catch (e) {
      console.log(`[ERROR] GET_VEVE_TOKENS iteration error:`, e);
    }

    const elapsedTime = Date.now() - timestampStart;
    console.log("\n[INFO] TOTAL TIME: ", elapsedTime / 1000, " seconds");

    if (elapsedTime < MINIMUM_TIME_MS) {
      let WAIT_TIME = MINIMUM_TIME_MS - elapsedTime;
      console.log(`[INFO] Pausing for ${WAIT_TIME / 1000} seconds to ensure minimum iteration time.`);
      await sleep(WAIT_TIME);
    }

  } while (true);
};

const fetchFromIMX = async (endpoint, tableName) => {
  let retryCount = 3; 

  while (retryCount > 0) {
      try {
          const { last_timestamp, next_cursor } = await prisma.veve_imx_status.findFirst({
              select: { last_timestamp: true, next_cursor: true },
              where: { table_name: tableName },
          });

          let queryString = `status=${STATUS}&collection=${VEVE_TOKEN_ADDRESS}&page_size=${PAGE_SIZE}&order_by=${ORDER_BY}&direction=${DIRECTION}`;
          
          if (firstRun === true) {
              queryString += `&updated_min_timestamp=${last_timestamp}`;
              firstRun = false;
          } else {
              queryString += `&cursor=${next_cursor}`;
          }

          const FULL_REQ_URL = `${BASE_URL}${endpoint}?${queryString}`;
          console.log(`\n[INFO] Requesting ${tableName} data using ${FULL_REQ_URL}\n`);

          const response = await fetch(FULL_REQ_URL, {
              method: "GET",
              headers: {
                  Accept: "application/json",
                  api_key: process.env.IMX_PUBLIC_API_KEY,
              },
          });

          if (response.status === 429) {
              console.error('[ALERT] Rate limit reached. Pausing for 60 seconds.');
              await new Promise(resolve => setTimeout(resolve, 60000)); 
              retryCount--;
              continue;
          }

          if (!response.ok) {
              const errorMsg = await response.text();
              throw new Error(
                  `[ERROR] Unable to fetch IMX ${tableName} transactions. Status: ${response.status}. Message: ${errorMsg}`
              );
          }

          const responseBody = await response.json();
          if (responseBody.cursor) {
              await prisma.veve_imx_status.update({
                  data: { next_cursor: responseBody.cursor },
                  where: { table_name: tableName }
              });
            }

          // if (tokensRemaining = responseBody.remaining) {
          //     console.log(`[INFO] ${tokensRemaining} ${tableName} tokens remaining.`);

          // } else {
          //     console.log(`[INFO] No ${tableName} tokens remaining.`);
          // }

          return responseBody;

      } catch (error) {
          if (error.message.includes('database connection')) {
              console.error('Database connection error. Pausing for 60 seconds.');
              await sleep(60);
              retryCount--;
          } else {
              throw error; // Rethrow the error if it's not a database connection error
          }
      }
  }

  throw new Error('Max retry attempts reached.'); // Throw an error if max retry attempts are reached
};

  const processAssets = async (allTokens) => {
    let count = 0;
    const prevTokenCount = await prisma.imx_stats.findFirst({
      select: { token_count: true },
      where: { project_id: VEVE_PROJECT_ID },
    });

    for (const token of allTokens) {
      const tokenIdNum = Number(token.token_id); 
      try {
        const isBurned = BURN_WALLETS.includes(token.user);
        // console.log('[INFO] Processing token ID: ' + tokenIdNum);
        
        // NO METADATA
        if (token.name === null) { 
          const createdMintDate = tokenIdNum > 3880000 ? token.created_at : null // To avoid overwriting the mint date with the incorrect created_at date from 12/15/2021 token migration 
          await upsertVeveToken(tokenIdNum, token.updated_at, isBurned, createdMintDate, token.user);
        
        // HAS METADATA
        } else { 
          const { type, comicOrCollectibleId } = extractUniqueId(token);
          // Successful extraction of type and ID
          if (type) {
            await processTokenByType(tokenIdNum, token, type, comicOrCollectibleId, isBurned);
          } else {
            console.log('Unable to extract type from token ID: ', tokenIdNum);
            await upsertVeveToken(tokenIdNum, token.updated_at, isBurned, token.created_at, token.user);
          }
        }
        lastTokenTimestamp = formatDateString(token.updated_at)

      } catch (e) {
        console.error("Failed to process token ID:", tokenIdNum, e);
      }
    }
    //const currentTokenCount = await prisma.imx_stats.findFirst({
    //  select: { token_count: true },
    //  where: { project_id: VEVE_PROJECT_ID },
    //});
    //const newTokenCount = currentTokenCount.token_count - prevTokenCount.token_count;
    //console.log("\n[INFO] Processed", newTokenCount, "tokens with last timestamp:", lastTokenTimestamp);
    await setVeveImxStatus('veve_tokens', formatDateString(lastTokenTimestamp));
  };
  
  const upsertVeveToken = async (tokenId, lastUpdated, isBurned, createdMintDate, wallet_id) => {
    // Prepare the data for the 'create' operation, including 'mint_date'
    const createData = {
      token_id: tokenId,
      last_updated: lastUpdated,
      mint_date: createdMintDate,
      wallet_id: wallet_id,
      is_burned: isBurned,
      to_process: true,
      no_meta: true
    };
  
    // Prepare the data for the 'update' operation, excluding 'mint_date'
    const updateData = {
      last_updated: lastUpdated,
      is_burned: isBurned,
      wallet_id: wallet_id,
      to_process: true,
      no_meta: true
    };
  
    await prisma.veve_tokens.upsert({
      where: { token_id: tokenId },
      create: createData,
      update: updateData
    });
  };
  
  const processTokenByType = async (tokenId, token, type, comicOrCollectibleId, isBurned) => {
    let tableToUpdate, tableToCheck, idField, dataToUpsert, created_mint_date;

    // 12/16/2021 or later - Tokens with the correct created_at date
    // TODO: Update this to exact token ID when the migration was completed
    if (token.token_id > 3880000) { 
      created_mint_date = moment(token.created_at).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
    } else { 
      created_mint_date = moment(token.metadata.mintDate).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
    }
    
    

    if (type === 'comic') {
      tableToUpdate = prisma.veve_tokens;
      tableToCheck = prisma.veve_comics;
      idField = 'comic_image_url_id';
      // // if existing comic, get unique_cover_id and mcp_low_ed_limit
      const result = await prisma.veve_comics.findFirst({
        select: { unique_cover_id: true},
        where: { comic_image_url_id: comicOrCollectibleId },
      });
      const unique_cover_id = result ? result.unique_cover_id : null;

      dataToUpsert = {
        unique_cover_id: unique_cover_id,
        comic_image_url_id: comicOrCollectibleId,
        name: token.name,
        edition: token.metadata.edition,
        mint_date: created_mint_date,
        rarity: token.metadata.rarity,
        type: type,
        last_updated: token.updated_at,
        wallet_id: token.user,
        is_burned: isBurned,
        to_process: false,
        no_meta: false,
      };

    } else if (type === 'collectible') {
      tableToUpdate = prisma.veve_tokens;
      tableToCheck = prisma.veve_collectibles;
      idField = 'collectible_id';

    const collectibleDetails = await prisma.veve_collectibles.findFirst({
      select: { licensor_id: true, brand_id: true, series_id: true },
      where: { collectible_id: comicOrCollectibleId },
    });

    if (collectibleDetails) {
      const { licensor_id, brand_id, series_id } = collectibleDetails;

      dataToUpsert = {
        collectible_id: comicOrCollectibleId,
        name: token.name,
        mint_date: created_mint_date,
        edition: token.metadata.edition,
        mint_date: created_mint_date,
        rarity: token.metadata.rarity,
        type: type,
        wallet_id: token.user,
        brand_id: brand_id,
        licensor_id: licensor_id,
        series_id: series_id,
        last_updated: token.updated_at,
        is_burned: isBurned,
        to_process: false,
        no_meta: false
      };

    }} else {
      console.error("[ERROR] Collectible not found for type: ", type, "and ID:", comicOrCollectibleId);
    }
  
    const existingEntry = await tableToCheck.findUnique({ where: { [idField]: comicOrCollectibleId } });
  
    if (!existingEntry) {
      await prisma.error_log.create({
        data: {
          token_id: Number(token.token_id),
          type: 'data',
          missing_data: true,
          table_name: tableToCheck === prisma.veve_comics ? 'veve_comics' : 'veve_collectibles',
          error_msg: `no metadata in ${tableToCheck === prisma.veve_comics ? 'veve_comics' : 'veve_collectibles'}`,
          process: 'services/Engine/running/$processAssets'
        }
      });
      return;
    } else if (existingEntry) {
      await tableToUpdate.upsert({
        where: { token_id: tokenId }, 
        create: { ...dataToUpsert, token_id: tokenId }, // Ensure tokenId is included in create
        update: dataToUpsert
      });

    //console.log(`[INFO] Upserted token ID ${tokenId} with type ${type}\n`);
    } 
  };

  const extractUniqueId = (token) => {
    try {
        const reComic = /comic_cover\.([a-f\d-]+)\./;
        const reCollectible = /collectible_type_image\.([a-f\d-]+)\./;
        const image_url = token.image_url || null;
  
        if (image_url && image_url.length > 0) {
            const comicMatch = image_url.match(reComic);
            const collectibleMatch = image_url.match(reCollectible);
  
            if (comicMatch) {
                return { type: 'comic', comicOrCollectibleId: comicMatch[1] };
            } else if (collectibleMatch) {
                return { type: 'collectible', comicOrCollectibleId: collectibleMatch[1] };
            }
        }
    } catch (e) {
        console.error('[ERROR] Unable to extract id from image_url for token:', e);
    }
};

async function getVeveImxStatus(table_name) {
  const result = await prisma.veve_imx_status.findFirst({
    select: { last_timestamp: true },
    where: { table_name: table_name },
  });
  return result ? result.last_timestamp : null;
}

async function setVeveImxStatus(table_name, last_timestamp) {
  const prev_timestamp_str = await getVeveImxStatus(table_name);
  const prev_timestamp = new Date(prev_timestamp_str)
  const new_timestamp = new Date(last_timestamp);

  if (new_timestamp > prev_timestamp) {
    await prisma.veve_imx_status.update({
      where: { table_name },
      data: { last_timestamp: formatDateString(last_timestamp) }
    });
  }
}

function formatDateString(input) {
  const date = new Date(input);
  return date.toISOString().split('.')[0] + 'Z';
}

GET_VEVE_TOKENS();




//   const processAssets = async (allTokens) => {
//     for (const token of allTokens) {
//         try {
//             let comic_image_url_id = null;
//             let collectible_id = null;
//             let is_burned = false;

//             // imxWalletsArr.push({
//             //     id: token.user,
//             //     timestamp: token.updated_at,
//             //     active: true,
//             //   });
            
//             if (BURN_WALLETS.includes(token.user)) {
//                 is_burned = true;
//             }

//             console.log('[INFO] Processing: ' + token.token_id)
//             if (token.name === null) {
//                 // console.log('no metadata');
//                 // imxTokensArr.push({
//                 //     token_id: Number(token.token_id),
//                 //     last_updated: token.updated_at,
//                 //     // wallet_id: token.user,
//                 //     is_burned: is_burned,
//                 //     to_process: true,
//                 //     no_meta: true
//                 // });
//                 if (token.token_id > 3880000) { // 12/16/2021 or later(Tokens with the correct created_at date)
//                   created_mint_date = token.created_at
//                 }

//                 await prisma.veve_tokens.upsert({
//                   where: { token_id: Number(token.token_id) },
//                   create: {
//                     token_id: Number(token.token_id),
//                     last_updated: token.updated_at,
//                     // wallet_id: token.user,
//                     // don't update because of 12/15/2021
//                     // mint_date: moment(token.metadata.created_at).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
//                     mint_date: created_mint_date,
//                     is_burned: is_burned,
//                     to_process: true,
//                     no_meta: true
//                   },
//                   update: {
//                     last_updated: token.updated_at,
//                     // wallet_id: token.user,
//                     // mint_date: created_mint_date,
//                     is_burned: is_burned,
//                     to_process: true,
//                     no_meta: true
//                   }
//               });

//             } else if (Number(token.token_id)  === 9822155) {
//                   console.log('FOUND: 9822155')
                
//                 const { type, comicOrCollectibleId } = extractUniqueId(token)

//                 if (type === 'comic') {
//                   if (Number(token.token_id) === 9822155) {
//                     console.log('9822155 is a comic')
//                   }
//                     comic_image_url_id = comicOrCollectibleId;

//                     const existingComic = await prisma.veve_comics.findUnique({
//                       where: { comic_image_url_id: comic_image_url_id },
//                   });

//                   // IF comic exists in veve_comics
//                   if (existingComic) {
//                     const { unique_cover_id, mcp_low_ed_limit } = await prisma.veve_comics.findFirst({
//                         select: { unique_cover_id: true, mcp_low_ed_limit: true },
//                         where: { comic_image_url_id: comic_image_url_id },
//                     });

//                     // ADD MCP ED BONUS CALC
//                     // imxTokensArr.push({
//                     //     token_id: Number(token.token_id),
//                     //     unique_cover_id: unique_cover_id,
//                     //     comic_image_url_id: comic_image_url_id,
//                     //     name: token.name,
//                     //     edition: token.metadata.edition,
//                     //     mint_date: moment(token.metadata.mintDate).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
//                     //     rarity: token.metadata.rarity, 
//                     //     type: type, 
//                     //     last_updated: token.updated_at,
//                     //     // wallet_id: token.user,
//                     //     is_burned: is_burned,
//                     //     to_process: false,
//                     //     no_meta: false
//                     // });

//                     if (token.token_id === 9822155) {
//                       console.log('UPSERTING EXISTING: 9822155')
//                     }
//                     await prisma.veve_tokens.upsert({
//                       where: { token_id: Number(token.token_id) },
//                       create: {                        
//                           token_id: Number(token.token_id),
//                           unique_cover_id: unique_cover_id,
//                           comic_image_url_id: comic_image_url_id,
//                           name: token.name,
//                           edition: token.metadata.edition,
//                           mint_date: moment(token.metadata.mintDate).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
//                           rarity: token.metadata.rarity, 
//                           type: type, 
//                           last_updated: token.updated_at,
//                           // wallet_id: token.user,
//                           is_burned: is_burned,
//                           to_process: false,
//                           no_meta: false,
//                       },
//                       update: {
//                           unique_cover_id: unique_cover_id,
//                           comic_image_url_id: comic_image_url_id,
//                           name: token.name,
//                           edition: token.metadata.edition,
//                           mint_date: moment(token.metadata.mintDate).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
//                           rarity: token.metadata.rarity, 
//                           type: type, 
//                           last_updated: token.updated_at,
//                           // wallet_id: token.user,
//                           is_burned: is_burned,
//                           to_process: false,
//                           no_meta: false,
//                       }
//                   });
//                 } else {
//                   // add error for no meta in veve veve_comics
//                   if (token.token_id === 9822155) {
//                     console.log('9822155 in ELSE')
//                   }
//                   await prisma.error_log.create({
//                     data: { token_id: Number(token.token_id), type: 'data', missing_data: true, table_name: 'veve_comics', error_msg: `no metadata in veve_comics`, process: 'services/Engine/running/$processAssets' }
//                   });
//                 }

//                 } else if (type === 'collectible') {
//                   if (token.token_id === 9822155) {
//                     console.log('9822155 is a Collectible')
//                   }
//                     collectible_id = comicOrCollectibleId;
//                     const existingCollectible = await prisma.veve_collectibles.findUnique({
//                       where: { collectible_id: collectible_id },
//                   });
                    
//                   if (existingCollectible) {
//                     const { brand_id, licensor_id, series_id, mcp_low_ed_limit } = await prisma.veve_collectibles.findFirst({
//                         select: { brand_id: true, licensor_id: true, series_id: true, mcp_low_ed_limit: true },
//                         where: { collectible_id: collectible_id },
//                     });

//                     // ADD MCP ED BONUS CALC
//                     // imxTokensArr.push({
//                         // token_id: Number(token.token_id),
//                         // collectible_id: collectible_id,
//                         // name: token.name,
//                         // edition: token.metadata.edition,
//                         // mint_date: moment(token.metadata.mintDate).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
//                         // rarity: token.metadata.rarity,
//                         // type: type,
//                         // last_updated: token.updated_at,
//                         // brand_id: brand_id,
//                         // licensor_id: licensor_id,
//                         // series_id: series_id,
//                         // // wallet_id: token.user,
//                         // to_process: false,
//                         // no_meta: false
//                     // });

//                     await prisma.veve_tokens.upsert({
//                       where: { token_id: Number(token.token_id) },
//                       create: {                        
//                       token_id: Number(token.token_id),
//                       collectible_id: collectible_id,
//                       name: token.name,
//                       edition: token.metadata.edition,
//                       mint_date: moment(token.metadata.mintDate).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
//                       rarity: token.metadata.rarity,
//                       type: type,
//                       last_updated: token.updated_at,
//                       brand_id: brand_id,
//                       licensor_id: licensor_id,
//                       series_id: series_id,
//                       // wallet_id: token.user,
//                       to_process: false,
//                       no_meta: false,
//                       },
//                       update: {
//                         token_id: Number(token.token_id),
//                         collectible_id: collectible_id,
//                         name: token.name,
//                         edition: token.metadata.edition,
//                         mint_date: moment(token.metadata.mintDate).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
//                         rarity: token.metadata.rarity,
//                         type: type,
//                         last_updated: token.updated_at,
//                         brand_id: brand_id,
//                         licensor_id: licensor_id,
//                         series_id: series_id,
//                         // wallet_id: token.user,
//                         to_process: false,
//                         no_meta: false
//                       }
//                     });
//                 }
//               else {
//                   // add error for no meta in veve_collectibles
//                   if (token.token_id === 9822155) {
//                     console.log('ERROR FOR: 9822155')
//                   }
//                   print("ERROR-Creating log record. something is wrong with token: ", token.token_id)
//                   await prisma.error_log.create({
//                     data: { token_id: Number(token.token_id), type: 'data', missing_data: true, table_name: 'veve_collectibles', error_msg: `no metadata in veve_collectibles`, process: 'services/Engine/running/$processAssets' }
//                   });
//                 }
//                 } else {
//                   console.log('NOT ABLE TO EXTRACT TYPE FROM TOKEN: ', token.token_id)
//                 }
//             }
//             lastTokenId = token && token.token_id ? Number(token.token_id) : null;
//         } catch (e) {
//             console.error("[ERROR] Failed to process token with ID:", token.token_id, e);
//         }

    
//       count += 1;
//       if (count % 200 === 0) {
//         console.log("\n[INFO] Processed", count, "tokens");
//         console.log(`[INFO] Last Date Processed: ${token.updated_at}`)
//       } 
//       lastTokenTimestamp = formatDateString(token.updated_at);

//     setVeveImxStatus('veve_tokens', lastTokenTimestamp)

//     }
//     console.log(`[INFO] Processed ${count} tokens`);
//     count = 0;
//     return { wallets: imxWalletsArr, tokens: imxTokensArr };
// };


// const processVeveIMXMetadata = async (tokens) => {
//   try {
//     // const previousTokenCount = await prisma.veve_tokens.count();
//     const allTokens = [...tokens.result];
//     // console.log(allTokens)
//     // const { wallets: imxWalletsArr, tokens: imxTokensArr } = 
//     await processAssets(allTokens);
//   //   console.log(imxTokensArr)
//     // await performUpserts(imxWalletsArr, imxTokensArr);
//   //   await updateStats(previousTokenCount);

//   } catch (e) {
//     console.error("[ERROR] Process Assets Failed:", e);
//   }
// };



// const performUpserts = async (imxWalletsArr, imxTokensArr) => {
//     try {
//       console.log();
      // const sortedWalletsArr = imxWalletsArr.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      // console.log("Updating veve_wallets.");
  
      // // Wallets needs to update before veve_tokens
      // for (const wallet of sortedWalletsArr) {
      //     const existingWallet = await prisma.veve_wallets.findUnique({
      //         where: { id: wallet.id },
      //     });
      //     await prisma.veve_wallets.upsert({
      //         where: { id: wallet.id },
      //         update: {
      //             last_activity_date: existingWallet && existingWallet.last_activity_date > wallet.timestamp
      //                 ? existingWallet.last_activity_date
      //                 : wallet.timestamp,
      //             first_activity_date: existingWallet
      //                 ? existingWallet.first_activity_date
      //                 : wallet.timestamp,
      //             active: wallet.active,
      //         },
      //         create: {
      //             id: wallet.id,
      //             last_activity_date: wallet.timestamp,
      //             first_activity_date: wallet.timestamp,
      //             active: wallet.active,
      //         },
      //     });
      //     if (!existingWallet) {
      //       console.log("New veve_wallets added wallet id:", wallet.id, "with timestamp:", wallet.timestamp);
      //   }
      // }

  //     console.log("Updating veve_tokens.");
  //     for (const token of imxTokensArr) {
  //       await prisma.veve_tokens.upsert({
  //           where: { token_id: token.token_id },
  //           create: token,
  //           update: token
  //       });
        
  //     }
      
  //   } catch (e) {
  //     console.error("[ERROR] Prisma Upsert Failed:", e);
  //   }
  // };

// const processAssets = async (allTokens) => {
//     try {
//             let imxWalletsArr = [];
//             let imxTokensArr = [];
          
//             allTokens.forEach((token) => {
//                 const collectible_id = null;
//                 const unique_cover_id = null;
//                 const comic_image_url_id = null;
//                 is_burned = false;

//                 if (token.name === null) {
//                     console.log('no metadata')

//                     //  #TODO
//                     // DON'T OVERWRITE CURRENT DATA IF EXISTS
//                     // only update mint_date and updated_at
//                     // imxTokensArr.push({
//                     //     token_id: Number(token.token_id),
//                     //     wallet_id: token.user,
//                     //     mint_date: moment.unix(Number(token.created_at) / 1000).utc().format(),
//                     //     updated_at: moment.unix(Number(token.updated_at) / 1000).utc().format(),
//                     //     no_meta: true,
//                     //     to_process: 1
//                     // })
//                     // {
//                     //     "token_id": "1782886",
//                     //     "user": "0x36de9ba2f15707d643f8204484aa3f2cf529a87b",
//                     //     "created_at": "2021-12-15T09:53:30.657437Z",
//                     //     "updated_at": "2023-09-01T00:03:30.716789Z"
//                     //     },
//                 } else {
//                     // full metadata

//                     const { type, comicOrCollectibleId } = extractUniqueId(token);
//                     if (type === 'comic') {
//                         // check if comic exists in veve_comics

//                         comic_image_url_id = comicOrCollectibleId
//                         const { unique_cover_id, element_id, mcp_low_ed_limit } = await prisma.veve_comics.findFirst({
//                             select: { unique_cover_id: true, element_id: true, mcp_low_ed_limit: true },
//                             where: { comic_image_url_id: comic_image_url_id },
//                           });

//                         // calc if mcp_ed_bonus applies

//                         if (token.user in BURN_WALLETS) {
//                             is_burned = true
//                         }

//                         imxTokensArr.push({
//                             token_id: Number(token.token_id),
//                             unique_cover_id: unique_cover_id,
//                             comic_image_url_id: comic_image_url_id,
//                             name: token.name,
//                             edition: token.metadata.edition,
//                             mint_date: moment.unix(Number(token.created_at) / 1000).utc().format(),
//                             rarity: token.metadata.rarity, 
//                             type: type, 
//                             element_id: element_id,
//                             last_updated: updated_at, 
//                             wallet_id: token.user,
//                             is_burned: is_burned,
//                             to_process: 0,
//                             no_meta: false
//                         });

//                     } else if (type === 'collectible') {
//                         // check if collectible exists in veve_collectibles
//                         collectible_id = comicOrCollectibleId
//                         const { brand_id, licensor_id, series_id, mcp_low_ed_limit } = await prisma.veve_collectibles.findFirst({
//                             select: { brand_id: true, licensor_id: true, series_id: true, mcp_low_ed_limit: true },
//                             where: { collectible_id: collectible_id },
//                           });
//                         // calc if mcp_ed_bonus applies

//                         imxTokensArr.push({
//                             token_id: Number(token.token_id),
//                             collectible_id: collectible_id,
//                             name: token.name,
//                             edition: token.metadata.edition,
//                             mint_date: moment.unix(Number(token.created_at) / 1000).utc().format(),
//                             rarity: token.metadata.rarity, 
//                             type: type,
//                             last_updated: updated_at,
//                             brand_id: brand_id,
//                             licensor_id: licensor_id,
//                             series_id: series_id,
//                             wallet_id: token.user,
//                             to_process: 0,
//                             no_meta: false
//                         });
//                     }

//                 }

//             })
          
//     return imxTokensArr;
//     } catch (e) {   
//         console.error("[ERROR] Process Assets Failed:", e);
//     }
//     };

                // imxWalletsArr.push({
                //   id: from_wallet,
                //   timestamp: timestamp,
                //   active: true,
                //   has_kyc: true,
                // });
                // imxWalletsArr.push({
                //   id: to_wallet,
                //   timestamp: timestamp,
                //   active: true,
                // });
                // imxTokensArr.push({
                //   token_id: token_id,
                //   wallet_id: to_wallet,
                //   to_process: true,
                // });


// //LEFT OFF HERE
//   performUpserts(imxTokensArr)





  

//     if burn wallets check is_burned
//     if name = null check no_meta
//     if complete meta to_process 0

//     // if name is not null - full metadata exists

//     imxTokensArr.push({
//         token_id: Number(transaction.assets.token_id),
//         name: name,
//         edition edition,
//         mint_date: moment.unix(Number(transaction.created_at) / 1000).utc().format(),
//         rarity: rarity, 
//         collectible_id: // parse image_url_id if it exists
//         unique_cover_id: // get from veve_collectibles
//         type: , // comic or collectible,
//         last_updated: updated_at, 
//         brand_id: , // get from veve_collectibles
//         licensor_id: , // get from veve_collectibles
//         series_id: , // get from veve_collectibles
//         comic_image_url_id: , // parse image_url_id if it exists
//         wallet_id: user,
//         to_process: 0
//     });

//     // if name is null
//     no_meta = true
//         if collectible
//             kick off mintable token check
//         else,
//             check veve api
//             if exists
//                 update token
//             else
                

//   };






// https://api.x.immutable.com/v1/mintable-token/{token_address}/{token_id}

// const fetchMintableToken = async (endpoint, tableName) => {
//     const { last_timestamp, next_cursor } = await prisma.veve_imx_status.findFirst({
//       select: { last_timestamp: true, next_cursor: true },
//       where: { table_name: tableName },
//     });
  
//     let queryString = `status=${STATUS}&collection=${VEVE_TOKEN_ADDRESS}&page_size=${PAGE_SIZE}&order_by=${ORDER_BY}&direction=${DIRECTION}&updated_min_timestamp=${last_timestamp}`;
  
//     const FULL_REQ_URL = `${BASE_URL}${endpoint}?${queryString}`;
//     console.log()
//     console.log(`[INFO] Requesting ${tableName} data using ${FULL_REQ_URL}`);
  
//     const response = await fetch(FULL_REQ_URL, {
//       method: "GET",
//       headers: {
//         Accept: "application/json",
//         api_key: process.env.IMX_PUBLIC_API_KEY,
//       },
//     });
  
//     if (!response.ok) {
//       const errorMsg = await response.text();
//       throw new Error(
//         `Unable to fetch IMX ${tableName} transactions. Status: ${response.status}. Message: ${errorMsg}`
//       );
//     }
  
//     const responseBody = await response.json();
  
//     await prisma.veve_imx_status.update({
//         data: { next_cursor: responseBody.cursor },
//         where: { table_name: tableName }
//     });
  
//     return responseBody;
//   };



// MINTABLE TOKEN SERVICE
// token.token_address,
// token.user,
// token.created_at,
// token.updated_at



// const mintableToken = await fetchFromIMX("mintable-token", "veve_tokens");
// const { brand_id, licensor_id, series_id, mcp_low_ed_limit } = await prisma.veve_collectibles.findFirst({
//     select: { brand_id: true, licensor_id: true, series_id: true, mcp_low_ed_limit: true },
//     where: { name: mintableToken.name },
// });



// // Collectible and matched in veve_collectibles
// imxTokensArr.push({
//     token_id: Number(token.token_id),
//     name: token.name,
//     edition: token.metadata.edition,
//     mint_date: token.metadata.mintDate,
//     rarity: token.metadata.rarity, 
//     type: type, 
//     updated_at: updated_at,
//     wallet_id: token.user,
//     is_burned: is_burned,
//     to_process: 0,
//     no_meta: false
// });

// // 
// imxTokensArr.push({
//     token_id: Number(token.token_id),
//     name: token.name,
//     edition: token.metadata.edition,
//     mint_date: token.metadata.mintDate,
//     rarity: token.metadata.rarity, 
//     type: type, 
//     updated_at: updated_at,
//     wallet_id: token.user,
//     is_burned: is_burned,
//     to_process: 0,
//     no_meta: false
// });


// const fetchFromIMX = async (endpoint, tableName) => {
//   const { last_timestamp, next_cursor } = await prisma.veve_imx_status.findFirst({
//     select: { last_timestamp: true, next_cursor: true },
//     where: { table_name: tableName },
//   });

//   let queryString = `status=${STATUS}&collection=${VEVE_TOKEN_ADDRESS}&page_size=${PAGE_SIZE}&order_by=${ORDER_BY}&direction=${DIRECTION}`
  
//   if (firstRun === true) {
//     queryString += `&updated_min_timestamp=${last_timestamp}`;
//     firstRun = false;
//   } else if (tokensRemaining === 0 && tableName === "veve_tokens") {
//     queryString += `&updated_min_timestamp=${last_timestamp}`;
//   } else {
//     queryString += `&cursor=${next_cursor}`;
//   }

//   const FULL_REQ_URL = `${BASE_URL}${endpoint}?${queryString}`;
//   console.log()
//   console.log(`[INFO] Requesting ${tableName} data using ${FULL_REQ_URL}`);

//   const response = await fetch(FULL_REQ_URL, {
//     method: "GET",
//     headers: {
//       Accept: "application/json",
//       api_key: process.env.IMX_PUBLIC_API_KEY,
//     },
//   });

//   if (!response.ok) {
    
//     const errorMsg = await response.text();
//     throw new Error(
//       `Unable to fetch IMX ${tableName} transactions. Status: ${response.status}. Message: ${errorMsg}`
//     );
//     setTimeout(60000);
//     // await 60 seconds
    

//   }

//   const responseBody = await response.json();

//   // TODO Add last timestamp update to veve_imx_status
//   await prisma.veve_imx_status.update({
//       data: { next_cursor: responseBody.cursor },
//       where: { table_name: tableName }
//   });

//   //temp fix
//   if(tableName == "veve_tokens") {
//     tokensRemaining = responseBody.remaining;
//   } 

//   return responseBody;
// };