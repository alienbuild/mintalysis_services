export const PARSE_SOCIALBLADE_DATA = async (prisma) => {
    try {

        const data = [
            { createdAt: "2022-08-17T00:00:00.000Z", followers: 238936, following: 247 },
            { createdAt: "2022-08-25T00:00:00.000Z", followers: 238793, following: 248 },
            { createdAt: "2022-09-02T00:00:00.000Z", followers: 238667, following: 252 },
            { createdAt: "2022-09-10T00:00:00.000Z", followers: 238313, following: 253 },
            { createdAt: "2022-09-18T00:00:00.000Z", followers: 238046, following: 253 },
            { createdAt: "2022-09-26T00:00:00.000Z", followers: 237795, following: 257 },
            { createdAt: "2022-10-04T00:00:00.000Z", followers: 237663, following: 262 },
            { createdAt: "2022-10-12T00:00:00.000Z", followers: 237400, following: 262 },
            { createdAt: "2022-10-20T00:00:00.000Z", followers: 237237, following: 262 },
            { createdAt: "2022-10-28T00:00:00.000Z", followers: 237124, following: 265 },
            { createdAt: "2022-11-05T00:00:00.000Z", followers: 236851, following: 265 },
            { createdAt: "2022-11-13T00:00:00.000Z", followers: 236461, following: 264 },
            { createdAt: "2022-11-21T00:00:00.000Z", followers: 236031, following: 265 },
            { createdAt: "2022-11-29T00:00:00.000Z", followers: 235627, following: 264 },
            { createdAt: "2022-12-07T00:00:00.000Z", followers: 235178, following: 267 },
            { createdAt: "2022-12-15T00:00:00.000Z", followers: 235048, following: 327 },
            { createdAt: "2022-12-23T00:00:00.000Z", followers: 234666, following: 327 },
            { createdAt: "2022-12-31T00:00:00.000Z", followers: 234402, following: 329 },
            { createdAt: "2023-01-08T00:00:00.000Z", followers: 234003, following: 329 },
            { createdAt: "2023-01-16T00:00:00.000Z", followers: 233748, following: 332 },
            { createdAt: "2023-01-24T00:00:00.000Z", followers: 233561, following: 332 },
            { createdAt: "2023-02-01T00:00:00.000Z", followers: 233314, following: 332 },
            { createdAt: "2023-02-09T00:00:00.000Z", followers: 233013, following: 332 },
            { createdAt: "2023-02-17T00:00:00.000Z", followers: 232933, following: 347 },
            { createdAt: "2023-02-25T00:00:00.000Z", followers: 232867, following: 349 },
            { createdAt: "2023-03-05T00:00:00.000Z", followers: 232616, following: 348 },
            { createdAt: "2023-03-13T00:00:00.000Z", followers: 232334, following: 351 },
            { createdAt: "2023-03-21T00:00:00.000Z", followers: 232199, following: 366 },
            { createdAt: "2023-03-29T00:00:00.000Z", followers: 231843, following: 368 },
            { createdAt: "2023-04-06T00:00:00.000Z", followers: 231470, following: 370 },
            { createdAt: "2023-04-14T00:00:00.000Z", followers: 231053, following: 371 },
            { createdAt: "2023-04-22T00:00:00.000Z", followers: 230763, following: 372 },
            { createdAt: "2023-05-01T00:00:00.000Z", followers: 230440, following: 374 },
            { createdAt: "2023-05-09T00:00:00.000Z", followers: 230188, following: 374 },
            { createdAt: "2023-05-17T00:00:00.000Z", followers: 229884, following: 374 },
            { createdAt: "2023-05-26T00:00:00.000Z", followers: 229625, following: 375 },
            { createdAt: "2023-06-03T00:00:00.000Z", followers: 229370, following: 376 },
            { createdAt: "2023-06-12T00:00:00.000Z", followers: 229111, following: 377 },
            { createdAt: "2023-06-20T00:00:00.000Z", followers: 228860, following: 381 },
            { createdAt: "2023-06-28T00:00:00.000Z", followers: 228636, following: 382 },
            { createdAt: "2023-07-06T00:00:00.000Z", followers: 228403, following: 381 },
            { createdAt: "2023-07-14T00:00:00.000Z", followers: 228105, following: 381 },
            { createdAt: "2023-07-22T00:00:00.000Z", followers: 228079, following: 383 },
            { createdAt: "2023-07-30T00:00:00.000Z", followers: 227907, following: 385 },
            { createdAt: "2023-08-07T00:00:00.000Z", followers: 227644, following: 387 },
            { createdAt: "2023-08-15T00:00:00.000Z", followers: 227418, following: 388 },
            { createdAt: "2023-08-23T00:00:00.000Z", followers: 227269, following: 389 },
            { createdAt: "2023-08-31T00:00:00.000Z", followers: 226966, following: 396 },
            { createdAt: "2023-09-08T00:00:00.000Z", followers: 226733, following: 405 },
            { createdAt: "2023-09-16T00:00:00.000Z", followers: 226514, following: 406 },
            { createdAt: "2023-09-25T00:00:00.000Z", followers: 226225, following: 405 }
        ]

        const extendedData = data.map(entry => ({
            ...entry,
            handle: 'veve_official',
        }));

        await prisma.x_account_snapshop.createMany({
            data: extendedData
        })

        console.log('[SUCCESS] Data saved.')

    } catch (error) {
        console.log('[ERROR] Unable to save data: ', error)
    }
}
