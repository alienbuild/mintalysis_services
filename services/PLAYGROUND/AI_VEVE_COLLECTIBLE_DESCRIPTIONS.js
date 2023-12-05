import { PrismaClient } from "@prisma/client"
import { ChatGPTAPI } from 'chatgpt'

const prisma = new PrismaClient()
const chatGptKey = "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"

export const AI_VEVE_COLLECTIBLE_DESCRIPTIONS = async () => {
    console.log('Lets get them descriptions!')

    const chatgpt = new ChatGPTAPI({
        apiKey: chatGptKey,
        completionParams: {
            model: 'gpt-4',
        }
    })

    const batchSize = 10;
    let skip = 0;

    while(true) {
        const collectibles = await prisma.veve_collectibles.findMany({
            include: {
                brand: true,
                licensor: true,
                series: true
            },
            skip: skip,
            take: 1
        });

        if (collectibles.length === 0) {
            break;
        }

        for (const collectible of collectibles) {
            console.log(`Calling ChatGPT 4 for ${collectible.name} - ${collectible.rarity}`);

            const message = `
            write a 300 to 500 word description for the image linked below.
            ignore the background of the image and concentrate only on the collectible.
            You can also use any of the other information below to help you.
            image: ${collectible.image_url}
            description: ${collectible.description}
            store price: ${collectible.store_price}
            total available: ${collectible.total_available}
            drop date: ${collectible.drop_date}
            edition type: ${collectible.edition_type}
            rarity: ${collectible.rarity}
            brand name: ${collectible.brand.name}
            brand description: ${collectible.brand.description}
            series name: ${collectible.series.name}
            series description: ${collectible.series.description}
            series season: ${collectible.series.season}
            licensor name: ${collectible.licensor.name}
            first public mint: ${collectible.first_public_mint}
            licensor description: ${collectible.licensor.description}
        `
            const rewrite = await chatgpt.sendMessage(message)

            const existingTranslation = await prisma.veve_collectibles_translations.findUnique({
                where: {
                    language_collectible_id: {
                        language: "EN",
                        collectible_id: collectible.collectible_id,
                    },
                },
            });

            if (existingTranslation) {
                await prisma.veve_collectibles_translations.update({
                    where: {
                        language_collectible_id: {
                            language: "EN",
                            collectible_id: collectible.collectible_id,
                        },
                    },
                    data: {
                        ai_description: rewrite.text,
                    },
                });
            } else {
                await prisma.veve_collectibles_translations.create({
                    data: {
                        collectible_id: collectible.collectible_id,
                        name: collectible.name,
                        edition_type: collectible.edition_type,
                        rarity: collectible.rarity,
                        ai_description: rewrite.text,
                        language: "EN",
                    },
                });
            }

            console.log('Waiting for 5 seconds...')

            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay

        }

        skip += batchSize;

    }

}

AI_VEVE_COLLECTIBLE_DESCRIPTIONS()