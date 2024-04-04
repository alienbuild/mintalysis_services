//getVeveLatestComicSeriesQuery.js

export const getVeveLatestComicSeriesQuery = () => {
    return `query getSeries {
           comicSeriesList {
                pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                }
                edges {
                    node {
                        id
                        name
                        description
                        publisher {
                            id
                            name
                            description
                            type
                            marketFee
                            landscapeImage {
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
                            squareImage {
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
                    }
                    cursor
                }
                totalCount
            }
    }`
}