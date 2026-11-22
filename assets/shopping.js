const version = new URL(import.meta.url).search;
const {
  getShoppingLibraryState, isExcludedShoppingQuery, shoppingCategories, shoppingCategory,
  shoppingLink, shoppingQuery, shoppingQueryLimit, shoppingRetailerLink, shoppingRetailers,
  shoppingSavedLimit, shoppingSearchKey, shoppingStorageKey, updateShoppingLibrary
} = await import(`./shopping-data.js${version}`);

export { getShoppingLibraryState, shoppingLink };

export function clearShoppingHistory() {
  return updateShoppingLibrary(state => { state.recent = []; });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label, callback, signal, className = 'button') {
  const result = element('button', className, label);
  result.type = 'button';
  result.addEventListener('click', callback, { signal });
  return result;
}

function link(label, href, className) {
  const result = element('a', className, label);
  result.href = href;
  return result;
}

function field(label, control) {
  const wrapper = element('label', 'shopping-field');
  wrapper.append(element('span', '', label), control);
  return wrapper;
}

function select(items, label, selected) {
  const result = element('select', 'field');
  const all = element('option', '', label);
  all.value = '';
  result.append(all);
  for (const item of items) {
    const option = element('option', '', item.title);
    option.value = item.id;
    result.append(option);
  }
  result.value = selected;
  return result;
}

function searchTitle(search) {
  return search.query || shoppingCategory(search.category)?.title || '';
}

function searchDetail(search) {
  return [
    search.query && shoppingCategory(search.category)?.title,
    shoppingRetailers.find(retailer => retailer.id === search.retailer)?.title
  ].filter(Boolean).join(' · ');
}

