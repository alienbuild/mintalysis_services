import fetch from 'node-fetch'
import slugify from 'slugify'
import * as Queries from "../../queries/getVeveLatestBrandsQuery.js";
import {prisma} from "../../index.js";

export const VEVE_GET_LATEST_BRANDS = async () => {
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
            query: Queries.getVeveLatestBrandsQuery(),
        }),
    })
        .then(latest_brands => latest_brands.json())
        .then(async latest_brands => {

            const brandList = latest_brands.data.brandList.edges
            brandList.map(async (brand) => {
                try {
                    await prisma.brands.upsert({
                        where: {
                            brand_id: brand.node.id,
                        },
                        update: {
                            name: brand.node.name,
                            description: brand.node.description,
                            landscape_image_url: brand.node.landscapeImage?.url,
                            landscape_image_thumbnail_url: brand.node.landscapeImage?.thumbnailUrl,
                            landscape_image_low_resolution_url: brand.node.landscapeImage?.lowResolutionUrl,
                            landscape_image_med_resolution_url: brand.node.landscapeImage?.medResolutionUrl,
                            landscape_image_full_resolution_url: brand.node.landscapeImage?.fullResolutionUrl,
                            landscape_image_high_resolution_url: brand.node.landscapeImage?.highResolutionUrl,
                            landscape_image_direction: brand.node.landscapeImage?.direction,
                            square_image_url: brand.node.squareImage?.url,
                            square_image_thumbnail_url: brand.node.squareImage?.thumbnailUrl,
                            square_image_low_resolution_url: brand.node.squareImage?.lowResolutionUrl,
                            square_image_med_resolution_url: brand.node.squareImage?.medResolutionUrl,
                            square_image_full_resolution_url: brand.node.squareImage?.fullResolutionUrl,
                            square_image_high_resolution_url: brand.node.squareImage?.highResolutionUrl,
                            square_image_direction: brand.node.squareImage?.direction,
                            licensor_id: brand.node.licensor?.id,
                            slug: slugify(`${brand.node.name}` ,{ lower: true, strict: true })
                        },
                        create: {
                            brand_id: brand.node.id,
                            name: brand.node.name,
                            description: brand.node.description,
                            landscape_image_url: brand.node.landscapeImage?.url,
                            landscape_image_thumbnail_url: brand.node.landscapeImage?.thumbnailUrl,
                            landscape_image_low_resolution_url: brand.node.landscapeImage?.lowResolutionUrl,
                            landscape_image_med_resolution_url: brand.node.landscapeImage?.medResolutionUrl,
                            landscape_image_full_resolution_url: brand.node.landscapeImage?.fullResolutionUrl,
                            landscape_image_high_resolution_url: brand.node.landscapeImage?.highResolutionUrl,
                            landscape_image_direction: brand.node.landscapeImage?.direction,
                            square_image_url: brand.node.squareImage?.url,
                            square_image_thumbnail_url: brand.node.squareImage?.thumbnailUrl,
                            square_image_low_resolution_url: brand.node.squareImage?.lowResolutionUrl,
                            square_image_med_resolution_url: brand.node.squareImage?.medResolutionUrl,
                            square_image_full_resolution_url: brand.node.squareImage?.fullResolutionUrl,
                            square_image_high_resolution_url: brand.node.squareImage?.highResolutionUrl,
                            square_image_direction: brand.node.squareImage?.direction,
                            licensor_id: brand.node.licensor?.id,
                            slug: slugify(`${brand.node.name}` ,{ lower: true, strict: true })
                        }
                    })
                } catch (e) {
                    console.log(`[ALICE][VEVE] - [GET LATEST BRANDS]: ${brand.node.name} was not added to prisma db.`, e)
                }
            })

        })
        .catch(err => console.log('[CRITICAL ERROR][VEVE][BRANDS] Unable to get latest brands. ', err))

}