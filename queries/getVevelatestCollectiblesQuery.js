export const getVevelatestCollectiblesQuery = () => {
    return `query collectibleTypeList {
        collectibleTypeList(first: 150, sortOptions: {sortBy: DROP_DATE, sortDirection: DESCENDING} ){
            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
            edges {
                node{
                    id
                    name
                    totalLikes
                    isFree
                    storePrice
                    isUnlimited
                    totalIssued
                    totalAvailable
                    description
                    rarity
                    variety
                    editionType
                    dropMethod
                    dropDate
                    marketFee
                    backgroundImage {
                        url
                        thumbnailUrl
                        lowResolutionUrl
                        medResolutionUrl
                        fullResolutionUrl
                        highResolutionUrl
                        direction
                    }
                    image {
                        url
                        thumbnailUrl
                        lowResolutionUrl
                        medResolutionUrl
                        fullResolutionUrl
                        highResolutionUrl
                        direction
                    }
                    licensor {
                        id
                    }
                    brand {
                        id
                    }
                    series {
                        id
                    }
                }
            }
        }
    }`
}