import {prisma} from "../../index.js";

export const GET_CURRENCY_RATES = async () => {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,ecomi&vs_currencies=usd`);
        const data = await response.json();

        const eth_to_usd = data.ethereum.usd;
        const btc_to_usd = data.bitcoin.usd;
        const omi_to_usd = data.ecomi.usd;

        await prisma.currency_rate.upsert({
            where: { id: 1 },
            update: {
                eth_to_usd,
                btc_to_usd,
                omi_to_usd,
            },
            create: {
                eth_to_usd,
                btc_to_usd,
                omi_to_usd,
            }
        });

        console.log(`[CURRENCY][INFO]: Currency rates updated successfully.`);
    } catch (error) {
        console.log(`[CURRENCY][ERROR]: Unable to fetch currencies from API.`, error);
    }
};

GET_CURRENCY_RATES()