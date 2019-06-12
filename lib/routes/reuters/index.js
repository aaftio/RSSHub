const utils = require('./utils')

module.exports = async (ctx) => {
  const doingCacheKey = 'Doing';
  const itemsCacheKey = 'Items';

  var items;
  if (await ctx.cache.get(doingCacheKey)) {
    var itemsString = await ctx.cache.get(itemsCacheKey);
    if (itemsString) {
      items = JSON.parse(itemsString);
    } else {
      items = [];
    }
  } else {
    await ctx.cache.set(doingCacheKey, 'doing');

    items = await utils.getItems(ctx, 'https://cn.reuters.com/');
    await ctx.cache.set(itemsCacheKey, JSON.stringify(items));

    await ctx.cache.set(doingCacheKey, null);
  }

  ctx.state.data = {
    title: '路透社',
    link: 'https://cn.reuters.com',
    description: '路透社-中文',
    item: items
  };
};
