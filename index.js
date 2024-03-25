import * as dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client"
import {scheduledHourlyJobs, scheduledFiveMinuteJobs} from "./services/index.js";
import mongoose from "mongoose";
import Slack from "@slack/bolt";
import {MeiliSearch} from "meilisearch";

export const prisma = new PrismaClient()

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

// Initialize Slack
export const slack = new Slack.App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN
});

export const meili = new MeiliSearch({
    host: 'http://67.225.248.251:7700',
    apiKey: process.env.MEILISEARCH_KEY
});

const initializeMongoose = async () => {
    try {
        await mongoose.connect(process.env.MONGO_DB, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('[CONNECTED] MongoDB');
    } catch (error) {
        console.log('[ERROR] MongoDB connection', error);
    }
};

async function main() {
    try {
        await initializeMongoose();
        await prisma.$connect();
        console.log('[CONNECTED] Prisma');
        // await scheduledHourlyJobs();
        // await scheduledFiveMinuteJobs()
    } catch (error) {
        console.error('[ERROR] main.js:', error);
    }
}

main().catch((e) => console.error('Server failed to start:', e));

process.on('SIGINT', async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
    process.exit(0);
});