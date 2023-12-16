import {PrismaClient} from "@prisma/client";
import { ChatGPTAPI } from 'chatgpt'

const prisma = new PrismaClient()
const chatGptKey = "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"

const VEVE_GENERATE_ARTISTS_DESCRIPTIONS = async () => {
    console.log('Lets get them ARTIST descriptions!')

    const chatgpt = new ChatGPTAPI({
        apiKey: chatGptKey,
        completionParams: {
            model: 'gpt-3.5-turbo',
        }
    })

    const batchSize = 10;
    let skip = 0;

    while (true) {
        const artists = await prisma.artists.findMany({
            // where: {
            //     translations: {
            //         some: {
            //             language: "EN",
            //             content: null
            //         }
            //     }
            // },
            include: {
                translations: { where: { language: "EN" } }
            },
            skip: skip,
            take: batchSize
        })
        console.log('artists is: ', artists)
        if (artists.length === 0) break
        for (const artist of artists) {
            console.log(`Calling ChatGPT 4 for ${artist.name}`);

            const get_content_message = `write a 300-500 biography and description of artist ${artist.name}`
            const content = await chatgpt.sendMessage(get_content_message)
            console.log(`[BODY] received for ${artist.name}`)

            const get_subtitle_message = `write a subtitle for the below description: ${content.text}`
            const subtitle = await chatgpt.sendMessage(get_subtitle_message)
            console.log(`[SUBTITLE] received for ${artist.name}`)

            const get_seo_description = `write a meta_description for the description below.
                Only return the resulting text, no html, no quotes, just string text results. Try to keep it below 158 characters.
                description: ${content.text}`
            const seo_description = await chatgpt.sendMessage(get_seo_description)
            console.log(`[SEO DESC] received for ${artist.name}`)

            const get_seo_keywords = `write the meta_keywords for the article text below.
            Only return the resulting text, no html, no quotes, just string text results.
            description: ${content.text}
            `
            const seo_keywords = await chatgpt.sendMessage(get_seo_keywords)
            console.log(`[SEO KEYWORDS] received for ${artist.name}`)

            const get_seo_title = `write the seo title based on the description below. 
            Only return the resulting text, no html, no quotes, just string text result.
            description: ${content.text}`
            const seo_title = await chatgpt.sendMessage(get_seo_title)
            console.log(`[SEO TITLE] received for ${artist.name}`)

            const get_og_title = `write the og_title metadata based on the description below.
            Only return the resulting text, no html, no quote, just string text result.
            description: ${content.text}
            `
            const og_title = await chatgpt.sendMessage(get_og_title)
            console.log(`[OG TITLE] received for ${artist.name}`)

            const get_og_description = `write og_description metadata based on the description below. 
            Only return the resulting text, no html, no quotes, just string text result.
            description: ${content.text}
            `
            const og_description = await chatgpt.sendMessage(get_og_description)
            console.log(`[OG DESC] received for ${artist.name}`)

            const exisitingTranslation = await prisma.artists_translations.findUnique({
                where: {
                    language_artist_id: {
                        language: "EN",
                        artist_id: artist.artist_id
                    }
                }
            })

            if (exisitingTranslation){
                await prisma.artists_translations.update({
                    where: {
                        language_artist_id: {
                            language: "EN",
                            artist_id: artist.artist_id
                        }
                    },
                    data: {
                        content: content.text,
                        subtitle: subtitle.text,
                        seo_description: seo_description.text,
                        seo_keywords: seo_keywords.text,
                        seo_title: seo_title.text,
                        og_title: og_title.text,
                        og_description: og_description.text
                    }
                })
            } else {
                await prisma.artists_translations.create({
                    data: {
                        artist_id: artist.artist_id,
                        content: content.text,
                        subtitle: subtitle.text,
                        seo_description: seo_description.text,
                        seo_keywords: seo_keywords.text,
                        seo_title: seo_title.text,
                        og_title: og_title.text,
                        og_description: og_description.text,
                        language: "EN"
                    }
                })
            }

            console.log(`[SAVED] Created translation for the artist ${artist.name}`)

            await new Promise(resolve => setTimeout(resolve, 2000));

        }
        skip += batchSize;
    }

}

