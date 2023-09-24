import * as schedule from "node-schedule"

const scheduledHourlyJobs = () => {
    schedule.scheduleJob('05 * * * *', () => {
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
    schedule.scheduleJob("0 0 * * *", () => {
        // VEVE_GET_LATEST_LICENSORS()
        // VEVE_GET_LATEST_BRANDS()
        // VEVE_GET_LATEST_SERIES()
        // VEVE_GET_LATEST_COLLECTIBLES()
        // VEVE_GET_LATEST_COMICS()
    })
}


export { scheduledHourlyJobs, scheduledDailyJobs }