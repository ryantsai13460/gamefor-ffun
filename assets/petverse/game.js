import { PETS, EGGS, VARIANTS, UPGRADES, applyAction, createProgress, hatchPlan, petPower, progression, restoreProgress } from './model.js';
import { createOnlineClient } from './online.js';
import { defaultPreferences, preferencesKey, readPreferences, readStorage, soloKey, writeStorage } from './preferences.js';
import { createSound } from './sound.js';

const root = document.getElementById('petverse');
const scope = new AbortController();
const { signal } = scope;
const sound = createSound();
const speciesById = new Map(PETS.map(pet => [pet.id, pet]));
const variantById = new Map(VARIANTS.map(variant => [variant.id, variant]));
const eggsById = new Map(EGGS.map(egg => [egg.id, egg]));
const currencyNames = { sunbeams: 'Sunbeams', crystals: 'Crystals' };
const number = new Intl.NumberFormat('en');
const percent = new Intl.NumberFormat('en', { maximumFractionDigits: 3, style: 'percent' });
const navNames = ['Hatch', 'Pets', 'Upgrades', 'Settings', 'Online'];
const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial'];
const settingGroups = ['General', 'Generation', 'Stop rules', 'Notifications', 'Audio', 'Graphics', 'Inventory', 'Accessibility'];
const stopLabels = {
  'new-discovery': 'New species discovered', 'inventory-full': 'Inventory full',
  'insufficient-sunbeams': 'More Sunbeams needed'
};

let solo = restoreProgress(readStorage(soloKey)) || createProgress();
let progress = solo;
let prefs = readPreferences();
let screen = 'Hatch';
let settingsGroup = 'Generation';
let petView = 'Inventory';
let query = '';
let filterVariant = '';
let peers = [];
let self = null;
let world;
let nearby;
let busy = false;
let activeAction;
let settingQueue = Promise.resolve();
let connecting = false;
let connectionEpoch = 0;
let endpoint = '';
let connectionError = '';
let canStartGuest = false;
let trade;
let tradeDraft;
let auto;
let autoView;
let autoTimer;
let collectTimer;
let feedbackTimer;
let lastReveal = [];
let storageAvailable = true;
let activeEgg = EGGS[0].id;
let worldReady = false;
let fullscreenError = '';
const expanded = new Set();

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(text, handler, options = {}) {
  const item = el('button', options.className || 'pv-button', text);
  item.type = 'button';
  item.disabled = Boolean(options.disabled);
  item.dataset.focusKey = options.key || text;
  if (options.primary) item.classList.add('pv-primary');
  if (options.pressed !== undefined) item.setAttribute('aria-pressed', String(options.pressed));
  if (options.label) item.setAttribute('aria-label', options.label);
  item.addEventListener('click', handler);
  return item;
}

function row(...children) {
  const area = el('div', 'pv-controls');
  area.append(...children);
  return area;
}

function section(title, description) {
  const area = el('section', 'pv-section');
  area.append(el('h2', '', title));
  if (description) area.append(el('p', 'pv-summary', description));
  return area;
}

function disclosure(key, summary, content) {
  const detail = el('details', 'pv-odds');
  detail.open = expanded.has(key);
  detail.append(el('summary', '', summary), content);
  detail.addEventListener('toggle', () => {
    if (detail.open) expanded.add(key);
    else expanded.delete(key);
  });
  return detail;
}

function format(value) { return number.format(value || 0); }

const header = el('header', 'pv-header');
const brand = el('div', 'pv-brand');
const badge = el('span', 'pv-mark', '✦');
badge.setAttribute('aria-hidden', 'true');
const title = el('h1', 'pv-title', 'Petverse Online');
const status = el('span', 'pv-status', 'Solo');
brand.append(badge, title, status);
const wallet = el('ul', 'pv-wallet');
wallet.setAttribute('aria-label', 'Petverse balances');
const balances = Object.fromEntries(Object.entries(currencyNames).map(([id, name]) => {
  const item = el('li', 'pv-wallet-item');
  const total = el('strong');
  item.dataset.currency = id;
  item.append(el('span', '', name), total);
  wallet.append(item);
  return [id, total];
}));
const level = el('span', 'pv-level');
header.append(brand, wallet, level);

const layout = el('div', 'pv-layout');
const play = el('section', 'pv-play');
play.setAttribute('aria-label', 'Explore Sunstep Meadow');
const terrain = el('div', 'pv-world');
const worldLabel = el('p', 'pv-world-label', 'Sunstep Meadow');
const worldHelp = el('p', 'pv-world-help', 'WASD or arrows to move. Drag to orbit, wheel to zoom, Space to jump, F to interact.');
const worldNotice = el('p', 'pv-world-message', 'Loading the 3D meadow…');
worldNotice.setAttribute('role', 'status');
const touch = el('div', 'pv-touch');
touch.setAttribute('aria-label', 'Movement controls');
const controls = { left: '←', forward: '↑', back: '↓', right: '→' };
for (const [direction, glyph] of Object.entries(controls)) {
  const control = button(glyph, () => {}, { className: 'pv-touch-direction', label: 'Move ' + direction, pressed: false });
  const set = active => {
    world?.setInput(direction, active);
    control.setAttribute('aria-pressed', String(active));
  };
  control.addEventListener('pointerdown', event => {
    if (!worldReady) return;
    event.preventDefault();
    control.setPointerCapture(event.pointerId);
    set(true);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) {
    control.addEventListener(event, () => set(false));
  }
  control.addEventListener('keydown', event => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); set(true); }
  });
  control.addEventListener('keyup', event => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); set(false); }
  });
  touch.append(control);
}
touch.append(button('Jump', () => world?.jump(), { className: 'pv-button pv-jump' }));
const interact = button('Explore', () => world?.interact(), { className: 'pv-button pv-primary pv-interact', disabled: true });
const resetCamera = button('Reset camera', () => world?.resetCamera(), { className: 'pv-button pv-reset-camera' });
terrain.append(worldLabel, worldNotice, touch, interact);
const fieldBar = el('div', 'pv-field-bar');
fieldBar.append(worldHelp, resetCamera);
const toast = el('aside', 'pv-toast');
toast.hidden = true;
toast.setAttribute('role', 'status');
play.append(terrain, fieldBar, toast);

