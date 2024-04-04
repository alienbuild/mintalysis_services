import fetch from 'node-fetch'
import {prisma} from "../../index.js";
import * as Queries from "../../queries/getVevelatestComicsQuery.js";
import {customAlphabet} from "nanoid/non-secure";
import slugify from "slugify";
import {getVeveLatestComicsQueryNew} from "../../queries/getVevelatestComicsQuery.js";

const VEVE_GET_LATEST_COMICS_NEW = async (afterCursor = null) => {
    try {
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
                query: Queries.getVeveLatestComicsQueryNew(),
                variables: {
                    after: afterCursor,
                },
            }),
        });
        const jsonResponse = await response.json();
        const comics = jsonResponse.data.comicList.edges.map(edge => edge.node);
        console.log(`Fetched ${comics.length} comics`);

        for (const comic of comics) {
            console.log(`Processing comic: ${comic.name}`);

            let writersArr = []
            let artistsArr = []
            let charactersArr = []

            await Promise.all(comic.writers.edges.map(async (writer) => {
                writersArr.push({
                    where: { author_id: writer.node.id },
                    create: { author_id: writer.node.id, name: writer.node.name },
                })
            }))

            await Promise.all(comic.artists.edges.map(async (artist) => {
                artistsArr.push({
                    where: { artist_id: artist.node.id },
                    create: { artist_id: artist.node.id, name: artist.node.name },
                })
            }))

            await Promise.all(comic.characters.edges.map(async (character) => {
                charactersArr.push({
                    where: { character_id: character.node.id },
                    create: { character_id: character.node.id, name: character.node.name },
                })
            }))

            const nanoid = customAlphabet('1234567890abcdef', 5)
            const slug = slugify(`${comic.name} ${comic.comicNumber} ${comic.startYear} ${nanoid()}`,{ lower: true, strict: true })

            const payload = {
                id: comic.id,
                name: comic.name,
                description: comic.description,
                comic_number: Number(comic.comicNumber),
                image_thumbnail: comic.cover.image.thumbnailUrl,
                image_low_resolution_url: comic.cover.image.lowResolutionUrl,
                image_med_resolution_url: comic.cover.image.medResolutionUrl,
                image_full_resolution_url: comic.cover.image.fullResolutionUrl,
                image_high_resolution_url: comic.cover.image.highResolutionUrl,
                image_direction: comic.cover.image.direction,
                start_year: comic.startYear,
                page_count: comic.pageCount,
                minimum_age: comic.minimumAge,
                writers: {
                    connectOrCreate: writersArr,
                },
                artists: {
                    connectOrCreate: artistsArr,
                },
                characters: {
                    connectOrCreate: charactersArr,
                },
                publisher: {
                    connectOrCreate: {
                        where: { id: comic.comicSeries.publisher.id },
                        create: { id: comic.comicSeries.publisher.id, name: comic.comicSeries.publisher.name, description: comic.comicSeries.publisher.description, veve_market_fee: comic.comicSeries.publisher.marketFee, slug: slugify(comic.comicSeries.publisher.name,{ lower: true, strict: true }) }
                    }
                },
                series :{
                    connectOrCreate: {
                        where: { id: comic.comicSeries.id },
                        create: { id: comic.comicSeries.id, name: comic.comicSeries.name, description: comic.comicSeries.description, slug: slugify(comic.comicSeries.name, { lower: true, strict: true })}
                    }
                },
                updatedAt: new Date(),
                slug: slug
            }

            if (!comic.comicSeries.id) console.log(`[NO COMIC SERIES ID] for ${comic.name} - id: ${comic.id}`)

            try {
                await prisma.comics.upsert({
                    where: {
                        id: comic.id,
                    },
                    update: payload,
                    create: {
                        id: comic.id,
                        ...payload
                    }
                })

                console.log(`[SUCCESS] - ${comic.name} was added to the prisma db `)

            } catch (e) {
                console.log(`[COMICS] - [GET LATEST COMICS]: ${comic.name} was not added to prisma db.`, e)
            }

        }

        if (jsonResponse.data.comicList.pageInfo.hasNextPage) {
            console.log('Fetching more comics...');
            await VEVE_GET_LATEST_COMICS_NEW(jsonResponse.data.comicList.pageInfo.endCursor);
        } else {
            console.log('All comics have been fetched and processed.');
        }

    } catch(error) {
        console.error('Failed to fetch comics:', error);
    }

}

VEVE_GET_LATEST_COMICS_NEW()