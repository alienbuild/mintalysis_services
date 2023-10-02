import * as dotenv from "dotenv";
dotenv.config();

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

import { PrismaClient } from "@prisma/client"
import {UPDATE_USER_STATUS} from "./services/MINTALYSIS/UPDATE_USER_STATUS";

export const prisma = new PrismaClient()

const main = async () => {

    try {
        await prisma.$connect();
        console.log('Connected to Prisma');
        console.log('About to call UPDATE_USER_STATUS');
        await UPDATE_USER_STATUS(prisma); // Here prisma instance is passed as argument.
        console.log('UPDATE_USER_STATUS has been called');
    } catch (error) {
        console.error('Error in main:', error);
    } finally {
        await prisma.$disconnect();
    }

}

main()
