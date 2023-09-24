const puppeteer = require('puppeteer');

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

const scrapeXAccount = async (page, accountUrl) => {
    await page.goto(accountUrl);
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });
        await page.waitForTimeout(1000);
    }

    const tweets = await page.evaluate(() => {
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        const tweets = [];

        for (const tweetElement of tweetElements) {
            const tweetTextElement = tweetElement.querySelector('[lang]');
            const tweetLinkElement = tweetElement.querySelector('a[href^="/veve_official/status/"]');

            if (tweetTextElement && tweetLinkElement) {
                const tweetText = tweetTextElement.textContent.trim();
                const tweetLink = 'https://twitter.com' + tweetLinkElement.getAttribute('href');

                const likeElement = tweetElement.querySelector('[data-testid^="like"] [dir] > div > span > span');
                const commentElement = tweetElement.querySelector('[data-testid^="reply"] [dir] > div > span > span');
                const repostElement = tweetElement.querySelector('[data-testid^="retweet"] [dir] > div > span > span');

                const likeCount = likeElement ? likeElement.textContent.trim() : '0';
                const commentCount = commentElement ? commentElement.textContent.trim() : '0';
                const repostCount = repostElement ? repostElement.textContent.trim() : '0';

                tweets.push({
                    text: tweetText,
                    link: tweetLink,
                    likeCount,
                    commentCount,
                    repostCount,
                });
            }
        }

        return tweets;
    });
    const accountInfo = await page.evaluate(() => {
        const ownerInfo = {};
        const profileHeader = document.querySelector('div[data-testid="primaryColumn"]');

        if (profileHeader) {
            const avatar = profileHeader.querySelector('img[src*="/profile_images/"]');
            const followersCount = profileHeader.querySelector('a[href="/veve_official/verified_followers"] span > span')
            const followingCount = profileHeader.querySelector('a[href="/veve_official/following"] span > span')

            ownerInfo.avatar = avatar ? avatar.src : '';
            ownerInfo.followersCount = followersCount ? followersCount.textContent.trim() : 0
            ownerInfo.followingCount = followingCount ? followingCount.textContent.trim() : 0
        }

        return ownerInfo;
    });

    await saveXInfo(accountInfo, tweets)
}

const saveXInfo = async (accountInfo, tweets) => {
    console.log('Saving account info', accountInfo)
    console.log('Saving tweets too..')
}

export const SCRAPE_X_DOT_COM = async (prisma) => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await loginToX(page);

    const veveAccountUrl = 'https://twitter.com/veve_official';
    // const mcfarlaneAccountUrl = 'https://twitter.com/mcfarlane_official';

    await scrapeXAccount(page, veveAccountUrl);
    // await scrapeXAccount(page, mcfarlaneAccountUrl);

    await browser.close();
}