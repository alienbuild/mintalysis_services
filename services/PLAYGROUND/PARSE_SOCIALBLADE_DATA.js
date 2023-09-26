export const PARSE_SOCIALBLADE_DATA = async (prisma) => {
    try {

        // Load your data to be mass saved
        const data = [
            { createdAt: "2023-04-30T00:00:00.000Z", followers: 19888, following: 126 },
            { createdAt: "2023-05-08T00:00:00.000Z", followers: 20027, following: 126 },
            { createdAt: "2023-05-17T00:00:00.000Z", followers: 20404, following: 126 },
            { createdAt: "2023-05-26T00:00:00.000Z", followers: 20676, following: 126 },
            { createdAt: "2023-06-03T00:00:00.000Z", followers: 20873, following: 127 },
            { createdAt: "2023-06-12T00:00:00.000Z", followers: 21373, following: 127 },
            { createdAt: "2023-06-20T00:00:00.000Z", followers: 21564, following: 128 },
            { createdAt: "2023-06-28T00:00:00.000Z", followers: 21876, following: 128 },
            { createdAt: "2023-07-06T00:00:00.000Z", followers: 22138, following: 128 },
            { createdAt: "2023-07-14T00:00:00.000Z", followers: 22887, following: 129 },
            { createdAt: "2023-07-22T00:00:00.000Z", followers: 24944, following: 129 },
            { createdAt: "2023-07-30T00:00:00.000Z", followers: 25767, following: 130 },
            { createdAt: "2023-08-07T00:00:00.000Z", followers: 26144, following: 131 },
            { createdAt: "2023-08-15T00:00:00.000Z", followers: 27386, following: 131 },
            { createdAt: "2023-08-23T00:00:00.000Z", followers: 27786, following: 131 },
            { createdAt: "2023-08-31T00:00:00.000Z", followers: 27950, following: 131 },
            { createdAt: "2023-09-08T00:00:00.000Z", followers: 28152, following: 133 },
            { createdAt: "2023-09-16T00:00:00.000Z", followers: 28357, following: 134 },
            { createdAt: "2023-09-25T00:00:00.000Z", followers: 29534, following: 134 },
        ]

        // Set the project X handle
        // const handle = 'veve_official'
        const handle = 'mcfarlanetoys'

        const extendedData = data.map(entry => ({
            ...entry,
            handle
        }));

        await prisma.x_account_snapshot.createMany({
            data: extendedData
        })

        console.log('[SUCCESS] Data saved.')

    } catch (error) {
        console.log('[ERROR] Unable to save data: ', error)
    }
}
