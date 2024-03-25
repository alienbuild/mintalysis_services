import {PrismaClient} from "@prisma/client";
import { ChatGPTAPI } from 'chatgpt'

const prisma = new PrismaClient()
const chatGptKey = "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"

export const VEVE_GET_SECONDARY_COMIC_SALESPRICES = async () => {
    console.log('Lets get them COMIC secondary sales!')

    const chatgpt = new ChatGPTAPI({
        apiKey: chatGptKey,
        completionParams: {
            model: 'gpt-4-0125-preview',
        }
    })

    const batchSize = 10;
    let skip = 0;

    while(true){

        const comics = await prisma.veve_comics.findMany({
            where: {
                start_year: { lt: 2022 }
            },
            skip: skip,
            take: batchSize
        })

        if (comics.length === 0) break

        for (const comic of comics) {

            const message = `What is the average price range on secondary market sales for the physical comic book "${comic.name} #${comic.comic_number} ${comic.start_year}" ?  

Your response should only be a JSON object with the following properties: "high" (integer), "low" (integer), "source" (string). Your primary source for information should be GoCollect, but use others if needed. Source value should be a full url link or reference to where you obtained the highest value. Here's an example:
                
{
  "high": 0,
  "low": 0,
  "source": "https://example.com/test/comic/"
}`

            try {
                console.log(`Calling ChatGPT 4 for ${comic.name} #${comic.comic_number} ${comic.start_year}`);

                const salesResponse = await chatgpt.sendMessage(message)

                const responseText = salesResponse.text;

                const openingBracket = responseText.indexOf('{');
                const closingBracket = responseText.lastIndexOf('}');

                const payload = responseText.slice(openingBracket, closingBracket + 1);
                const parsedPayload = JSON.parse(payload);
                console.log('parsedPayload: ', parsedPayload);

                if(parsedPayload.high > 0) {
                    try {
                        await prisma.veve_comics_physical_sales.create({
                            data: {
                                high: parsedPayload.high,
                                low: parsedPayload.low,
                                source: parsedPayload.source,
                                unique_cover_id: comic.unique_cover_id
                            }
                        })
                        console.log(`[SUCCESS][SALES DATA][COMIC] ${comic.name} #${comic.comic_number} ${comic.start_year}`)
                    } catch (error) {
                        console.log(`[ERROR][SALES DATA][COMIC] ${comic.name} #${comic.comic_number} ${comic.start_year}`, error)
                    }
                }
            } catch (error) {
                console.log('EPIC FAIL ', error)
            }

        }

        skip += batchSize;
    }

}

VEVE_GET_SECONDARY_COMIC_SALESPRICES()