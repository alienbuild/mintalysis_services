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