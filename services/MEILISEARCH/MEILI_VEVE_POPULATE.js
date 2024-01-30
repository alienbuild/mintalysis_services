import { meili, prisma } from "../../index.js";

// Constants
const BATCH_SIZE = 100;

// Generic function to fetch updated batch
async function fetchUpdatedBatch(model, selectConfig, lastRunDate, skip, take) {
    return await prisma[model].findMany({
        where: { updatedAt: { gt: lastRunDate } },
        skip,
        take,
        select: selectConfig
    });
}


// Generic function to index updated data in MeiliSearch
async function indexUpdatedDataInMeiliSearch(model, indexName, primaryKey, selectConfig, lastRunDate) {
    let skip = 0;
    let batch;

    do {
        batch = await fetchUpdatedBatch(model, selectConfig, lastRunDate, skip, BATCH_SIZE);
        if (batch.length > 0) {
            await meili.index(indexName).addDocuments(batch, { primaryKey });
            skip += batch.length;
        }
    } while (batch.length === BATCH_SIZE);

    console.log(`Indexed ${skip} updated records in MeiliSearch for model ${model}`);
}

// Function to get the last run date of a script
async function getLastRunDate(scriptName) {
    const record = await prisma.meili_script_logs.findUnique({
        where: { script_name: scriptName },
    });

    return record ? record.last_run_date : new Date(0);
}

// Function to update the last run date of a script
async function updateLastRunDate(scriptName) {
    const now = new Date();
    await prisma.meili_script_logs.upsert({
        where: { script_name: scriptName },
        update: { last_run_date: now },
        create: { script_name: scriptName, last_run_date: now },
    });
}

// Function to populate a specific model (example: Veve Collectibles)
export async function populateModel(scriptName, modelName, indexName, primaryKey, selectConfig) {
    try {
        console.log(`Populating ${modelName} [MeiliSearch]`);

        const lastRunDate = await getLastRunDate(scriptName);
        await indexUpdatedDataInMeiliSearch(modelName, indexName, primaryKey, selectConfig, lastRunDate);
        await updateLastRunDate(scriptName);

        console.log(`Finished indexing ${modelName} in MeiliSearch`);
    } catch (error) {
        console.error(`Error populating MeiliSearch for ${modelName}:`, error);
    }
}

// Usage example for Veve Collectibles
export const MEILI_VEVE_POPULATE = async () => {

    const veveBrandsConfig = {
        brand_id: true,
        name: true,
        square_image_thumbnail_url: true
    };

    const veveSeriesConfig = {
        series_id: true,
        name: true,
        square_image_thumbnail_url: true
    };

    const veveLicensorsConfig = {
        licensor_id: true,
        name: true,
        square_image_thumbnail_url: true
    };

    const veveCollectiblesConfig = {
        collectible_id: true,
        name: true,
        image_thumbnail_url: true,
        image_direction: true,
        rarity: true,
        edition_type: true,
        tags: {
            select: {
                name: true
            }
        },
        project: {
            select: {
                id: true,
                name: true,
                motiff_url: true
            }
        }
    };

    // await populateModel('veve_collectibles_indexing', 'veve_collectibles', 'veve_collectibles', 'collectible_id', veveCollectiblesConfig);
    // await populateModel('veve_brands_indexing', 'veve_brands', 'veve_brands', 'brand_id', veveBrandsConfig);
    // await populateModel('veve_series_indexing', 'veve_series', 'veve_series', 'series_id', veveSeriesConfig);
    // await populateModel('veve_licensors_indexing', 'veve_licensors', 'veve_licensors', 'licensor_id', veveLicensorsConfig);
};

const emptyIndex = async (indexName) => {
    try {
        const response = await meili.index(indexName).deleteAllDocuments();
        console.log(`All documents in '${indexName}' have been deleted`, response);
    } catch (error) {
        console.error(`Error deleting documents in index '${indexName}':`, error);
    }
};

// emptyIndex('veve_collectibles');
// emptyIndex('veve_brands');

MEILI_VEVE_POPULATE().then(r => console.log('FINISHED POPULATING MEILISEARCH'))