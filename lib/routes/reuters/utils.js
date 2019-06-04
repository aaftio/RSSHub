const axios = require('../../utils/axios');
const cheerio = require('cheerio');

const titleSuffix = '-title';
const descriptionSuffix = '-description';
const authorSuffix = '-author';

const getArticleUrl = async (url) => {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    while (url.endsWith('/')) {
        url = url.substr(0, url.length - 1);
    }
    var articleUrls = $('a[href*="/article/"]').map((i, el) => {
        var articleUrl = $(el).attr('href');
        if (articleUrl.startsWith('//')) {
            if (url.startsWith('https')) {
                articleUrl = 'https:' + articleUrl;
            } else {
                articleUrl = 'http:' + articleUrl;
            }
        } else if (articleUrl.startsWith('/')) {
            articleUrl = url + articleUrl;
        } else if (!articleUrl.startsWith('http://') && !articleUrl.startsWith('https://')) {
            articleUrl = url + '/' + articleUrl;
        }
        return articleUrl;
    }).get();

    //去重复
    return Array.from(new Set(articleUrls));
}

const getArticleItemCache = async (ctx, articleUrl) => {
    const title = await ctx.cache.get(articleUrl + titleSuffix);
    if (title) {
        const description = await ctx.cache.get(articleUrl + descriptionSuffix);
        const author = await ctx.cache.get(articleUrl + authorSuffix);
        return { title, description, author, link: articleUrl };
    } else {
        return null;
    }
};

const setArticleItemCache = (ctx, articleUrl, item) => {
    ctx.cache.set(articleUrl + titleSuffix, item.title);
    ctx.cache.set(articleUrl + descriptionSuffix, item.description);
    ctx.cache.set(articleUrl + authorSuffix, item.author);
};

const getArticleItem = async (ctx, page, articleUrl) => {
    let item = await getArticleItemCache(ctx, articleUrl);
    if (item) {
        return item;
    } else {
        try {
            await page.goto(articleUrl, { timeout: 300000 });
            const title = await page.evaluate(
                () => document.querySelector('h1.ArticleHeader_headline').textContent
            );
            const description = await page.evaluate(
                () => document.querySelector('div.StandardArticleBody_body').outerHTML
            );
            const author = await page.evaluate(
                () => document.querySelector('div.BylineBar_byline').textContent
            );
            item = { title, description, author, link: articleUrl };
            setArticleItemCache(ctx, articleUrl, item);
            return item;
        } catch (e) {
            console.error(e);
            return null;
        }
    }
};


const getItems = async (ctx, indexUrl) => {
    const articleUrls = await getArticleUrl(indexUrl);

    // 使用 RSSHub 提供的 puppeteer 工具类，初始化 Chrome 进程
    const browser = await require('../../utils/puppeteer')();

    // 创建一个新的浏览器页面
    const page = await browser.newPage();
    var items = new Set();
    for (i in articleUrls) {
        var item = await getArticleItem(ctx, page, articleUrls[i]);
        if (item) {
            items.add(item);
        }
    }
    page.close();
    browser.close();

    return Array.from(items);
};

module.exports = {
    getItems
};
