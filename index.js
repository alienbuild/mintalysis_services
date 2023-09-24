import * as dotenv from "dotenv";
dotenv.config();

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

import { PrismaClient } from "@prisma/client"

import {GET_SOCIAL_STATS} from "./services/SOCIAL";

export const prisma = new PrismaClient()

const main = async () => {
    await GET_SOCIAL_STATS(prisma)
}

main()
