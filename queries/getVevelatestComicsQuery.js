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

export const getVeveLatestComicsQueryNew = () => {
    return `query getComics($after: String) {
    comicList: comicTypeList(first: 50, after: $after){
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
                cover {
                    image {
                        id
                        url
                        thumbnailUrl
                        lowResolutionUrl
                        medResolutionUrl
                        fullResolutionUrl
                        highResolutionUrl
                        type
                        direction
                        name
                        version
                        updatedAt
                    }
                }
                covers {
                    edges {
                      node {
                      id
                      totalIssued
                      rarity
                      totalStoreAllocation
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
                        }
                    }
                    totalCount
                }
                comicSeries{
                    id
                    name
                    description
                    publisher {
                        id
                        name
                        marketFee
                        description
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
}`
}