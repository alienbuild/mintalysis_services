export const getVevelatestComicsQuery = () => {
    return `query marketListingByComicCover {
        marketListingByComicCover{
            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
            edges {
                node {
                    rarity
                    totalIssued
                    image {
                        id
                        url
                        thumbnailUrl
                        lowResolutionUrl
                        medResolutionUrl
                        fullResolutionUrl
                        highResolutionUrl
                        direction
                    }
                    comicType {
                        id
                        name
                        isFree
                        storePrice
                        isUnlimited
                        totalIssued
                        totalAvailable
                        description
                        dropDate
                        dropMethod
                        minimumAge
                        startYear
                        comicNumber
                        pageCount
                        comicSeries {
                            id
                            publisher {
                                id
                                marketFee
                            }
                        }
                        artists {
                            edges{
                                node{
                                    id
                                    name
                                }
                                cursor
                            }
                            totalCount
                        }
                        characters {
                            edges {
                                node{
                                    id
                                    name
                                }
                            }
                            totalCount
                        }
                        writers {
                            edges {
                                node {
                                    id
                                    name
                                }
                            }
                            totalCount
                        }
                    }
                }
            }
        }
    }`
}