import {prisma} from "../../index.js";

export const VEVE_CALCULATE_BRANDS_METRICS = async () => {
    try {
        const brands = await prisma.veve_brands.findMany({
            include: {
                veve_collectibles: {
                    include: {
                        metrics: {
                            select: {
                                floor_price: true,
                                one_day_change: true,
                                one_wk_change: true,
                                one_mo_change: true,
                                three_mo_change: true,
                                six_mo_change: true,
                                one_year_change: true,
                                total_listings: true,
                                all_time_change: true,
                                all_time_high: true,
                                all_time_low: true,
                                volume: true,
                            }
                        }
                    },
                    where: {
                        metrics: {
                            floor_price: {
                                not: null,
                            },
                        },
                    },
                },
            },
        });
        for (const brand of brands) {
            const collectibles = brand.veve_collectibles;
            let marketCap = 0;
            let totalListings = 0;
            let allTimeHigh = 0;
            let allTimeLow = 0;
            let volume = 0;
            let marketCapChange = {
                one_day_change: 0,
                one_wk_change: 0,
                one_mo_change: 0,
                three_mo_change: 0,
                six_mo_change: 0,
                one_year_change: 0,
                all_time_change: 0
            };
            for (const collectible of collectibles) {
                marketCap += collectible.metrics.floor_price * collectible.metrics.total_listings;
                totalListings += collectible.metrics.total_listings;
                allTimeHigh += Number(collectible.metrics.all_time_high);
                allTimeLow += Number(collectible.metrics.all_time_low);
                volume += Number(collectible.metrics.volume);

                marketCapChange.one_day_change += (marketCap * (1 + collectible.metrics.one_day_change / 100)) - marketCap;
                marketCapChange.one_wk_change += (marketCap * (1 + collectible.metrics.one_wk_change / 100)) - marketCap;
                marketCapChange.one_mo_change += (marketCap * (1 + collectible.metrics.one_mo_change / 100)) - marketCap;
                marketCapChange.three_mo_change += (marketCap * (1 + collectible.metrics.three_mo_change / 100)) - marketCap;
                marketCapChange.six_mo_change += (marketCap * (1 + collectible.metrics.six_mo_change / 100)) - marketCap;
                marketCapChange.one_year_change += (marketCap * (1 + collectible.metrics.one_year_change / 100)) - marketCap;
                marketCapChange.all_time_change += (marketCap * (1 + collectible.metrics.all_time_change / 100)) - marketCap;
            }
            if (brand.brand_id) {
                await prisma.veve_brands_metrics.upsert({
                    where: {
                        brand_id: brand.brand_id,
                    },
                    update: {
                        market_cap: marketCap,
                        total_listings: totalListings,
                        all_time_high: allTimeHigh.toFixed(2),
                        all_time_low: allTimeLow.toFixed(2),
                        volume: volume.toFixed(2),
                        one_day_change: marketCapChange.one_day_change,
                        one_mo_change: marketCapChange.one_mo_change,
                        one_wk_change: marketCapChange.one_wk_change,
                        one_year_change: marketCapChange.one_year_change,
                        six_mo_change: marketCapChange.six_mo_change,
                        three_mo_change: marketCapChange.three_mo_change,
                        all_time_change: marketCapChange.all_time_change
                    },
                    create: {
                        brand_id: brand.brand_id,
                        market_cap: marketCap,
                        total_listings: totalListings,
                        all_time_high: allTimeHigh,
                        all_time_low: allTimeLow,
                        volume,
                        one_day_change: marketCapChange.one_day_change,
                        one_mo_change: marketCapChange.one_mo_change,
                        one_wk_change: marketCapChange.one_wk_change,
                        one_year_change: marketCapChange.one_year_change,
                        six_mo_change: marketCapChange.six_mo_change,
                        three_mo_change: marketCapChange.three_mo_change,
                        all_time_change: marketCapChange.all_time_change
                    },
                })
            } else {
                console.log('NO BRAND ID', brand);
            }
        }
    } catch (error) {
        console.error('Error calculating brand metrics:', error);
    }
}