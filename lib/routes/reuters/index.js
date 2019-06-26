const utils = require('./utils')

module.exports = async (ctx) => {
  const doingCacheKey = 'Doing';
  const itemsCacheKey = 'Items';

  if (!await ctx.cache.get(doingCacheKey)) {
    await ctx.cache.set(doingCacheKey, 'doing');
    utils.getItems(ctx, 'https://cn.reuters.com/').then(function (items) {
      ctx.cache.set(itemsCacheKey, JSON.stringify(items));
    }).catch(function (e) {
      console.error(e);
    }).finally(function () {
      ctx.cache.set(doingCacheKey, null);
    });
  }

  var items;
  var itemsString = await ctx.cache.get(itemsCacheKey);
  if (itemsString) {
    items = JSON.parse(itemsString);
  } else {
    items = [];
  }

  ctx.state.data = {
    title: '路透社',
    link: 'https://cn.reuters.com',
    description: '路透社-中文',
    item: items
  };
};
