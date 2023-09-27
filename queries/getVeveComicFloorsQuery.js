export const getVeveComicFloorsQuery = () => {
    return `query marketListingByComicCover {
    marketListingByComicCover(first: 5000) {
        pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
        }
        edges{
            node{
                image {
                    id
                } 
                comicType {
                    storePrice
                    name
                }
                totalMarketListings
                minMarketPrice
                maxMarketPrice
                floorMarketPrice
            }
        }
        totalCount
    }
}`
}