import fetch from "node-fetch";
import {setTimeout} from "node:timers/promises";
import fs from "fs";
import { removeBackgroundFromImageUrl } from "remove.bg";
import tinify from 'tinify'

// REMOVE VEVE COLLECTIBLE BACKGROUNDS
export const removeCollectibleBackgrounds = async (prisma) => {
    const collectibles = await prisma.veve_collectibles.findMany({
        // where: {
        //   // drop_date: { gt: Date.now() }
        //   drop_date: { gt: moment().subtract(130, 'days').format() }
        // },
        take: 60,
        orderBy: {
            createdAt: 'desc'
        },
        select:{
            name: true,
            collectible_id: true,
            image_high_resolution_url: true
        }
    })
    await collectibles.map(async (collectible, index) => {
        await setTimeout(1000 * index)
        try {
            const url = collectible.image_high_resolution_url

            const path = `${__dirname}/images/${collectible.collectible_id}`;
            fs.mkdir(path, (error) => {})

            const outputFile = `${__dirname}/images/${collectible.collectible_id}/${collectible.collectible_id}.png`;

            removeBackgroundFromImageUrl({
                url,
                apiKey: process.env.REMOVE_BG_API_KEY,
                size: "auto",
                type: "product",
                outputFile
            }).then((result) => {
                console.log(`${collectible.name} saved to ${outputFile}`);
            }).catch((errors) => {
                console.log(JSON.stringify(errors));
            });
        } catch (e) {
            console.log('[ERROR] Unable to remove background: ', e)
        }
    })
}

// TINIFY / COMPRESS IMAGES IN const imagePath
export const tinifyImages = async () => {
    tinify.key = "k8qvNnJ14WtCtTP6FZYVXcNfgghM9WWL";

    const collectibles = await prisma.veve_collectibles.findMany({
        // where: {
        //     // drop_date: { gt: Date.now() }
        //     // drop_date: { gt: moment().subtract(130, 'days').format() }
        // },
        take: 60,
        orderBy: {
            createdAt: 'desc'
        },
        select: {
            name: true,
            collectible_id: true,
        }
    })

    await collectibles.map(async (collectible, index) => {

        // if (index > 0) return
        if (index > 60) {
            console.log(`[SKIPPING]`)
        } else {
            await setTimeout(1000 * (index - 500))

            try {

                const imagePath = `${__dirname}/images/${collectible.collectible_id}/${collectible.collectible_id}.png`
                const output = `${__dirname}/images/${collectible.collectible_id}/${collectible.collectible_id}.png`

                console.log(`[COMPRESSING] ${collectible.name} (${collectible.collectible_id})`)
                const oldStats = fs.statSync(imagePath);

                const source = tinify.fromFile(imagePath);
                await source.toFile(output);
                const newStats = fs.statSync(output);
                console.log(`${collectible.name} (${collectible.collectible_id}) file size was ${oldStats.size}. It is now: ${newStats.size}`)

            } catch (e) {
                console.log(`[ERROR] Tinify: `, e)
            }
        }

    })

}

// EXTENDED NODE FETCH (AUTO RETRIES FOR YOU)

const delay = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));

const retryFetch = (
    url,
    fetchOptions = {},
    retries = 3,
    retryDelay = 1000,
    timeout
) => {
    return new Promise((resolve, reject) => {
        // check for timeout
        if (timeout) setTimeout(() => reject('error: timeout'), timeout);

        const wrapper = (n) => {
            fetch(url, fetchOptions)
                .then((res) => resolve(res))
                .catch(async (err) => {
                    if (n > 0) {
                        await delay(retryDelay);
                        wrapper(--n);
                    } else {
                        reject(err);
                    }
                });
        };

        wrapper(retries);
    });
};