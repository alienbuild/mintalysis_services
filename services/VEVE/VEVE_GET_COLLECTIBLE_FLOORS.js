import fetch from 'node-fetch'
import slugify from 'slugify'
import CollectiblePrice from "../../models/CollectiblePrices.js"
import MarketPrice from "../../models/MarketPrice.js"
import {VEVE_CALCULATE_SERIES_METRICS} from "./VEVE_CALCULATE_SERIES_METRICS.js";
import {VEVE_CALCULATE_BRANDS_METRICS} from "./VEVE_CALCULATE_BRANDS_METRICS.js";
import {VEVE_CALCULATE_LICENSORS_METRICS} from "./VEVE_CALCULATE_LICENSORS_METRICS.js";
import {prisma} from "../../index.js";
import mysql from "mysql";

const getVeveCollectibleFloorsQuery = () => {
    return `query collectibleTypeList {
    collectibleTypeList(first: 2000) {
        pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
        }
        edges{
            node{
                id
                name
                totalMarketListings
                floorMarketPrice
                storePrice
            }
        }
    }
}`
}

const updateTimeSeries = (collectible) => {
    return new Promise((resolve, reject) => {
        CollectiblePrice.find({ collectibleId: collectible.id })
            .lean()
            .sort({ date: -1 })
            .limit(5)
            .exec((err, history) => {
                if (err) console.log('Unable to get timeseries data: ', err)
                let newArr = []
                const getDifference = (a, b) => {
                    return Math.abs(a - b);
                }
                const calculateVolume = (totalSales = 0) => {
                    if (isNaN(collectible.floorMarketPrice)) {
                        return 0
                    }
                    return totalSales * parseFloat(collectible.floorMarketPrice)
                }
                const calculateCandleHigh = () => {
                    const shallowCopy = history.slice(0, 4)

                    return Math.max.apply(Math, shallowCopy.map(function (o) {
                        return o.value;
                    }))
                }
                const calculateCandleLow = () => {
                    const shallowCopy = history.slice(0, 4)

                    return Math.min.apply(Math, shallowCopy.map(function (o) {
                        return o.value;
                    }))
                }
                const calculateCandleOpen = () => {
                    return history[history.length - 1].value
                }

                const newPriceHistory = new CollectiblePrice({
                    collectibleId: collectible.id,
                    date: new Date(),
                    value: collectible.floorMarketPrice,
                    listings: Number(collectible.totalMarketListings),
                    // lastSold: typeof prevSoldData.data.marketingList.edges[0] !== "undefined" && prevSoldData.data.marketingList.edges[0] !== null ? parseFloat(prevSoldData.data.marketingList.edges[0].node.currentPrice) : 0,
                    // volume: calculateVolume(getDifference(history[history.length - 1]?.listings, Number(collectible.totalMarketListings))),
                    high: history.length < 1 ? collectible.floorMarketPrice : calculateCandleHigh(0),
                    low: history.length < 1 ? collectible.floorMarketPrice : calculateCandleLow(0),
                    open: history.length < 1 ? collectible.storePrice : calculateCandleOpen()
                })
                newArr.push(newPriceHistory)

                CollectiblePrice.insertMany(newArr)
                    .then((success) => {
                        resolve()
                    })
                    .catch((error) => console.log(`[ERROR] Unable to insertMany on CollectiblePrice. name is ${collectible.name} / ${collectible.id}`, error))
            })
    })
}

