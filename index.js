import * as dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client"
import {scheduledHourlyJobs} from "./services/index.js";
import mongoose from "mongoose";

export const prisma = new PrismaClient()

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

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
        await scheduledHourlyJobs(prisma);
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