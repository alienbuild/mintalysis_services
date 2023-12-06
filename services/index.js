import * as schedule from "node-schedule"
import {UPDATE_USER_STATUS} from "./MINTALYSIS/UPDATE_USER_STATUS.js";
import {VEVE_GET_COMIC_FLOORS} from "./VEVE/VEVE_GET_COMIC_FLOORS.js";
import {VEVE_GET_COLLECTIBLE_FLOORS} from "./VEVE/VEVE_GET_COLLECTIBLE_FLOORS.js";
import {VEVE_GET_LATEST_LICENSORS} from "./VEVE/VEVE_GET_LATEST_LICENSORS.js";
import {VEVE_GET_LATEST_BRANDS} from "./VEVE/VEVE_GET_LATEST_BRANDS.js";
import {VEVE_GET_LATEST_SERIES} from "./VEVE/VEVE_GET_LATEST_SERIES.js";
import {VEVE_GET_LATEST_COLLECTIBLES} from "./VEVE/VEVE_GET_LATEST_COLLECTIBLES.js";
import {VEVE_GET_LATEST_COMICS} from "./VEVE/VEVE_GET_LATEST_COMICS.js";
import {VEVE_CALCULATE_BRANDS_METRICS} from "./VEVE/VEVE_CALCULATE_BRANDS_METRICS.js";
import {VEVE_CALCULATE_LICENSORS_METRICS} from "./VEVE/VEVE_CALCULATE_LICENSORS_METRICS.js";
import {VEVE_CALCULATE_SERIES_METRICS} from "./VEVE/VEVE_CALCULATE_SERIES_METRICS.js";

// import {GET_SOCIAL_STATS, SCRAPE_X_DOT_COM, X_DAILY_SNAPSHOT} from "./SOCIAL";


// export const scheduleLiveJobs = () => {
//     startTask('./services/_ENGINES/VEVE_ASSETS.js', 'GET_VEVE_ASSETS_TASK');
//     startTask('./services/_ENGINES/VEVE_GET_TRANSACTIONS.js', 'GET_VEVE_TRANSACTIONS_TASK');
// }

// export const scheduledMinuteJobs = async (prisma) => {
//     schedule.scheduleJob('05 * * * *', async () => {
//         await UPDATE_USER_STATUS(prisma)
//     })
// }

const scheduledHourlyJobs = async () => {
    schedule.scheduleJob('01 */30 * * * *', async () => {
        try {

            // UPDATE YOUTUBE/INSTA SOCIAL STATS
            // await GET_SOCIAL_STATS()

            // GET LATEST X POSTS
            // await SCRAPE_X_DOT_COM()

            // VEVE GET LATEST LICENSORS
            await VEVE_GET_LATEST_LICENSORS()
            console.log('[SUCCESS] VEVE GET LATEST LICENSORS COMPLETED.')

            // VEVE GET LATEST BRANDS
            await VEVE_GET_LATEST_BRANDS()
            console.log('[SUCCESS] VEVE GET LATEST BRANDS COMPLETED.')

            // VEVE GET LATEST SERIES
            await VEVE_GET_LATEST_SERIES()
            console.log('[SUCCESS] VEVE GET LATEST SERIES COMPLETED.')

            // VEVE GET LATEST COLLECTIBLES
            await VEVE_GET_LATEST_COLLECTIBLES()
            console.log('[SUCCESS] VEVE GET LATEST COLLECTIBLES COMPLETED.')

            // VEVE GET LATEST COMICS
            await VEVE_GET_LATEST_COMICS()
            console.log('[SUCCESS] VEVE GET LATEST COMICS COMPLETED.')

            // VEVE GET COMIC FLOOR PRICES
            await VEVE_GET_COMIC_FLOORS()
            console.log('[SUCCESS] VEVE GET COMIC FLOORS COMPLETED.')

            // VEVE GET COLLECTIBLE FLOOR PRICES
            await VEVE_GET_COLLECTIBLE_FLOORS()
            console.log('[SUCCESS] VEVE GET COLLECTIBLES FLOORS COMPLETED.')

            // VEVE CALCULATE BRAND METRICS
            await VEVE_CALCULATE_BRANDS_METRICS()
            console.log('[SUCCESS] VEVE BRAND METRICS HAS BEEN RECALCULATED')

            // VEVE CALCULATE LICENSOR METRICS
            await VEVE_CALCULATE_LICENSORS_METRICS()
            console.log('[SUCCESS] VEVE LICENSOR METRICS HAS BEEN RECALCULATED')

            // VEVE CALCULATE SERIES METRICS
            await VEVE_CALCULATE_SERIES_METRICS()
            console.log('[SUCCESS] VEVE SERIES METRICS HAS BEEN RECALCULATED')

        } catch (error) {
            console.error('Error in scheduled job:', error);
        }
    })
}

// const scheduledDailyJobs = (prisma) => {
//     schedule.scheduleJob("0 0 * * *", async (prisma) => {
//         // X SOCIAL STATISTICS DAILY SNAPSHOT
//         // await X_DAILY_SNAPSHOT(prisma)
//     })
// }

export { scheduledHourlyJobs }