const VEVE_GENERATE_ARTISTS_GRAILS = async () => {
    console.log('Lets get them GRAILS!')

    const chatgpt = new ChatGPTAPI({
        apiKey: chatGptKey,
        completionParams: {
            model: 'gpt-4',
        }
    })

    const batchSize = 10;
    let skip = 0;

    while (true) {
        const artists = await prisma.artists.findMany({
            skip,
            take: batchSize
        })
        console.log('artists is: ', artists)
        if (artists.length === 0) break
        for (const artist of artists) {
            console.log(`Calling ChatGPT 4 for ${artist.name} grails`)

            const message = `
                Write a list of the most notable comics that ${artist.name} contributed to. Descriptions should be around 350 characters in length.  Each item should be an object with the following properties: "title" (string), "number" (integer), "year" (integer), and "description" (string). Here's an example:
                
                {
                  "title": "The comic title",
                  "number": 1,
                  "year": 2000,
                  "description": "Short description of the comic book"
                }
                
                Please ensure these objects are in an array.
                `

            const grailsResponse = await chatgpt.sendMessage(message)
            console.log(`[GRAILS] received for ${artist.name}`)

            const responseText = grailsResponse.text;
            const openingBracket = responseText.indexOf('[');
            const closingBracket = responseText.lastIndexOf(']');

            const jsonArray = responseText.slice(openingBracket, closingBracket + 1);
            let grails;
            try {
                grails = JSON.parse(jsonArray);
                if (Array.isArray(grails)) {
                    if (!grails.every((grail) => typeof grail === "object")) {
                        console.error("The array contains non-object elements for " + artist.name);
                        continue;
                    }
                } else {
                    console.error("Received response is not an array for " + artist.name);
                    continue;
                }
            } catch (err) {
                console.error("Failed to parse response for " + artist.name);
                continue;
            }

            for (let grail of grails) {
                const comic = await prisma.veve_comics.findFirst({
                    where: {
                        AND: [
                            {
                                name: {
                                    equals: grail.title,
                                },
                            },
                            {
                                comic_number: parseInt(grail.number),
                            },
                        ],
                    },
                });

                if (comic && comic.length > 0) console.log(`[${artist.name}][MATCHED] - [GRAIL TITLE] ${grail.title} - [COMIC NAME] ${comic.name}`)

                try {
                    await prisma.artists_grails.create({
                        data: {
                            title: grail.title,
                            description: grail.description,
                            year: grail.year,
                            number: String(grail.number),
                            artist_id: artist.artist_id,
                            unique_cover_id: comic?.unique_cover_id
                        }
                    });
                } catch (e) {
                    console.log('[ERROR] Unable to save grails for artist: ', artist.name)
                }

            }

            console.log(`[SAVED][GRAILS] for the character ${artist.name}`)

            await new Promise(resolve => setTimeout(resolve, 2000));

        }
        skip += batchSize;
    }
}

const VEVE_GENERATE_CHARACTER_DESCRIPTIONS = async () => {
    console.log('Lets get them CHARACTER descriptions!')

    const chatgpt = new ChatGPTAPI({
        apiKey: chatGptKey,
        completionParams: {
            model: 'gpt-3.5-turbo',
        }
    })

    const batchSize = 10;
    let skip = 0;

    while (true) {
        const characters = await prisma.characters.findMany({
            where: {
                translations: {
                    none: {}
                }
            },
            include: {
                translations: { where: { language: "EN" } }
            },
            skip: skip,
            take: batchSize
        })
        console.log('characters is: ', characters)
        if (characters.length === 0) break
        for (const character of characters) {
            console.log(`Calling ChatGPT 4 for ${character.name}`);

            const get_content_message = `write a 300-500 biography and description of comic book character ${character.name}`
            const content = await chatgpt.sendMessage(get_content_message)
            console.log(`[BODY] received for ${character.name}`)

            const get_subtitle_message = `write a subtitle for the below description: ${content.text}`
            const subtitle = await chatgpt.sendMessage(get_subtitle_message)
            console.log(`[SUBTITLE] received for ${character.name}`)

            const get_seo_description = `write a meta_description for the description below.
                Only return the resulting text, no html, no quotes, just string text results. Try to keep it below 158 characters.
                description: ${content.text}`
            const seo_description = await chatgpt.sendMessage(get_seo_description)
            console.log(`[SEO DESC] received for ${character.name}`)

            const get_seo_keywords = `write the meta_keywords for the article text below.
            Only return the resulting text, no html, no quotes, just string text results.
            description: ${content.text}
            `
            const seo_keywords = await chatgpt.sendMessage(get_seo_keywords)
            console.log(`[SEO KEYWORDS] received for ${character.name}`)

            const get_seo_title = `write the seo title based on the description below. 
            Only return the resulting text, no html, no quotes, just string text result.
            description: ${content.text}`
            const seo_title = await chatgpt.sendMessage(get_seo_title)
            console.log(`[SEO TITLE] received for ${character.name}`)

            const get_og_title = `write the og_title metadata based on the description below.
            Only return the resulting text, no html, no quote, just string text result.
            description: ${content.text}
            `
            const og_title = await chatgpt.sendMessage(get_og_title)
            console.log(`[OG TITLE] received for ${character.name}`)

            const get_og_description = `write og_description metadata based on the description below. 
            Only return the resulting text, no html, no quotes, just string text result.
            description: ${content.text}
            `
            const og_description = await chatgpt.sendMessage(get_og_description)
            console.log(`[OG DESC] received for ${character.name}`)

            // const get_grails = `return only a json object of the most notable comics that feature ${character.name}. include the comic book title, comic book number, comic book year and description. only return the array of objects.`
            // const grails = await chatgpt.sendMessage(get_grails)
            // console.log(`[GRAILS] received for ${character.name}`)

            const exisitingTranslation = await prisma.characters_translations.findUnique({
                where: {
                    language_character_id: {
                        language: "EN",
                        character_id: character.character_id
                    }
                }
            })

            if (exisitingTranslation){
                await prisma.characters_translations.update({
                    where: {
                        language_character_id: {
                            language: "EN",
                            character_id: character.character_id
                        }
                    },
                    data: {
                        content: content.text,
                        subtitle: subtitle.text,
                        seo_description: seo_description.text,
                        seo_keywords: seo_keywords.text,
                        seo_title: seo_title.text,
                        og_title: og_title.text,
                        og_description: og_description.text,
                        // grails: grails.text
                    }
                })
            } else {
                await prisma.characters_translations.create({
                    data: {
                        character_id: character.character_id,
                        content: content.text,
                        subtitle: subtitle.text,
                        seo_description: seo_description.text,
                        seo_keywords: seo_keywords.text,
                        seo_title: seo_title.text,
                        og_title: og_title.text,
                        og_description: og_description.text,
                        // grails: grails.text,
                        language: "EN"
                    }
                })
            }

            console.log(`[SAVED] Created translation for the character ${character.name}`)

            await new Promise(resolve => setTimeout(resolve, 2000));

        }
        skip += batchSize;
    }

}

