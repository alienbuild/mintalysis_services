import * as dotenv from "dotenv";
dotenv.config();

import {SCRAPE_X_DOT_COM} from "./services/X/SCRAPE_X_DOT_COM";

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

import { PrismaClient } from "@prisma/client"

export const prisma = new PrismaClient()

const main = async () => {
    await SCRAPE_X_DOT_COM(prisma)
}

main()
