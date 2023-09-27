import mongoose from 'mongoose'

const ComicPriceSchema = new mongoose.Schema({
    uniqueCoverId: {
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
        metaField: 'uniqueCoverId',
        granularity: 'hours'
    },
    expireAfterSeconds: "off"
})

const ComicPrice = mongoose.model('ComicPrice', ComicPriceSchema, 'comic-market-prices')
export default ComicPrice
