import fetch from 'node-fetch'
import slugify from 'slugify'
import * as Queries from "../../queries/getVeveLatestLicensorsQuery.js";

export const VEVE_GET_LATEST_LICENSORS = async (prisma) => {
    console.log(`[ALICE][VEVE] - [GET LATEST LICENSORS]`)

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
                    await prisma.veve_licensors.upsert({
                        where: {
                            licensor_id: licensor.node.id
                        },
                        update: {
                            name: licensor.node.name,
                            description: licensor.node.description,
                            market_fee: licensor.node.marketFee,
                            theme_logo_image_url: licensor.node.themeLogoImage?.url,
                            theme_logo_image_thumbnail_url: licensor.node.themeLogoImage?.thumbnailUrl,
                            theme_logo_image_low_resolution_url: licensor.node.themeLogoImage?.lowResolutionUrl,
                            theme_logo_image_med_resolution_url: licensor.node.themeLogoImage?.medResolutionUrl,
                            theme_logo_image_full_resolution_url: licensor.node.themeLogoImage?.fullResolutionUrl,
                            theme_logo_image_high_resolution_url: licensor.node.themeLogoImage?.highResolutionUrl,
                            theme_logo_image_direction: licensor.node.themeLogoImage?.direction,
                            theme_background_image_url: licensor.node.themeBackgroundImage?.url,
                            theme_background_image_thumbnail_url: licensor.node.themeBackgroundImage?.thumbnailUrl,
                            theme_background_image_low_resolution_url: licensor.node.themeBackgroundImage?.lowResolutionUrl,
                            theme_background_image_med_resolution_url: licensor.node.themeBackgroundImage?.medResolutionUrl,
                            theme_background_image_full_resolution_url: licensor.node.themeBackgroundImage?.fullResolutionUrl,
                            theme_background_image_high_resolution_url: licensor.node.themeBackgroundImage?.highResolutionUrl,
                            theme_background_image_direction: licensor.node.themeBackgroundImage?.direction,
                            theme_footer_image_url: licensor.node.themeFooterImage?.url,
                            theme_footer_image_thumbnail_url: licensor.node.themeFooterImage?.thumbnailUrl,
                            theme_footer_image_low_resolution_url: licensor.node.themeFooterImage?.lowResolutionUrl,
                            theme_footer_image_med_resolution_url: licensor.node.themeFooterImage?.medResolutionUrl,
                            theme_footer_image_full_resolution_url: licensor.node.themeFooterImage?.fullResolutionUrl,
                            theme_footer_image_high_resolution_url: licensor.node.themeFooterImage?.highResolutionUrl,
                            theme_footer_image_direction: licensor.node.themeFooterImage?.direction,
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
                            theme_logo_image_url: licensor.node.themeLogoImage?.url,
                            theme_logo_image_thumbnail_url: licensor.node.themeLogoImage?.thumbnailUrl,
                            theme_logo_image_low_resolution_url: licensor.node.themeLogoImage?.lowResolutionUrl,
                            theme_logo_image_med_resolution_url: licensor.node.themeLogoImage?.medResolutionUrl,
                            theme_logo_image_full_resolution_url: licensor.node.themeLogoImage?.fullResolutionUrl,
                            theme_logo_image_high_resolution_url: licensor.node.themeLogoImage?.highResolutionUrl,
                            theme_logo_image_direction: licensor.node.themeLogoImage?.direction,
                            theme_background_image_url: licensor.node.themeBackgroundImage?.url,
                            theme_background_image_thumbnail_url: licensor.node.themeBackgroundImage?.thumbnailUrl,
                            theme_background_image_low_resolution_url: licensor.node.themeBackgroundImage?.lowResolutionUrl,
                            theme_background_image_med_resolution_url: licensor.node.themeBackgroundImage?.medResolutionUrl,
                            theme_background_image_full_resolution_url: licensor.node.themeBackgroundImage?.fullResolutionUrl,
                            theme_background_image_high_resolution_url: licensor.node.themeBackgroundImage?.highResolutionUrl,
                            theme_background_image_direction: licensor.node.themeBackgroundImage?.direction,
                            theme_footer_image_url: licensor.node.themeFooterImage?.url,
                            theme_footer_image_thumbnail_url: licensor.node.themeFooterImage?.thumbnailUrl,
                            theme_footer_image_low_resolution_url: licensor.node.themeFooterImage?.lowResolutionUrl,
                            theme_footer_image_med_resolution_url: licensor.node.themeFooterImage?.medResolutionUrl,
                            theme_footer_image_full_resolution_url: licensor.node.themeFooterImage?.fullResolutionUrl,
                            theme_footer_image_high_resolution_url: licensor.node.themeFooterImage?.highResolutionUrl,
                            theme_footer_image_direction: licensor.node.themeFooterImage?.direction,
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
                    // console.log(`[FAIL][VEVE][LICENSORS]: ${licensor.node.name} was not added to prisma db.`)
                } finally {
                    console.log('[SUCCESS] VEVE LATEST LICENSORS UPDATED')
                }

            })

        })
        .catch(err => console.log('[ERROR][VEVE][LICENSORS] Unable to get latest licensors. ', err))

}