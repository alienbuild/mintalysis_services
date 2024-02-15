import {prisma} from "../../index.js";

export const GET_CURRENCY_RATES = async () => {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,ecomi&vs_currencies=usd`);
        const data = await response.json();

        const ethToUsd = data.ethereum.usd;
        const btcToUsd = data.bitcoin.usd;
        const omiToUsd = data.ecomi.usd;

        await prisma.currency_rate.upsert({
            where: { id: 1 },
            update: {
                ethToUsd: ethToUsd,
                btcToUsd: btcToUsd,
                omiToUsd: omiToUsd,
            },
            create: {
                ethToUsd: ethToUsd,
                btcToUsd: btcToUsd,
                omiToUsd: omiToUsd,
            }
        });

        console.log(`[CURRENCY][INFO]: Currency rates updated successfully.`);
    } catch (error) {
        console.log(`[CURRENCY][ERROR]: Unable to fetch currencies from API.`, error);
    }
};
