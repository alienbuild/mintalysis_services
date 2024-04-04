import fetch from "node-fetch";
import slugify from "slugify";
import {prisma} from "../../index.js";
import {getVeveLatestComicSeriesQuery} from "../../queries/getVeveLatestComicSeriesQuery.js";

export const VEVE_GET_LATEST_COMIC_SERIES = async (afterCursor = null) => {
    console.log('[VEVE][GET LATEST COMIC SERIES]')

    const response = await fetch('https://web.api.prod.veve.me/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'client-name': 'alice-backend',
            'client-version': '...',
            'user-agent': 'alice-requests',
            'Csrf-Token': process.env.ALICE_CSRF_TOKEN,
            'X-Auth-Version': '2',
            'cookie': process.env.ALICE_COOKIE
        },
        body: JSON.stringify({
            query: getVeveLatestComicSeriesQuery(),
        }),
    });

    const jsonResponse = await response.json();
    const seriesTotal = jsonResponse.data.comicSeriesList.edges.map(edge => edge.node);
    console.log(`Fetched ${seriesTotal.length} series`);

    for (const series of seriesTotal) {
        console.log(`Processing series: ${series.name}`);

        const slug = slugify(`${series.name}}`,{ lower: true, strict: true })

        const payload = {
            name: series.name,
            description: series.description,
            slug,
            publisher: {
                connectOrCreate: {
                    where: { id: series.publisher.id },
                    create: { id: series.publisher.id, name: series.publisher.name, description: series.publisher.description, veve_market_fee: series.publisher.marketFee, slug: slugify(series.publisher.name,{ lower: true, strict: true }) }
                }
            }
        }

        try {

            await prisma.comic_series.upsert({
                where: {
                    id: series.id
                },
                update: payload,
                create: {
                    id: series.id,
                    ...payload
                }
            })

        } catch (e) {
            console.log(`[SERIES] - [GET LATEST SERIES]: ${series.name} was not added to prisma db.`, e)
        }



    }

}

VEVE_GET_LATEST_COMIC_SERIES()