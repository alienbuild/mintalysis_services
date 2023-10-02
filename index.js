import * as dotenv from "dotenv";
dotenv.config();

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

import { PrismaClient } from "@prisma/client"
import {UPDATE_USER_STATUS} from "./services/MINTALYSIS/UPDATE_USER_STATUS";

export const prisma = new PrismaClient()

const main = async () => {
    UPDATE_USER_STATUS(prisma)
}

main()
