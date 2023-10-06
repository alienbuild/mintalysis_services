import fetch from 'node-fetch'
import slugify from 'slugify'
import * as Queries from "../../queries/getVeveLatestSeriesQuery.js";

export const VEVE_GET_LATEST_SERIES = async (prisma) => {

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
            query: Queries.getVeveLatestSeriesQuery(),
        }),
    })
        .then(latest_series => latest_series.json())
        .then(async latest_series => {

            const seriesList = latest_series.data.seriesList.edges
            seriesList.map(async (series) => {

                try {
                    await prisma.veve_series.upsert({
                        where: {
                            series_id: series.node.id,
                        },
                        update: {
                            name: series.node.name,
                            description: series.node.description,
                            season: series.node.season,
                            is_blindbox: series.node.isBlindbox,
                            theme_logo_image_url: series.node.themeLogoImage?.url,
                            theme_logo_image_thumbnail_url: series.node.themeLogoImage?.thumbnailUrl,
                            theme_logo_image_low_resolution_url: series.node.themeLogoImage?.lowResolutionUrl,
                            theme_logo_image_med_resolution_url: series.node.themeLogoImage?.medResolutionUrl,
                            theme_logo_image_full_resolution_url: series.node.themeLogoImage?.fullResolutionUrl,
                            theme_logo_image_high_resolution_url: series.node.themeLogoImage?.highResolutionUrl,
                            theme_logo_image_direction: series.node.themeLogoImage?.direction,
                            theme_background_image_url: series.node.themeBackgroundImage?.url,
                            theme_background_image_thumbnail_url: series.node.themeBackgroundImage?.thumbnailUrl,
                            theme_background_image_low_resolution_url: series.node.themeBackgroundImage?.lowResolutionUrl,
                            theme_background_image_med_resolution_url: series.node.themeBackgroundImage?.medResolutionUrl,
                            theme_background_image_full_resolution_url: series.node.themeBackgroundImage?.fullResolutionUrl,
                            theme_background_image_high_resolution_url: series.node.themeBackgroundImage?.highResolutionUrl,
                            theme_background_image_direction: series.node.themeBackgroundImage?.direction,
                            theme_footer_image_url: series.node.themeFooterImage?.url,
                            theme_footer_image_thumbnail_url: series.node.themeFooterImage?.thumbnailUrl,
                            theme_footer_image_low_resolution_url: series.node.themeFooterImage?.lowResolutionUrl,
                            theme_footer_image_med_resolution_url: series.node.themeFooterImage?.medResolutionUrl,
                            theme_footer_image_full_resolution_url: series.node.themeFooterImage?.fullResolutionUrl,
                            theme_footer_image_high_resolution_url: series.node.themeFooterImage?.highResolutionUrl,
                            theme_footer_image_direction: series.node.themeFooterImage?.direction,
                            landscape_image_url: series.node.landscapeImage?.url,
                            landscape_image_thumbnail_url: series.node.landscapeImage?.thumbnailUrl,
                            landscape_image_low_resolution_url: series.node.landscapeImage?.lowResolutionUrl,
                            landscape_image_med_resolution_url: series.node.landscapeImage?.medResolutionUrl,
                            landscape_image_full_resolution_url: series.node.landscapeImage?.fullResolutionUrl,
                            landscape_image_high_resolution_url: series.node.landscapeImage?.highResolutionUrl,
                            landscape_image_direction: series.node.landscapeImage?.direction,
                            square_image_url: series.node.squareImage?.url,
                            square_image_thumbnail_url: series.node.squareImage?.thumbnailUrl,
                            square_image_low_resolution_url: series.node.squareImage?.lowResolutionUrl,
                            square_image_med_resolution_url: series.node.squareImage?.medResolutionUrl,
                            square_image_full_resolution_url: series.node.squareImage?.fullResolutionUrl,
                            square_image_high_resolution_url: series.node.squareImage?.highResolutionUrl,
                            square_image_direction: series.node.squareImage?.direction,
                            licensor_id: series.node.licensor?.id,
                            brand_id: series.node.brand?.id,
                            slug: slugify(`${series.node.name}` ,{ lower: true, strict: true })
                        },
                        create: {
                            series_id: series.node.id,
                            name: series.node.name,
                            description: series.node.description,
                            season: series.node.season,
                            is_blindbox: series.node.isBlindbox,
                            theme_logo_image_url: series.node.themeLogoImage?.url,
                            theme_logo_image_thumbnail_url: series.node.themeLogoImage?.thumbnailUrl,
                            theme_logo_image_low_resolution_url: series.node.themeLogoImage?.lowResolutionUrl,
                            theme_logo_image_med_resolution_url: series.node.themeLogoImage?.medResolutionUrl,
                            theme_logo_image_full_resolution_url: series.node.themeLogoImage?.fullResolutionUrl,
                            theme_logo_image_high_resolution_url: series.node.themeLogoImage?.highResolutionUrl,
                            theme_logo_image_direction: series.node.themeLogoImage?.direction,
                            theme_background_image_url: series.node.themeBackgroundImage?.url,
                            theme_background_image_thumbnail_url: series.node.themeBackgroundImage?.thumbnailUrl,
                            theme_background_image_low_resolution_url: series.node.themeBackgroundImage?.lowResolutionUrl,
                            theme_background_image_med_resolution_url: series.node.themeBackgroundImage?.medResolutionUrl,
                            theme_background_image_full_resolution_url: series.node.themeBackgroundImage?.fullResolutionUrl,
                            theme_background_image_high_resolution_url: series.node.themeBackgroundImage?.highResolutionUrl,
                            theme_background_image_direction: series.node.themeBackgroundImage?.direction,
                            theme_footer_image_url: series.node.themeFooterImage?.url,
                            theme_footer_image_thumbnail_url: series.node.themeFooterImage?.thumbnailUrl,
                            theme_footer_image_low_resolution_url: series.node.themeFooterImage?.lowResolutionUrl,
                            theme_footer_image_med_resolution_url: series.node.themeFooterImage?.medResolutionUrl,
                            theme_footer_image_full_resolution_url: series.node.themeFooterImage?.fullResolutionUrl,
                            theme_footer_image_high_resolution_url: series.node.themeFooterImage?.highResolutionUrl,
                            theme_footer_image_direction: series.node.themeFooterImage?.direction,
                            landscape_image_url: series.node.landscapeImage?.url,
                            landscape_image_thumbnail_url: series.node.landscapeImage?.thumbnailUrl,
                            landscape_image_low_resolution_url: series.node.landscapeImage?.lowResolutionUrl,
                            landscape_image_med_resolution_url: series.node.landscapeImage?.medResolutionUrl,
                            landscape_image_full_resolution_url: series.node.landscapeImage?.fullResolutionUrl,
                            landscape_image_high_resolution_url: series.node.landscapeImage?.highResolutionUrl,
                            landscape_image_direction: series.node.landscapeImage?.direction,
                            square_image_url: series.node.squareImage?.url,
                            square_image_thumbnail_url: series.node.squareImage?.thumbnailUrl,
                            square_image_low_resolution_url: series.node.squareImage?.lowResolutionUrl,
                            square_image_med_resolution_url: series.node.squareImage?.medResolutionUrl,
                            square_image_full_resolution_url: series.node.squareImage?.fullResolutionUrl,
                            square_image_high_resolution_url: series.node.squareImage?.highResolutionUrl,
                            square_image_direction: series.node.squareImage?.direction,
                            licensor_id: series.node.licensor?.id,
                            brand_id: series.node.brand?.id,
                            slug: slugify(`${series.node.name}` ,{ lower: true, strict: true })
                        }
                    })
                } catch (e) {
                    // console.log(`[FAIL][VEVE][SERIES]: ${series.node.name} was not added to prisma db.`)
                } finally {
                    console.log('[SUCCESS] VEVE LATEST SERIES UPDATED')
                }

            })

        })
        .catch(err => console.log('[ERROR][VEVE][SERIES] Unable to get latest series. ', err))
}

