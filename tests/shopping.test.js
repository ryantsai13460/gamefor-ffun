import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isExcludedShoppingQuery, shoppingCategories, shoppingLink, shoppingQuery,
  shoppingQueryLimit, shoppingRetailerLink, shoppingSearchKey
} from '../assets/shopping-data.js';

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
