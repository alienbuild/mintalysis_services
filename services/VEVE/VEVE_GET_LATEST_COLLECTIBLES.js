import fetch from 'node-fetch'
import { customAlphabet } from 'nanoid/non-secure'
import slugify from 'slugify'
import * as Queries from "../../queries/getVevelatestCollectiblesQuery.js";

export const VEVE_GET_LATEST_COLLECTIBLES = async (prisma) => {
    console.log(`[ALICE][VEVE] - [GET LATEST COLLECTIBLES]`)

    await fetch(`https://web.api.prod.veve.me/graphql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'client-name': 'alice-backend',
            'client-version': '...',
            'user-agent': 'alice-requests',
            'cookie': "veve=s%3ABBzqVcXCx-u7b2OnNrI2hQEwq14FXASo.C%2F5sObS5AunP8qIBZeqDEC3WnCnVsEdY9qMNQ%2FPGQK4"
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
                const mcp_rarity_value = collectible.node.rarity === 'COMMON' ? 0 : collectible.node.rarity === 'UNCOMMON' ? 0 : collectible.node.rarity === 'RARE' ? .25 : collectible.node.rarity === 'ULTRA_RARE' ? .5 : collectible.node.rarity === 'SECRET_RARE' ? 5.0 : NULL
                const title_case_rarity = collectible.node.rarity === 'COMMON' ? 'Common' : collectible.node.rarity === 'UNCOMMON' ? 'Uncommon' : collectible.node.rarity === 'RARE' ? 'Rare' : collectible.node.rarity === 'ULTRA_RARE' ? 'Ultra Rare' : collectible.node.rarity === 'SECRET_RARE' ? 'Secret Rare' : NULL

                try {
                    // Check if licensor exists
                    const licensorExists = await prisma.veve_licensors.findUnique({
                        where: {
                            licensor_id: collectible.node.licensor?.id,
                        },
                    });

                    // Create licensor if it doesn't exist
                    if (!licensorExists) {
                        await prisma.veve_licensors.create({
                            data: {
                                licensor_id: collectible.node.licensor?.id,
                            },
                        });
                    }

                    // Check if brand exists
                    const brandExists = await prisma.veve_brands.findUnique({
                        where: {
                                brand_id: collectible.node.brand?.id,
                        },
                    });

                    // Create brand if it doesn't exist
                    if (!brandExists) {
                        await prisma.veve_brands.create({
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
                            mcp_rarity_value: mcp_rarity_value,
                            mcp_total_value: mcp_base_value + mcp_rarity_value,
                            updatedAt: new Date(),
                            total_likes: collectible.node.totalLikes,
                            is_free: collectible.node.isFree,
                            store_price: collectible.node.storePrice,
                            is_unlimited: collectible.node.isUnlimited,
                            total_issued: collectible.node.totalIssued,
                            total_available: collectible.node.totalAvailable,
                            description: collectible.node.description,
                            rarity: title_case_rarity,
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
                            mcp_rarity_value: mcp_rarity_value,
                            mcp_total_value: mcp_base_value + mcp_rarity_value,
                            updatedAt: new Date(),
                            total_likes: collectible.node.totalLikes,
                            is_free: collectible.node.isFree,
                            store_price: collectible.node.storePrice,
                            is_unlimited: collectible.node.isUnlimited,
                            total_issued: collectible.node.totalIssued,
                            total_available: collectible.node.totalAvailable,
                            description: collectible.node.description,
                            rarity: title_case_rarity,
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
                    console.log(`[FAIL][VEVE]: ${collectible.node.name} was not added to prisma db.`, e)
                } finally {
                    console.log(`[SUCCESS] LATEST VEVE COLLECTIBLES UPDATED: ${collectible.node.name} - ${collectibleTypeList.length}`)
                }

            }

            if (latest_collectibles.data.collectibleTypeList.pageInfo?.hasNextPage){
                console.log('next page is: ', latest_collectibles.data.collectibleTypeList.pageInfo.endCursor)
            }

        })
        .catch(err => console.log('[ERROR][VEVE] Unable to get latest collectibles. '))
}