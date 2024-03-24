import fetch from 'node-fetch'
import {customAlphabet} from 'nanoid/non-secure'
import slugify from 'slugify'
import * as Queries from "../../queries/getVevelatestCollectiblesQuery.js";
import {prisma} from "../../index.js";
import {ChatGPTAPI} from 'chatgpt'

const chatGptKey = "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"

export const VEVE_GET_LATEST_COLLECTIBLES = async () => {

    await fetch(`https://web.api.prod.veve.me/graphql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'client-name': 'alice-backend',
            'client-version': '...',
            'user-agent': 'alice-requests',
            'cookie': "veve=s%3AJcar1noXQMx0RuSr3H_FjFPKAZ-1IQmp.lc52qj%2BqOdmVjk4lTxQPeFwXpCoiH3HkdV2%2BgoJeMbw; _ga=GA1.1.1843381761.1710450036; OptanonAlertBoxClosed=2024-03-14T21:00:38.269Z; _ga_VYLZ9K4GY3=GS1.1.1710450035.1.0.1710450040.55.0.0; vv.at=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImd0eSI6WyJhdXRob3JpemF0aW9uX2NvZGUiXSwia2lkIjoieEZ4RnRIY3JpNWxFRWxia0tWNzVSTkVUTGpFIn0.eyJhdWQiOiI3MTI1ZDZmZi1jZDM4LTQwMjQtYjU4Zi1kODhmOTMzMzRmMjkiLCJleHAiOjE3MTA0OTM0MDQsImlhdCI6MTcxMDQ1MDIwNCwiaXNzIjoiaHR0cHM6Ly9hdXRoLnZldmUubWUiLCJzdWIiOiI2NjQ1MjFhOS05YmFkLTQ4YzQtOWU3NS05MGZjNGMyMmIzNjMiLCJqdGkiOiJmMTdmMzJlNS1lMDMzLTQxNjctYjhkNy0yOGJlMmQ4ZjkwM2UiLCJhcHBsaWNhdGlvbklkIjoiNzEyNWQ2ZmYtY2QzOC00MDI0LWI1OGYtZDg4ZjkzMzM0ZjI5Iiwic2NvcGUiOiJvcGVuaWQgb2ZmbGluZV9hY2Nlc3MiLCJyb2xlcyI6WyJ1c2VyIl0sInNpZCI6IjEwNTBjYmEwLWRkNjAtNDEzZC1iMTg2LWE0NTMwNDI4MmE1YiIsImF1dGhfdGltZSI6MTcxMDQ1MDIwNCwidGlkIjoiNDQ2NWEyZGUtNDdkNS00OTMxLWFlZTgtZDIyYzk4MGYyNTUxIn0.JjTfEFh8h8oSECMu9RKXHL8JcQl87PRTuhpUils3slQ5b2w792IJoDqhgBrkeDkl9X9oRG_f9Ks_LBy10ZsqoP9szix7Vae9pshLZkcWzqhCiqOi4k6i1R9AWQ2xkEr4OaXDZl1kW2Lvnfz_t2AIpaObzIKf00kkq3cawlqq3NkmnX3FDfq2Fzn-omJ24e_82BCztIKaQA13E7yeZPxQERZ8waTaq8msiKnV9DzT67ifhXQYFDPTaP1u6pNMF8hZ92J0viwusEM8Y_qSLCWHRfo8vaAsZTHPoGV7Wj_Y6PDfq9Pn36xFMsEZ0CZPjiGjAM7oDcflW7gv-hoQSvgTCQ; vv.rt=eNCVq-YKPNuNaQ7xkyMpMxLwSM2GOalzJozh5fucEs-T5F6CWK6klw; vv.at_exp=1710493403408; vv.rt_exp=1711659804408; OptanonConsent=isGpcEnabled=0&datestamp=Thu+Mar+14+2024+21%3A03%3A25+GMT%2B0000+(Greenwich+Mean+Time)&version=6.34.0&isIABGlobal=false&hosts=&consentId=23a0bf52-cef5-43d5-af82-7807c2f9dc6b&interactionCount=1&landingPath=NotLandingPage&groups=C0004%3A1%2CC0002%3A1%2CC0001%3A1%2CC0003%3A1%2CC0005%3A1&geolocation=GB%3BENG&AwaitingReconsent=false; AMP_MKTG_1034237904=JTdCJTIycmVmZXJyZXIlMjIlM0ElMjJodHRwcyUzQSUyRiUyRmF1dGgudmV2ZS5tZSUyRiUyMiUyQyUyMnJlZmVycmluZ19kb21haW4lMjIlM0ElMjJhdXRoLnZldmUubWUlMjIlN0Q=; AMP_1034237904=JTdCJTIyb3B0T3V0JTIyJTNBZmFsc2UlMkMlMjJkZXZpY2VJZCUyMiUzQSUyMmYzZGYyZmE2LTNjODUtNGRjZS04NmE2LTI5Nzc2YTBhNzAyZCUyMiUyQyUyMmxhc3RFdmVudFRpbWUlMjIlM0ExNzEwNDUwMjExNzE0JTJDJTIyc2Vzc2lvbklkJTIyJTNBMTcxMDQ1MDIwNzkzOSUyQyUyMnVzZXJJZCUyMiUzQSUyMjY2NDUyMWE5LTliYWQtNDhjNC05ZTc1LTkwZmM0YzIyYjM2MyUyMiU3RA==",
            'Csrf-Token': "3FyNFpjM-gvt8H_lMD14KQI1KKh6xh2GM3EI",
            "X-Auth-Version": "2",
            "X-Datadog-Origin": "rum",
            "X-Datadog-Parent-Id": "9034782047447161082",
            "X-Datadog-Sampled": "1",
            "X-Datadog-Sampling-Priority": "1",
            "X-Datadog-Trace-Id": "8148972651200753665"
        },
        body: JSON.stringify({
            query: Queries.getVevelatestCollectiblesQuery(),
        }),
    })
        .then(latest_collectibles => latest_collectibles.json())
        .then(async latest_collectibles => {

            const collectibleTypeList = latest_collectibles.data.collectibleTypeList.edges
            const nanoid = customAlphabet('1234567890abcdef', 5)

            for (const collectible of collectibleTypeList) {

                const slug = slugify(`${collectible.node.name} ${collectible.node.rarity} ${collectible.node.editionType} ${nanoid()}`,{ lower: true, strict: true })
                const mcp_base_value = 1
                // const mcp_rarity_value = collectible.node.rarity === 'COMMON' ? 0 : collectible.node.rarity === 'UNCOMMON' ? 0 : collectible.node.rarity === 'RARE' ? .25 : collectible.node.rarity === 'ULTRA_RARE' ? .5 : collectible.node.rarity === 'SECRET_RARE' ? 5.0 : NULL
                // const title_case_rarity = collectible.node.rarity === 'COMMON' ? 'Common' : collectible.node.rarity === 'UNCOMMON' ? 'Uncommon' : collectible.node.rarity === 'RARE' ? 'Rare' : collectible.node.rarity === 'ULTRA_RARE' ? 'Ultra Rare' : collectible.node.rarity === 'SECRET_RARE' ? 'Secret Rare' : null

                const title_case_rarity = () => {
                    switch (collectible.node.rarity) {
                        case 'COMMON':
                            return 'Common'
                        case 'UNCOMMON':
                            return 'Uncommon'
                        case 'RARE':
                            return 'Rare'
                        case 'ULTRA_RARE':
                            return 'Ultra Rare'
                        case 'SECRET_RARE':
                            return 'Secret Rare'
                        default:
                            return 'Artist Proof'
                    }
                }

                try {
                    const licensorExists = await prisma.licensors.findUnique({
                        where: {
                            licensor_id: collectible.node.licensor?.id,
                        },
                    });

                    // Create licensor if it doesn't exist
                    if (!licensorExists) {
                        await prisma.licensors.create({
                            data: {
                                licensor_id: collectible.node.licensor?.id,
                            },
                        });
                    }

                    // Check if brand exists
                    const brandExists = await prisma.brands.findUnique({
                        where: {
                                brand_id: collectible.node.brand?.id,
                        },
                    });

                    // Create brand if it doesn't exist
                    if (!brandExists) {
                        await prisma.brands.create({
                            data: {
                                licensor_id: collectible.node.licensor?.id,
                                brand_id: collectible.node.brand?.id,
                            },
                        });
                    }

                    // Check if series exists
                    const seriesExists = await prisma.veve_series.findUnique({
                        where: {
                                series_id: collectible.node.series?.id,
                        },
                    });

                    // Create series if it doesn't exist
                    if (!seriesExists) {
                        await prisma.veve_series.create({
                            data: {
                                licensor_id: collectible.node.licensor?.id,
                                brand_id: collectible.node.brand?.id,
                                series_id: collectible.node.series?.id,
                            },
                        });
                    }

                    await prisma.veve_collectibles.upsert({
                        where: {
                            collectible_id: collectible.node.id,
                        },
                        update: {
                            name: collectible.node.name,
                            mcp_base_value: mcp_base_value,
                            // mcp_rarity_value: mcp_rarity_value,
                            // mcp_total_value: mcp_base_value + mcp_rarity_value,
                            updatedAt: new Date(),
                            total_likes: collectible.node.totalLikes,
                            is_free: collectible.node.isFree,
                            store_price: collectible.node.storePrice,
                            is_unlimited: collectible.node.isUnlimited,
                            total_issued: collectible.node.totalIssued,
                            total_available: collectible.node.totalAvailable,
                            description: collectible.node.description,
                            rarity: title_case_rarity(),
                            variety: collectible.node.variety,
                            edition_type: collectible.node.editionType,
                            drop_method: collectible.node.dropMethod,
                            drop_date: collectible.node.dropDate,
                            market_fee: collectible.node.marketFee,
                            total_store_allocation: collectible.node.totalStoreAllocation,
                            background_image_url: collectible.node.backgroundImage?.url,
                            background_image_thumbnail_url: collectible.node.backgroundImage?.thumbnailUrl,
                            background_image_low_resolution_url: collectible.node.backgroundImage?.lowResolutionUrl,
                            background_image_med_resolution_url: collectible.node.backgroundImage?.medResolutionUrl,
                            background_image_full_resolution_url: collectible.node.backgroundImage?.fullResolutionUrl,
                            background_image_high_resolution_url: collectible.node.backgroundImage?.highResolutionUrl,
                            background_image_direction: collectible.node.backgroundImage?.direction,
                            image_url: collectible.node.image?.url,
                            image_thumbnail_url: collectible.node.image?.thumbnailUrl,
                            image_low_resolution_url: collectible.node.image?.lowResolutionUrl,
                            image_med_resolution_url: collectible.node.image?.medResolutionUrl,
                            image_full_resolution_url: collectible.node.image?.fullResolutionUrl,
                            image_high_resolution_url: collectible.node.image?.highResolutionUrl,
                            image_direction: collectible.node.image?.direction,
                            licensor_id: collectible.node.licensor?.id,
                            brand_id: collectible.node.brand?.id,
                            series_id: collectible.node?.series?.id,
                            slug: slug
                        },
                        create: {
                            collectible_id: collectible.node.id,
                            name: collectible.node.name,
                            mcp_base_value: mcp_base_value,
                            // mcp_rarity_value: mcp_rarity_value,
                            // mcp_total_value: mcp_base_value + mcp_rarity_value,
                            updatedAt: new Date(),
                            total_likes: collectible.node.totalLikes,
                            is_free: collectible.node.isFree,
                            store_price: collectible.node.storePrice,
                            is_unlimited: collectible.node.isUnlimited,
                            total_issued: collectible.node.totalIssued,
                            total_available: collectible.node.totalAvailable,
                            description: collectible.node.description,
                            rarity: title_case_rarity(),
                            variety: collectible.node.variety,
                            edition_type: collectible.node.editionType,
                            drop_method: collectible.node.dropMethod,
                            drop_date: collectible.node.dropDate,
                            market_fee: collectible.node.marketFee,
                            total_store_allocation: collectible.node.totalStoreAllocation,
                            background_image_url: collectible.node.backgroundImage?.url,
                            background_image_thumbnail_url: collectible.node.backgroundImage?.thumbnailUrl,
                            background_image_low_resolution_url: collectible.node.backgroundImage?.lowResolutionUrl,
                            background_image_med_resolution_url: collectible.node.backgroundImage?.medResolutionUrl,
                            background_image_full_resolution_url: collectible.node.backgroundImage?.fullResolutionUrl,
                            background_image_high_resolution_url: collectible.node.backgroundImage?.highResolutionUrl,
                            background_image_direction: collectible.node.backgroundImage?.direction,
                            image_url: collectible.node.image?.url,
                            image_thumbnail_url: collectible.node.image?.thumbnailUrl,
                            image_low_resolution_url: collectible.node.image?.lowResolutionUrl,
                            image_med_resolution_url: collectible.node.image?.medResolutionUrl,
                            image_full_resolution_url: collectible.node.image?.fullResolutionUrl,
                            image_high_resolution_url: collectible.node.image?.highResolutionUrl,
                            image_direction: collectible.node.image?.direction,
                            licensor_id: collectible.node.licensor?.id,
                            brand_id: collectible.node.brand?.id,
                            series_id: collectible.node?.series?.id,
                            slug: slug
                        }
                    })

                } catch (e) {
                    console.log(`[VEVE] - [GET LATEST COLLECTIBLES]: ${collectible.node.name} was not added to prisma db.`, e)
                }

            }

            // await checkDescriptions()
            // await checkSeoTags()

            // if (latest_collectibles.data.collectibleTypeList.pageInfo?.hasNextPage){
            //     console.log('next page is: ', latest_collectibles.data.collectibleTypeList.pageInfo.endCursor)
            // }

        })
        .catch(err => console.log('[CRITICAL ERROR][VEVE] Unable to get latest collectibles. ', err))
}

const checkDescriptions = async () => {

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
            where: {
                translations: {
                    some: {
                        language: "EN",
                        ai_description: null
                    }
                }
            },
            include: {
                brand: true,
                licensor: true,
                series: true,
                translations: {
                    where: {
                        language: "EN"
                    }
                }
            },
            skip: skip,
            take: batchSize
        })
        if (collectibles.length === 0) break;
        for (const collectible of collectibles) {
            const message = `
            write a 300 to 500 word description for the image linked below.
            ignore the background of the image and concentrate only on the collectible.
            You can also use any of the other information below to help you.
            FYI First public mint means the first mint number the public can get, all mint numbers 
            before are held by the Veve wallet. Also remove any 'used by permission' text.
            image: ${collectible.image_url}
            description: ${collectible.description}
            store price: $${collectible.store_price}
            total available at drop: ${collectible.total_issued}
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
                        description: collectible.description,
                        language: "EN",
                    },
                });
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        skip += batchSize;
    }
}
const checkSeoTags = async () => {
    const chatgpt = new ChatGPTAPI({
        apiKey: chatGptKey,
        completionParams: {
            model: 'gpt-3.5-turbo',
        }
    })
    const batchSize = 10;
    let skip = 0;
    while(true){
        const collectibles = await prisma.veve_collectibles.findMany({
            where: {
                translations: {
                    some: {
                        language: "EN",
                        seo_title: null
                    }
                }
            },
            include: {
                brand: true,
                licensor: true,
                series: true,
                translations: { where: { language: "EN" } }
            },
            skip: skip,
            take: batchSize
        })
        if (collectibles.length === 0) break;
        for (const collectible of collectibles) {
            const pre_seo_description = `
                write the meta_description meta data with a focus on collectibles for the product description below.
                Only return the resulting text, no html, no quotes, just string text results. Try to keep it below 158 characters.
                description: ${collectible.translations[0].ai_description}
                brand: ${collectible.brand.name}
                licensor: ${collectible.licensor.name}
                series: ${collectible.series.name}
            `
            const seo_description = await chatgpt.sendMessage(pre_seo_description)

            const pre_seo_keywords = `
                write the meta_keywords metadata based on the product description below. Focus on collectibles.
                Only return the resulting text, no html, no quotes, just string text results.
                description: ${collectible.translations[0].ai_description}
            `
            const seo_keywords = await chatgpt.sendMessage(pre_seo_keywords)

            const pre_seo_title = `
                write the seo title metadata based on the product title and description below. 
                Only return the resulting text, no html, no quotes, just string text results.
                title: ${collectible.name}
                description: ${collectible.ai_description}
            `
            const seo_title = await chatgpt.sendMessage(pre_seo_title)

            const pre_og_title = `
                write an og_title metadata based on the product title and description below. 
                Only return the resulting text, no html, no quotes, just string text results.
                title: ${collectible.name}
                description: ${collectible.translations[0].ai_description}
            `
            const og_title = await chatgpt.sendMessage(pre_og_title)

            const pre_og_description = `
                write an og_description metadata based on the product title and description below.
                Only return the resulting text, no html, no quotes, just string text results.
                title: ${collectible.name}
                description: ${collectible.ai_description}
            `
            const og_description = await chatgpt.sendMessage(pre_og_description)

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
                        seo_description: seo_description.text,
                        seo_keywords: seo_keywords.text,
                        seo_title: seo_title.text,
                        og_title: og_title.text,
                        og_description: og_description.text
                    },
                });
            } else {
                await prisma.veve_collectibles_translations.create({
                    data: {
                        collectible_id: collectible.collectible_id,
                        name: collectible.name,
                        edition_type: collectible.edition_type,
                        rarity: collectible.rarity,
                        seo_description: seo_description.text,
                        seo_keywords: seo_keywords.text,
                        seo_title: seo_title.text,
                        og_title: og_title.text,
                        og_description: og_description.text,
                        language: "EN",
                    },
                });
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

        }
        skip += batchSize;
    }
}
