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

        //处理超链接的相对路径、绝对路径、相对协议等
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

        //处理超链接可能的查询参数,导致文章重复
        let index = articleUrl.indexOf('?');
        if (index > -1) {
            articleUrl = articleUrl.substring(0, index);
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
        if (item.title === 'redirect') {
            //此链接为跳转链接,返回其真实链接的内容(当为跳转链接时其真实内容都会被获取并缓存)
            return await getArticleItemCache(ctx, item.link);;
        } else {
            return item;
        }
    } else {
        try {
            await page.goto(articleUrl, { timeout: 300000 });

            const realUrl = page.url();

            if (realUrl !== articleUrl) {
                //页面被跳转了
                let redirectItem = { title: 'redirect', description: '', author: '', link: realUrl };
                setArticleItemCache(ctx, articleUrl, redirectItem);
            }

            const title = await page.evaluate(
                () => document.querySelector('h1.ArticleHeader_headline').textContent
            );

            //清除广告
            await page.$$eval('div[data-ad-type]', els => {
                for (i in els) {
                    els[i].outerHTML = '';
                }
            });
            const description = await page.$eval('div.StandardArticleBody_body', el => el.outerHTML);

            const author = await page.evaluate(
                () => document.querySelector('div.BylineBar_byline').textContent
            );
            item = { title, description, author, link: realUrl };
            setArticleItemCache(ctx, realUrl, item);
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
    for (i in articleUrls.slice(0, 5)) {
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
