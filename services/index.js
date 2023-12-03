import { PrismaClient } from "@prisma/client"
import * as schedule from "node-schedule"
import Slack from '@slack/bolt';
import { fork } from 'child_process'
import {UPDATE_USER_STATUS} from "./MINTALYSIS/UPDATE_USER_STATUS.js";
import {VEVE_GET_COMIC_FLOORS} from "./VEVE/VEVE_GET_COMIC_FLOORS.js";
import {VEVE_GET_COLLECTIBLE_FLOORS} from "./VEVE/VEVE_GET_COLLECTIBLE_FLOORS.js";
import {VEVE_GET_LATEST_LICENSORS} from "./VEVE/VEVE_GET_LATEST_LICENSORS.js";
import {VEVE_GET_LATEST_BRANDS} from "./VEVE/VEVE_GET_LATEST_BRANDS.js";
import {VEVE_GET_LATEST_SERIES} from "./VEVE/VEVE_GET_LATEST_SERIES.js";
import {VEVE_GET_LATEST_COLLECTIBLES} from "./VEVE/VEVE_GET_LATEST_COLLECTIBLES.js";
import {VEVE_GET_LATEST_COMICS} from "./VEVE/VEVE_GET_LATEST_COMICS.js";

// import {GET_SOCIAL_STATS, SCRAPE_X_DOT_COM, X_DAILY_SNAPSHOT} from "./SOCIAL";

export const prisma = new PrismaClient()

export const scheduleLiveJobs = () => {
    startTask('./services/_ENGINES/VEVE_ASSETS.js', 'GET_VEVE_ASSETS_TASK');
    startTask('./services/_ENGINES/VEVE_GET_TRANSACTIONS.js', 'GET_VEVE_TRANSACTIONS_TASK');
}

export const scheduledMinuteJobs = async (prisma) => {
    schedule.scheduleJob('05 * * * *', async () => {
        await UPDATE_USER_STATUS(prisma)
    })
}

const scheduledHourlyJobs = (prisma) => {
    schedule.scheduleJob('05 */30 * * * *', async (prisma) => {

        // UPDATE YOUTUBE/INSTA SOCIAL STATS
        // await GET_SOCIAL_STATS(prisma)

        // GET LATEST X POSTS
        // await SCRAPE_X_DOT_COM(prisma)

        // VEVE GET LATEST LICENSORS
        await VEVE_GET_LATEST_LICENSORS(prisma)

        // VEVE GET LATEST BRANDS
        await VEVE_GET_LATEST_BRANDS(prisma)

        // VEVE GET LATEST SERIES
        await VEVE_GET_LATEST_SERIES(prisma)

        // VEVE GET LATEST COLLECTIBLES
        await VEVE_GET_LATEST_COLLECTIBLES(prisma)

        // VEVE GET LATEST COMICS
        await VEVE_GET_LATEST_COMICS(prisma)

        // VEVE GET COMIC FLOOR PRICES
        await VEVE_GET_COMIC_FLOORS(prisma)

        // VEVE GET COLLECTIBLE FLOOR PRICES
        await VEVE_GET_COLLECTIBLE_FLOORS(prisma)
    })
}

const scheduledDailyJobs = (prisma) => {
    schedule.scheduleJob("0 0 * * *", async (prisma) => {
        // X SOCIAL STATISTICS DAILY SNAPSHOT
        // await X_DAILY_SNAPSHOT(prisma)
    })
}

const MAX_RETRIES = 5;
const RESTART_DELAY_MS = 10000;

const startTask = (taskPath, taskName) => {
    let retryCount = 0;

    const start = () => {
        if (retryCount >= MAX_RETRIES) {
            console.error(`Maximum retry attempts reached for ${taskName}. Not restarting.`);
            return;
        }

        const task = fork(taskPath);

        task.on('message', (message) => {
            console.log(`${taskName}:`, message);
        });

        task.on('error', async (error) => {
            console.error(`Error in ${taskName}:`, error);
            await slack.client.chat.postMessage({
                token: process.env.SLACK_BOT_TOKEN,
                channel: "errors",
                text: error,
                blocks: [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `New ${taskName} Error`
                        }
                    },
                    {
                        "type": "section"
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `Message:\n*${error}`
                        }
                    }
                ]
            })
        });

        task.on('exit', (code) => {
            console.warn(`${taskName} exited with code:`, code);
            if (code !== 0) {
                retryCount++;
                console.log(`Restarting ${taskName} in ${RESTART_DELAY_MS / 1000} seconds...`);
                setTimeout(start, RESTART_DELAY_MS);
            } else {
                retryCount = 0;
            }
        });

        return task;
    };

    return start();
};

// Initialize Slack
export const slack = new Slack.App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN
});

export { scheduledHourlyJobs, scheduledDailyJobs }