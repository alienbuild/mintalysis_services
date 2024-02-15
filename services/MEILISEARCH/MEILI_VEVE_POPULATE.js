import { meili, prisma } from "../../index.js";

// Constants
const BATCH_SIZE = 100;

// Generic function to fetch updated batch
async function fetchUpdatedBatch(model, selectConfig, lastRunDate, skip, take) {
    const data = await prisma[model].findMany({
        where: { updatedAt: { gt: lastRunDate } },
        skip: skip,
        take: take,
        select: selectConfig
    });

    return data.map(item => {
        let id;

        if (model === 'veve_collectibles') {
            id = `veve_collectibles_${item.collectible_id}`;
        } else if (model === 'veve_comics') {
            id = `veve_comics_${item.unique_cover_id}`;
        } else {
            id = `${model}_${item[model + '_id']}`;
        }

        return {
            id: id,
            slug: item.slug,
            source_type: model,
            name: item.name,
            project_id: item.project?.id,
            project_motiff_url: item.project?.motiff_url,
            ...(model === 'veve_collectibles' && {
                rarity: item.rarity,
                image: item.image_thumbnail_url,
                edition_type: item.edition_type,
                tags: Array.isArray(item.tags) ? item.tags.map(tag => tag.name).join(', ') : '',
            }),
            ...(model === 'veve_comics' && {
                rarity: item.rarity,
                image: item.image_thumbnail,
                comic_number: item.comic_number,
                artists: item.artists?.map(artist => artist.name).join(', ') ?? '',
                characters: item.characters?.map(character => character.name).join(', ') ?? '',
                writers: item.writers?.map(writer => writer.name).join(', ') ?? '',
            }),
        };
    });
}



// Generic function to index updated data in MeiliSearch
async function indexUpdatedDataInMeiliSearch(model, indexName, selectConfig, lastRunDate) {
    let skip = 0;
    let batch;

    do {
        batch = await fetchUpdatedBatch(model, selectConfig, lastRunDate, skip, BATCH_SIZE);

        if (batch.length > 0) {
            const transformedBatch = batch.map(item => {
                // Common fields for all models
                const commonFields = {
                    id: item.id,
                    slug: item.slug,
                    name: item.name,
                    project_id: item.project?.id,
                    project_motiff_url: item.project?.motiff_url,
                };

                // Fields specific to veve_collectibles
                if (model === 'veve_collectibles') {
                    return {
                        ...commonFields,
                        rarity: item.rarity,
                        image: item.image,
                        edition_type: item.edition_type,
                        tags: item.tags,
                    };
                }
                // Fields specific to veve_comics
                else if (model === 'veve_comics') {
                    console.log('item is: ', item)
                    return {
                        ...commonFields,
                        rarity: item.rarity,
                        image: item.image,
                        comic_number: item.comic_number,
                        artists: item?.artists,
                        characters: item?.characters,
                        writers: item?.writers,
                    };
                }
                // Fields for other models...
                else {
                    return {
                        ...commonFields,
                        // other specific fields for other models...
                    };
                }
            });

            // Index the batch in MeiliSearch
            await meili.index(indexName).addDocuments(transformedBatch, { primaryKey: 'id' });

            // Update the skip value for the next batch
            skip += batch.length;
        }
    } while (batch.length === BATCH_SIZE);

    console.log(`Indexed ${skip} records in MeiliSearch for model ${model}`);
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

    const veveArtistsConfig = {
        artist_id: true,
        name: true,
        image: true
    };

    const veveCharactersConfig = {
        character_id: true,
        name: true,
        image: true
    };

    const veveWritersConfig = {
        author_id: true,
        name: true,
        image: true
    };

    const veveCollectiblesConfig = {
        collectible_id: true,
        name: true,
        slug: true,
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

    const veveComicsConfig = {
        unique_cover_id: true,
        name: true,
        slug: true,
        image_thumbnail: true,
        comic_number: true,
        rarity: true,
        artists: {
            select: {
                name: true
            }
        },
        characters: {
            select: {
                name: true
            }
        },
        writers: {
            select: {
                name: true
            }
        },
        project: {
            select: {
                id: true,
                motiff_url: true
            }
        }
    };

    await populateModel('veve_collectibles_indexing', 'veve_collectibles', 'collectibles', veveCollectiblesConfig);
    // await populateModel('veve_comics_indexing', 'veve_comics', 'collectibles', veveComicsConfig);

    // await populateModel('brands_indexing', 'brands', 'brands', 'brand_id', veveBrandsConfig);
    // await populateModel('veve_series_indexing', 'veve_series', 'veve_series', 'series_id', veveSeriesConfig);
    // await populateModel('licensors_indexing', 'licensors', 'licensors', 'licensor_id', veveLicensorsConfig);
    // await populateModel('artists_indexing', 'artists', 'artists', 'artist_id', veveArtistsConfig);
    // await populateModel('characters_indexing', 'characters', 'characters', 'character_id', veveCharactersConfig);
    // await populateModel('writers_indexing', 'writers', 'writers', 'author_id', veveWritersConfig);
};

const emptyIndex = async (indexName) => {
    try {
        const response = await meili.index(indexName).deleteAllDocuments();
        console.log(`All documents in '${indexName}' have been deleted`, response);
    } catch (error) {
        console.error(`Error deleting documents in index '${indexName}':`, error);
    }
};

const deleteIndex = async (indexName) => {
    try {
        const response = await meili.index(indexName).delete();
        console.log(`Index '${indexName}' has been deleted`, response);
    } catch (error) {
        console.error(`Error deleting index '${indexName}':`, error);
    }
};

// deleteIndex('veve_brands')
// deleteIndex('veve_licensors')

// emptyIndex('collectibles');
// emptyIndex('veve_brands');
// emptyIndex('veve_licensors');

MEILI_VEVE_POPULATE().then(r => console.log('FINISHED POPULATING MEILISEARCH'))