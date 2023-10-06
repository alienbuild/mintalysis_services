import * as dotenv from "dotenv";
dotenv.config();

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

import { PrismaClient } from "@prisma/client"
import {scheduledDailyJobs, scheduledHourlyJobs} from "./services/index.js";

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

const main = async () => {

    try {
        await prisma.$connect();
        await scheduledHourlyJobs(prisma)
        // await scheduledDailyJobs(prisma)
    } catch (error) {
        console.error('Error in main:', error);
    } finally {
        console.log('FINISHED')
        await prisma.$disconnect();
    }

}

main()
