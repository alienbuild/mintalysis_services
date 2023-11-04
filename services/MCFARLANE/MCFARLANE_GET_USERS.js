import fetch from 'node-fetch'
import {PrismaClient} from "@prisma/client";
import {setTimeout} from "node:timers/promises"

const prisma = new PrismaClient()

export const MCFARLANE_GET_USERS = async () => {
    console.log('Getting mcfarlane users...')

    await fetch(`https://api.mcfarlanedigital.app/gallery?type=User&limit=550&offset=0`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Accept-Encoding': 'deflate, gzip',
            'User-Agent': 'UnityPlayer/2021.3.1f1 (UnityWebRequest/1.0, libcurl/7.80.0-DEV)',
            'X-Unity-Version': '2021.3.1f1',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU4ZGE2NTkzLTBiNTAtNDRiMi1iYzBkLTM5NWQ3MDhhMTA3OCIsImlhdCI6MTY4NDkyNDg1NCwiZXhwIjoxNjg3NTE2ODU0fQ.b-ikDQ6TrLbTBnoy5OmLFkfuptPX2DQVK9Y_S9eIrIQ',
        }
    })
        .then(mcfarlane_users => mcfarlane_users.json())
        .then(async mcfarlane_users => {

            mcfarlane_users?.data?.map(async (user, index) => {

                try {

                    const mcfarlane_username = user.username
                    const mcfarlane_id = user.id
                    await setTimeout(500 * index)

                    const getUserAssets = await fetch(`https://api.mcfarlanedigital.app/gallery?type=Collectible&limit=1&offset=0&associated_user_id=${mcfarlane_id}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': '*/*',
                            'Accept-Encoding': 'deflate, gzip',
                            'User-Agent': 'UnityPlayer/2021.3.1f1 (UnityWebRequest/1.0, libcurl/7.80.0-DEV)',
                            'X-Unity-Version': '2021.3.1f1',
                            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU4ZGE2NTkzLTBiNTAtNDRiMi1iYzBkLTM5NWQ3MDhhMTA3OCIsImlhdCI6MTY4NDg1NDI2NywiZXhwIjoxNjg3NDQ2MjY3fQ.Fpp2JfvzbzVqt3-cf2ILrxMeCaNmqJt1yhOROBaSbGA',
                        }
                    })

                    const userAssets = await getUserAssets.json()

                    if (userAssets && userAssets.totalCount > 0){
                        const token_id = userAssets?.data[0]?.tokenId
                        const address = userAssets?.data[0]?.address
                        const getWallet = await fetch(`https://api.rarible.org/v0.1/ownerships/byItem?itemId=${address}:${token_id}&size=1`, {
                            method: 'GET',
                            headers:{
                                'Content-Type': 'application/json',
                            },
                        })
                        const wallet = await getWallet.json()
                        if (wallet && wallet?.ownerships[0]){
                            const user_wallet = wallet?.ownerships[0]?.owner
                            console.log(`User ${mcfarlane_username} wallet is: ${user_wallet}`)

                            await prisma.mcfarlane_wallets.create({
                                data: {
                                    id: user_wallet,
                                    mcfarlane_username: mcfarlane_username,
                                    mcfarlane_id: mcfarlane_id
                                }
                            })

                        }
                    } else {
                        console.log('User has no assets.', mcfarlane_username)
                    }

                } catch (e) {
                    console.log('nah...', e)
                }

            })
        })
        .catch(err => console.log('[ERROR] Unable to fetch mcfarlane users...', err))
}

MCFARLANE_GET_USERS()