import * as dotenv from "dotenv";
dotenv.config();

console.log('[ALICE IS WAITING FOR INSTRUCTION]')

import { PrismaClient } from "@prisma/client"

import {GET_SOCIAL_STATS, SCRAPE_X_DOT_COM} from "./services/SOCIAL";
import {PARSE_SOCIALBLADE_DATA} from "./services/PLAYGROUND/PARSE_SOCIALBLADE_DATA";

export const prisma = new PrismaClient()

const main = async () => {
    // await GET_SOCIAL_STATS(prisma)
    SCRAPE_X_DOT_COM(prisma)
    // PARSE_SOCIALBLADE_DATA(prisma)
}

main()