const VEVE_GENERATE_CHARACTER_GRAILS = async () => {
    console.log('Lets get them GRAILS!')

    const chatgpt = new ChatGPTAPI({
        apiKey: chatGptKey,
        completionParams: {
            model: 'gpt-4',
        }
    })

    const batchSize = 10;
    let skip = 0;

    while (true) {
        const characters = await prisma.characters.findMany({
            skip,
            take: batchSize
        })
        console.log('characters is: ', characters)
        if (characters.length === 0) break
        for (const character of characters) {
            console.log(`Calling ChatGPT 4 for ${character.name} grails`)

            const message = `
                Write a list of the most notable comics that feature ${character.name}. Each item should be an object with the following properties: "title" (string), "number" (integer), "year" (integer), and "description" (string). Here's an example:
                
                {
                  "title": "The comic title",
                  "number": 1,
                  "year": 2000,
                  "description": "Short description of the comic book"
                }
                
                Please ensure these objects are in an array.
                `

            const grailsResponse = await chatgpt.sendMessage(message)
            console.log(`[GRAILS] received for ${character.name}`)

            const responseText = grailsResponse.text;
            const openingBracket = responseText.indexOf('[');
            const closingBracket = responseText.lastIndexOf(']');

            const jsonArray = responseText.slice(openingBracket, closingBracket + 1);
            let grails;
            try {
                grails = JSON.parse(jsonArray);
                if (Array.isArray(grails)) {
                    if (!grails.every((grail) => typeof grail === "object")) {
                        console.error("The array contains non-object elements for " + character.name);
                        continue;
                    }
                } else {
                    console.error("Received response is not an array for " + character.name);
                    continue;
                }
            } catch (err) {
                console.error("Failed to parse response for " + character.name);
                continue;
            }

            for (let grail of grails) {
                const comic = await prisma.veve_comics.findFirst({
                    where: {
                        AND: [
                            {
                                name: {
                                    equals: grail.title,
                                },
                            },
                            {
                                comic_number: parseInt(grail.number),
                            },
                        ],
                    },
                });

                if (comic && comic.length > 0) console.log(`[${character.name}][MATCHED] - [GRAIL TITLE] ${grail.title} - [COMIC NAME] ${comic.name}`)

                await prisma.characters_grails.create({
                    data: {
                        title: grail.title,
                        description: grail.description,
                        year: grail.year,
                        number: String(grail.number),
                        character_id: character.character_id,
                        unique_cover_id: comic?.unique_cover_id
                    }
                });
            }

            console.log(`[SAVED][GRAILS] for the character ${character.name}`)

            await new Promise(resolve => setTimeout(resolve, 2000));

        }
        skip += batchSize;
    }
}

