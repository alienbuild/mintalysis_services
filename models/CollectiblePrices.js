import mongoose from 'mongoose'

const CollectiblePriceSchema = new mongoose.Schema({
    collectibleId: {
        type: String,
        index: true
    },
    date: Date,
    value: Number,
    listings: Number,
    lastSold: Number,
    volume: Number,
    high: Number,
    low: Number,
    open: Number
}, {
    timeseries: {
        timeField: 'date',
        metaField: 'collectibleId',
        granularity: 'hours'
    },
    expireAfterSeconds: "off"
})


const CollectiblePrice = mongoose.model('CollectiblePrice', CollectiblePriceSchema, 'collectible-market-prices')
export default CollectiblePrice
