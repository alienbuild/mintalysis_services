import puppeteer from "puppeteer";
import { prisma } from "../../index.js";
import slugify from 'slugify'

const VEVE_SCRAPE_OFFICIAL_BLOG = async () => {
    const baseUrl = 'https://www.veve.me/blog-pages/collectibles?7b18dd40_page=';
    let pageNum = 1;
    let articleUrls = [];
    const maxPages = 10

    while (pageNum <= maxPages) {
        const url = `${baseUrl}${pageNum}`;
        console.log(`Starting the scrape for url: ${url}`);
        const pageUrls = await scrapeListPageForArticleUrls(url);
        if (pageUrls.length === 0) {
            break; // Break the loop if no URLs are found
        }
        articleUrls.push(...pageUrls);
        pageNum++;
    }

    console.log(`Scraping individual articles...`, articleUrls);
    for (const articleUrl of articleUrls) {
        await scrapeArticleAndSave(articleUrl);
    }

    console.log('SCRAPE COMPLETE');
}

async function scrapeListPageForArticleUrls(url) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto(url);

    const articleUrls = await page.$$eval('a.blog-article-link', elements =>
        elements.map(el => el.href));

    // const articleUrls = await page.$$eval('.latest-drops-blog', elements =>
    //     elements.map(el => el.href));

    await browser.close();
    return articleUrls;
}

async function scrapeArticleAndSave(url) {
    console.log(`Navigating to article URL: ${url}`);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const title = await page.$eval('.blog-post-heading-2', h1 => h1.innerText.trim());
    const publishedDate = await page.$eval('.text-block-11', elem => elem.textContent.trim());

    const article = await page.$eval('.blog-post-container', element => {
        const mainImage = element.querySelector('img').getAttribute('src');
        const mainArticleHTML = element.querySelector('.blog-post-container .w-richtext').innerHTML;
        const subtitle = element.querySelector('.blog-post-container .blog-post-summary').textContent

        return {
            mainImage,
            mainArticleHTML,
            subtitle
        };
    });


    console.log(`Saving article: ${title}`);
    const parsedDate = new Date(publishedDate);

    await prisma.tmp_veve_news.create({
        data: {
            original_link: url,
            content: article.mainArticleHTML,
            title,
            subtitle: article.subtitle,
            published_at: parsedDate,
            image: article.mainImage,
            slug: slugify(title, { lower: true, strict: true })
        }
    });

    await browser.close();
    console.log(`Article saved: ${title}`);
}

VEVE_SCRAPE_OFFICIAL_BLOG();