const consolePanel = el('section', 'pv-console');
consolePanel.setAttribute('aria-label', 'Petverse game controls');
const nav = el('nav', 'pv-nav');
nav.setAttribute('aria-label', 'Petverse menus');
const navControls = navNames.map(tab => button(tab, () => openScreen(tab), { pressed: tab === screen }));
nav.append(...navControls);
const panel = el('div', 'pv-panel');
const banner = el('p', 'pv-banner');
banner.setAttribute('role', 'status');
banner.hidden = true;
const autoPanel = el('div', 'pv-auto-panel');
autoPanel.hidden = true;
consolePanel.append(nav, banner, autoPanel, panel);
layout.append(play, consolePanel);
root.replaceChildren(header, layout);

function showFeedback(text, options = {}) {
  clearTimeout(feedbackTimer);
  banner.textContent = text || '';
  banner.hidden = !text;
  banner.dataset.error = String(Boolean(options.error));
  if (options.pet) {
    const species = speciesById.get(options.pet.speciesId);
    toast.replaceChildren(petPortrait(species, options.pet.variant), el('strong', '', text));
    toast.hidden = false;
    feedbackTimer = setTimeout(() => { toast.hidden = true; }, 4500);
  } else {
    toast.hidden = true;
  }
}

function updateHeader() {
  const stats = progression(progress);
  for (const [id, total] of Object.entries(balances)) total.textContent = format(progress.wallet[id]);
  level.textContent = 'Level ' + stats.level + ' · ' + format(progress.xp) + ' XP';
  status.textContent = connecting ? 'Connecting' : self ? 'Online · ' + (peers.length + 1) : 'Solo';
  status.dataset.state = self ? 'online' : 'solo';
  status.setAttribute('aria-label', self ? (peers.length + 1) + ' real players online' : status.textContent);
}

function updateWorld() {
  root.dataset.reducedMotion = String(prefs.graphics.reducedMotion);
  world?.update({ progress, peers, graphics: prefs.graphics });
}

function refreshPanel({ resetScroll = false } = {}) {
  const focus = panel.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
  const scroll = panel.scrollTop;
  for (const [index, node] of navControls.entries()) node.setAttribute('aria-pressed', String(navNames[index] === screen));
  panel.replaceChildren();
  if (screen === 'Hatch') renderHatch();
  if (screen === 'Pets') renderPets();
  if (screen === 'Upgrades') renderUpgrades();
  if (screen === 'Settings') renderSettings();
  if (screen === 'Online') renderOnline();
  syncAutoPanel();
  panel.scrollTop = resetScroll ? 0 : scroll;
  if (focus) [...panel.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === focus)?.focus({ preventScroll: true });
}

function openScreen(next) {
  screen = next;
  refreshPanel({ resetScroll: true });
}

function commit(next) {
  progress = next;
  if (!self) {
    solo = next;
    storageAvailable = writeStorage(soloKey, solo);
  }
  updateHeader();
  updateWorld();
}

function toggleSetting(data) {
  const epoch = connectionEpoch;
  settingQueue = settingQueue.then(async () => {
    await activeAction;
    if (epoch === connectionEpoch) return act({ type: 'settings', settings: data });
  });
  return settingQueue;
}

function act(action, options) {
  if (activeAction || connecting) return Promise.resolve(null);
  activeAction = executeAction(action, options).finally(() => { activeAction = undefined; });
  return activeAction;
}

async function executeAction(action, { quiet = false, automatic = false } = {}) {
  if (busy || connecting) return null;
  busy = true;
  const epoch = connectionEpoch;
  try {
    const result = self ? await online.command(action) : applyAction(progress, action);
    if (epoch !== connectionEpoch) return null;
    commit(result.progress);
    if (result.event.type === 'error') {
      if (!quiet && !automatic) showFeedback(result.event.message, { error: true });
    } else {
      reportAction(result.event, action, { quiet, automatic });
      if (!storageAvailable && !self) showFeedback('Progress is available for this visit. This browser could not save it.', { error: true });
    }
    refreshPanel();
    return result.event;
  } catch (error) {
    if (!quiet) showFeedback(error.message || 'This action could not be completed.', { error: true });
    return { type: 'error', code: 'connection', message: error.message };
  } finally {
    busy = false;
  }
}

function describePet(pet) {
  const species = speciesById.get(pet.speciesId);
  const variant = variantById.get(pet.variant);
  return [variant?.id !== 'normal' ? variant?.name : '', species?.name].filter(Boolean).join(' ');
}