const updateMintalysis = async (collectible) => {

    try {
        let collectibleMetrics = await CollectiblePrice.aggregate([
            {
                '$match': {
                    'collectibleId': collectible.id
                }
            }, {
                '$set': {
                    'target-date': '$$NOW'
                }
            }, {
                '$facet': {
                    'one_day': [
                        {
                            '$match': {
                                '$expr': {
                                    '$lte': [
                                        {
                                            '$subtract': [
                                                '$target-date', '$date'
                                            ]
                                        }, {
                                            '$multiply': [
                                                24, 60, 60, 1000
                                            ]
                                        }
                                    ]
                                }
                            }
                        }, {
                            '$group': {
                                '_id': null,
                                'avg': {
                                    '$avg': '$value'
                                },
                                'previous': {
                                    '$first': '$value'
                                },
                                'current': {
                                    '$last': '$value'
                                },
                                'min': {
                                    '$min': '$low'
                                },
                                'max': {
                                    '$max': '$high'
                                },
                                'volume': {
                                    '$avg': '$volume'
                                }
                            }
                        },
                        {
                            '$addFields': {
                                'percentage_change': {
                                    '$cond': {
                                        'if': { '$eq': ['$previous', 0] },
                                        'then': null, // or null, or whatever you want
                                        'else': {
                                            '$multiply': [
                                                {
                                                    '$divide': [
                                                        {
                                                            '$subtract': [
                                                                '$current', '$previous'
                                                            ]
                                                        }, '$previous'
                                                    ]
                                                }, 100
                                            ]
                                        }
                                    }
                                }
                            }
                        }, {
                            '$unset': [
                                '_id'
                            ]
                        }
                    ],
                    'one_week': [
                        {
                            '$match': {
                                '$expr': {
                                    '$lte': [
                                        {
                                            '$subtract': [
                                                '$target-date', '$date'
                                            ]
                                        }, {
                                            '$multiply': [
                                                7, 24, 60, 60, 1000
                                            ]
                                        }
                                    ]
                                }
                            }
                        }, {
                            '$group': {
                                '_id': null,
                                'avg': {
                                    '$avg': '$value'
                                },
                                'previous': {
                                    '$first': '$value'
                                },
                                'current': {
                                    '$last': '$value'
                                },
                                'min': {
                                    '$min': '$low'
                                },
                                'max': {
                                    '$max': '$high'
                                }
                            }
                        },
                        {
                            '$addFields': {
                                'percentage_change': {
                                    '$cond': {
                                        'if': { '$eq': ['$previous', 0] },
                                        'then': null, // or null, or whatever you want
                                        'else': {
                                            '$multiply': [
                                                {
                                                    '$divide': [
                                                        {
                                                            '$subtract': [
                                                                '$current', '$previous'
                                                            ]
                                                        }, '$previous'
                                                    ]
                                                }, 100
                                            ]
                                        }
                                    }
                                }
                            }
                        }, {
                            '$unset': [
                                '_id'
                            ]
                        }
                    ],
                    'one_month': [
                        {
                            '$match': {
                                '$expr': {
                                    '$lte': [
                                        {
                                            '$subtract': [
                                                '$target-date', '$date'
                                            ]
                                        }, {
                                            '$multiply': [
                                                30, 24, 60, 60, 1000
                                            ]
                                        }
                                    ]
                                }
                            }
                        }, {
                            '$group': {
                                '_id': null,
                                'avg': {
                                    '$avg': '$value'
                                },
                                'previous': {
                                    '$first': '$value'
                                },
                                'current': {
                                    '$last': '$value'
                                },
                                'min': {
                                    '$min': '$low'
                                },
                                'max': {
                                    '$max': '$high'
                                }
                            }
                        },{
                            '$addFields': {
                                'percentage_change': {
                                    '$cond': {
                                        'if': { '$eq': ['$previous', 0] },
                                        'then': null, // or null, or whatever you want
                                        'else': {
                                            '$multiply': [
                                                {
                                                    '$divide': [
                                                        {
                                                            '$subtract': [
                                                                '$current', '$previous'
                                                            ]
                                                        }, '$previous'
                                                    ]
                                                }, 100
                                            ]
                                        }
                                    }
                                }
                            }
                        }, {
                            '$unset': [
                                '_id'
                            ]
                        }
                    ],
                    'three_months': [
                        {
                            '$match': {
                                '$expr': {
                                    '$lte': [
                                        {
                                            '$subtract': [
                                                '$target-date', '$date'
                                            ]
                                        }, {
                                            '$multiply': [
                                                3, 30, 24, 60, 60, 1000
                                            ]
                                        }
                                    ]
                                }
                            }
                        }, {
                            '$group': {
                                '_id': null,
                                'avg': {
                                    '$avg': '$value'
                                },
                                'previous': {
                                    '$first': '$value'
                                },
                                'current': {
                                    '$last': '$value'
                                },
                                'min': {
                                    '$min': '$low'
                                },
                                'max': {
                                    '$max': '$high'
                                }
                            }
                        },{
                            '$addFields': {
                                'percentage_change': {
                                    '$cond': {
                                        'if': { '$eq': ['$previous', 0] },
                                        'then': null, // or null, or whatever you want
                                        'else': {
                                            '$multiply': [
                                                {
                                                    '$divide': [
                                                        {
                                                            '$subtract': [
                                                                '$current', '$previous'
                                                            ]
                                                        }, '$previous'
                                                    ]
                                                }, 100
                                            ]
                                        }
                                    }
                                }
                            }
                        }, {
                            '$unset': [
                                '_id'
                            ]
                        }
                    ],
                    'six_months': [
                        {
                            '$match': {
                                '$expr': {
                                    '$lte': [
                                        {
                                            '$subtract': [
                                                '$target-date', '$date'
                                            ]
                                        }, {
                                            '$multiply': [
                                                6, 30, 24, 60, 60, 1000
                                            ]
                                        }
                                    ]
                                }
                            }
                        }, {
                            '$group': {
                                '_id': null,
                                'avg': {
                                    '$avg': '$value'
                                },
                                'previous': {
                                    '$first': '$value'
                                },
                                'current': {
                                    '$last': '$value'
                                },
                                'min': {
                                    '$min': '$low'
                                },
                                'max': {
                                    '$max': '$high'
                                }
                            }
                        },{
                            '$addFields': {
                                'percentage_change': {
                                    '$cond': {
                                        'if': { '$eq': ['$previous', 0] },
                                        'then': null, // or null, or whatever you want
                                        'else': {
                                            '$multiply': [
                                                {
                                                    '$divide': [
                                                        {
                                                            '$subtract': [
                                                                '$current', '$previous'
                                                            ]
                                                        }, '$previous'
                                                    ]
                                                }, 100
                                            ]
                                        }
                                    }
                                }
                            }
                        }, {
                            '$unset': [
                                '_id'
                            ]
                        }
                    ],
                    'one_year': [
                        {
                            '$match': {
                                '$expr': {
                                    '$lte': [
                                        {
                                            '$subtract': [
                                                '$target-date', '$date'
                                            ]
                                        }, {
                                            '$multiply': [
                                                12, 30, 24, 60, 60, 1000
                                            ]
                                        }
                                    ]
                                }
                            }
                        }, {
                            '$group': {
                                '_id': null,
                                'avg': {
                                    '$avg': '$value'
                                },
                                'previous': {
                                    '$first': '$value'
                                },
                                'current': {
                                    '$last': '$value'
                                },
                                'min': {
                                    '$min': '$low'
                                },
                                'max': {
                                    '$max': '$high'
                                }
                            }
                        },{
                            '$addFields': {
                                'percentage_change': {
                                    '$cond': {
                                        'if': { '$eq': ['$previous', 0] },
                                        'then': null, // or null, or whatever you want
                                        'else': {
                                            '$multiply': [
                                                {
                                                    '$divide': [
                                                        {
                                                            '$subtract': [
                                                                '$current', '$previous'
                                                            ]
                                                        }, '$previous'
                                                    ]
                                                }, 100
                                            ]
                                        }
                                    }
                                }
                            }
                        }, {
                            '$unset': [
                                '_id'
                            ]
                        }
                    ],
                    'all_time': [
                        {
                            '$group': {
                                '_id': null,
                                'avg': {
                                    '$avg': '$value'
                                },
                                'previous': {
                                    '$first': '$value'
                                },
                                'current': {
                                    '$last': '$value'
                                },
                                'min': {
                                    '$min': '$low'
                                },
                                'max': {
                                    '$max': '$high'
                                }
                            }
                        }, {
                            '$addFields': {
                                'percentage_change': {
                                    '$cond': {
                                        'if': { '$eq': ['$previous', 0] },
                                        'then': null, // or null, or whatever you want
                                        'else': {
                                            '$multiply': [
                                                {
                                                    '$divide': [
                                                        {
                                                            '$subtract': [
                                                                '$current', '$previous'
                                                            ]
                                                        }, '$previous'
                                                    ]
                                                }, 100
                                            ]
                                        }
                                    }
                                }
                            }
                        }, {
                            '$unset': [
                                '_id'
                            ]
                        }
                    ]
                }
            }
        ])
        collectibleMetrics = collectibleMetrics[0]

        let total_issued = await prisma.veve_collectibles.findUnique({where: {collectible_id: collectible.id}})
        total_issued = total_issued?.total_issued ? total_issued.total_issued : 0

        let volume = 0
        const market_cap = Number(collectible.floorMarketPrice) * Number(total_issued)
        const one_day_change = collectibleMetrics.one_day[0]?.percentage_change
        const one_wk_change = collectibleMetrics.one_week[0]?.percentage_change
        const one_mo_change = collectibleMetrics?.one_month[0]?.percentage_change
        const three_mo_change = collectibleMetrics?.three_months[0]?.percentage_change
        const six_mo_change = collectibleMetrics?.six_months[0]?.percentage_change
        const one_year_change = collectibleMetrics?.one_year[0]?.percentage_change
        const all_time_change = collectibleMetrics?.all_time[0]?.percentage_change
        volume = collectibleMetrics?.one_day[0]?.volume

        let all_time_high = await CollectiblePrice.find({collectibleId: collectible.id }).sort({value: -1}).select('value').limit(1)
        all_time_high = all_time_high[0]?.value

        let all_time_low = await CollectiblePrice.find({collectibleId: collectible.id }).sort({value: 1}).select('value').limit(1)
        all_time_low = all_time_low[0]?.value

        // let volume = await CollectiblePrice.find({ collectibleId: collectible.id }).sort({ date: -1 }).select('volume').limit(1)
        // volume = volume[0].volume

        const circulating_supply = ((( Number(collectible.totalMarketListings) || 0) / ( total_issued || 1)) * 100)

        return new Promise(async (resolve, reject) => {
            try {
                await prisma.veve_collectibles_metrics.upsert({
                    create: {
                        collectible_id: collectible.id,
                        floor_price: Number(collectible.floorMarketPrice),
                        total_listings: Number(collectible.totalMarketListings),
                        circulating_supply,
                        volume,
                        one_day_change,
                        one_wk_change,
                        one_mo_change,
                        one_year_change,
                        six_mo_change,
                        three_mo_change,
                        all_time_change: typeof all_time_change === 'number' ? all_time_change : null,
                        all_time_high,
                        all_time_low,
                        market_cap,
                    },
                    update: {
                        floor_price: Number(collectible.floorMarketPrice),
                        total_listings: Number(collectible.totalMarketListings),
                        circulating_supply,
                        volume,
                        one_day_change,
                        one_wk_change,
                        one_mo_change,
                        one_year_change,
                        six_mo_change,
                        three_mo_change,
                        all_time_change: typeof all_time_change === 'number' ? all_time_change : null,
                        all_time_high,
                        all_time_low,
                        market_cap,
                    },
                    where: {
                        collectible_id: collectible.id,
                    },
                })
            } catch (e) {
                console.log(`[ERROR] Unable to update mintalysis - Name: ${collectible.name}. Id: ${collectible.id}`, e)
            }
            resolve()
        })
    } catch (e) {
        console.log(`[MINTALYSIS VEVE COLLECTIBLE UPDATE FAILED]:Could not update mintalysis is ${collectible.id}` , e)
    }

}