const VEVE_GENERATE_WRITER_DESCRIPTIONS = async () => {
    console.log('Lets get them WRITER descriptions!')

    const chatgpt = new ChatGPTAPI({
        apiKey: chatGptKey,
        completionParams: {
            model: 'gpt-3.5-turbo',
        }
    })

    const batchSize = 10;
    let skip = 0;

    while(true) {
        const writers = await prisma.writers.findMany({

            include: {
                translations: { where: { language: "EN" }}
            },
            skip: skip,
            take: batchSize
        })
        console.log('writers is: ', writers)
        if (writers.length === 0) break
        for (const writer of writers){
            console.log(`Calling ChatGPT 4 for ${writer.name}`);
            const get_content_message = `write a 300-500 biography and description of comic book writer ${writer.name}`
            const content = await chatgpt.sendMessage(get_content_message)
            console.log(`[BODY] received for ${writer.name}`)

            const get_subtitle_message = `write a subtitle for the below description: ${content.text}`
            const subtitle = await chatgpt.sendMessage(get_subtitle_message)
            console.log(`[SUBTITLE] received for ${writer.name}`)

            const get_seo_description = `write a meta_description for the description below.
                Only return the resulting text, no html, no quotes, just string text results. Try to keep it below 158 characters.
                description: ${content.text}`
            const seo_description = await chatgpt.sendMessage(get_seo_description)
            console.log(`[SEO DESC] received for ${writer.name}`)

            const get_seo_keywords = `write the meta_keywords for the article text below.
            Only return the resulting text, no html, no quotes, just string text results.
            description: ${content.text}
            `
            const seo_keywords = await chatgpt.sendMessage(get_seo_keywords)
            console.log(`[SEO KEYWORDS] received for ${writer.name}`)

            const get_seo_title = `write the seo title based on the description below. 
            Only return the resulting text, no html, no quotes, just string text result.
            description: ${content.text}`
            const seo_title = await chatgpt.sendMessage(get_seo_title)
            console.log(`[SEO TITLE] received for ${writer.name}`)

            const get_og_title = `write the og_title metadata based on the description below.
            Only return the resulting text, no html, no quote, just string text result.
            description: ${content.text}
            `
            const og_title = await chatgpt.sendMessage(get_og_title)
            console.log(`[OG TITLE] received for ${writer.name}`)

            const get_og_description = `write og_description metadata based on the description below. 
            Only return the resulting text, no html, no quotes, just string text result.
            description: ${content.text}
            `
            const og_description = await chatgpt.sendMessage(get_og_description)
            console.log(`[OG DESC] received for ${writer.name}`)

            const exisitingTranslation = await prisma.writers_translations.findUnique({
                where: {
                    language_author_id: {
                        language: "EN",
                        author_id: writer.author_id
                    }
                }
            })

            if (exisitingTranslation){
                await prisma.writers_translations.update({
                    where: {
                        language_author_id: {
                            language: "EN",
                            author_id: writer.author_id
                        }
                    },
                    data: {
                        content: content.text,
                        subtitle: subtitle.text,
                        seo_description: seo_description.text,
                        seo_keywords: seo_keywords.text,
                        seo_title: seo_title.text,
                        og_title: og_title.text,
                        og_description: og_description.text,
                        // grails: grails.text
                    }
                })
            } else {
                await prisma.writers_translations.create({
                    data: {
                        author_id: writer.author_id,
                        content: content.text,
                        subtitle: subtitle.text,
                        seo_description: seo_description.text,
                        seo_keywords: seo_keywords.text,
                        seo_title: seo_title.text,
                        og_title: og_title.text,
                        og_description: og_description.text,
                        // grails: grails.text,
                        language: "EN"
                    }
                })
            }
            console.log(`[SAVED] Created translation for the character ${writer.name}`)

            await new Promise(resolve => setTimeout(resolve, 2000));

        }
        skip += batchSize;
    }
}

// VEVE_GENERATE_ARTISTS_DESCRIPTIONS().then(r => console.log('[FINISHED]'))

// VEVE_GENERATE_CHARACTER_DESCRIPTIONS().then(r => console.log('[FINISHED]'))

// VEVE_GENERATE_CHARACTER_GRAILS().then(r => console.log('[FINISHED]'))

// VEVE_GENERATE_ARTISTS_GRAILS().then(r => console.log('[FINISHED]'))

VEVE_GENERATE_WRITER_DESCRIPTIONS().then(r => console.log('[FINISHED]'))