function reportAction(event, action, { quiet, automatic }) {
  if (event.type === 'hatch') {
    lastReveal = event.pets;
    const interesting = event.pets.find(pet => pet.variant !== 'normal' && prefs.notifications[pet.variant]);
    const discovered = event.pets.find(pet => event.newSpecies.includes(pet.speciesId));
    const spotlight = interesting || (prefs.notifications.newPet ? discovered : null);
    const animate = prefs.reveal.animations && !prefs.graphics.reducedMotion &&
      !(prefs.reveal.skipCommon && event.pets.every(pet => pet.variant === 'normal' && speciesById.get(pet.speciesId)?.rarity.toLowerCase() === 'common'));
    if (animate) world?.showBurst({ kind: 'hatch', variant: spotlight?.variant || 'normal' });
    sound.play(interesting ? 'rare' : 'hatch');
    if (spotlight) showFeedback('Discovered ' + describePet(spotlight) + ' · ' + speciesById.get(spotlight.speciesId).rarity, { pet: spotlight });
    else if (!automatic && !quiet) showFeedback('Hatched ' + event.pets.map(describePet).join(', ') + '.');
  } else if (event.type === 'gather') {
    world?.showBurst({ kind: 'gather', nodeId: action.nodeId, amount: prefs.graphics.collectionNumbers ? event.sunbeams : undefined });
    sound.play('gather');
    if (!quiet) showFeedback('Collected ' + format(event.sunbeams) + ' Sunbeams' +
      (event.crystals ? ' and ' + format(event.crystals) + ' Crystals.' : '.'));
  } else if (event.type === 'upgrade') {
    sound.play('ui');
    showFeedback((UPGRADES.find(upgrade => upgrade.id === action.id)?.name || 'Upgrade') + ' purchased.');
  }
}

function petPortrait(species, variant = 'normal') {
  const portrait = el('span', 'pv-pet-symbol');
  portrait.setAttribute('aria-hidden', 'true');
  portrait.dataset.shape = species?.shape || 'round';
  portrait.dataset.variant = variant;
  portrait.style.setProperty('--pv-pet-color', species?.color || '#b39268');
  portrait.style.setProperty('--pv-pet-accent', species?.accent || '#fff5d6');
  portrait.append(el('span', 'pv-pet-head'));
  return portrait;
}

function statLine(text) { return el('p', 'pv-stats', text); }

function changePreference(group, id, value) {
  prefs[group][id] = value;
  if (!writeStorage(preferencesKey, prefs)) showFeedback('Settings are active for this visit. This browser could not save them.', { error: true });
  sound.configure(prefs.audio);
  updateWorld();
}

function checkbox(label, value, change, hint) {
  const field = el('label', 'pv-setting');
  const copy = el('span', 'pv-setting-copy');
  copy.append(el('strong', '', label));
  if (hint) copy.append(el('small', '', hint));
  const input = el('input');
  input.type = 'checkbox';
  input.checked = value;
  input.dataset.focusKey = label;
  input.addEventListener('change', () => change(input.checked));
  field.append(copy, input);
  return field;
}

function select(label, value, choices, change) {
  const field = el('label', 'pv-field');
  const input = el('select');
  input.dataset.focusKey = label;
  for (const [id, name] of choices) input.append(new Option(name, id, false, id === value));
  input.addEventListener('change', () => change(input.value));
  field.append(el('span', '', label), input);
  return field;
}

function volume(label, id) {
  const field = el('label', 'pv-field pv-volume');
  const output = el('span', 'pv-volume-value', Math.round(prefs.audio[id] * 100) + '%');
  const input = el('input');
  input.type = 'range';
  input.min = 0;
  input.max = 100;
  input.step = 1;
  input.value = Math.round(prefs.audio[id] * 100);
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => {
    output.textContent = input.value + '%';
    changePreference('audio', id, Number(input.value) / 100);
  });
  field.append(el('span', '', label), output, input);
  return field;
}

function oddsList(records, name, odds) {
  const list = el('dl', 'pv-odds-list');
  const total = records.reduce((sum, record) => sum + record.weight, 0);
  for (const record of records) {
    list.append(el('dt', '', name(record)), el('dd', '', percent.format(record.weight / total) + (odds?.(record) || '')));
  }
  return list;
}

function renderHatch() {
  const facts = progression(progress);
  const area = section('Egg nursery', 'Collect Sunbeams in the meadow and hatch companions to grow your team.');
  const stats = statLine(format(progress.stats.eggsHatched) + ' hatched · ' + progress.discovered.length + '/' + PETS.length + ' discovered · ' + progress.stats.shinies + ' shiny');
  area.append(stats);
  const cards = el('div', 'pv-cards');
  for (const egg of EGGS) {
    const card = el('article', 'pv-card pv-egg-card');
    card.dataset.current = String(egg.id === activeEgg);
    const eggArt = el('span', 'pv-egg-art');
    eggArt.style.setProperty('--pv-egg-color', egg.color);
    eggArt.setAttribute('aria-hidden', 'true');
    const name = el('div');
    name.append(el('h3', '', egg.name), el('p', 'pv-summary', format(egg.cost) + ' Sunbeams per egg'));
    const head = el('div', 'pv-card-head');
    head.append(eggArt, name);
    card.append(head, el('p', 'pv-summary', egg.description));
    if (facts.level < egg.level) {
      card.append(statLine('Unlocks at Level ' + egg.level));
    } else {
      const hatch = button('Hatch egg', () => {
        activeEgg = egg.id;
        void act({ type: 'hatch', eggId: egg.id, mode: 'manual', count: 1 });
      }, { primary: true, label: 'Hatch ' + egg.name });
      const actions = row(hatch);
      if (progress.upgrades.multiHatch) actions.append(button('Hatch ×3', () => void act({ type: 'hatch', eggId: egg.id, mode: 'manual', count: 3 }),
        { label: 'Hatch three ' + egg.name + 's' }));
      if (progress.upgrades.autoHatch) actions.append(button('Auto hatch', () => startAuto(egg.id),
        { label: 'Auto hatch ' + egg.name, disabled: auto?.state === 'active' || auto?.state === 'paused' }));
      card.append(actions);
    }
    card.append(disclosure('egg-odds-' + egg.id, 'Species odds',
      oddsList(egg.pool, reward => speciesById.get(reward.speciesId).name)));
    cards.append(card);
  }
  area.append(cards, disclosure('variant-odds', 'Variant odds and power',
    oddsList(VARIANTS, variant => variant.name, variant => ' · ×' + variant.multiplier)));
  panel.append(area);
  if (lastReveal.length && prefs.reveal.results) {
    const reveal = section('Latest hatch');
    reveal.classList.add('pv-hatch-result');
    const list = el('div', 'pv-cards');
    for (const pet of lastReveal) list.append(petEntry(pet));
    reveal.append(list);
    panel.append(reveal);
  }
  if (progress.hatchHistory.length) {
    const history = el('ul', 'pv-list');
    for (const entry of progress.hatchHistory.slice(0, 8)) {
      const result = Array.isArray(entry.pets) ? entry.pets.map(describePet).join(', ') : describePet(entry);
      if (result) history.append(el('li', '', result));
    }
    if (history.childElementCount) panel.append(disclosure('hatch-history', 'Recent hatches', history));
  }
}