export const VEVE_GET_COLLECTIBLE_FLOORS = async () => {

    console.log(`[ALICE][VEVE] - [COLLECTIBLE FLOORS]`)
    await fetch(`https://web.api.prod.veve.me/graphql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'client-name': 'alice-backend',
            'client-version': '...',
            'user-agent': 'alice-requests',
            'cookie': "veve=s%3AJcar1noXQMx0RuSr3H_FjFPKAZ-1IQmp.lc52qj%2BqOdmVjk4lTxQPeFwXpCoiH3HkdV2%2BgoJeMbw; _ga=GA1.1.1843381761.1710450036; OptanonAlertBoxClosed=2024-03-14T21:00:38.269Z; _ga_VYLZ9K4GY3=GS1.1.1710450035.1.0.1710450040.55.0.0; vv.at=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImd0eSI6WyJhdXRob3JpemF0aW9uX2NvZGUiXSwia2lkIjoieEZ4RnRIY3JpNWxFRWxia0tWNzVSTkVUTGpFIn0.eyJhdWQiOiI3MTI1ZDZmZi1jZDM4LTQwMjQtYjU4Zi1kODhmOTMzMzRmMjkiLCJleHAiOjE3MTA0OTM0MDQsImlhdCI6MTcxMDQ1MDIwNCwiaXNzIjoiaHR0cHM6Ly9hdXRoLnZldmUubWUiLCJzdWIiOiI2NjQ1MjFhOS05YmFkLTQ4YzQtOWU3NS05MGZjNGMyMmIzNjMiLCJqdGkiOiJmMTdmMzJlNS1lMDMzLTQxNjctYjhkNy0yOGJlMmQ4ZjkwM2UiLCJhcHBsaWNhdGlvbklkIjoiNzEyNWQ2ZmYtY2QzOC00MDI0LWI1OGYtZDg4ZjkzMzM0ZjI5Iiwic2NvcGUiOiJvcGVuaWQgb2ZmbGluZV9hY2Nlc3MiLCJyb2xlcyI6WyJ1c2VyIl0sInNpZCI6IjEwNTBjYmEwLWRkNjAtNDEzZC1iMTg2LWE0NTMwNDI4MmE1YiIsImF1dGhfdGltZSI6MTcxMDQ1MDIwNCwidGlkIjoiNDQ2NWEyZGUtNDdkNS00OTMxLWFlZTgtZDIyYzk4MGYyNTUxIn0.JjTfEFh8h8oSECMu9RKXHL8JcQl87PRTuhpUils3slQ5b2w792IJoDqhgBrkeDkl9X9oRG_f9Ks_LBy10ZsqoP9szix7Vae9pshLZkcWzqhCiqOi4k6i1R9AWQ2xkEr4OaXDZl1kW2Lvnfz_t2AIpaObzIKf00kkq3cawlqq3NkmnX3FDfq2Fzn-omJ24e_82BCztIKaQA13E7yeZPxQERZ8waTaq8msiKnV9DzT67ifhXQYFDPTaP1u6pNMF8hZ92J0viwusEM8Y_qSLCWHRfo8vaAsZTHPoGV7Wj_Y6PDfq9Pn36xFMsEZ0CZPjiGjAM7oDcflW7gv-hoQSvgTCQ; vv.rt=eNCVq-YKPNuNaQ7xkyMpMxLwSM2GOalzJozh5fucEs-T5F6CWK6klw; vv.at_exp=1710493403408; vv.rt_exp=1711659804408; OptanonConsent=isGpcEnabled=0&datestamp=Thu+Mar+14+2024+21%3A03%3A25+GMT%2B0000+(Greenwich+Mean+Time)&version=6.34.0&isIABGlobal=false&hosts=&consentId=23a0bf52-cef5-43d5-af82-7807c2f9dc6b&interactionCount=1&landingPath=NotLandingPage&groups=C0004%3A1%2CC0002%3A1%2CC0001%3A1%2CC0003%3A1%2CC0005%3A1&geolocation=GB%3BENG&AwaitingReconsent=false; AMP_MKTG_1034237904=JTdCJTIycmVmZXJyZXIlMjIlM0ElMjJodHRwcyUzQSUyRiUyRmF1dGgudmV2ZS5tZSUyRiUyMiUyQyUyMnJlZmVycmluZ19kb21haW4lMjIlM0ElMjJhdXRoLnZldmUubWUlMjIlN0Q=; AMP_1034237904=JTdCJTIyb3B0T3V0JTIyJTNBZmFsc2UlMkMlMjJkZXZpY2VJZCUyMiUzQSUyMmYzZGYyZmE2LTNjODUtNGRjZS04NmE2LTI5Nzc2YTBhNzAyZCUyMiUyQyUyMmxhc3RFdmVudFRpbWUlMjIlM0ExNzEwNDUwMjExNzE0JTJDJTIyc2Vzc2lvbklkJTIyJTNBMTcxMDQ1MDIwNzkzOSUyQyUyMnVzZXJJZCUyMiUzQSUyMjY2NDUyMWE5LTliYWQtNDhjNC05ZTc1LTkwZmM0YzIyYjM2MyUyMiU3RA==",
            'Csrf-Token': "3FyNFpjM-gvt8H_lMD14KQI1KKh6xh2GM3EI",
            "X-Auth-Version": "2",
            "X-Datadog-Origin": "rum",
            "X-Datadog-Parent-Id": "9034782047447161082",
            "X-Datadog-Sampled": "1",
            "X-Datadog-Sampling-Priority": "1",
            "X-Datadog-Trace-Id": "8148972651200753665"
        },
        body: JSON.stringify({
            query: getVeveCollectibleFloorsQuery(),
        }),
    })
        .then(collectible_floors => collectible_floors.json())
        .then(async collectible_floors => {

            try {
                const edges = collectible_floors.data.collectibleTypeList.edges
                await edges.map(async (collectible) => {
                    await updateTimeSeries(collectible.node)
                    await updateMintalysis(collectible.node)
                    // await insertFloorPriceIntoLocalDatabase(collectible.node.id, collectible.node.floorMarketPrice);
                })
            } catch (e) {
                console.log('[ERROR] Could not update colectible floors ', e)
            }
        })
        .catch(err => console.log(`[CRITICAL ERROR][VEVE] Unable to get collectible floors`, err))
}