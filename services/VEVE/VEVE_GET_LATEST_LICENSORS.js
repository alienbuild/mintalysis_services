import fetch from 'node-fetch'
import slugify from 'slugify'
import * as Queries from "../../queries/getVeveLatestLicensorsQuery.js";
import {prisma} from "../../index.js";

export const VEVE_GET_LATEST_LICENSORS = async () => {
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
            query: Queries.getVeveLatestLicensorsQuery(),
        }),
    })
        .then(latest_licensors => latest_licensors.json())
        .then(async latest_licensors => {

            const licensorList = latest_licensors.data.licensorList.edges
            licensorList.map(async (licensor) => {
                try {
                    await prisma.licensors.upsert({
                        where: {
                            licensor_id: licensor.node.id
                        },
                        update: {
                            name: licensor.node.name,
                            description: licensor.node.description,
                            market_fee: licensor.node.marketFee,
                            landscape_image_url: licensor.node.landscapeImage?.url,
                            landscape_image_thumbnail_url: licensor.node.landscapeImage?.thumbnailUrl,
                            landscape_image_low_resolution_url: licensor.node.landscapeImage?.lowResolutionUrl,
                            landscape_image_med_resolution_url: licensor.node.landscapeImage?.medResolutionUrl,
                            landscape_image_full_resolution_url: licensor.node.landscapeImage?.fullResolutionUrl,
                            landscape_image_high_resolution_url: licensor.node.landscapeImage?.highResolutionUrl,
                            landscape_image_direction: licensor.node.landscapeImage?.direction,
                            square_image_url: licensor.node.squareImage?.url,
                            square_image_thumbnail_url: licensor.node.squareImage?.thumbnailUrl,
                            square_image_low_resolution_url: licensor.node.squareImage?.lowResolutionUrl,
                            square_image_med_resolution_url: licensor.node.squareImage?.medResolutionUrl,
                            square_image_full_resolution_url: licensor.node.squareImage?.fullResolutionUrl,
                            square_image_high_resolution_url: licensor.node.squareImage?.highResolutionUrl,
                            square_image_direction: licensor.node.squareImage?.direction,
                            slug: slugify(`${licensor.node.name}` ,{ lower: true, strict: true })
                        },
                        create: {
                            licensor_id: licensor.node.id,
                            name: licensor.node.name,
                            description: licensor.node.description,
                            market_fee: licensor.node.marketFee,
                            landscape_image_url: licensor.node.landscapeImage?.url,
                            landscape_image_thumbnail_url: licensor.node.landscapeImage?.thumbnailUrl,
                            landscape_image_low_resolution_url: licensor.node.landscapeImage?.lowResolutionUrl,
                            landscape_image_med_resolution_url: licensor.node.landscapeImage?.medResolutionUrl,
                            landscape_image_full_resolution_url: licensor.node.landscapeImage?.fullResolutionUrl,
                            landscape_image_high_resolution_url: licensor.node.landscapeImage?.highResolutionUrl,
                            landscape_image_direction: licensor.node.landscapeImage?.direction,
                            square_image_url: licensor.node.squareImage?.url,
                            square_image_thumbnail_url: licensor.node.squareImage?.thumbnailUrl,
                            square_image_low_resolution_url: licensor.node.squareImage?.lowResolutionUrl,
                            square_image_med_resolution_url: licensor.node.squareImage?.medResolutionUrl,
                            square_image_full_resolution_url: licensor.node.squareImage?.fullResolutionUrl,
                            square_image_high_resolution_url: licensor.node.squareImage?.highResolutionUrl,
                            square_image_direction: licensor.node.squareImage?.direction,
                            slug: slugify(`${licensor.node.name}` ,{ lower: true, strict: true })
                        }
                    })
                } catch (e) {
                    console.log(`[VEVE] - [GET LATEST LICENSORS]: ${licensor.node.name} was not added to prisma db.`, e)
                }

            })

        })
        .catch(err => console.log('[CRITICAL ERROR][VEVE][LICENSORS] Unable to get latest licensors. ', err))

}