function textForStop(reason) {
  if (reason?.startsWith('variant:')) return variantById.get(reason.slice(8))?.name + ' hatched';
  return stopLabels[reason] || reason || 'Stopped by you';
}

function buildAutoPanel() {
  const area = section('Auto-hatch session');
  area.classList.add('pv-auto-status');
  const headline = statLine('');
  const totals = el('p', 'pv-summary');
  const ruleText = el('p', 'pv-summary');
  const rules = button('Edit stop rules', () => {
    settingsGroup = 'Stop rules';
    openScreen('Settings');
  });
  const pause = button('Pause', () => {
    clearTimeout(autoTimer);
    auto.state = 'paused';
    auto.reason = '';
    refreshPanel();
    autoView.resume.focus({ preventScroll: true });
  }, { label: 'Pause auto hatch' });
  const resume = button('Resume', () => {
    auto.state = 'active';
    auto.reason = '';
    refreshPanel();
    autoView.pause.focus({ preventScroll: true });
    scheduleAuto();
  }, { label: 'Resume auto hatch', primary: true });
  const stop = button('Stop', () => {
    stopAuto();
    refreshPanel();
    rules.focus({ preventScroll: true });
  }, { label: 'Stop auto hatch' });
  const ruleDetails = el('details', 'pv-auto-rules');
  ruleDetails.append(el('summary', '', 'Active stop conditions'), ruleText);
  area.append(headline, totals, row(pause, resume, stop, rules), ruleDetails);
  autoPanel.append(area);
  return { headline, totals, ruleText, pause, resume, stop };
}

function syncAutoPanel() {
  autoPanel.hidden = !auto;
  if (!auto) {
    if (autoView) autoPanel.replaceChildren();
    autoView = undefined;
    return;
  }
  autoView ||= buildAutoPanel();
  const state = auto.state === 'active' ? 'Running' : auto.state === 'paused' ? 'Paused' : 'Stopped';
  autoView.headline.textContent = state + (auto.reason ? ' · ' + auto.reason : ' · ' + eggsById.get(auto.eggId).name);
  autoView.totals.textContent = auto.count + ' hatched · ' + format(auto.spent) + ' Sunbeams spent · ' + auto.shinies +
    ' shiny · ' + auto.rare + ' variants · ' + (progression(progress).hatchInterval / 1000) + 's interval';
  const rules = VARIANTS.slice(1).filter(item => progress.settings.stopVariants[item.id]).map(item => item.name);
  if (progress.settings.stopOnNew) rules.push('New discovery');
  if (progress.settings.stopOnFull) rules.push('Inventory full');
  autoView.ruleText.textContent = [...rules, 'Out of Sunbeams'].join(', ');
  autoView.pause.hidden = auto.state !== 'active';
  autoView.resume.hidden = auto.state !== 'paused';
  autoView.stop.hidden = auto.state === 'stopped';
}

function stopAuto(reason = '', paused = false) {
  clearTimeout(autoTimer);
  if (!auto || auto.state === 'stopped') return;
  auto.state = paused ? 'paused' : 'stopped';
  auto.reason = reason;
}

function startAuto(eggId) {
  const plan = hatchPlan(progress, eggId, { mode: 'auto' });
  if (plan.code && !plan.retryAt) {
    showFeedback(textForStop(plan.code), { error: true });
    return;
  }
  activeEgg = eggId;
  auto = { eggId, state: 'active', reason: '', count: 0, spent: 0, shinies: 0, rare: 0 };
  refreshPanel();
  scheduleAuto();
}

function scheduleAuto(delay = 75) {
  clearTimeout(autoTimer);
  if (auto?.state !== 'active') return;
  const wait = Math.max(delay, progress.hatchReadyAt - Date.now());
  autoTimer = setTimeout(runAuto, wait);
}

async function runAuto() {
  const session = auto;
  if (session?.state !== 'active') return;
  if (busy || document.hidden) { scheduleAuto(500); return; }
  const event = await act({ type: 'hatch', eggId: session.eggId, mode: 'auto' }, { automatic: true });
  if (session !== auto || !event) return;
  if (event.type === 'hatch') {
    session.count += event.pets.length;
    session.spent += event.spent;
    session.shinies += event.pets.filter(pet => pet.variant === 'shiny').length;
    session.rare += event.pets.filter(pet => pet.variant !== 'normal').length;
    if (event.stopReason) stopAuto(textForStop(event.stopReason));
  } else if (event.type === 'error' && !event.retryAt) {
    stopAuto(event.message || textForStop(event.stopReason || event.code),
      event.code === 'inventory-full' && !progress.settings.stopOnFull);
  }
  refreshPanel();
  if (session.state === 'active') scheduleAuto(event.retryAt ? Math.max(75, event.retryAt - Date.now()) : 75);
}

