import * as schedule from "node-schedule"

import {GET_SOCIAL_STATS, SCRAPE_X_DOT_COM, X_DAILY_SNAPSHOT} from "./SOCIAL";

const scheduledHourlyJobs = () => {
    schedule.scheduleJob('05 * * * *', async () => {
        await GET_SOCIAL_STATS()
        await SCRAPE_X_DOT_COM()
        // VEVE_GET_COLLECTIBLE_FLOORS()
    })
    schedule.scheduleJob('08 * * * *', () => {
        // VEVE_GET_COMIC_FLOORS()
    })
    schedule.scheduleJob('18 * * * *', () => {
        // GetWalletUsernamesFromVeveCollectibles()
        // GetWalletUsernamesFromVeveComics()
    })
}

const scheduledDailyJobs = () => {
    schedule.scheduleJob("0 0 * * *", async () => {
        await X_DAILY_SNAPSHOT
        // VEVE_GET_LATEST_LICENSORS()
        // VEVE_GET_LATEST_BRANDS()
        // VEVE_GET_LATEST_SERIES()
        // VEVE_GET_LATEST_COLLECTIBLES()
        // VEVE_GET_LATEST_COMICS()
    })
}


export { scheduledHourlyJobs, scheduledDailyJobs }