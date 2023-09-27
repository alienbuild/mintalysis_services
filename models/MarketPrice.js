// TODO: DELETE THIS MODEL WHEN ECOMIWIKI IS DEAD.

import mongoose from 'mongoose'

const MarketPriceSchema = new mongoose.Schema({
    collectibleId: {
        type: String,
    },
    name: {
        type: String
    },
    slug: {
        type: String
    },
    totalIssued: {
        type: Number
    },
    elementTypeId: {
        type: String
    },
    rarity: {
        type: String
    },
    brand: {
        "name": {
            type: String
        },
        "id": {
            type: String
        },
        "squareImage":{
            "thumbnailUrl": {
                type: String
            },
        }
    },
    image: {
        direction: String,
        thumbnailUrl: String,
        url: String,
        lowResolutionUrl: String,
        medResolutionUrl: String,
    },
    storePrice: {
        type: Number
    },
    editionType: {
        type: String
    },
    history: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketPriceHistoric'
    },
    metrics:{
        issueNumber: {
            type: Number
        },
        lowestPrice: {
            type: Number
        },
        marketCap: {
            type: Number
        },
        marketCapFullyDiluted: {
            type: Number
        },
        totalListings: {
            type: Number
        },
        one_day_change: {
            type: Number
        },
        createdAt: {
            type: Date
        },
        updatedAt: {
            type: Date
        },
        prevSoldArr: {
            type: Array
        },
        prevSold: {
            "price": {
                type: Number
            },
            "createdAt": {
                type: Date
            },
            "issueNumber": {
                type: Number
            },
            "listingType": {
                type: String
            }
        },
    },
    one_day_change: {
        type: Number
    },
    change: []
}, { timestamps: true })

const MarketPrice = mongoose.model('MarketPrice', MarketPriceSchema, 'marketprices')
export default MarketPrice