function petEntry(pet, manage = false) {
  const species = speciesById.get(pet.speciesId);
  const card = el('article', 'pv-card pv-pet-card');
  card.dataset.rarity = species.rarity;
  const head = el('div', 'pv-card-head');
  const copy = el('div');
  const equipped = progress.equipped.includes(pet.id);
  copy.append(el('h3', '', describePet(pet)), el('p', 'pv-pet-meta',
    species.rarity + ' · ' + format(petPower(pet)) + ' power' + (equipped ? ' · Equipped' : '')));
  head.append(petPortrait(species, pet.variant), copy);
  card.append(head);
  if (manage) {
    const name = describePet(pet);
    card.append(row(button(equipped ? 'Unequip' : 'Equip', () => act({ type: 'equip', petId: pet.id }),
      { label: (equipped ? 'Unequip ' : 'Equip ') + name, key: 'equip-' + pet.id, pressed: equipped }),
    button(pet.favorite ? 'Favorited' : 'Favorite', () => act({ type: 'favorite', petId: pet.id }),
      { label: 'Favorite ' + name, key: 'favorite-' + pet.id, pressed: pet.favorite }),
    button(pet.locked ? 'Locked' : 'Lock', () => act({ type: 'lock', petId: pet.id }),
      { label: 'Lock ' + name, key: 'lock-' + pet.id, pressed: pet.locked }),
    ...(!pet.locked && !pet.favorite && !equipped && progress.inventory.length > 1 ? [
      button('Release', () => confirmRelease(pet), { label: 'Release ' + name, key: 'release-' + pet.id })
    ] : [])));
  }
  return card;
}

function renderPets() {
  const facts = progression(progress);
  const area = section('Pet journal', progress.inventory.length + '/' + facts.capacity + ' pets · ' +
    progress.equipped.length + '/' + facts.equipSlots + ' equipped · ' + format(facts.power) + ' team power');
  area.append(row(...['Inventory', 'Collection'].map(view => button(view, () => {
    petView = view;
    refreshPanel();
  }, { pressed: petView === view }))));
  const filters = el('div', 'pv-filters');
  const search = el('input');
  search.type = 'search';
  search.placeholder = 'Search by name or rarity';
  search.value = query;
  search.setAttribute('aria-label', 'Search pets');
  search.dataset.focusKey = 'search-pets';
  search.addEventListener('input', () => { query = search.value; refreshCards(); });
  const searchLabel = el('label', 'pv-field');
  searchLabel.append(el('span', '', 'Search pets'), search);
  filters.append(searchLabel, select('Variant', filterVariant, [['', 'All variants'], ...VARIANTS.map(item => [item.id, item.name])], value => {
    filterVariant = value;
    refreshCards();
  }));
  const cards = el('div', 'pv-cards');
  if (petView === 'Inventory') {
    filters.append(select('Sort pets', prefs.inventory.sort,
      [['power', 'Strength'], ['rarity', 'Rarity'], ['name', 'Name'], ['recent', 'Recently obtained']], value => {
        changePreference('inventory', 'sort', value);
        refreshCards();
      }));
    area.append(button('Equip best', () => act({ type: 'equip-best' })));
  } else {
    area.append(statLine(progress.discovered.length + ' of ' + PETS.length + ' species discovered · ' +
      progress.variantDiscoveries.length + ' species and variant combinations recorded'));
  }
  area.append(filters, cards);
  panel.append(area);

  function matches(species) {
    return (species.name + ' ' + species.rarity).toLowerCase().includes(query.trim().toLowerCase());
  }

  function refreshCards() {
    cards.replaceChildren();
    if (petView === 'Inventory') {
      const selectors = {
        power: (a, b) => petPower(b) - petPower(a),
        rarity: (a, b) => rarityOrder.indexOf(speciesById.get(b.speciesId).rarity) - rarityOrder.indexOf(speciesById.get(a.speciesId).rarity),
        name: (a, b) => describePet(a).localeCompare(describePet(b)),
        recent: (a, b) => b.obtainedAt - a.obtainedAt
      };
      const seen = new Set();
      const owned = progress.inventory.filter(pet => matches(speciesById.get(pet.speciesId)) && (!filterVariant || pet.variant === filterVariant))
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || selectors[prefs.inventory.sort](a, b));
      for (const pet of owned) {
        const key = pet.speciesId + ':' + pet.variant;
        if (!prefs.inventory.showDuplicates && seen.has(key)) continue;
        seen.add(key);
        cards.append(petEntry(pet, true));
      }
    } else for (const species of PETS) {
      if (!matches(species) || (filterVariant && !progress.variantDiscoveries.includes(species.id + ':' + filterVariant))) continue;
      const encountered = progress.discovered.includes(species.id);
      const card = el('article', 'pv-card pv-collection-card');
      card.dataset.discovered = String(encountered);
      const head = el('div', 'pv-card-head');
      const copy = el('div');
      const variants = VARIANTS.filter(item => progress.variantDiscoveries.includes(species.id + ':' + item.id));
      copy.append(el('h3', '', species.name), el('p', 'pv-summary', encountered ? variants.map(item => item.name).join(', ') || 'Discovered' : 'Undiscovered'));
      head.append(petPortrait(species, filterVariant || 'normal'), copy);
      card.append(head);
      cards.append(card);
    }
    if (!cards.childElementCount) cards.append(el('p', 'pv-summary', 'No pets match these filters.'));
  }
  refreshCards();
}

