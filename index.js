import * as dotenv from "dotenv";
dotenv.config();

// import {SCRAPE_X_DOT_COM} from "./services/X/SCRAPE_X_DOT_COM";

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

import { PrismaClient } from "@prisma/client"
// import {X_DAILY_SNAPSHOT} from "./services/X/X_DAILY_SNAPSHOT";
import {GET_SOCIAL_STATS} from "./services/X/SCRAPE_X_DOT_COM";

export const prisma = new PrismaClient()

const main = async () => {
    // await SCRAPE_X_DOT_COM(prisma)
    // await X_DAILY_SNAPSHOT(prisma)
    await GET_SOCIAL_STATS(prisma)
}

main()
