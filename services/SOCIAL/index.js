// MAIN CALLERS (EXPORTED) ARE THE BOTTOM OF THE PAGE

const puppeteer = require('puppeteer');

// FUNCTIONS
const getYouTubeStats = async (prisma, project_id, channel_id) => {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channel_id}&key=${process.env.YOUTUBE_API_KEY}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        const subscribers = Number(data.items[0].statistics.subscriberCount)
        const videos = Number(data.items[0].statistics.videoCount)
        const views = Number(data.items[0].statistics.viewCount)

        await prisma.youtube_account.upsert({
            where: { project_id },
            update: {
                subscribers,
                videos,
                views
            },
            create: {
                subscribers,
                videos,
                views,
                channel_id
            }
        })

        console.log(`[SUCCESS] YouTube metrics saved for ${project_id}`)

    } catch (error) {
        console.error('YouTube API error:', error);
    }
}

const getInstagramStats = async (prisma, project_id, instagram_id) => {
    try {
        const response = await fetch(`https://graph.instagram.com/${instagram_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${process.env.INSTAGRAM_API_KEY}`);

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        const followers = data.followers_count;
        const following = data.follows_count
        const media = data.media_count

    } catch (error) {
        console.error('Instagram API error:', error);
    }
}

const loginToX = async (page) => {
    await page.goto('https://twitter.com/i/flow/login')

    await page.waitForSelector('input[autocomplete="username"]');
    await page.type('input[name="text"]', process.env.X_EMAIL);

    const nextButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('div[dir="ltr"] span'));
        return buttons.find(button => button.textContent === 'Next');
    });
    await nextButton.click();

    const confirmationInput = await page.waitForSelector('input[data-testid="ocfEnterTextTextInput"]', { timeout: 5000 });
    if (confirmationInput) {
        await confirmationInput.type(process.env.X_USERNAME);
    }

    const nextNextButton = await page.waitForSelector('div[data-testid="ocfEnterTextNextButton"]', { timeout: 5000 });
    if (nextNextButton) {
        await nextNextButton.click();
    }

    await page.waitForSelector('input[name="password"]');
    await page.type('input[name="password"]', process.env.X_PASSWORD);

    const loginButton = await page.waitForSelector('div[data-testid="LoginForm_Login_Button"]', { timeout: 5000 });
    await loginButton.click();

    await page.waitForSelector('a[data-testid="SideNav_NewTweet_Button"]');
}

const scrapeXAccount = async (page, accountHandle, prisma) => {

    await prisma.x_posts.deleteMany({
        where:{
            handle: accountHandle
        }
    })

    await page.goto(`https://twitter.com/${accountHandle}`);
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });
        await page.waitForTimeout(1000);
    }

    const tweets = await page.evaluate((accountHandle) => {
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        const tweets = [];

        tweetElements.forEach((tweetElement) => {
            let tweetText = tweetElement.querySelector('[data-testid="tweetText"]').textContent.trim();

            let photoURL = null;
            const photoElement = tweetElement.querySelector('[data-testid="tweetPhoto"] img');
            if (photoElement) {
                photoURL = photoElement.src;
            }

            let createdAt = null;
            const timeElement = tweetElement.querySelector('time');
            if (timeElement) {
                createdAt = timeElement.getAttribute('datetime');
            }

            const tweetTextElement = tweetElement.querySelector('[lang]');
            const tweetLinkElement = tweetElement.querySelector(`a[href^="/${accountHandle}/status/"]`);

            if (tweetTextElement && tweetLinkElement) {
                const tweetLink = 'https://twitter.com' + tweetLinkElement.getAttribute('href');

                const likeElement = tweetElement.querySelector('[data-testid^="like"] [dir] > div > span > span');
                const commentElement = tweetElement.querySelector('[data-testid^="reply"] [dir] > div > span > span');
                const repostElement = tweetElement.querySelector('[data-testid^="retweet"] [dir] > div > span > span');

                const likeCount = likeElement ? likeElement.textContent.trim() : '0';
                const commentCount = commentElement ? commentElement.textContent.trim() : '0';
                const repostCount = repostElement ? repostElement.textContent.trim() : '0';

                tweets.push({
                    handle: accountHandle,
                    text: tweetText,
                    link: tweetLink,
                    like_count: Number(likeCount),
                    comment_count: Number(commentCount),
                    repost_count: Number(repostCount),
                    image: photoURL,
                    createdAt
                });
            }
        });

        return tweets;
    }, accountHandle);

    const accountInfo = await page.evaluate((accountHandle) => {
        const ownerInfo = {};
        const profileHeader = document.querySelector('div[data-testid="primaryColumn"]');
        const headerImage = document.querySelector('img[src*="/profile_banners/"]');
        const displayNameElement = profileHeader.querySelector('h2[role="heading"][aria-level="2"]');
        const joinDateElement = profileHeader.querySelector('span[data-testid="UserJoinDate"] span');
        if (joinDateElement) {
            const joinDateString = joinDateElement.textContent.trim().replace('Joined ', '');
            const parts = joinDateString.split(' ');
            const month = parts[0];
            const year = parts[1];
            const joinDate = new Date(`${month} 1, ${year}`);
            ownerInfo.joinDate = joinDate.toISOString();
        } else {
            ownerInfo.joinDate = '';
        }
        const convertTwitterCount = (str) => {
            let multiplier = 1;
            str = str.replace(/,/g, '');
            if (str.endsWith('K')) {
                multiplier = 1000;
                str = str.slice(0, -1);
            } else if (str.endsWith('M')) {
                multiplier = 1000000;
                str = str.slice(0, -1);
            }

            const number = parseFloat(str);
            if (isNaN(number)) return null;
            return number * multiplier;
        }

        if (profileHeader) {
            const avatar = profileHeader.querySelector('img[src*="/profile_images/"]');
            const followersCount = profileHeader.querySelector(`a[href="/${accountHandle}/followers"] span > span`) || profileHeader.querySelector(`a[href="/${accountHandle}/verified_followers"] span > span`);
            const followingCount = profileHeader.querySelector(`a[href="/${accountHandle}/following"] span > span`);

            ownerInfo.avatar = avatar ? avatar.src : '';
            ownerInfo.coverPhoto = headerImage ? headerImage.src : '';
            ownerInfo.followersCount = followersCount ? convertTwitterCount(followersCount.textContent.trim()) : 0;
            ownerInfo.followingCount = followingCount ? convertTwitterCount(followingCount.textContent.trim()) : 0;
            ownerInfo.displayName = displayNameElement ? displayNameElement.textContent.trim() : '';
            ownerInfo.joinDate = joinDateElement ? joinDateElement.textContent.trim().replace('Joined ', '') : '';

        }

        return ownerInfo;
    }, accountHandle);

    const saveObj = {
        account: accountInfo,
        tweets: tweets,
    }
    await saveXInfo(accountHandle, saveObj, prisma)

}