function renderUpgrades() {
  const facts = progression(progress);
  const area = section('Meadow workshop', 'Spend resources earned in the meadow on persistent upgrades.');
  const cards = el('div', 'pv-cards');
  for (const upgrade of UPGRADES) {
    const rank = progress.upgrades[upgrade.id];
    const cost = upgrade.costs[rank];
    const card = el('article', 'pv-card');
    card.append(el('h3', '', upgrade.name), el('p', 'pv-summary', upgrade.description));
    if (cost === undefined) card.append(statLine('Fully upgraded'));
    else if (facts.level < upgrade.level) card.append(statLine('Unlocks at Level ' + upgrade.level));
    else {
      card.append(statLine(format(cost) + ' ' + currencyNames[upgrade.currency]));
      card.append(button('Buy upgrade', () => act({ type: 'upgrade', id: upgrade.id }),
        { primary: true, label: 'Buy ' + upgrade.name, disabled: progress.wallet[upgrade.currency] < cost }));
    }
    cards.append(card);
  }
  area.append(cards);
  panel.append(area);
}

function renderSettings() {
  const area = section('Settings');
  const tabs = row(...settingGroups.map(group => button(group, () => {
    settingsGroup = group;
    refreshPanel();
  }, { pressed: settingsGroup === group })));
  tabs.classList.add('pv-settings-nav');
  area.append(tabs);
  const group = el('div', 'pv-settings-group');
  group.append(el('h3', '', settingsGroup));
  const gameSetting = (label, id, hint) => checkbox(label, progress.settings[id], value => toggleSetting({ [id]: value }), hint);
  const choice = (group, id, label, hint) => checkbox(label, prefs[group][id], value => {
    changePreference(group, id, value);
    if (group === 'reveal') refreshPanel();
  }, hint);
  if (settingsGroup === 'Generation') {
    group.append(statLine('Hatch interval · ' + progression(progress).hatchInterval / 1000 + ' seconds'),
      gameSetting('Auto Equip Best', 'autoEquip', 'Choose the strongest pets when you hatch a companion.'),
      gameSetting('Lock Rare Pets', 'lockRare', 'Lock new rare pets and variants to protect them from trades.'));
    if (progress.upgrades.multiHatch) group.append(gameSetting('Multi-Hatch in auto mode', 'multiHatch', 'Attempt up to three eggs per paid hatch cycle.'));
    else group.append(el('p', 'pv-summary', 'Multi-Hatch is available at the workshop from Level 3.'));
    if (progress.upgrades.autoCollect) group.append(gameSetting('Auto Collect', 'autoCollect', 'Gather ready resources near your equipped team.'));
    else group.append(el('p', 'pv-summary', 'Auto Collect becomes available from Level 3.'));
    group.append(choice('reveal', 'animations', 'Generation animations'), choice('reveal', 'skipCommon', 'Skip common animations'),
      choice('reveal', 'results', 'Show generation results'), statLine(format(progress.stats.eggsHatched) + ' total hatched · ' +
        format(progress.stats.rareVariants) + ' rare variants'));
  } else if (settingsGroup === 'Stop rules') {
    for (const variant of VARIANTS.slice(1)) group.append(checkbox('Stop When ' + variant.name, progress.settings.stopVariants[variant.id],
      value => toggleSetting({ stopVariants: { [variant.id]: value } }),
      variant.id === 'shiny' ? 'When off, shiny pets do not stop a hatch session.' : undefined));
    group.append(gameSetting('Stop When a New Pet Is Discovered', 'stopOnNew'),
      gameSetting('Stop When Inventory Is Full', 'stopOnFull', 'When off, a full habitat pauses hatching until you can resume.'),
      el('p', 'pv-summary', 'Auto-hatch always stops when you run out of Sunbeams.'));
  } else if (settingsGroup === 'Notifications') {
    for (const variant of VARIANTS.slice(1)) group.append(choice('notifications', variant.id, variant.name + ' notifications'));
    group.append(choice('notifications', 'newPet', 'New species notifications'),
      choice('audio', 'enableRare', 'Notification sound'), volume('Notification volume', 'rare'));
  } else if (settingsGroup === 'Audio') {
    for (const [id, label] of Object.entries({
      master: 'Master volume', music: 'Music volume', ambient: 'Ambient volume', effects: 'Effects volume',
      hatch: 'Hatching volume', rare: 'Rare discovery volume', ui: 'Interface volume'
    })) group.append(volume(label, id));
    for (const [id, label] of Object.entries({
      enableMusic: 'Music', enableAmbient: 'Meadow ambience', enableEffects: 'Gathering sounds',
      enableHatch: 'Hatching sounds', enableRare: 'Rare discovery sounds', enableUI: 'Interface sounds',
      muteBackground: 'Mute when the game is in the background'
    })) group.append(choice('audio', id, label));
  } else if (settingsGroup === 'Graphics') {
    group.append(select('Graphics quality', prefs.graphics.quality, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
      value => changePreference('graphics', 'quality', value)),
    select('Particles', prefs.graphics.particles, [['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
      value => changePreference('graphics', 'particles', value)));
    for (const [id, label] of Object.entries({
      petGlow: 'Pet glow', shinyEffects: 'Shiny effects', rareAnimations: 'Rare variant animations',
      showPeerPets: 'Show other players’ pets', showPetNames: 'Show pet names',
      collectionNumbers: 'Collection numbers', shake: 'Camera shake', reducedMotion: 'Reduced motion'
    })) group.append(choice('graphics', id, label));
  } else if (settingsGroup === 'Inventory') {
    group.append(choice('inventory', 'showDuplicates', 'Show duplicates'), select('Sort pets by', prefs.inventory.sort,
      [['power', 'Strength'], ['rarity', 'Rarity'], ['name', 'Name'], ['recent', 'Recently obtained']],
      value => changePreference('inventory', 'sort', value)),
    gameSetting('Auto Equip Best', 'autoEquip'), gameSetting('Lock Rare Pets', 'lockRare'));
  } else if (settingsGroup === 'General') {
    group.append(button(document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen game', toggleFullscreen),
      el('p', 'pv-summary', 'Your solo save lives in this browser. Connected players save their separate guest profile on the server.'));
    if (fullscreenError) group.append(el('p', 'pv-summary', fullscreenError));
  } else if (settingsGroup === 'Accessibility') {
    group.append(choice('graphics', 'reducedMotion', 'Reduced motion'), choice('graphics', 'showPetNames', 'Show pet names'),
      el('p', 'pv-summary', 'Move with WASD, the arrow keys, or the on-screen controls. Use F to interact and Space to jump.'));
  }
  area.append(group, button('Reset settings', askReset));
  panel.append(area);
}

function askReset() {
  const dialog = el('dialog', 'pv-dialog');
  const close = () => dialog.close();
  dialog.append(el('h2', '', 'Restore default settings?'),
    el('p', 'pv-summary', 'Your pets, upgrades and balances will stay in your save.'), row(button('Cancel', close),
      button('Restore defaults', () => {
        prefs = defaultPreferences();
        writeStorage(preferencesKey, prefs);
        sound.configure(prefs.audio);
        updateWorld();
        void toggleSetting(createProgress().settings);
        close();
        refreshPanel();
      }, { primary: true })));
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  root.append(dialog);
  dialog.showModal();
}

function confirmRelease(pet) {
  const name = describePet(pet);
  const dialog = el('dialog', 'pv-dialog');
  dialog.append(el('h2', '', 'Release ' + name + '?'),
    el('p', 'pv-summary', 'This frees a habitat space. The pet stays recorded in your collection journal.'),
    row(button('Cancel', () => dialog.close()), button('Release pet', () => {
      dialog.close();
      void act({ type: 'release', petId: pet.id, confirm: true });
    }, { primary: true })));
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  root.append(dialog);
  dialog.showModal();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await root.requestFullscreen();
    fullscreenError = '';
  } catch {
    fullscreenError = 'Fullscreen is unavailable in this browser.';
  }
  refreshPanel();
}

function renderOnline() {
  const area = section('Meadow online', self ? 'Connected as ' + self.name + '.' :
    'Join a running Petverse server to share the meadow. Your online progress is saved on that server.');
  if (!self) {
    const form = el('form', 'pv-connect');
    const label = el('label', 'pv-field');
    const input = el('input');
    input.type = 'url';
    input.placeholder = 'wss://your-petverse-server';
    input.value = endpoint;
    input.maxLength = 250;
    input.required = true;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      endpoint = input.value;
      canStartGuest = false;
      newGuestButton?.remove();
    });
    label.append(el('span', '', 'Server endpoint'), input);
    const join = el('button', 'pv-button pv-primary', connecting ? 'Connecting…' : 'Join meadow');
    join.type = 'submit';
    join.disabled = connecting || busy;
    form.addEventListener('submit', event => {
      event.preventDefault();
      endpoint = input.value.trim();
      void joinOnline();
    });
    form.append(label, join);
    if (connecting) form.append(button('Cancel connection', leaveOnline));
    if (connectionError) {
      const error = el('p', 'pv-summary', connectionError);
      error.setAttribute('role', 'alert');
      form.append(error);
    }
    const newGuestButton = canStartGuest ? button('Start a new guest profile', () => joinOnline(true)) : null;
    if (newGuestButton) form.append(newGuestButton);
    area.append(form);
  } else {
    area.append(statLine((peers.length + 1) + ' connected · ' + peers.length + ' other players'), button('Leave meadow', leaveOnline));
    if (trade && trade.state !== 'closed') area.append(renderTrade());
    const list = el('ul', 'pv-list pv-peers');
    for (const peer of peers) {
      const item = el('li');
      item.append(el('span', '', peer.name), button('Offer trade', () => tradeAction('invite', { peerId: peer.id }),
        { label: 'Offer trade to ' + peer.name, disabled: Boolean(trade && trade.state !== 'closed') }));
      list.append(item);
    }
    if (!peers.length) list.append(el('li', 'pv-summary', 'You’re the first player in this meadow.'));
    area.append(list);
  }
  panel.append(area);
}

