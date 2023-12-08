import * as dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client"
import {scheduledHourlyJobs} from "./services/index.js";
import mongoose from "mongoose";
import Slack from "@slack/bolt";

export const prisma = new PrismaClient()

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

// Initialize Slack
export const slack = new Slack.App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN
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
        await scheduledHourlyJobs();
    } catch (error) {
        console.error('[ERROR] main.js:', error);
    }
}

main().catch((e) => console.error('Server failed to start:', e));

process.on('SIGINT', async () => {
    console.log('Shutting down');
    await prisma.$disconnect();
    await mongoose.disconnect();
    process.exit(0);
});