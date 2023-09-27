import * as schedule from "node-schedule"
import { PrismaClient } from "@prisma/client"

import {GET_SOCIAL_STATS, SCRAPE_X_DOT_COM, X_DAILY_SNAPSHOT} from "./SOCIAL";
import {VEVE_GET_LATEST_SERIES} from "./VEVE/VEVE_GET_LATEST_SERIES";
import {VEVE_GET_LATEST_COMICS} from "./VEVE/VEVE_GET_LATEST_COMICS";
import {VEVE_GET_LATEST_LICENSORS} from "./VEVE/VEVE_GET_LATEST_LICENSORS";
import {VEVE_GET_LATEST_COLLECTIBLES} from "./VEVE/VEVE_GET_LATEST_COLLECTIBLES";
import {VEVE_GET_LATEST_BRANDS} from "./VEVE/VEVE_GET_LATEST_BRANDS";
import {VEVE_GET_COMIC_FLOORS} from "./VEVE/VEVE_GET_COMIC_FLOORS";
import {VEVE_GET_COLLECTIBLE_FLOORS} from "./VEVE/VEVE_GET_COLLECTIBLE_FLOORS";

export const prisma = new PrismaClient()

const scheduledHourlyJobs = () => {
    schedule.scheduleJob('05 * * * *', async () => {

        // UPDATE YOUTUBE/INSTA SOCIAL STATS
        await GET_SOCIAL_STATS(prisma)

        // GET LATEST X POSTS
        await SCRAPE_X_DOT_COM(prisma)

        // VEVE GET COMIC FLOOR PRICES
        await VEVE_GET_COMIC_FLOORS(prisma)

        // VEVE GET COLLECTIBLE FLOOR PRICES
        await VEVE_GET_COLLECTIBLE_FLOORS(prisma)

    })
}

const scheduledDailyJobs = () => {
    schedule.scheduleJob("0 0 * * *", async () => {

        // X SOCIAL STATISTICS DAILY SNAPSHOT
        await X_DAILY_SNAPSHOT(prisma)

        // VEVE GET LATEST SERIES
        await VEVE_GET_LATEST_SERIES(prisma)

        // VEVE GET LATEST LICENSORS
        await VEVE_GET_LATEST_LICENSORS(prisma)

        // VEVE GET LATEST COMICS
        await VEVE_GET_LATEST_COMICS(prisma)

        // VEVE GET LATEST COLLECTIBLES
        await VEVE_GET_LATEST_COLLECTIBLES(prisma)

        // VEVE GET LATEST BRANDS
        await VEVE_GET_LATEST_BRANDS(prisma)

    })
}


export { scheduledHourlyJobs, scheduledDailyJobs }