function renderTrade() {
  const current = trade;
  const area = el('section', 'pv-card pv-trade');
  area.append(el('h3', '', 'Trade with ' + current.peer.name));
  const cancel = button('Cancel trade', () => tradeAction('cancel', { tradeId: current.id }));
  if (current.state === 'invited') {
    area.append(el('p', 'pv-summary', current.initiatedByMe ? 'Waiting for player to accept.' : 'This player invited you to trade pets.'));
    area.append(row(...(current.initiatedByMe ? [] : [button('Accept trade', () => tradeAction('accept', { tradeId: current.id }), { primary: true })]), cancel));
    return area;
  }
  const lists = el('div', 'pv-trade-offers');
  for (const [heading, pets] of [['Your offer', current.mine], ['Their offer', current.theirs]]) {
    const item = el('div');
    item.append(el('h4', '', heading));
    const list = el('ul', 'pv-list');
    for (const pet of pets) list.append(el('li', '', describePet(pet)));
    if (!pets.length) list.append(el('li', 'pv-summary', 'No pets offered'));
    item.append(list);
    lists.append(item);
  }
  area.append(lists);
  const offered = current.mine.map(pet => pet.id).sort().join(',');
  if (tradeDraft?.id !== current.id || tradeDraft.offered !== offered) {
    tradeDraft = { id: current.id, offered, selection: new Set(current.mine.map(pet => pet.id)) };
  }
  const { selection } = tradeDraft;
  const petList = el('div', 'pv-trade-pets');
  for (const pet of progress.inventory.filter(pet => !pet.locked && !pet.favorite && !progress.equipped.includes(pet.id))) petList.append(checkbox(describePet(pet), selection.has(pet.id), selected => {
    if (selected) selection.add(pet.id);
    else selection.delete(pet.id);
    syncOffer();
  }));
  if (!petList.childElementCount) petList.append(el('p', 'pv-summary', 'Unlock an eligible pet to include it in a trade.'));
  const confirm = button(current.confirmedByMe ? 'Offer confirmed' : 'Confirm trade', () => tradeAction('confirm', {
    tradeId: current.id, revision: current.revision
  }), { primary: true });
  const saveOffer = button('Save offer', () => tradeAction('offer', { tradeId: current.id, petIds: [...selection] }));
  function syncOffer() {
    const changed = [...selection].sort().join(',') !== offered;
    saveOffer.disabled = !changed || selection.size > 4;
    confirm.disabled = changed || current.confirmedByMe || !current.mine.length || !current.theirs.length;
  }
  syncOffer();
  area.append(disclosure('trade-selection', 'Choose pets to offer', petList), statLine(current.confirmedByPeer ? 'Other player confirmed.' : 'Both players must confirm the same offer.'),
    row(saveOffer, confirm, cancel));
  return area;
}

