import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient()

const plans = [
    {
        name: 'Basic',
        description: 'Basic membership description',
        features: ['Feature 1', 'Feature 2'],
        stripe_product_id: 'prod_PanR3uPASufwPS',
        prices: [
            { stripe_price_id: 'price_1OloifLh7lPDD143156ZjvRZ', currency: 'USD', amount: 7.99, interval: 'month' },
            { stripe_price_id: 'price_1OlbqILh7lPDD143roC3vdpz', currency: 'GBP', amount: 4.99, interval: 'month' },
            { stripe_price_id: 'price_1OlotyLh7lPDD143PEUl0kw8', currency: 'USD', amount: 79.99, interval: 'year' },
            { stripe_price_id: 'price_1OloudLh7lPDD1431THpJUEu', currency: 'GBP', amount: 39.99, interval: 'year' },
        ]
    },
    {
        name: 'Intermediate',
        description: 'Intermediate membership description',
        features: ['Feature 1', 'Feature 2'],
        stripe_product_id: 'prod_PanRI8PcgDiZAK',
        prices: [
            { stripe_price_id: 'price_1OlbqtLh7lPDD143yfIiCBRx', currency: 'USD', amount: 12.99, interval: 'month' },
            { stripe_price_id: 'price_1OloshLh7lPDD1432cPi3S0l', currency: 'GBP', amount: 99.99, interval: 'month' },
            { stripe_price_id: 'price_1OlortLh7lPDD143BJjMKWfN', currency: 'USD', amount: 149.99, interval: 'year' },
            { stripe_price_id: 'price_1OlortLh7lPDD143BJjMKWfN', currency: 'GBP', amount: 149.99, interval: 'year' },
        ]
    },
    {
        name: 'Advanced',
        description: 'Advanced membership description',
        features: ['Feature 1', 'Feature 2'],
        stripe_product_id: 'prod_PanRI8PcgDiZAK',
        prices: [
            { stripe_price_id: 'price_1OlbhmLh7lPDD143Vnk1FXtg', currency: 'USD', amount: 19.99, interval: 'month' },
            { stripe_price_id: 'price_1OlofMLh7lPDD143lgaxJFNi', currency: 'GBP', amount: 16.99, interval: 'month' },
            { stripe_price_id: 'price_1OlolHLh7lPDD143QvFMYXYt', currency: 'USD', amount: 199.99, interval: 'year' },
            { stripe_price_id: 'price_1Olon3Lh7lPDD1431wDtpDRE', currency: 'GBP', amount: 189.99, interval: 'year' },
        ]
    },
];


const STRIPE_CREATE_PLANS = async () => {
    for (const plan of plans) {
        // Create the subscription plan
        const createdPlan = await prisma.subscription_plan.create({
            data: {
                name: plan.name,
                description: plan.description,
                features: plan.features,
                stripe_product_id: plan.stripe_product_id,
            },
        });

        // Iterate over the prices array for each plan
        for (const price of plan.prices) {
            await prisma.subscription_price.create({
                data: {
                    stripe_price_id: price.stripe_price_id,
                    currency: price.currency,
                    amount: price.amount,
                    interval: price.interval,
                    plan_id: createdPlan.id,
                },
            });
        }
    }

    console.log('Subscription plans and prices seeded');
};

// STRIPE_CREATE_PLANS()
//     .catch((e) => {
//         console.error(e);
//         process.exit(1);
//     })
//     .finally(async () => {
//         await prisma.$disconnect();
//     });