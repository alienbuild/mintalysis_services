import puppeteer from "puppeteer";
import { prisma } from "../../index.js";
import slugify from 'slugify'
const chatGptKey = "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"
import { ChatGPTAPI } from 'chatgpt'
import {setTimeout} from "node:timers/promises";

const chatgpt = new ChatGPTAPI({
    apiKey: chatGptKey,
    completionParams: {
        model: 'gpt-4',
    }
})

const delay = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));

export const VEVE_SCRAPE_OFFICIAL_BLOG = async () => {
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
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto(url);

    const title = await page.$eval('.blog-post-heading-2', h1 => h1.innerText.trim());
    const publishedDate = await page.$eval('.text-block-11', elem => elem.textContent.trim());

    const article = await page.$eval('.blog-post-container', element => {
        const rawHTML = document.querySelector('.blog-post-container .w-richtext').innerHTML;
        const dom = new DOMParser().parseFromString(rawHTML, 'text/html');

        dom.querySelectorAll('*').forEach(node => {
            // Remove all class attributes
            if (node.hasAttribute('class')) {
                node.removeAttribute('class');
            }
            // Remove all id attributes
            if (node.hasAttribute('id')) {
                node.removeAttribute('id');
            }
        });

        const mainArticleHTML = dom.body.innerHTML;
        const mainImage = element.querySelector('img').getAttribute('src');
        // const mainArticleHTML = element.querySelector('.blog-post-container .w-richtext').innerHTML;
        const subtitle = element.querySelector('.blog-post-container .blog-post-summary').textContent

        return {
            mainImage,
            mainArticleHTML,
            subtitle
        };
    });

    console.log(`Saving article: ${title}`);
    const parsedDate = new Date(publishedDate);

    await prisma.article.create({
        data: {
            image: article.mainImage,
            author: {
                connect: {
                    id: "771849d5-5701-452a-b4ae-a67ddfe92fe3"
                }
            },
            project: {
                connect: {
                    id: "de2180a8-4e26-402a-aed1-a09a51e6e33d"
                }
            },
            published: true,
            createdAt: parsedDate,
            slug: slugify(title, { lower: true, strict: true }) + "-" + Date.now(),
            to_process: true,
            translations: {
                create: [
                    {
                        language: "EN",
                        title,
                        content: article.mainArticleHTML,
                        subtitle: article.subtitle
                    }
                ]
            }
        }
    })

    await browser.close();
    console.log(`Article saved: ${title}`);
}

export const VEVE_TRANSLATE_OFFICIAL_ARTICLES = async () => {
    console.log('Retrieving articles')

    let skip = 0;

    while (true) {
        const article = await prisma.article.findFirst({
            where:{ to_process: true },
            include: {
                translations:{ where:{ language: "EN" } }
            },
            skip: skip,
            orderBy: { id: 'asc' },
        })

        if (!article) break;

        await processArticle(article);
        skip++;
    }

    console.log('ALL ARTICLES PROCESSED');
}

const processArticle = async (article) => {
    console.log('Processing')
    console.log(`Processing article ID: ${article.id}`);

    if (!article.translations[0].content) return

    console.log('Rewriting article with html for article: ', article.id)
    const htmlMessage = `rewrite the below article and provide clean semantic html elements
    but do not return to me and head, body, main elements only provide the the article text rewritten and
    the html elements for any text and headings. Do not omit any product details, images or videos.
    article: ${article.translations[0].content}`
    const html = await chatgpt.sendMessage(htmlMessage)

    console.log('Rewriting title for article: ', article.id)
    const titleMessage = `Rewrite the below title and return only the string result. Do not use quote marks.
    ${article.translations[0].title}`
    const title = await chatgpt.sendMessage(titleMessage)

    console.log('Rewriting subtitle for article: ', article.id)
    const subtitleMessage = `Rewrite the below subtitle and return only the string result. Do not use quote marks.
    ${article.translations[0].subtitle}`
    const subtitle = await chatgpt.sendMessage(subtitleMessage)

    await prisma.article_translations.upsert({
        where: {
            language_article_id: {
                article_id: article.id,
                language: "EN",
            }
        },
        update: {
            content: html.text,
            title: title.text,
            subtitle: subtitle.text,
        },
        create: {
            content: html.text,
            title: title.text,
            subtitle: subtitle.text,
            language: "EN",
            article_id: article.id
        }
    });

    await prisma.article.update({
        where: { id: article.id },
        data: { to_process: false }
    });

    console.log('[SAVED] article rewritten. ', article.id)

};

VEVE_TRANSLATE_OFFICIAL_ARTICLES()