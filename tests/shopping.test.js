import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isExcludedShoppingQuery, shoppingCategories, shoppingLink, shoppingQuery,
  shoppingQueryLimit, shoppingRetailerLink, shoppingSearchKey
} from '../assets/shopping-data.js';
import { amazonProduct, amazonProductUrl, amazonProducts, findAmazonProducts } from '../assets/shopping-products.js';

test('retailer results use official U.S. marketplace URLs and encode the query', () => {
  const search = { query: 'C++ games & tag=affiliate #1', category: 'books' };
  const amazon = new URL(shoppingRetailerLink('amazon', search));
  assert.equal(amazon.origin, 'https://www.amazon.com');
  assert.equal(amazon.pathname, '/s');
  assert.deepEqual(Object.fromEntries(amazon.searchParams), { k: search.query, i: 'stripbooks' });
  assert.equal(amazon.hash, '');

  const ebay = new URL(shoppingRetailerLink('ebay', search));
  assert.equal(ebay.origin, 'https://www.ebay.com');
  assert.equal(ebay.pathname, '/sch/i.html');
  assert.deepEqual(Object.fromEntries(ebay.searchParams), { _nkw: search.query, _sacat: '267' });
  assert.equal(shoppingRetailerLink('example.com', search), '');
  assert.equal(shoppingRetailerLink('ebay'), '');
});

test('each shopping category has concrete safe destination searches for both retailers', () => {
  const ids = new Set();
  for (const category of shoppingCategories) {
    assert.ok(!ids.has(category.id));
    ids.add(category.id);
    assert.ok(category.topics.length >= 3);
    for (const retailer of ['amazon', 'ebay']) {
      const key = retailer === 'amazon' ? 'k' : '_nkw';
      const department = retailer === 'amazon' ? 'i' : '_sacat';
      const result = new URL(shoppingRetailerLink(retailer, { category: category.id }));
      assert.equal(result.searchParams.get(key), category.example);
      assert.equal(result.searchParams.get(department), category[retailer] || null);
      for (const query of category.topics) assert.ok(shoppingRetailerLink(retailer, { query, category: category.id }));
    }
  }
});

test('shopping routes bound and normalize queries and ignore unknown request fields', () => {
  assert.equal(shoppingQuery('  USB-C\n\tＨｕｂ  '), 'USB-C Hub');
  assert.equal([...shoppingQuery('🎮'.repeat(shoppingQueryLimit + 20))].length, shoppingQueryLimit);
  assert.equal(shoppingQuery(null), '');
  assert.equal(shoppingLink({ query: 'Game & book', category: 'books', retailer: 'ebay' }),
    '#shopping?q=Game+%26+book&category=books&retailer=ebay');
  assert.equal(shoppingLink({ category: 'unknown', retailer: 'example.com' }), '#shopping');
  assert.equal(shoppingSearchKey({ query: 'Game & book', category: '', retailer: '' }),
    shoppingSearchKey({ query: 'game & book', category: '', retailer: '' }));
});

test('excluded search terms never generate retailer links', () => {
  for (const query of ['handgun ammo', 'e-cigarettes', 'cannabis', 'adult toys']) {
    assert.ok(isExcludedShoppingQuery(query));
    assert.equal(shoppingLink({ query }), '#shopping');
    assert.equal(shoppingRetailerLink('ebay', { query, category: 'gaming' }), '');
    assert.equal(shoppingRetailerLink('amazon', { query }), '');
  }
  assert.equal(isExcludedShoppingQuery('shotgun microphone'), false);
  assert.equal(isExcludedShoppingQuery('puzzle games'), false);
});

test('catalog products point to exact official listings and support term and category filters', () => {
  const categories = new Set(shoppingCategories.map(category => category.id));
  assert.equal(new Set(amazonProducts.map(product => product.asin)).size, amazonProducts.length);
  for (const product of amazonProducts) {
    assert.match(product.asin, /^[A-Z0-9]{10}$/);
    assert.ok(categories.has(product.category));
    assert.ok(product.specs.length);
    assert.equal(new URL(product.source).protocol, 'https:');
    assert.equal(amazonProductUrl(product.asin), 'https://www.amazon.com/dp/' + product.asin);
  }
  const results = findAmazonProducts({ query: 'USB-C hubs & HDMI', category: 'computers' });
  assert.deepEqual(results.map(item => item.asin), ['B0D9R5SNG1', 'B0CB95R3VM']);
  assert.equal(findAmazonProducts({ query: 'USB-C hubs & HDMI', category: 'gaming' }).length, 0);
  assert.equal(findAmazonProducts({ query: '///' }).length, 0);
  assert.equal(amazonProduct('b0dm1wh5bv').asin, 'B0DM1WH5BV');
  assert.equal(shoppingLink({ query: '8BitDo', product: 'B0DM1WH5BV' }), '#shopping?q=8BitDo&retailer=amazon&product=B0DM1WH5BV');
  assert.equal(shoppingLink({ product: 'https://outside.example' }), '#shopping');
  assert.equal(amazonProductUrl('B0DM1WH5BZ'), '');
});