async function tradeAction(step, fields) {
  try { await online.trade(step, fields); }
  catch (error) { showFeedback(error.message || 'The trade could not be completed.', { error: true }); }
}

const online = createOnlineClient({
  onPeers(next) {
    const oldMembers = peers.map(peer => peer.id).join(',');
    peers = next;
    updateHeader();
    updateWorld();
    if (screen === 'Online' && oldMembers !== peers.map(peer => peer.id).join(',')) refreshPanel();
  },
  onPosition(position) { world?.setPosition(position); },
  onProgress(next, event) {
    if (self && event?.type === 'trade') {
      commit(next);
      showFeedback('Trade complete. Your new pets are in the journal.');
      refreshPanel();
    }
  },
  onTrade(next) {
    trade = next;
    if (next.state === 'closed') tradeDraft = undefined;
    if (next.state === 'invited' && !next.initiatedByMe) {
      showFeedback(next.peer.name + ' sent a trade invitation. Open Online to respond.');
    } else if (next.state === 'closed' && next.message) showFeedback(next.message);
    if (screen === 'Online') refreshPanel();
  },
  onClose({ unexpected, message }) {
    if (self && unexpected) {
      clearOnline();
      connectionError = message || 'The connection ended. Rejoin to resume your server save.';
      openScreen('Online');
    }
  }
});

async function joinOnline(newGuest = false) {
  if (connecting || busy) return;
  stopAuto('Connecting to another save');
  connecting = true;
  connectionError = '';
  canStartGuest = false;
  const revision = ++connectionEpoch;
  updateHeader();
  refreshPanel();
  try {
    const joined = await online.connect(endpoint, { newGuest });
    if (revision !== connectionEpoch) return;
    self = joined.self;
    peers = joined.peers;
    world?.setPosition(joined.self);
    progress = joined.progress;
    lastReveal = [];
    auto = undefined;
    showFeedback('');
  } catch (error) {
    if (revision === connectionEpoch) {
      connectionError = error.message;
      canStartGuest = error.code === 'invalid_token';
    }
  } finally {
    if (revision === connectionEpoch) {
      connecting = false;
      updateHeader();
      updateWorld();
      refreshPanel();
    }
  }
}

function clearOnline() {
  connectionEpoch++;
  connecting = false;
  stopAuto('Session ended');
  self = null;
  peers = [];
  trade = undefined;
  tradeDraft = undefined;
  auto = undefined;
  lastReveal = [];
  progress = solo;
  updateHeader();
  updateWorld();
}

function leaveOnline() {
  online.disconnect();
  clearOnline();
  connectionError = '';
  showFeedback('');
  refreshPanel();
}

function setProximity(target) {
  nearby = target;
  interact.textContent = target?.type === 'gather' ? 'Gather ' + target.label : target?.label || 'Explore';
  interact.disabled = !target;
}

async function startWorld() {
  try {
    const { mountWorld } = await import('./world.js');
    if (signal.aborted) return;
    world = mountWorld(terrain, {
      onGather: nodeId => void act({ type: 'gather', nodeId }),
      onInteract(id) {
        if (id === 'upgrades') openScreen('Upgrades');
        else {
          if (eggsById.has(id)) activeEgg = id;
          openScreen('Hatch');
        }
      },
      onMove(position) { if (self) online.move(position); },
      onProximity: setProximity,
      onReady({ available }) {
        worldReady = available;
        worldNotice.hidden = available;
        worldNotice.textContent = available ? '' : '3D graphics are unavailable on this device.';
      }
    });
    if (self) world.setPosition(self);
    updateWorld();
  } catch {
    worldNotice.textContent = 'The meadow could not load. Try reopening the game.';
  }
}

sound.configure(prefs.audio);
root.addEventListener('pointerdown', () => void sound.unlock(), { capture: true, once: true, signal });
root.addEventListener('keydown', () => void sound.unlock(), { capture: true, once: true, signal });
root.addEventListener('click', event => {
  if (event.target.closest('button')) sound.play('ui');
}, { signal });

collectTimer = setInterval(() => {
  if (nearby?.type !== 'gather' || document.hidden || busy || connecting ||
      !progress.upgrades.autoCollect || !progress.settings.autoCollect ||
      (progress.nodeReadyAt[nearby.id] || 0) > Date.now()) return;
  void act({ type: 'gather', nodeId: nearby.id, mode: 'auto' }, { quiet: true });
}, 550);

window.addEventListener('pagehide', event => {
  stopAuto('Game closed');
  online.disconnect();
  clearOnline();
  if (event.persisted) { refreshPanel(); return; }
  clearInterval(collectTimer);
  clearTimeout(feedbackTimer);
  scope.abort();
  online.destroy();
  world?.destroy();
  sound.destroy();
}, { signal });

updateHeader();
refreshPanel();
void startWorld();
