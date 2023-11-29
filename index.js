import * as dotenv from "dotenv";
dotenv.config();

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

import { PrismaClient } from "@prisma/client"
import {scheduledDailyJobs, scheduledHourlyJobs} from "./services/index.js";
import {VEVE_GET_LATEST_COLLECTIBLES} from "./services/VEVE/VEVE_GET_LATEST_COLLECTIBLES.js";
import {VEVE_GET_LATEST_COMICS} from "./services/VEVE/VEVE_GET_LATEST_COMICS.js";
import {VEVE_GET_LATEST_SERIES} from "./services/VEVE/VEVE_GET_LATEST_SERIES.js";
import {VEVE_GET_LATEST_LICENSORS} from "./services/VEVE/VEVE_GET_LATEST_LICENSORS.js";
import {VEVE_GET_LATEST_BRANDS} from "./services/VEVE/VEVE_GET_LATEST_BRANDS.js";
import {VEVE_GET_COLLECTIBLE_FLOORS} from "./services/VEVE/VEVE_GET_COLLECTIBLE_FLOORS.js";
import mongoose from "mongoose";
import {VEVE_GET_COMIC_FLOORS} from "./services/VEVE/VEVE_GET_COMIC_FLOORS.js";

export const prisma = new PrismaClient()

// const BATCH_SIZE = 100;

// async function addUsersToServerInBatch(userIds) {
//     try {
//         await prisma.server.update({
//             where: { id: 1 },
//             data: {
//                 members: {
//                     connect: userIds.map(id => ({ id }))
//                 }
//             }
//         });
//         console.log(`Added ${userIds.length} users to the server successfully.`);
//     } catch (error) {
//         console.error('Error adding users to server:', error);
//     }
// }
//
// async function addAllUsersToServer() {
//     try {
//         console.log('GETTING USERS')
//         // Get all user IDs from the database
//         const users = await prisma.user.findMany({
//             select: { id: true }
//         });
//         const userIds = users.map(u => u.id);
//
//         // Process users in batches
//         for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
//             const batchOfUserIds = userIds.slice(i, i + BATCH_SIZE);
//             await addUsersToServerInBatch(batchOfUserIds);
//         }
//         console.log('All users were added to the server successfully.');
//     } catch (error) {
//         console.error('Error during the batch process:', error);
//     }
// }

const initializeMongoose = async () => {
    try {
        await mongoose.connect(process.env.MONGO_DB, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('[CONNECTED] MongoDB');
    } catch (error) {
        console.log('[ERROR] MongoDB connection', error);
    }
};

const main = async () => {

    try {
        await initializeMongoose();
        await prisma.$connect();
        console.log('[CONNECTED] Prisma');
        await scheduledHourlyJobs(prisma)

    } catch (error) {
        console.error('[ERROR] main.js:', error);
    } finally {
        console.log('[DISCONNECTED] Prisma');
        await prisma.$disconnect();
        console.log('[FINISHED]');
    }

}

main().catch((e) => console.error('Server failed to start:', e));