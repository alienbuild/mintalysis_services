import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import moment from "moment";

const prisma = new PrismaClient();

const VEVE_PROJECT_ID = "de2180a8-4e26-402a-aed1-a09a51e6e33d";
const VEVE_TOKEN_ADDRESS = "0xa7aefead2f25972d80516628417ac46b3f2604af";
const BASE_URL = "https://api.x.immutable.com/v1/";
const PAGE_SIZE = "200";
const ORDER_BY = "updated_at";
const DIRECTION = "asc";
const STATUS = "imx";
const BURN_WALLETS = ['0x39e3816a8c549ec22cd1a34a8cf7034b3941d8b1', '0x1400d3c5918187e0f1ac663c17c48acf0c6b12fc']
let firstRun = true;


let lastTokenTimestamp = null;

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

GET_VEVE_TOKENS()