const saveXInfo = async (accountHandle, saveObj, prisma) => {
    try {
        await prisma.x_account.upsert({
            where: {
                handle: accountHandle
            },
            update: {
                avatar: saveObj.account.avatar,
                followers: saveObj.account.followersCount,
                following: saveObj.account.followingCount,
                display_name: saveObj.account.displayName,
                join_date: new Date(saveObj.account.joinDate),
                cover_photo: saveObj.account.coverPhoto,
            },
            create: {
                handle: accountHandle,
                display_name: saveObj.account.displayName,
                join_date: new Date(saveObj.account.joinDate),
                cover_photo: saveObj.account.coverPhoto,
                avatar: saveObj.account.avatar,
                followers: saveObj.account.followersCount,
                following: saveObj.account.followingCount,
            }
        })
        await prisma.x_posts.createMany({
            data: saveObj.tweets
        })
    } catch (e) {
        console.log('[ERROR] Unable to save tweets: ', e)
    }
}

// GENERIC SOCIAL JOBS
export const GET_SOCIAL_STATS = async (prisma) => {

    const PROJECT_ID_VEVE = "de2180a8-4e26-402a-aed1-a09a51e6e33d"
    const PROJECT_ID_MCFARLANE = "99ff1ba5-706d-4d15-9f3d-de4247ac3a7b"

    // GET VEVE SOCIAL STATS
    await getYouTubeStats(prisma, PROJECT_ID_VEVE, "UC6psiYgowNPQbodOphinq1A")
    // await getInstagramStats(prisma, PROJECT_ID_VEVE, '')

    // GET MCFARLANE SOCIAL STATS
    // await getYouTubeStats(prisma, PROJECT_ID_MCFARLANE, process.env.VEVE_YOUTUBE_CHANNEL_ID, process.env.YOUTUBE_API_KEY)
}

// X.COM (FORMERLY TWITTER)
export const SCRAPE_X_DOT_COM = async (prisma) => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await loginToX(page);

    const veveHandle = 'veve_official';
    const mcfarlaneHandle = 'mcfarlanetoys';

    await scrapeXAccount(page, veveHandle, prisma);
    await scrapeXAccount(page, mcfarlaneHandle, prisma);

    await browser.close();
}

// Daily snapshots of the X accounts followers and following
export const X_DAILY_SNAPSHOT = async (prisma) => {
    const snapshots = await prisma.x_account.findMany({})
    snapshots.map(async snap => {
        await prisma.x_account_snapshot.create({
            data:{
                handle: snap.handle,
                followers: snap.followers,
                following: snap.following
            }
        })
    })
}