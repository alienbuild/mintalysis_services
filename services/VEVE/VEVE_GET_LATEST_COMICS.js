import fetch from 'node-fetch'
import { customAlphabet } from 'nanoid/non-secure'
import slugify from 'slugify'
import {getVevelatestComicsQuery} from "../../queries/getVevelatestComicsQuery";

export const VEVE_GET_LATEST_COMICS = async (prisma) => {
    console.log('GETTING LATEST COMICS')
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
            query: getVevelatestComicsQuery(),
        }),
    })
        .then(latest_comics => latest_comics.json())
        .then(async latest_comics => {

            const marketListingByComicCover = latest_comics.data.marketListingByComicCover.edges

            marketListingByComicCover.map(async (comic) => {
                let writersArr = []
                let artistsArr = []
                let charactersArr = []

                comic.node.comicType.writers.edges.map(async (writer) => {
                    writersArr.push({
                        where: { author_id: writer.node.id },
                        create: { author_id: writer.node.id, name: writer.node.name },
                    })
                })

                comic.node.comicType.artists.edges.map(async (artist) => {
                    artistsArr.push({
                        where: { artist_id: artist.node.id },
                        create: { artist_id: artist.node.id, name: artist.node.name },
                    })
                })

                comic.node.comicType.characters.edges.map(async (character) => {
                    charactersArr.push({
                        where: { character_id: character.node.id },
                        create: { character_id: character.node.id, name: character.node.name },
                    })
                })

                const reComic = /comic_cover\.([a-f\d-]+)\./;
                const comicMatch = comic.node.image.fullResolutionUrl.match(reComic);
                const comic_image_url_id = comicMatch[1];
                const nanoid = customAlphabet('1234567890abcdef', 5)
                const slug = slugify(`${comic.node.comicType.name} ${comic.node.comicType.comicNumber} ${comic.node.rarity} ${comic.node.comicType.startYear} ${nanoid()}`,{ lower: true, strict: true })
                const mcp_rarity_value = comic.node.rarity === 'COMMON' ? .25 : comic.node.rarity === 'UNCOMMON' ? .5 : comic.node.rarity === 'RARE' ? 2.0 : comic.node.rarity === 'ULTRA_RARE' ? 3.0 : comic.node.rarity === 'SECRET_RARE' ? 6.0 : NULL

                try {
                    await prisma.veve_comics.upsert({
                        where: {
                            unique_cover_id: comic.node.image.id,
                        },
                        update: {
                            comic_id: comic.node.comicType.id,
                            mcp_rarity_value: mcp_rarity_value,
                            comic_image_url_id: comic_image_url_id,
                            name: comic.node.comicType.name,
                            rarity: comic.node.rarity,
                            description: comic.node.comicType.description,
                            comic_number: Number(comic.node.comicType.comicNumber),
                            comic_series_id: comic.node.comicType.comicSeries.id,
                            image_thumbnail: comic.node.image.thumbnailUrl,
                            image_low_resolution_url: comic.node.image.lowResolutionUrl,
                            image_med_resolution_url: comic.node.image.medResolutionUrl,
                            image_full_resolution_url: comic.node.image.fullResolutionUrl,
                            image_high_resolution_url: comic.node.image.highResolutionUrl,
                            image_direction: comic.node.image.direction,
                            drop_date: comic.node.comicType.dropDate,
                            drop_method: comic.node.comicType.dropMethod,
                            start_year: comic.node.comicType.startYear,
                            page_count: comic.node.comicType.pageCount,
                            store_price: comic.node.comicType.storePrice,
                            publisher_id: comic.node.comicType.comicSeries.publisher.id,
                            market_fee: comic.node.comicType.comicSeries.publisher.marketFee,
                            total_issued: comic.node.totalIssued,
                            total_available: comic.node.comicType.totalAvailable,
                            is_free: comic.node.comicType.isFree,
                            is_unlimited: comic.node.comicType.isUnlimited,
                            writers: {
                                connectOrCreate: writersArr,
                            },
                            artists: {
                                connectOrCreate: artistsArr,
                            },
                            characters: {
                                connectOrCreate: charactersArr,
                            },
                            updatedAt: new Date(),
                            slug: slug
                        },
                        create: {
                            unique_cover_id: comic.node.image.id,
                            comic_id: comic.node.comicType.id,
                            mcp_rarity_value: mcp_rarity_value,
                            comic_image_url_id: comic_image_url_id,
                            name: comic.node.comicType.name,
                            rarity: comic.node.rarity,
                            description: comic.node.comicType.description,
                            comic_number: Number(comic.node.comicType.comicNumber),
                            comic_series_id: comic.node.comicType.comicSeries.id,
                            image_thumbnail: comic.node.image.thumbnailUrl,
                            image_low_resolution_url: comic.node.image.lowResolutionUrl,
                            image_med_resolution_url: comic.node.image.medResolutionUrl,
                            image_full_resolution_url: comic.node.image.fullResolutionUrl,
                            image_high_resolution_url: comic.node.image.highResolutionUrl,
                            image_direction: comic.node.image.direction,
                            drop_date: comic.node.comicType.dropDate,
                            drop_method: comic.node.comicType.dropMethod,
                            start_year: comic.node.comicType.startYear,
                            page_count: comic.node.comicType.pageCount,
                            store_price: comic.node.comicType.storePrice,
                            publisher_id: comic.node.comicType.comicSeries.publisher.id,
                            market_fee: comic.node.comicType.comicSeries.publisher.marketFee,
                            total_issued: comic.node.totalIssued,
                            total_available: comic.node.comicType.totalAvailable,
                            is_free: comic.node.comicType.isFree,
                            is_unlimited: comic.node.comicType.isUnlimited,
                            writers: {
                                connectOrCreate: writersArr,
                            },
                            artists: {
                                connectOrCreate: artistsArr,
                            },
                            characters: {
                                connectOrCreate: charactersArr,
                            },
                            updatedAt: new Date(),
                            slug: slug
                        }
                    })
                } catch (e) {
                    // console.log(`[FAIL][VEVE][COMIC]: ${comic.node.comicType.name} was not added to prisma db.`, e)
                } finally {
                    console.log('[SUCCESS] VEVE LATEST COMICS UPDATED')
                }

            })

        })
        .catch(err => console.log('[ERROR][VEVE] Unable to get latest comics. ', err))

}