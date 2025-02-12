import fetch from 'node-fetch'
import ComicPrice from "../../models/ComicPrices.js"
import * as Queries from "../../queries/getVeveComicFloorsQuery.js";
import {prisma} from "../../index.js";

const updateTimeSeries = (comic) => {
    try {
        return new Promise((resolve, reject) => {

            if (!comic?.image?.id) {
                return reject(new Error("Invalid or missing comic image id."));
            }

            ComicPrice.find({ uniqueCoverId: comic?.image?.id })
                .lean()
                .sort({ date: -1 })
                .limit(5)
                .exec((err, history) => {
                    if (err) {
                        console.error('Unable to get timeseries data:', err);
                        return reject(err);
                    }

                    if (!history) {
                        return reject(new Error("History is null."));
                    }

                    let newArr = []

                    const getDifference = (a, b) => {
                        return Math.abs(a - b);
                    }
                    const calculateVolume = (totalSales = 0) => {
                        if (isNaN(totalSales)) {
                            totalSales = 0
                        }
                        return totalSales * parseFloat(comic.floorMarketPrice)
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

                    const newPriceHistory = new ComicPrice({
                        uniqueCoverId: comic.image.id,
                        date: new Date(),
                        value: comic.floorMarketPrice,
                        listings: Number(comic.totalMarketListings),
                        volume: calculateVolume(getDifference(history[history.length - 1]?.listings, Number(comic.totalMarketListings))),
                        high: history.length < 1 ? comic.floorMarketPrice : calculateCandleHigh(0),
                        low: history.length < 1 ? comic.floorMarketPrice : calculateCandleLow(0),
                        open: history.length < 1 ? comic.comicType.storePrice : calculateCandleOpen()
                    })
                    newArr.push(newPriceHistory)

                    ComicPrice.insertMany(newArr)
                        .then((success) => {
                            resolve()
                        })
                        .catch((error) => console.log(`[ERROR] Unable to update time series - insertMany on ${comic.image.id}`, error))
                })
        })
    } catch (e) {
        console.log('[CRITICAL TIMESERIES ERROR][COMICS]' , e)
    }
}

const updateMintalysis = async (comic) => {
    let comicMetrics = await ComicPrice.aggregate([
        {
            '$match': {
                'uniqueCoverId': comic.image.id
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
                                '$multiply': [
                                    {
                                        '$divide': [
                                            {
                                                '$subtract': [
                                                    '$current', '$previous'
                                                ]
                                            }, '$current'
                                        ]
                                    }, 100
                                ]
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
                                '$multiply': [
                                    {
                                        '$divide': [
                                            {
                                                '$subtract': [
                                                    '$current', '$previous'
                                                ]
                                            }, '$current'
                                        ]
                                    }, 100
                                ]
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
                                '$multiply': [
                                    {
                                        '$divide': [
                                            {
                                                '$subtract': [
                                                    '$current', '$previous'
                                                ]
                                            }, '$current'
                                        ]
                                    }, 100
                                ]
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
                                '$multiply': [
                                    {
                                        '$divide': [
                                            {
                                                '$subtract': [
                                                    '$current', '$previous'
                                                ]
                                            }, '$current'
                                        ]
                                    }, 100
                                ]
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
                                '$multiply': [
                                    {
                                        '$divide': [
                                            {
                                                '$subtract': [
                                                    '$current', '$previous'
                                                ]
                                            }, '$current'
                                        ]
                                    }, 100
                                ]
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
                                '$multiply': [
                                    {
                                        '$divide': [
                                            {
                                                '$subtract': [
                                                    '$current', '$previous'
                                                ]
                                            }, '$current'
                                        ]
                                    }, 100
                                ]
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
                                '$multiply': [
                                    {
                                        '$divide': [
                                            {
                                                '$subtract': [
                                                    '$current', '$previous'
                                                ]
                                            }, '$current'
                                        ]
                                    }, 100
                                ]
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
    comicMetrics = comicMetrics[0]

    let total_issued = await prisma.veve_comics.findUnique({where: {unique_cover_id: comic.image.id}})
    total_issued = total_issued?.total_issued ? total_issued.total_issued : 0

    let volume = 0
    const market_cap = Number(comic.floorMarketPrice) * Number(total_issued)
    const one_day_change = comicMetrics.one_day[0]?.percentage_change
    const one_wk_change = comicMetrics.one_week[0]?.percentage_change
    const one_mo_change = comicMetrics?.one_month[0]?.percentage_change
    const three_mo_change = comicMetrics?.three_months[0]?.percentage_change
    const six_mo_change = comicMetrics?.six_months[0]?.percentage_change
    const one_year_change = comicMetrics?.one_year[0]?.percentage_change
    const all_time_change = comicMetrics?.all_time[0]?.percentage_change
    volume = comicMetrics?.one_day[0]?.volume

    let all_time_high = await ComicPrice.find({ uniqueCoverId: comic.image.id }).sort({value: -1}).select('value').limit(1)
    all_time_high = all_time_high[0]?.value

    let all_time_low = await ComicPrice.find({ uniqueCoverId: comic.image.id }).sort({value: 1}).select('value').limit(1)
    all_time_low = all_time_low[0]?.value

    const circulating_supply = ((( Number(comic.totalMarketListings) || 0) / ( total_issued || 1)) * 100)

    return new Promise(async (resolve, reject) => {
        try {
            await prisma.veve_comics_metrics.upsert({
                create: {
                    unique_cover_id: comic.image.id,
                    floor_price: Number(comic.floorMarketPrice),
                    total_listings: Number(comic.totalMarketListings),
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
                    floor_price: Number(comic.floorMarketPrice),
                    total_listings: Number(comic.totalMarketListings),
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
                    unique_cover_id: comic.image.id
                }
            })
        } catch (e) {
            console.log(`[ERROR] Unable to update mintalysis - Name: ${comic.comicType.name}. Id: ${comic.image.id}`)
        }
        resolve()
    })

}

export const VEVE_GET_COMIC_FLOORS = async () => {
    console.log(`[ALICE][VEVE] - [COMIC FLOORS]`)

    await fetch(`https://web.api.prod.veve.me/graphql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'client-name': 'alice-backend',
            'client-version': '...',
            'user-agent': 'alice-requests',
            'Csrf-Token': process.env.ALICE_CSRF_TOKEN,
            'X-Auth-Version': '2',
            'cookie': process.env.ALICE_COOKIE
         }, 
        body: JSON.stringify({
            query: Queries.getVeveComicFloorsQuery(),
        }),
    })
        .then(comic_floors => comic_floors.json())
        .then(async comic_floors => {
            const edges = comic_floors.data.marketListingByComicCover.edges
            await edges.map(async (comic, index) => {
                // if (index > 0) return
                try {
                    await updateTimeSeries(comic.node)
                    await updateMintalysis(comic.node)
                } catch (e) {
                    console.log('[ERROR] Unable to get comic floor prices', e)
                }
            })
        })
        .catch(err => console.log(`[CRITICAL ERROR][VEVE] Unable to get comic floors. `, err))
}