export function renderShopping(target, params = new URLSearchParams(), { rememberSearches = true } = {}) {
  const controller = new AbortController();
  const { signal } = controller;
  const inputQuery = shoppingQuery(params.get('q'));
  const excluded = isExcludedShoppingQuery(inputQuery);
  const category = shoppingCategory(params.get('category'))?.id || '';
  const retailer = shoppingRetailers.find(item => item.id === params.get('retailer'))?.id || '';
  const search = { query: excluded ? '' : inputQuery, category, retailer };
  const hasSearch = !excluded && Boolean(search.query || category);
  const searchKey = hasSearch ? shoppingSearchKey(search) : '';
  const shell = element('div', 'shopping');
  const intro = element('header', 'page-heading shopping-intro');
  intro.append(element('h1', '', 'Shopping'), element('p', '', 'Find gaming gear, electronics, books, and collectibles on Amazon and eBay.'));

  const form = element('form', 'shopping-form');
  form.setAttribute('role', 'search');
  form.setAttribute('aria-label', 'Shopping');
  const queryInput = element('input', 'field');
  queryInput.type = 'search';
  queryInput.value = inputQuery;
  queryInput.maxLength = shoppingQueryLimit;
  queryInput.autocomplete = 'off';
  queryInput.enterKeyHint = 'search';
  queryInput.placeholder = 'Try wireless headphones or a game controller';
  const categoryField = select(shoppingCategories, 'All categories', category);
  const retailerField = select(shoppingRetailers, 'Both retailers', retailer);
  const submit = element('button', 'button primary', 'Search');
  submit.type = 'submit';
  const formMessage = element('p', 'shopping-feedback');
  formMessage.id = 'shopping-feedback';
  formMessage.setAttribute('role', 'status');
  queryInput.setAttribute('aria-describedby', formMessage.id);
  form.append(field('Search shopping', queryInput), field('Category', categoryField),
    field('Retailer', retailerField), submit, formMessage);

  function showSearchError(message) {
    formMessage.textContent = message;
    if (message) queryInput.setAttribute('aria-invalid', 'true');
    else queryInput.removeAttribute('aria-invalid');
  }

  const excludedMessage = 'Try a search for gaming gear, electronics, books, or collectibles.';
  if (excluded) showSearchError(excludedMessage);
  queryInput.addEventListener('input', () => showSearchError(''), { signal });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const query = shoppingQuery(queryInput.value);
    if (isExcludedShoppingQuery(query)) {
      showSearchError(excludedMessage);
      queryInput.focus();
      return;
    }
    if (!query && !categoryField.value) {
      showSearchError('Enter what you’re looking for or choose a category.');
      queryInput.focus();
      return;
    }
    const destination = shoppingLink({ query, category: categoryField.value, retailer: retailerField.value });
    if (window.location.hash === destination) resultsTitle?.focus();
    else window.location.hash = destination;
  }, { signal });

  const notice = element('p', 'shopping-notice', 'Retailer links open in a new tab. Listings, current prices, and checkout are on the retailer’s U.S. website.');
  shell.append(intro, form, notice);

  let resultsTitle;
  let saveButton;
  if (hasSearch) {
    const results = element('section', 'shopping-section shopping-results');
    const heading = element('div', 'shopping-section-heading');
    resultsTitle = element('h2', '', searchTitle(search));
    resultsTitle.id = 'shopping-results';
    resultsTitle.tabIndex = -1;
    results.setAttribute('aria-labelledby', resultsTitle.id);
    const context = element('div', 'shopping-result-heading');
    context.append(resultsTitle);
    if (searchDetail(search)) context.append(element('p', '', searchDetail(search)));
    saveButton = button('Save search', toggleSavedSearch, signal);
    heading.append(context, saveButton);
    const row = element('div', 'shopping-retailers');
    for (const merchant of shoppingRetailers) {
      if (retailer && merchant.id !== retailer) continue;
      const href = shoppingRetailerLink(merchant.id, search);
      if (!href) continue;
      const card = element('article', 'shopping-retailer');
      card.dataset.retailer = merchant.id;
      const open = link('Open ' + merchant.title + ' results', href, 'button');
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      card.append(element('h3', '', merchant.title), open);
      row.append(card);
    }
    results.append(heading, row);
    shell.append(results);
  }

  let library = getShoppingLibraryState();
  if (hasSearch && rememberSearches) {
    updateShoppingLibrary(state => {
      state.recent = [search, ...state.recent.filter(entry => shoppingSearchKey(entry) !== searchKey)];
    });
    library = getShoppingLibraryState();
  }

  const personalFeedback = element('p', 'shopping-feedback');
  personalFeedback.setAttribute('role', 'status');
  const savedPanel = element('section', 'shopping-section');
  const savedTitle = element('h2', '', 'Saved searches');
  const savedList = element('ul', 'shopping-saved-list');
  savedPanel.append(savedTitle, savedList);
  const recentPanel = element('section', 'shopping-section shopping-recent');
  const recentHeader = element('div', 'shopping-section-heading');
  recentHeader.append(element('h2', '', 'Recent searches'), button('Clear recent searches', () => {
    applyLocalChange(state => { state.recent = []; }, 'Recent searches cleared.');
    queryInput.focus({ preventScroll: true });
  }, signal, 'button shopping-quiet'));
  const recentLinks = element('div', 'shopping-chips');
  recentPanel.append(recentHeader, recentLinks);
  const interestsPanel = element('section', 'shopping-section shopping-interests');
  const interestLinks = element('div', 'shopping-chips');
  interestsPanel.append(element('h2', '', 'Your interests'), interestLinks);
  shell.append(personalFeedback, savedPanel, recentPanel, interestsPanel);

  const categories = element('section', 'shopping-section');
  const grid = element('div', 'shopping-categories');
  const interestButtons = new Map();
  for (const department of shoppingCategories) {
    const card = element('article', 'shopping-category');
    card.dataset.category = department.id;
    const top = element('div', 'shopping-category-heading');
    const title = element('h3');
    title.append(link(department.title, shoppingLink({ category: department.id, retailer }), 'text-action'));
    const pin = button('Save interest', () => {
      const saved = library.interests.includes(department.id);
      applyLocalChange(state => {
        state.interests = saved ? state.interests.filter(id => id !== department.id) : [...state.interests, department.id];
      }, saved ? department.title + ' removed from interests.' : department.title + ' saved as an interest.');
    }, signal, 'button shopping-interest-button');
    interestButtons.set(department.id, pin);
    top.append(title, pin);
    const topics = element('div', 'shopping-chips');
    for (const query of department.topics) {
      topics.append(link(query, shoppingLink({ query, category: department.id, retailer }), 'chip'));
    }
    card.append(top, element('p', '', department.description), topics);
    grid.append(card);
  }
  categories.append(element('h2', '', 'Explore categories'), grid);
  shell.append(categories);
  target.replaceChildren(shell);
  if (resultsTitle && document.activeElement === target.parentElement) resultsTitle.focus();

  function applyLocalChange(update, message) {
    const stored = updateShoppingLibrary(update);
    library = getShoppingLibraryState();
    renderPersonalSections();
    personalFeedback.textContent = stored ? message : message + ' This change will last for this visit.';
  }

  function toggleSavedSearch() {
    const saved = library.saved.some(entry => shoppingSearchKey(entry) === searchKey);
    if (!saved && library.saved.length >= shoppingSavedLimit) {
      personalFeedback.textContent = 'Remove a saved search to make room for another.';
      return;
    }
    applyLocalChange(state => {
      state.saved = saved ? state.saved.filter(entry => shoppingSearchKey(entry) !== searchKey) : [search, ...state.saved];
    }, saved ? 'Search removed.' : 'Search saved.');
  }

  function renderPersonalSections() {
    if (saveButton) {
      const saved = library.saved.some(entry => shoppingSearchKey(entry) === searchKey);
      saveButton.setAttribute('aria-pressed', String(saved));
      saveButton.textContent = saved ? 'Saved search' : 'Save search';
    }
    savedPanel.hidden = !library.saved.length;
    savedList.replaceChildren(...library.saved.map(entry => {
      const item = element('li', 'shopping-saved-item');
      const text = element('div', 'shopping-saved-copy');
      text.append(link(searchTitle(entry), shoppingLink(entry), 'text-action'));
      if (searchDetail(entry)) text.append(element('span', '', searchDetail(entry)));
      const remove = button('Remove', () => {
        applyLocalChange(state => {
          state.saved = state.saved.filter(value => shoppingSearchKey(value) !== shoppingSearchKey(entry));
        }, 'Search removed.');
        queryInput.focus({ preventScroll: true });
      }, signal, 'button shopping-quiet');
      remove.setAttribute('aria-label', 'Remove saved search ' + searchTitle(entry));
      item.append(text, remove);
      return item;
    }));
    recentPanel.hidden = !rememberSearches || !library.recent.length;
    recentLinks.replaceChildren(...library.recent.map(entry => link(searchTitle(entry), shoppingLink(entry), 'chip')));
    interestsPanel.hidden = !library.interests.length;
    interestLinks.replaceChildren(...library.interests.map(id => link(shoppingCategory(id).title, shoppingLink({ category: id, retailer }), 'chip')));
    for (const [id, pin] of interestButtons) {
      const selected = library.interests.includes(id);
      pin.setAttribute('aria-pressed', String(selected));
      pin.textContent = selected ? 'Interest saved' : 'Save interest';
      pin.setAttribute('aria-label', (selected ? 'Remove ' : 'Save ') + shoppingCategory(id).title + ' interest');
    }
  }

  renderPersonalSections();
  window.addEventListener('storage', event => {
    if (event.key !== shoppingStorageKey && event.key !== null) return;
    library = getShoppingLibraryState();
    renderPersonalSections();
  }, { signal });
  return () => controller.abort();
}
