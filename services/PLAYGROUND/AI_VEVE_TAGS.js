import fetch from 'node-fetch'
import {customAlphabet} from 'nanoid/non-secure'
import slugify from 'slugify'
import * as Queries from "../../queries/getVevelatestCollectiblesQuery.js";
import {prisma} from "../../index.js";
import {ChatGPTAPI} from 'chatgpt'

const chatGptKey = "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"
const getTagsFromChatGPT = async (chatgpt, collectible) => {
    const prompt = createCollectiblesPrompt(collectible);

    const response = await chatgpt.sendMessage(prompt)

    return extractTagsFromResponse(response.text);
};

const createCollectiblesPrompt = (collectible) => {
    return `Generate a list of search tags for the following collectible item:
Name: ${collectible.name}
Description: ${collectible.description}
AI Description: ${collectible.ai_description}
Brand Name: ${collectible.brand.name}
Series Name: ${collectible.series.name}
Licensor Name: ${collectible.licensor.name}
Note: Provide a comma-separated list of relevant tags that directly relate to the collectible item. Tags should be concise and directly related to the item. Avoid including generic, vague or irrelevant words.`;
};

const BATCH_SIZE = 10;

const generateTags = async () => {
    let skip = 0;
    let batchNumber = 1;

    console.log('Starting tag generation...');

    while (true) {
        const collectibles = await prisma.veve_collectibles.findMany({
            select: {
                collectible_id: true,
                name: true,
                description: true,
                brand: {
                    select: {
                        name: true
                    }
                },
                series: {
                    select: {
                        name: true,
                    }
                },
                licensor: {
                    select: {
                        name: true,
                    }
                },
                translations: {
                    select: {
                        ai_description: true
                    },
                    where: {
                        language: 'EN'
                    }
                }
            },
            skip,
            take: 1,
        });

        if (collectibles.length === 0) {
            console.log('All collectibles processed.');
            break;
        }

        console.log(`Processing Batch ${batchNumber}...`);

        const chatgpt = new ChatGPTAPI({
            apiKey: chatGptKey,
            completionParams: {
                model: 'gpt-4',
            }
        });

        const tagsBatch = await Promise.all(collectibles.map(async (collectible) => {
            return getTagsFromChatGPT(chatgpt, collectible);
        }));

        // Save tags to the database in bulk
        const collectibleIds = collectibles.map((collectible) => collectible.collectible_id);
        const tagsStrings = tagsBatch.map((tagsString) => tagsString);

        await saveTagsToDatabaseBulk(collectibleIds, tagsStrings);

        console.log(`Batch ${batchNumber} processed.`);
        batchNumber++;

        skip += BATCH_SIZE;
        await delay(3000);
    }
    console.log('Tag generation completed.');

};

const delay = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const extractTagsFromResponse = (responseText) => {
    const tagArray = responseText.split(',');
    return tagArray.map(tag => tag.trim()).filter(tag => tag !== '');
};

const saveTagsToDatabaseBulk = async (collectibleIds, tagsStrings) => {
    let bulkData = [];
    collectibleIds.forEach((collectibleId, index) => {
        tagsStrings[index].forEach((tag) => {
            bulkData.push({
                name: tag,
                collectible_id: collectibleId
            });
        });
    });

    await prisma.veve_collectible_tags.createMany({
        data: bulkData,
    });
    console.log(`Saved ${bulkData.length} tags to the database.`);
};
generateTags()