export const shoppingCategories = [
  {
    id: 'gaming', title: 'Gaming gear', description: 'Controllers, charging stands, and accessories for your setup.',
    amazon: 'videogames', ebay: '1249', example: 'game controllers',
    topics: ['Game controllers', 'Controller charging docks', 'Handheld console cases']
  },
  {
    id: 'computers', title: 'Computers & accessories', description: 'Keyboards, storage, and connections for your desk.',
    amazon: 'computers', ebay: '58058', example: 'computer accessories',
    topics: ['Mechanical keyboards', 'External SSDs', 'USB-C hubs']
  },
  {
    id: 'technology', title: 'Technology & audio', description: 'Headphones, speakers, and other everyday electronics.',
    amazon: 'electronics', ebay: '293', example: 'headphones',
    topics: ['Wireless headphones', 'Portable speakers', 'Webcams']
  },
  {
    id: 'books', title: 'Books', description: 'Programming guides, game design books, and fiction.',
    amazon: 'stripbooks', ebay: '267', example: 'programming books',
    topics: ['Programming books', 'Game design books', 'Piano sheet music books']
  },
  {
    id: 'tabletop', title: 'Board games & puzzles', description: 'Find games for the table, family, or a quiet afternoon.',
    amazon: 'toys-and-games', ebay: '220', example: 'board games and puzzles',
    topics: ['Cooperative board games', 'Jigsaw puzzles', 'Chess sets']
  },
  {
    id: 'collectibles', title: 'Collectibles', description: 'Explore figures, display cases, and ways to organize a collection.',
    amazon: '', ebay: '1', example: 'collectible figures',
    topics: ['Collectible figures', 'Trading card binders', 'Collectible display cases']
  }
];

export const shoppingRetailers = [
  { id: 'amazon', title: 'Amazon', host: 'www.amazon.com' },
  { id: 'ebay', title: 'eBay', host: 'www.ebay.com' }
];

export const shoppingStorageKey = 'gamefor-ffun-shopping-v1';
export const shoppingQueryLimit = 100;
export const shoppingSavedLimit = 24;
const maxRecent = 8;
const categoriesById = new Map(shoppingCategories.map(category => [category.id, category]));
const retailersById = new Map(shoppingRetailers.map(retailer => [retailer.id, retailer]));
const excludedTerms = /\b(?:firearms?|handguns?|pistols?|revolvers?|airsoft|ammunition|ammo|rifles?|shotguns?(?!\s+(?:mic|microphone)s?\b)|stun\s+guns?|tasers?|crossbows?|combat\s+knives|switchblades?|vapes?|vaping|e[\s-]?cigarettes?|nicotine|tobacco|cannabis|marijuana|alcoholic drinks?|liquor|whisk(?:ey|y)|hard\s+seltzer|adult\s+toys?|pornography)\b/iu;

export function shoppingQuery(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.slice(0, shoppingQueryLimit * 4).normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return [...normalized].slice(0, shoppingQueryLimit).join('').trimEnd();
}

export function isExcludedShoppingQuery(value) {
  return excludedTerms.test(value);
}

export function shoppingCategory(id) {
  return categoriesById.get(id);
}

export function shoppingLink({ query, category, retailer } = {}) {
  const params = new URLSearchParams();
  const text = shoppingQuery(query);
  if (text && !isExcludedShoppingQuery(text)) params.set('q', text);
  if (categoriesById.has(category)) params.set('category', category);
  if (retailersById.has(retailer)) params.set('retailer', retailer);
  return '#shopping' + (params.size ? '?' + params : '');
}

export function shoppingRetailerLink(retailerId, { query, category } = {}) {
  const retailer = retailersById.get(retailerId);
  if (!retailer) return '';
  const department = categoriesById.get(category);
  const text = shoppingQuery(query) || department?.example;
  if (!text || isExcludedShoppingQuery(text)) return '';
  const amazon = retailerId === 'amazon';
  const url = new URL(amazon ? '/s' : '/sch/i.html', 'https://' + retailer.host);
  url.searchParams.set(amazon ? 'k' : '_nkw', text);
  const departmentId = department?.[retailerId];
  if (departmentId) url.searchParams.set(amazon ? 'i' : '_sacat', departmentId);
  return url.href;
}

export function shoppingSearchKey({ query, category, retailer }) {
  return JSON.stringify([query.toLowerCase(), category, retailer]);
}

function restoredSearch(value) {
  if (!value || typeof value !== 'object') return null;
  const query = shoppingQuery(value.query);
  const category = categoriesById.has(value.category) ? value.category : '';
  if ((!query && !category) || isExcludedShoppingQuery(query)) return null;
  const retailer = retailersById.has(value.retailer) ? value.retailer : '';
  return { query, category, retailer };
}

function restoredSearches(values, limit) {
  if (!Array.isArray(values)) return [];
  const restored = new Map();
  for (const value of values.slice(0, limit * 4)) {
    const search = restoredSearch(value);
    if (search) {
      const key = shoppingSearchKey(search);
      if (!restored.has(key)) restored.set(key, search);
    }
    if (restored.size >= limit) break;
  }
  return [...restored.values()];
}

function restoreShoppingState(value) {
  return {
    interests: Array.isArray(value?.interests)
      ? [...new Set(value.interests.slice(0, 30).filter(id => categoriesById.has(id)))] : [],
    saved: restoredSearches(value?.saved, shoppingSavedLimit),
    recent: restoredSearches(value?.recent, maxRecent)
  };
}

let sessionState = restoreShoppingState(null);
let sessionOnly = false;

export function getShoppingLibraryState() {
  try {
    if (!sessionOnly && globalThis.localStorage) {
      sessionState = restoreShoppingState(JSON.parse(globalThis.localStorage.getItem(shoppingStorageKey) ?? 'null'));
    }
  } catch {
    // Keep changes from this tab if browser storage cannot be read.
  }
  return { interests: [...sessionState.interests], saved: sessionState.saved.map(s => ({ ...s })), recent: sessionState.recent.map(s => ({ ...s })) };
}

export function updateShoppingLibrary(update) {
  const state = getShoppingLibraryState();
  update(state);
  sessionState = restoreShoppingState(state);
  try {
    globalThis.localStorage.setItem(shoppingStorageKey, JSON.stringify(sessionState));
    sessionOnly = false;
    return true;
  } catch {
    sessionOnly = true;
    return false;
  }
}
