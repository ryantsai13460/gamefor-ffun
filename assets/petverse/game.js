import { PETS, EGGS, VARIANTS, UPGRADES, GENERATIONS, REBIRTH_ALTAR, achievementStatus, applyAction,
  awardCrystalBreak, collectEligibleDrops, collectionMetrics, createProgress, expeditionCollections, fusionOptions, generationStatus,
  hatchOdds, hatchPlan, magnetStats, petCombatStats, progression, rebirthPlan, restoreProgress } from './model.js?v=20261123-4';
import { createOnlineClient } from './online.js?v=20261123-4';
import { defaultPreferences, preferencesKey, readPreferences, readStorage, soloKey, writeStorage } from './preferences.js?v=20261123-4';
import { createSound } from './sound.js?v=20261123-4';
import { FARM_AREAS, FARM_PRIORITIES, canFarmArea, createFarmingWorld, farmSettings, farmingAreaAt } from './farming.js?v=20261123-4';
import { advanceGenerator, canOperateGenerator, GENERATOR_UPGRADES, generatorEggCost,
  generatorPlan, markGeneratorStart } from './generator.js?v=20261123-4';
import { biomeAt, canEnterBiome, expeditionDestination, expeditionEggAt, EXPEDITION_BIOMES, MEADOW_ARRIVAL } from './biomes.js?v=20261123-4';

const root = document.getElementById('petverse');
const scope = new AbortController();
const { signal } = scope;
const sound = createSound();
const speciesById = new Map(PETS.map(pet => [pet.id, pet]));
const variantById = new Map(VARIANTS.map(variant => [variant.id, variant]));
const eggsById = new Map(EGGS.map(egg => [egg.id, egg]));
const biomesById = new Map(EXPEDITION_BIOMES.map(biome => [biome.id, biome]));
const currencyNames = { sunbeams: 'Gold', crystals: 'Crystals', ascension: 'Ascension' };
const number = new Intl.NumberFormat('en');
const percent = new Intl.NumberFormat('en', { maximumFractionDigits: 3, style: 'percent' });
const navNames = ['Explore', 'Hatch', 'Pets', 'Farming', 'Generator', 'Upgrades', 'Journal', 'Settings', 'Online'];
const rankingMetrics = {
  collectionScore: 'Collection score', uniquePets: 'Unique species', shiny: 'Shiny discoveries', metallic: 'Metallic discoveries',
  gold: 'Gold discoveries', diamond: 'Diamond discoveries', obsidian: 'Obsidian discoveries', titanium: 'Titanium discoveries',
  giant: 'Giant discoveries',
  mythic: 'Mythic discoveries', eggsHatched: 'Eggs hatched', resourcesCollected: 'Resources collected', rebirths: 'Rebirths',
  generation: 'Highest generation', achievementPoints: 'Achievement points', goldEarned: 'Gold earned',
  crystalsDestroyed: 'Crystals destroyed', specialCrystalsDestroyed: 'Special crystals destroyed',
  biomesCompleted: 'Biome collections completed', expeditionBonus: 'Expedition bonus'
};
const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial'];
const settingGroups = ['General', 'Generation', 'Stop rules', 'Notifications', 'Audio', 'Graphics', 'Inventory', 'Workshop', 'Accessibility'];
const stopLabels = {
  'new-discovery': 'New species discovered', 'new-variant': 'New variant discovered', 'inventory-full': 'Inventory full',
  'insufficient-sunbeams': 'More Gold needed', 'egg-out-of-range': 'Return to the regional egg station'
};

let solo = restoreProgress(readStorage(soloKey)) || createProgress();
let progress = solo;
let prefs = readPreferences();
let screen = 'Hatch';
let settingsGroup = 'Generation';
let petView = 'Inventory';
let query = '';
let filterVariant = '';
let filterGeneration = '';
let filterBiome = '';
let peers = [];
let self = null;
let room = null;
let soloReturnPosition;
let roomResources = {};
let roomMode = 'create';
let invitation = '';
let roomSize = '4';
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
let journalView = 'Milestones';
let rankMetric = 'collectionScore';
let rankFilter = '';
let rankRevision = 0;
let rankState;
let worldReady = false;
let fullscreenError = '';
let farming = null;
let soloFarm;
let farmingTimer;
let previousFarmTick;
let farmChoice = '';
let crankActive = false;
let crankPending = false;
let stopRequested = false;
let crankSoundAt = 0;
let generatorControls;
let farmingControls;
let income = [];
let upgradeView = 'All';
let visibleBiome;
let hatchStationInRange;
let expeditionAccess;
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
const fullscreen = button('Fullscreen', toggleFullscreen, { className: 'pv-button pv-fullscreen' });
header.append(brand, wallet, level, fullscreen);

const modes = el('nav', 'pv-play-modes');
modes.setAttribute('aria-label', 'Play modes');
const soloChoice = button('Play Solo', () => {
  if (self || connecting) leaveOnline();
  closeMenu();
});
const createChoice = button('Create Private Server', () => chooseRoom('create'));
const joinChoice = button('Join With Code', () => chooseRoom('join'));
modes.append(soloChoice, createChoice, joinChoice);

const layout = el('div', 'pv-layout');
const play = el('section', 'pv-play');
play.setAttribute('aria-label', 'Explore Sunstep Meadow');
const terrain = el('div', 'pv-world');
const worldLabel = el('p', 'pv-world-label', 'Sunstep Meadow');
const worldHelp = el('p', 'pv-world-help', 'WASD to move · Drag to orbit · E to crank · F to interact');
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
const interact = button('Interact', () => world?.interact(), { className: 'pv-button pv-primary pv-interact', disabled: true });
const resetCamera = button('Reset camera', () => world?.resetCamera(), { className: 'pv-button pv-reset-camera' });
const farmHud = el('aside', 'pv-farming-hud');
const farmHudTitle = el('strong');
const farmHudMetrics = el('small');
farmHud.append(farmHudTitle, farmHudMetrics);
const crankHud = el('aside', 'pv-crank-hud');
const crankTitle = el('strong');
const crankMeter = el('progress', 'pv-progress');
crankMeter.setAttribute('aria-label', 'Generation Progress');
const crankDetails = el('small');
const stopCranking = button('Stop Cranking', () => void setCranking(false));
crankHud.append(crankTitle, crankMeter, crankDetails, stopCranking);
crankHud.hidden = true;
terrain.append(worldLabel, worldNotice, touch, interact, farmHud, crankHud);
const fieldBar = el('div', 'pv-field-bar');
fieldBar.append(worldHelp, resetCamera, button('Ranks', () => openJournal('Leaderboards'), { label: 'Open Leaderboards' }));
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
play.append(banner);
const autoPanel = el('div', 'pv-auto-panel');
autoPanel.hidden = true;
consolePanel.append(nav, autoPanel, panel);
layout.append(play, consolePanel);
root.replaceChildren(header, modes, layout);
const menuClose = button('Close menu', closeMenu, { className: 'pv-button pv-close-menu' });
consolePanel.append(menuClose);

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

function currentField() {
  const position = world?.getPosition();
  return position && farmingAreaAt(position);
}

function farmingReadout() {
  const settings = farmSettings(progress);
  const area = FARM_AREAS.find(item => item.id === settings.area) || currentField();
  const owner = self?.id || 'solo';
  const working = farming?.pets?.filter(pet => pet.ownerId === owner && pet.targetId).length || 0;
  const windowMs = 20_000;
  income = income.filter(entry => Date.now() - entry.at <= windowMs);
  const earned = income.reduce((total, entry) => total + entry.gold, 0);
  return { area, assigned: Boolean(settings.area), working, goldPerSecond: (earned / (windowMs / 1000)).toFixed(1) };
}

function updateActivity() {
  const fields = farmingReadout();
  const generator = generatorPlan(progress);
  const fieldName = fields.area?.label || 'No nearby field';
  farmHudTitle.textContent = fields.assigned ? fieldName + ' · Assigned' : fieldName;
  const data = [];
  if (prefs.workshop.showPetActivity) data.push(fields.working + ' active');
  if (prefs.workshop.showIncome) data.push(fields.goldPerSecond + ' Gold/s');
  farmHudMetrics.textContent = data.join(' · ');
  crankHud.hidden = !crankActive;
  if (nearby?.type === 'generator') setProximity(nearby);
  crankTitle.textContent = generator.machine;
  crankMeter.hidden = !prefs.workshop.showProgress;
  crankMeter.max = generator.capacity;
  crankMeter.value = generator.energy;
  crankDetails.textContent = [format(Math.floor(generator.energy / 1000)) + ' / ' + format(generator.capacity / 1000) + ' energy', ...data].join(' · ');
  stopCranking.disabled = crankPending;
  if (farmingControls) {
    const here = currentField();
    farmingControls.summary.textContent = (fields.assigned ? 'Assigned to ' : 'Following you · ') + fieldName;
    farmingControls.active.textContent = `${fields.working}/${progress.equipped.length}`;
    farmingControls.crystals.textContent = format(progress.stats.crystalsDestroyed);
    farmingControls.income.textContent = fields.goldPerSecond;
    farmingControls.assign.disabled = !here || !canFarmArea(progress, here.id);
  }
  if (generatorControls) {
    const near = canOperateGenerator(world?.getPosition());
    generatorControls.meter.max = generator.capacity;
    generatorControls.meter.value = generator.energy;
    generatorControls.start.disabled = crankActive || crankPending || !near;
    generatorControls.status.textContent = crankActive ? 'Cranking' : near ? 'Ready to operate' : 'Approach the crank in the southwest workshop.';
    generatorControls.energy.textContent = format(Math.floor(generator.energy / 1000)) + ' / ' + format(generator.capacity / 1000);
    generatorControls.total.textContent = format(Math.floor(generator.produced / 1000));
    generatorControls.field.textContent = fieldName;
    generatorControls.active.textContent = String(fields.working);
    generatorControls.income.textContent = fields.goldPerSecond;
    const egg = eggsById.get(generator.eggId);
    generatorControls.claim.disabled = !near || !generator.ready || progress.wallet.sunbeams < generatorEggCost(egg);
  }
}

function updateHeader() {
  const stats = progression(progress);
  for (const [id, total] of Object.entries(balances)) total.textContent = format(progress.wallet[id]);
  const scores = collectionMetrics(progress);
  level.textContent = 'Lv ' + stats.level + ' · Gen ' + scores.generation + ' · ' + scores.rebirths + ' rebirths · ' + format(scores.collectionScore) + ' points';
  status.textContent = connecting ? 'Connecting' : self ? 'Online · ' + (peers.length + 1) : 'Solo';
  status.dataset.state = self ? 'online' : 'solo';
  status.setAttribute('aria-label', self ? (peers.length + 1) + ' real players online' : status.textContent);
  soloChoice.setAttribute('aria-pressed', String(!self && !connecting && screen !== 'Online'));
  createChoice.setAttribute('aria-pressed', String(screen === 'Online' && roomMode === 'create'));
  joinChoice.setAttribute('aria-pressed', String(screen === 'Online' && roomMode === 'join'));
  updateActivity();
}

function updateWorld(farmingEvents) {
  root.dataset.reducedMotion = String(prefs.graphics.reducedMotion);
  const visibleProgress = self ? { ...progress, nodeReadyAt: { ...progress.nodeReadyAt, ...roomResources } } : progress;
  const generator = generatorPlan(progress);
  world?.update({ progress: visibleProgress, peers, graphics: prefs.graphics, magnetPreview: screen === 'Upgrades',
    farming, farmingEvents, farmOwnerId: self?.id || 'solo', generator: { active: crankActive, ratio: generator.ratio,
      tier: generator.tier, rate: generator.speed, animate: prefs.workshop.crankAnimations } });
}

function refreshPanel({ resetScroll = false } = {}) {
  const focus = panel.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
  const scroll = panel.scrollTop;
  root.dataset.menuOpen = String(Boolean(screen));
  panel.hidden = !screen;
  menuClose.hidden = !screen;
  for (const [index, node] of navControls.entries()) node.setAttribute('aria-pressed', String(navNames[index] === screen));
  panel.replaceChildren();
  generatorControls = farmingControls = undefined;
  if (screen === 'Explore') renderExpedition();
  if (screen === 'Hatch') renderHatch();
  if (screen === 'Pets') renderPets();
  if (screen === 'Farming') renderFarming();
  if (screen === 'Generator') renderGenerator();
  if (screen === 'Upgrades') renderUpgrades();
  if (screen === 'Journal') renderJournal();
  if (screen === 'Settings') renderSettings();
  if (screen === 'Online') renderOnline();
  syncAutoPanel();
  updateActivity();
  panel.scrollTop = resetScroll ? 0 : scroll;
  if (focus) [...panel.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === focus)?.focus({ preventScroll: true });
}

function closeMenu() {
  openScreen(null);
  terrain.querySelector('canvas')?.focus({ preventScroll: true });
}

function openScreen(next) {
  screen = next;
  updateHeader();
  updateWorld();
  refreshPanel({ resetScroll: true });
  if (next === 'Journal' && journalView === 'Leaderboards') void updateLeaderboard();
}

function commit(next, farmingEvents) {
  progress = next;
  if (!self) {
    solo = next;
    storageAvailable = writeStorage(soloKey, solo);
  }
  updateHeader();
  updateWorld(farmingEvents);
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
    const result = self ? await online.command(action) : applyAction(progress, action, { position: world?.getPosition(), cranking: crankActive });
    if (epoch !== connectionEpoch) return null;
    commit(result.progress);
    if (result.event.type === 'error') {
      if (!quiet && !automatic) showFeedback(result.event.message, { error: true });
    } else {
      reportAction(result.event, action, { quiet, automatic });
      if (!storageAvailable && !self) showFeedback('Progress is available for this visit. This browser could not save it.', { error: true });
    }
    busy = false;
    if (action.type === 'collect') refreshRewardsPanel();
    else refreshPanel();
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
    const titan = event.pets.find(pet => pet.variant === 'titanium');
    const interesting = (prefs.notifications.titanium && titan) ||
      event.pets.find(pet => pet.variant !== 'normal' && prefs.notifications[pet.variant]);
    const discovered = event.pets.find(pet => event.newSpecies.includes(pet.speciesId));
    const spotlight = interesting || (prefs.notifications.newPet && discovered ? { ...discovered, variant: 'normal' } : null);
    const animate = prefs.reveal.animations && !prefs.graphics.reducedMotion && (!titan || prefs.reveal.titaniumAnimation) &&
      !(prefs.reveal.skipCommon && event.pets.every(pet => pet.variant === 'normal' && speciesById.get(pet.speciesId)?.rarity.toLowerCase() === 'common'));
    if (animate) world?.showBurst({ kind: 'hatch', variant: titan?.variant || spotlight?.variant || 'normal' });
    sound.play(titan && prefs.notifications.titanium && prefs.audio.enableTitanium ? 'titanium' : interesting && !titan ? 'rare' : 'hatch');
    if (spotlight) showFeedback('Discovered ' + describePet(spotlight) + ' · ' + speciesById.get(spotlight.speciesId).rarity, { pet: spotlight });
    else if (!automatic && !quiet) showFeedback('Hatched ' + event.pets.map(describePet).join(', ') + '.');
  } else if (event.type === 'gather') {
    world?.showBurst({ kind: 'gather', nodeId: action.nodeId });
  } else if (event.type === 'collect') {
    if (event.crystalId || event.areaId || event.remote) income.push({ at: Date.now(), gold: event.sunbeams });
    const showAmount = prefs.graphics.collectionNumbers && (!event.remote || prefs.workshop.showRemoteRewards);
    world?.showBurst({ kind: 'collect', nodeId: event.nodeId, amount: showAmount ? event.sunbeams : undefined, currency: 'gold' });
    sound.play('gather');
    if (!quiet) showFeedback('Collected ' + format(event.sunbeams) + ' Gold' +
      (event.crystals ? ' and ' + format(event.crystals) + (event.crystals === 1 ? ' Crystal.' : ' Crystals.') : '.'));
  } else if (event.type === 'fuse') {
    if (prefs.reveal.animations && !prefs.graphics.reducedMotion) world?.showBurst({ kind: 'hatch', variant: event.pet.variant });
    sound.play('rare');
    showFeedback('Fused ' + describePet(event.pet), { pet: event.pet });
  } else if (event.type === 'expedition-travel') {
    arriveAtExpedition(event.areaId, event.position);
  } else if (event.type === 'upgrade') {
    sound.play('ui');
    showFeedback((UPGRADES.find(upgrade => upgrade.id === action.id)?.name || 'Upgrade') + ' purchased.');
  } else if (event.type === 'rebirth') {
    if (prefs.reveal.animations && !prefs.graphics.reducedMotion) world?.showBurst({ kind: 'hatch', variant: 'mythic' });
    sound.play('rare');
    showFeedback('Rebirth complete. Your permanent bonuses and generation have been updated.');
  } else if (event.type === 'claim') {
    sound.play('rare');
    showFeedback('Achievement reward claimed.');
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
  updateActivity();
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
  input.setAttribute('aria-label', label);
  input.dataset.focusKey = label;
  for (const [id, name] of choices) input.append(new Option(name, id, false, id === value));
  input.addEventListener('change', () => change(input.value));
  field.append(el('span', '', label), input);
  return field;
}

function slider(label, id, group = 'audio') {
  const field = el('label', 'pv-field pv-volume');
  const output = el('span', 'pv-volume-value', Math.round(prefs[group][id] * 100) + '%');
  const input = el('input');
  input.type = 'range';
  input.min = 0;
  input.max = 100;
  input.step = 1;
  input.value = Math.round(prefs[group][id] * 100);
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => {
    output.textContent = input.value + '%';
    changePreference(group, id, Number(input.value) / 100);
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

function unlockRequirement(biome) {
  return 'Level ' + biome.level + (biome.rebirths ? ' · ' + biome.rebirths + (biome.rebirths === 1 ? ' rebirth' : ' rebirths') : '');
}

function expeditionAccessKey() {
  return [worldReady, ...EXPEDITION_BIOMES.map(biome => canEnterBiome(progress, biome.id))].join('/');
}

function renderExpedition() {
  expeditionAccess = expeditionAccessKey();
  const location = biomeAt(world?.getPosition());
  const area = section('Biome expeditions', 'Travel to an unlocked field to mine new crystals and find its egg station.');
  const current = el('div', 'pv-expedition-location');
  current.append(el('span', '', 'Current location'), el('strong', '', location?.label || 'Sunstep Meadow'));
  if (location) current.append(button('Return to Sunstep Meadow', () => void travelTo('meadow'), { disabled: !worldReady }));
  area.append(current);
  const sets = new Map(expeditionCollections(progress).map(collection => [collection.id, collection]));
  for (const biome of EXPEDITION_BIOMES) {
    const open = canEnterBiome(progress, biome.id);
    const egg = eggsById.get(biome.eggId);
    const card = el('article', 'pv-card pv-expedition-card');
    card.dataset.theme = biome.theme;
    const status = el('span', 'pv-expedition-status', location?.id === biome.id ? 'You are here' : open ? 'Open' : unlockRequirement(biome));
    const heading = el('div', 'pv-expedition-heading');
    heading.append(el('h3', '', biome.label), status);
    card.append(heading, el('p', 'pv-summary', biome.description),
      statLine(egg.name + ' · ' + format(egg.cost) + ' Gold · ' + sets.get(biome.id).discovered + ' / ' + sets.get(biome.id).total + ' species'),
      button('Travel to ' + biome.label, () => void travelTo(biome.id), { primary: open, disabled: !worldReady || !open || location?.id === biome.id }));
    area.append(card);
  }
  panel.append(area, expeditionScoreSection());
}

function expeditionScoreSection(showSets = false) {
  const scores = collectionMetrics(progress);
  const area = section('Expedition collection');
  const totals = el('dl', 'pv-workshop-stats');
  metric(totals, 'Collection score', format(scores.collectionScore));
  metric(totals, 'Discovery points', format(scores.discoveryPoints));
  metric(totals, 'Expedition bonus', '+' + format(scores.expeditionBonus));
  metric(totals, 'Completed biome sets', scores.biomesCompleted + ' / ' + EXPEDITION_BIOMES.length);
  area.append(totals);
  if (showSets) {
    const list = el('div', 'pv-cards');
    for (const collection of expeditionCollections(progress)) {
      const card = el('article', 'pv-card');
      const meter = el('progress', 'pv-progress');
      meter.value = collection.discovered;
      meter.max = collection.total;
      meter.setAttribute('aria-label', collection.label + ' pet collection');
      card.append(el('h3', '', collection.label), meter, statLine(collection.discovered + ' / ' + collection.total + ' species'),
        el('p', 'pv-summary', format(collection.points) + ' discovery points · ' + format(collection.bonus) + ' / ' +
          format(collection.possibleBonus) + ' set bonus'));
      list.append(card);
    }
    area.append(list, el('p', 'pv-summary', 'Each biome awards bonus points at three species and again when you complete its collection.'));
  }
  return area;
}

function arriveAtExpedition(areaId, position) {
  const label = biomesById.get(areaId)?.label || 'Sunstep Meadow';
  crankActive = false;
  stopAuto('Traveled to ' + label);
  world?.setPosition(position, { reorient: true });
  updateLocation(biomeAt(position));
  closeMenu();
  showFeedback('Arrived at ' + label + '.');
}

async function travelTo(areaId) {
  if (!worldReady || busy || connecting || crankPending) return;
  const destination = expeditionDestination(progress, areaId);
  if (!destination) {
    showFeedback('Meet the biome requirements to travel there.', { error: true });
    return;
  }
  if (self) await act({ type: 'expedition-travel', areaId });
  else {
    if (crankActive) await setCranking(false);
    arriveAtExpedition(areaId, destination);
  }
}

function renderHatch() {
  const facts = progression(progress);
  const area = section('Egg nursery', 'Send your pets to break crystals, collect the Gold, and hatch stronger companions.');
  const stats = statLine(format(progress.stats.eggsHatched) + ' hatched · ' + progress.discovered.length + '/' + PETS.length + ' discovered · ' + progress.stats.shinies + ' shiny');
  area.append(stats);
  const cards = el('div', 'pv-cards');
  const selected = eggsById.get(activeEgg);
  const orderedEggs = selected?.biomeId ? [selected, ...EGGS.filter(egg => egg !== selected)] : EGGS;
  for (const egg of orderedEggs) {
    const card = el('article', 'pv-card pv-egg-card');
    card.dataset.current = String(egg.id === activeEgg);
    const eggArt = el('span', 'pv-egg-art');
    eggArt.style.setProperty('--pv-egg-color', egg.color);
    eggArt.setAttribute('aria-hidden', 'true');
    const name = el('div');
    name.append(el('h3', '', egg.name), el('p', 'pv-summary', format(egg.cost) + ' Gold per egg'));
    const head = el('div', 'pv-card-head');
    head.append(eggArt, name);
    card.append(head, el('p', 'pv-summary', egg.description));
    const biome = biomesById.get(egg.biomeId);
    if (biome && !canEnterBiome(progress, biome.id)) {
      card.append(statLine(biome.label + ' · ' + unlockRequirement(biome)));
    } else if (facts.generation < egg.generation) {
      card.append(statLine('Unlocks in Generation ' + egg.generation));
    } else if (facts.level < egg.level) {
      card.append(statLine('Unlocks at Level ' + egg.level));
    } else if (biome && !expeditionEggAt(world?.getPosition(), biome.id)) {
      card.append(statLine('Hatch at the egg station in ' + biome.label + '.'));
      if (biomeAt(world?.getPosition())?.id !== biome.id) {
        card.append(button('Travel to ' + biome.label, () => void travelTo(biome.id), { disabled: !worldReady }));
      }
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
      oddsList(hatchOdds(progress, egg.id).pool, reward => speciesById.get(reward.speciesId).name)));
    cards.append(card);
  }
  area.append(cards, disclosure('variant-odds', 'Variant odds and power',
    oddsList(hatchOdds(progress, EGGS[0].id).variants, variant => variant.name, variant => ' · ×' + variant.multiplier)));
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
  autoView.totals.textContent = auto.count + ' hatched · ' + format(auto.spent) + ' Gold spent · ' + auto.shinies +
    ' shiny · ' + auto.rare + ' variants · ' + (progression(progress).hatchInterval / 1000) + 's interval';
  const rules = VARIANTS.slice(1).filter(item => progress.settings.stopVariants[item.id]).map(item => item.name);
  if (progress.settings.stopOnNew) rules.push('New discovery');
  if (progress.settings.stopOnNewVariant) rules.push('New variant');
  if (progress.settings.stopOnFull) rules.push('Inventory full');
  autoView.ruleText.textContent = [...rules, 'Out of Gold'].join(', ');
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
  const stats = petCombatStats(pet, progress);
  copy.append(el('h3', '', describePet(pet)), el('p', 'pv-pet-meta',
    species.rarity + ' · Gen ' + species.generation + (equipped ? ' · Equipped' : '')),
  el('p', 'pv-summary', `${stats.damage} damage · ${stats.attackRate} hits/s · ${stats.moveSpeed} m/s`));
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
    progress.equipped.length + '/' + facts.equipSlots + ' equipped · ' + format(facts.teamDamageRate) + ' team damage/s');
  area.append(row(...['Inventory', 'Collection', 'Fusion'].map(view => button(view, () => {
    petView = view;
    refreshPanel();
  }, { pressed: petView === view }))));
  if (petView === 'Fusion') {
    renderFusion(area);
    panel.append(area);
    return;
  }
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
  }), select('Generation', filterGeneration, [['', 'All generations'], ...GENERATIONS.map(item => [String(item.id), item.name])], value => {
    filterGeneration = value;
    refreshCards();
  }), select('Biome', filterBiome, [['', 'All biomes'], ['meadow', 'Sunstep and Emberdeep'], ...EXPEDITION_BIOMES.map(item => [item.id, item.label])], value => {
    filterBiome = value;
    refreshCards();
  }));
  const cards = el('div', 'pv-cards');
  if (petView === 'Inventory') {
    filters.append(select('Sort pets', prefs.inventory.sort,
      [['power', 'Farming strength'], ['rarity', 'Rarity'], ['generation', 'Generation'], ['variant', 'Variant'], ['name', 'Name'], ['recent', 'Recently obtained']], value => {
        changePreference('inventory', 'sort', value);
        refreshCards();
      }));
    area.append(button('Equip best', () => act({ type: 'equip-best' })));
  } else {
    area.append(statLine(progress.discovered.length + ' of ' + PETS.length + ' species discovered · ' +
      percent.format(progress.discovered.length / PETS.length)));
    const totals = el('dl', 'pv-workshop-stats');
    for (const variant of VARIANTS) {
      const found = progress.variantDiscoveries.filter(key => key.endsWith(':' + variant.id)).length;
      metric(totals, variant.name, found + ' / ' + PETS.length);
    }
    area.append(disclosure('discovery-totals', 'Variant collection totals', totals));
    area.append(expeditionScoreSection(true));
  }
  area.append(filters, cards);
  panel.append(area);

  function matches(species) {
    return (!filterGeneration || String(species.generation) === filterGeneration) &&
      (!filterBiome || (species.biomeId || 'meadow') === filterBiome) &&
      (species.name + ' ' + species.rarity).toLowerCase().includes(query.trim().toLowerCase());
  }

  function refreshCards() {
    cards.replaceChildren();
    if (petView === 'Inventory') {
      const selectors = {
        power: (a, b) => petCombatStats(b, progress).farmingPower - petCombatStats(a, progress).farmingPower,
        rarity: (a, b) => rarityOrder.indexOf(speciesById.get(b.speciesId).rarity.toLowerCase()) - rarityOrder.indexOf(speciesById.get(a.speciesId).rarity.toLowerCase()),
        generation: (a, b) => speciesById.get(b.speciesId).generation - speciesById.get(a.speciesId).generation,
        variant: (a, b) => VARIANTS.indexOf(variantById.get(b.variant)) - VARIANTS.indexOf(variantById.get(a.variant)),
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

function renderFusion(area) {
  const choices = fusionOptions(progress);
  area.append(el('p', 'pv-summary', 'Fuse three eligible duplicates. Equipped, locked and favorited companions are protected.'));
  for (const plan of choices) {
    const card = el('article', 'pv-card');
    card.append(el('h3', '', describePet(plan.result)), el('p', 'pv-summary',
      plan.consumed.map(pet => describePet(pet) + ' #' + pet.id.replace('pet-', '')).join(' · ')),
    button('Review fusion', () => {
      const dialog = el('dialog', 'pv-dialog');
      dialog.append(el('h2', '', 'Fuse into ' + describePet(plan.result) + '?'),
        el('p', 'pv-summary', 'These companions will be consumed.'),
        ...plan.consumed.map(pet => el('p', 'pv-summary', describePet(pet) + ' #' + pet.id.replace('pet-', ''))),
        row(button('Cancel', () => dialog.close()), button('Confirm fusion', () => {
          dialog.close();
          void act({ type: 'fuse', petIds: plan.petIds, confirm: true });
        }, { primary: true })));
      dialog.addEventListener('close', () => dialog.remove(), { once: true });
      root.append(dialog);
      dialog.showModal();
    }));
    area.append(card);
  }
  if (!choices.length) area.append(statLine('Hatch more duplicates or unequip and unlock pets you want to fuse.'));
}

function updateFarmSettings(settings) {
  return act({ type: 'farm-settings', settings });
}

function renderFarming() {
  const settings = farmSettings(progress);
  const area = section('Crystal farming');
  const summary = el('p', 'pv-summary');
  const stats = el('dl', 'pv-workshop-stats');
  const active = metric(stats, 'Active Pets');
  const crystals = metric(stats, 'Crystals Destroyed');
  const incomeValue = metric(stats, 'Gold Per Second');
  const unlocked = FARM_AREAS.filter(item => canFarmArea(progress, item.id));
  const assign = button('Assign Pets Here', () => void act({ type: 'assign-farm-here' }), { primary: true });
  farmChoice = unlocked.some(item => item.id === farmChoice) ? farmChoice : settings.area || unlocked[0].id;
  area.append(summary, stats, row(assign,
    button('Recall All Pets', () => updateFarmSettings({ area: null, enabled: false })),
    button('Follow Player', () => updateFarmSettings({ area: null, enabled: true }))),
  select('Change farming area', farmChoice, unlocked.map(item => [item.id, item.label]), id => { farmChoice = id; }),
  button('Assign selected area', () => updateFarmSettings({ area: farmChoice, enabled: true })),
  checkbox('Automatic Crystal Targeting', settings.enabled, enabled => updateFarmSettings({ enabled })),
  checkbox('Prioritize Special Crystals', settings.preferSpecial, preferSpecial => updateFarmSettings({ preferSpecial })),
  select('Target priority', settings.policy, FARM_PRIORITIES.map(item => [item.id, item.label]), policy => updateFarmSettings({ policy })));
  const locked = FARM_AREAS.filter(item => !canFarmArea(progress, item.id));
  if (locked.length) area.append(...locked.map(field => statLine(field.label + ' unlocks at Level ' + field.level +
    (field.rebirths ? ' after ' + field.rebirths + ' rebirth' : ''))));
  area.append(el('p', 'pv-summary', magnetStats(progress).remote ? 'Remote magnet collects drops from your assigned field.' :
    'Buy Remote Magnet to collect Gold while your team works in a different field.'),
  button('Magnet upgrades', () => { upgradeView = 'Farming'; openScreen('Upgrades'); }));
  farmingControls = { summary, active, crystals, income: incomeValue, assign };
  panel.append(area);
}

function metric(list, label, value = '') {
  const item = el('div');
  const total = el('dd', '', value);
  item.append(el('dt', '', label), total);
  list.append(item);
  return total;
}

function renderGenerator() {
  const plan = generatorPlan(progress);
  const area = section(plan.machine);
  const status = el('p', 'pv-summary');
  const meter = el('progress', 'pv-progress');
  meter.setAttribute('aria-label', 'Stored generator energy');
  const stats = el('dl', 'pv-workshop-stats');
  metric(stats, 'Generation', String(progression(progress).generation));
  metric(stats, 'Generation Speed', plan.speed + ' energy/s');
  const energy = metric(stats, 'Stored Energy');
  const total = metric(stats, 'Energy Produced');
  const field = metric(stats, 'Current Farming Area');
  const active = metric(stats, 'Active Pets');
  const income = metric(stats, 'Gold Per Second');
  metric(stats, 'Generator Upgrade Level', String(plan.upgradeRanks));
  metric(stats, 'Cost Per Charge', plan.threshold / 1000 + ' energy');
  const start = button('Start Cranking', () => void setCranking(true), { primary: true });
  const egg = eggsById.get(plan.eggId);
  const claim = button('Hatch Charged Egg', () => void act({ type: 'generatorClaim', eggId: plan.eggId }), { primary: true });
  const unlocked = EGGS.filter(item => item.generation <= progression(progress).generation && item.level <= plan.level);
  area.append(status, meter, stats, start,
    select('Generator egg', plan.eggId, unlocked.map(item => [item.id, item.name]), eggId => void act({ type: 'generatorSelect', eggId })),
    statLine('A full charge hatches one ' + egg.name + ' for ' + generatorEggCost(egg) + ' Gold.'), claim,
    button('Generator upgrades', () => { upgradeView = 'Generator'; openScreen('Upgrades'); }));
  if (plan.nextMachine) area.append(statLine(plan.nextMachine.name + ' unlocks at Level ' + plan.nextMachine.level +
    (plan.nextMachine.rebirths ? ' after rebirth.' : '.')));
  generatorControls = { meter, start, status, energy, total, field, active, income, claim };
  panel.append(area);
}

function renderUpgrades() {
  const facts = progression(progress);
  const area = section('Meadow workshop', 'Spend resources earned in the meadow on persistent upgrades.');
  const stats = magnetStats(progress);
  const precise = value => Number(value.toFixed(2));
  area.append(statLine('Magnet · ' + precise(stats.radius) + ' m range · ' + precise(stats.speed) + ' attraction speed'),
    row(...['All', 'Farming', 'Generator'].map(view => button(view, () => { upgradeView = view; refreshPanel(); },
      { label: view + ' upgrades only', pressed: view === upgradeView }))));
  const magnetStatsKeys = { magnetRange: ['radius', ' m pickup range'], magnetSpeed: ['speed', ' attraction speed'], magnetEfficiency: ['efficiency', ' reward multiplier'],
    ascensionReach: ['radius', ' m pickup range'], ascensionYield: ['efficiency', ' reward multiplier'] };
  const cards = el('div', 'pv-cards');
  const generatorIds = new Set(GENERATOR_UPGRADES.map(upgrade => upgrade.id));
  const farmingIds = new Set(['petDamage', 'attackRate', 'petSpeed', 'specialCrystalLuck', 'remoteMagnet', 'autoCollect', 'harvest']);
  for (const upgrade of UPGRADES) {
    if (upgradeView === 'Generator' && !generatorIds.has(upgrade.id)) continue;
    if (upgradeView === 'Farming' && !farmingIds.has(upgrade.id) && !magnetStatsKeys[upgrade.id] && !upgrade.id.startsWith('magnet')) continue;
    const rank = progress.upgrades[upgrade.id];
    const cost = upgrade.costs[rank];
    const card = el('article', 'pv-card');
    card.append(el('h3', '', upgrade.name), el('p', 'pv-summary', upgrade.description),
      statLine('Rank ' + (rank || 0) + '/' + upgrade.costs.length + (upgrade.currency === 'ascension' ? ' · Ascension' : '')));
    const stat = magnetStatsKeys[upgrade.id];
    if (stat && cost !== undefined) {
      const next = magnetStats({ ...progress, upgrades: { ...progress.upgrades, [upgrade.id]: rank + 1 } });
      card.append(el('p', 'pv-summary', 'Next rank gives ' + precise(next[stat[0]]) + stat[1] + '.'));
    }
    if (generatorIds.has(upgrade.id) && cost !== undefined) {
      const next = generatorPlan({ ...progress, upgrades: { ...progress.upgrades, [upgrade.id]: rank + 1 } });
      card.append(statLine(`Next rank · ${next.speed} energy/s · ${next.capacity / 1000} stored · ${next.threshold / 1000} per charge`));
    }
    if (cost === undefined) card.append(statLine('Fully upgraded'));
    else if (facts.level < upgrade.level) card.append(statLine('Unlocks at Level ' + upgrade.level));
    else if (upgrade.rebirths > facts.rebirths) card.append(statLine('Unlocks after rebirth'));
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

function openJournal(view) {
  journalView = view;
  openScreen('Journal');
}

function renderJournal() {
  const scores = collectionMetrics(progress);
  const area = section('Meadow journal', format(scores.collectionScore) + ' collection points · Generation ' + scores.generation);
  area.append(row(...['Milestones', 'Rebirth Cave', 'Leaderboards'].map(view =>
    button(view, () => openJournal(view), { pressed: view === journalView }))));
  panel.append(area);
  if (journalView === 'Rebirth Cave') renderRebirth();
  else if (journalView === 'Leaderboards') renderRanks(scores);
  else renderMilestones(scores);
}

function renderMilestones(scores) {
  const generations = section('Generations', 'Grow your collection and rebirth at the cave to unlock later eggs.');
  for (const generation of generationStatus(progress)) {
    const card = el('article', 'pv-card');
    const bar = el('progress', 'pv-progress');
    bar.max = generation.total || 1;
    bar.value = generation.discovered;
    bar.setAttribute('aria-label', generation.name + ' collection completion');
    card.append(el('h3', '', generation.name), el('p', 'pv-summary', generation.description), bar,
      statLine(generation.discovered + ' of ' + generation.total + ' discovered · ' + percent.format(generation.discovered / bar.max) +
        ' · ' + (generation.unlocked ? 'Unlocked' : generation.rebirths + ' rebirths required')));
    generations.append(card);
  }
  const milestones = section('Achievements', format(scores.achievementPoints) + ' achievement points');
  for (const achievement of achievementStatus(progress)) {
    const card = el('article', 'pv-card');
    const bar = el('progress', 'pv-progress');
    bar.max = achievement.target;
    bar.value = Math.min(achievement.current, achievement.target);
    bar.setAttribute('aria-label', achievement.name + ' completion');
    card.append(el('h3', '', achievement.name), el('p', 'pv-summary', achievement.description), bar,
      statLine(Math.min(achievement.current, achievement.target) + '/' + achievement.target));
    if (achievement.isClaimed) card.append(el('p', 'pv-summary', 'Reward claimed'));
    else card.append(button('Claim ' + achievement.reward + ' Ascension', () => act({ type: 'claim', achievementId: achievement.id }),
      { label: 'Claim ' + achievement.name, primary: achievement.isReady, disabled: !achievement.isReady }));
    milestones.append(card);
  }
  panel.append(generations, milestones);
}

function isAtAltar(position = world?.getPosition()) {
  return Boolean(position && Math.hypot(position.x - REBIRTH_ALTAR.x, position.z - REBIRTH_ALTAR.z) <= REBIRTH_ALTAR.radius);
}

function renderRebirth() {
  const plan = rebirthPlan(progress);
  const { requirements, rewards } = plan;
  const area = section('Rebirth Altar', 'Follow the stone path to the southwest cave to bring your offering to the altar.');
  const old = collectionMetrics(progress);
  const stats = el('dl', 'pv-odds-list');
  for (const [label, value] of [
    ['Previous rebirths', plan.count], ['Required level', requirements.level], ['Gold offered', requirements.sunbeams],
    ['Crystals offered', requirements.crystals], ['Ascension earned', rewards.ascension], ['Generation after rebirth', rewards.generation]
  ]) stats.append(el('dt', '', label), el('dd', '', format(value)));
  area.append(stats, statLine('Permanent bonuses · +' + percent.format(rewards.resourceBonus) + ' gathering yield and +' + rewards.magnetBonus + ' m magnet range'),
    el('p', 'pv-summary', 'Pets, discoveries, XP and purchased upgrades stay with you.'));
  if (rewards.generation > old.generation) area.append(statLine('A new generation and the Ember Geode egg unlock with this rebirth.'));
  if (!isAtAltar()) area.append(statLine('Walk up to the altar to rebirth.'));
  else if (!plan.available) area.append(statLine('Meet the level and resource requirements for the next rebirth.'));
  area.append(button('Begin rebirth', () => confirmRebirth(plan), { primary: true, disabled: !plan.available || !isAtAltar() }));
  panel.append(area);
}

function confirmRebirth(plan) {
  const dialog = el('dialog', 'pv-dialog');
  dialog.append(el('h2', '', 'Offer resources at the altar?'),
    el('p', 'pv-summary', 'Spend ' + format(plan.requirements.sunbeams) + ' Gold and ' + format(plan.requirements.crystals) +
      ' Crystals. You keep your pets, discoveries and upgrades.'),
    row(button('Cancel', () => dialog.close()), button('Confirm rebirth', () => {
      dialog.close();
      void act({ type: 'rebirth', confirm: true });
    }, { primary: true })));
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  root.append(dialog);
  dialog.showModal();
}

function renderRanks(scores) {
  const area = section('Leaderboards', self ? 'Saved statistics from explorers in your current private meadow.' : 'Your score from this solo save. Join a private meadow to rank with friends.');
  area.classList.add('pv-rankings');
  area.append(select('Ranking', rankMetric, Object.entries(rankingMetrics), metric => {
    rankMetric = metric;
    rankState = undefined;
    refreshPanel();
    void updateLeaderboard();
  }), statLine('Your ' + rankingMetrics[rankMetric].toLowerCase() + ' · ' + format(scores[rankMetric])),
  row(button(document.fullscreenElement === panel ? 'Exit rankings fullscreen' : 'Fullscreen rankings', async () => {
    try {
      if (document.fullscreenElement === panel) await document.exitFullscreen();
      else await panel.requestFullscreen();
    } catch { showFeedback('Fullscreen rankings are unavailable in this browser.', { error: true }); }
    refreshPanel();
  }), button('Back to meadow', async () => {
    if (document.fullscreenElement === panel) await document.exitFullscreen();
    closeMenu();
    terrain.querySelector('canvas')?.focus();
  })));
  if (self) {
    const filter = el('label', 'pv-field');
    const search = el('input');
    search.type = 'search';
    search.value = rankFilter;
    search.dataset.focusKey = 'rank-filter';
    filter.append(el('span', '', 'Search ranked explorers'), search);
    const list = el('ol', 'pv-ranking-list');
    search.addEventListener('input', () => { rankFilter = search.value; paint(); });
    area.append(filter, button('Refresh rankings', updateLeaderboard), list);
    paint();

    function paint() {
      list.replaceChildren();
      if (!rankState || rankState.metric !== rankMetric || rankState.roomId !== room?.id) {
        list.append(el('li', 'pv-summary', 'Loading verified rankings…'));
      } else if (rankState.error) list.append(el('li', 'pv-summary', rankState.error));
      else {
        for (const [index, entry] of rankState.entries.entries()) {
          if (!entry.name.toLowerCase().includes(rankFilter.trim().toLowerCase())) continue;
          const item = el('li');
          item.append(el('small', '', String(index + 1)), el('span', '', entry.name), el('strong', '', format(entry.score)));
          list.append(item);
        }
        if (!list.childElementCount) list.append(el('li', 'pv-summary', 'No matching explorers.'));
      }
    }
  }
  panel.append(area);
}

async function updateLeaderboard() {
  if (!self || !room) return;
  const metric = rankMetric;
  const roomId = room.id;
  const revision = ++rankRevision;
  try {
    const result = await online.leaderboard(metric);
    if (revision === rankRevision && room?.id === roomId) rankState = { ...result, roomId };
  } catch (error) {
    if (revision === rankRevision && room?.id === roomId) rankState = { metric, roomId, error: error.message };
  }
  if (revision === rankRevision && screen === 'Journal' && journalView === 'Leaderboards') refreshPanel();
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
    group.append(choice('reveal', 'animations', 'Generation animations'), choice('reveal', 'titaniumAnimation', 'Titanium discovery animation'),
      choice('reveal', 'skipCommon', 'Skip common animations'),
      choice('reveal', 'results', 'Show generation results'), statLine(format(progress.stats.eggsHatched) + ' total hatched · ' +
        format(progress.stats.rareVariants) + ' rare variants'));
  } else if (settingsGroup === 'Stop rules') {
    for (const variant of VARIANTS.slice(1)) group.append(checkbox('Stop When ' + variant.name, progress.settings.stopVariants[variant.id],
      value => toggleSetting({ stopVariants: { [variant.id]: value } }),
      variant.id === 'shiny' ? 'When off, shiny pets do not stop a hatch session.' : undefined));
    group.append(gameSetting('Stop When a New Pet Is Discovered', 'stopOnNew'), gameSetting('Stop When a New Variant Is Discovered', 'stopOnNewVariant'),
      gameSetting('Stop When Inventory Is Full', 'stopOnFull', 'When off, a full habitat pauses hatching until you can resume.'),
      el('p', 'pv-summary', 'Auto-hatch always stops when you run out of Gold.'));
  } else if (settingsGroup === 'Notifications') {
    for (const variant of VARIANTS.slice(1)) group.append(choice('notifications', variant.id, variant.name + ' notifications'));
    group.append(choice('notifications', 'newPet', 'New species notifications'),
      choice('audio', 'enableRare', 'Notification sound'), choice('audio', 'enableTitanium', 'Titanium discovery sound'),
      slider('Notification volume', 'rare'));
  } else if (settingsGroup === 'Audio') {
    for (const [id, label] of Object.entries({
      master: 'Master volume', music: 'Music volume', ambient: 'Ambient volume', effects: 'Effects volume',
      hatch: 'Hatching volume', rare: 'Rare discovery volume', ui: 'Interface volume'
    })) group.append(slider(label, id));
    for (const [id, label] of Object.entries({
      enableMusic: 'Music', enableAmbient: 'Meadow ambience', enableEffects: 'Gathering sounds',
      enableHatch: 'Hatching sounds', enableRare: 'Rare discovery sounds', enableUI: 'Interface sounds',
      muteBackground: 'Mute when the game is in the background'
    })) group.append(choice('audio', id, label));
  } else if (settingsGroup === 'Graphics') {
    group.append(select('Graphics quality', prefs.graphics.quality, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
      value => changePreference('graphics', 'quality', value)),
    select('Particles', prefs.graphics.particles, [['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
      value => changePreference('graphics', 'particles', value)), slider('Camera sensitivity', 'cameraSensitivity', 'graphics'));
    for (const [id, label] of Object.entries({
      shadows: 'Shadows at High quality', petGlow: 'Pet glow', shinyEffects: 'Shiny effects', rareAnimations: 'Rare variant animations',
      showPeerPets: 'Show other players’ pets', showPeerTitanium: 'Show other players’ Titanium pets', showPetNames: 'Show pet names',
      collectionNumbers: 'Collection numbers', shake: 'Camera shake', reducedMotion: 'Reduced motion'
    })) group.append(choice('graphics', id, label));
  } else if (settingsGroup === 'Inventory') {
    group.append(choice('inventory', 'showDuplicates', 'Show duplicates'), select('Sort pets by', prefs.inventory.sort,
      [['power', 'Farming strength'], ['rarity', 'Rarity'], ['generation', 'Generation'], ['variant', 'Variant'], ['name', 'Name'], ['recent', 'Recently obtained']],
      value => changePreference('inventory', 'sort', value)),
    gameSetting('Auto Equip Best', 'autoEquip'), gameSetting('Lock Rare Pets', 'lockRare'));
  } else if (settingsGroup === 'Workshop') {
    for (const [id, label, hint] of [
      ['keepAssigned', 'Keep Pets in Assigned Area', 'Remember the assignment when you return to this save.'],
      ['recallOnWorldChange', 'Recall Pets When Changing Worlds', 'Release an assignment when entering solo play or a private room.'],
      ['generatorSounds', 'Generator Sounds'], ['crankAnimations', 'Crank Animations'], ['showProgress', 'Show Generation Progress'],
      ['showRemoteRewards', 'Show Remote Farming Rewards'], ['showIncome', 'Show Gold Per Second'], ['showPetActivity', 'Show Pet Activity']
    ]) group.append(choice('workshop', id, label, hint));
    group.append(checkbox('Automatic Crystal Targeting', farmSettings(progress).enabled, enabled => updateFarmSettings({ enabled })),
      gameSetting('Auto-Collect Gold Drops', 'autoCollectGold', 'Requires the Auto Collect upgrade.'));
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
  fullscreen.textContent = document.fullscreenElement === root ? 'Exit fullscreen' : 'Fullscreen';
  refreshPanel();
}

document.addEventListener('fullscreenchange', () => {
  fullscreen.textContent = document.fullscreenElement === root ? 'Exit fullscreen' : 'Fullscreen';
}, { signal });

function chooseRoom(mode) {
  if (!self && !connecting) {
    roomMode = mode;
    connectionError = '';
    canStartGuest = false;
  }
  openScreen('Online');
}

function renderOnline() {
  const area = section('Meadow online', self ? 'Connected as ' + self.name + '.' :
    'Private play uses a running Petverse server. Your online journal and solo save are separate.');
  if (!self) {
    area.append(row(button('Create private world', () => chooseRoom('create'), { pressed: roomMode === 'create', disabled: connecting }),
      button('Join an invitation', () => chooseRoom('join'), { pressed: roomMode === 'join', disabled: connecting })));
    const form = el('form', 'pv-connect');
    const label = el('label', 'pv-field');
    const input = el('input');
    input.type = 'url';
    input.placeholder = 'wss://your-petverse-server';
    input.value = endpoint;
    input.maxLength = 250;
    input.disabled = connecting;
    input.required = true;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      endpoint = input.value;
      canStartGuest = false;
      newGuestButton?.remove();
    });
    label.append(el('span', '', 'Server endpoint'), input);
    form.append(label);
    if (roomMode === 'join') {
      const codeLabel = el('label', 'pv-field');
      const code = el('input');
      code.type = 'text';
      code.maxLength = 14;
      code.required = true;
      code.disabled = connecting;
      code.autocapitalize = 'characters';
      code.autocomplete = 'off';
      code.spellcheck = false;
      code.placeholder = 'PET-…';
      code.value = invitation;
      code.addEventListener('input', () => { invitation = code.value; });
      codeLabel.append(el('span', '', 'Invitation code'), code);
      form.append(codeLabel);
    } else {
      form.append(select('Maximum players', roomSize, ['2', '3', '4', '6', '8', '12', '16'].map(size => [size, size]), size => { roomSize = size; }));
    }
    const join = el('button', 'pv-button pv-primary', connecting ? 'Connecting…' :
      roomMode === 'create' ? 'Create private meadow' : 'Join private meadow');
    join.type = 'submit';
    join.disabled = connecting || busy;
    form.addEventListener('submit', event => {
      event.preventDefault();
      endpoint = input.value.trim();
      void joinOnline();
    });
    form.append(join);
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
    area.append(statLine((room?.playerCount || peers.length + 1) + '/' + (room?.maxPlayers || peers.length + 1) +
      ' connected · Invite only'), button('Leave meadow', leaveOnline));
    if (room?.code && room.hostId === self.id) area.append(renderHostControls());
    if (trade && trade.state !== 'closed') area.append(renderTrade());
    const list = el('ul', 'pv-list pv-peers');
    for (const peer of peers) {
      const item = el('li');
      item.append(el('span', '', peer.name + (peer.id === room?.hostId ? ' · Host' : '')), button('Offer trade', () => tradeAction('invite', { peerId: peer.id }),
        { label: 'Offer trade to ' + peer.name, disabled: Boolean(trade && trade.state !== 'closed') }));
      list.append(item);
    }
    if (!peers.length) list.append(el('li', 'pv-summary', 'You’re the first player in this meadow.'));
    area.append(list);
  }
  panel.append(area);
}

function renderHostControls() {
  const card = el('section', 'pv-card pv-invite-card');
  const label = el('label', 'pv-field');
  const code = el('input');
  code.value = room.code;
  code.readOnly = true;
  code.spellcheck = false;
  code.setAttribute('aria-label', 'Invite code');
  label.append(el('span', '', 'Invite code'), code);
  card.append(el('h3', '', 'Host controls'), label,
    el('p', 'pv-summary', 'Share this code privately with friends who use the same server endpoint.'),
    row(button('Copy invite code', async () => {
      try { await navigator.clipboard.writeText(code.value); showFeedback('Invite code copied.'); }
      catch { code.focus(); code.select(); showFeedback('The invite code is selected. Copy it from the field.'); }
    }), button('Regenerate code', () => changeRoom('regenerate')), button('Close server', askCloseRoom)));
  if (Number.isFinite(room.expiresAt)) {
    card.append(el('p', 'pv-summary', 'Room expires ' + new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(room.expiresAt) + '.'));
  }
  return card;
}

async function changeRoom(step) {
  try {
    await online.room(step);
    if (step === 'regenerate') showFeedback('New invitation created. The previous code has expired.');
  } catch (error) { showFeedback(error.message, { error: true }); }
}

function askCloseRoom() {
  const dialog = el('dialog', 'pv-dialog');
  dialog.append(el('h2', '', 'Close this private world?'),
    el('p', 'pv-summary', 'Everyone will return to solo. Online profiles keep their saved progress.'),
    row(button('Keep room open', () => dialog.close()), button('Close private world', () => {
      dialog.close();
      void changeRoom('close');
    }, { primary: true })));
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  root.append(dialog);
  dialog.showModal();
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

async function setCranking(active) {
  if (crankPending) {
    if (!active) stopRequested = true;
    return;
  }
  if (active === crankActive || connecting) return;
  if (active && (!worldReady || !canOperateGenerator(world?.getPosition()) || document.hidden)) {
    showFeedback('Approach the crank in the southwest workshop.', { error: true });
    return;
  }
  const epoch = connectionEpoch;
  crankPending = true;
  updateActivity();
  try {
    if (self) {
      const result = await online.command({ type: active ? 'generatorStart' : 'generatorStop' });
      if (epoch !== connectionEpoch) return;
      if (result.event.type === 'error') {
        showFeedback(result.event.message, { error: true });
        return;
      }
      crankActive = active;
      commit(result.progress);
    } else {
      crankActive = active;
      previousFarmTick = Date.now();
      if (active) commit(markGeneratorStart(progress));
    }
    if (crankActive) {
      crankSoundAt = 0;
      closeMenu();
    }
  } catch (error) {
    if (epoch === connectionEpoch) showFeedback(error.message || 'The generator did not respond.', { error: true });
  } finally {
    if (epoch === connectionEpoch) {
      crankPending = false;
      updateActivity();
      updateWorld();
      const shouldStop = stopRequested || document.hidden || !canOperateGenerator(world?.getPosition());
      stopRequested = false;
      if (active && crankActive && shouldStop) void setCranking(false);
    }
  }
}

function showFarmingEvents(events = []) {
  const found = events.find(event => event.type === 'respawn' && event.specialTier &&
    (event.areaId === farmSettings(progress).area || event.areaId === currentField()?.id));
  if (found) {
    toast.replaceChildren(el('strong', '', 'A special crystal appeared in your field.'));
    toast.hidden = false;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { toast.hidden = true; }, 3500);
  }
}

function tickFarming() {
  const now = Date.now();
  const elapsed = now - (previousFarmTick || now);
  previousFarmTick = now;
  if (!worldReady || document.hidden || connecting) return;
  if (crankActive && prefs.workshop.generatorSounds && now >= crankSoundAt) {
    sound.play('crank');
    crankSoundAt = now + 760;
  }
  if (self) return;
  if (crankActive && !canOperateGenerator(world.getPosition())) void setCranking(false);
  const position = world.getPosition();
  let next = crankActive ? advanceGenerator(progress, elapsed) : progress;
  const events = soloFarm.advance([{ id: 'solo', position, progress: next }], now, (_, reward) => {
    const awarded = awardCrystalBreak(next, reward, { now });
    if (awarded.event.type === 'error') return false;
    next = awarded.progress;
    return true;
  });
  const rewards = collectEligibleDrops(next, { now, position, cranking: crankActive });
  next = rewards.progress;
  for (const event of rewards.events) reportAction(event, {}, { quiet: true });
  farming = soloFarm.snapshot();
  if (next !== progress) {
    commit(next, events);
    if (rewards.events.length) refreshRewardsPanel();
  }
  else {
    updateActivity();
    updateWorld(events);
  }
  showFarmingEvents(events);
}

function refreshRewardsPanel() {
  if (screen === 'Hatch' || screen === 'Upgrades' || (screen === 'Explore' && expeditionAccess !== expeditionAccessKey())) refreshPanel();
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
  onRoom(next) {
    room = next;
    if (screen === 'Online') refreshPanel();
    if (screen === 'Journal' && journalView === 'Leaderboards') void updateLeaderboard();
  },
  onResources(nodeReadyAt) {
    roomResources = nodeReadyAt;
    updateWorld();
  },
  onFarm(next, generator) {
    if (!self || !next) return;
    farming = next;
    if (!crankPending) crankActive = generator?.active === true;
    updateActivity();
    updateWorld(next.events);
    showFarmingEvents(next.events);
  },
  onRoomClosed({ message }) {
    clearOnline();
    invitation = '';
    connectionError = message || 'The host closed this private world.';
    openScreen('Online');
  },
  onProgress(next, event) {
    if (!self) return;
    if (event.type === 'collect') reportAction(event, {}, { quiet: true });
    commit(next);
    if (event.type === 'trade') {
      showFeedback('Trade complete. Your new pets are in the journal.');
      refreshPanel();
    } else if (event.type === 'collect') refreshRewardsPanel();
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
  const previousPosition = world?.getPosition();
  stopAuto('Connecting to another save');
  void setCranking(false);
  connecting = true;
  connectionError = '';
  canStartGuest = false;
  const revision = ++connectionEpoch;
  updateHeader();
  refreshPanel();
  try {
    const joined = await online.connect(endpoint, { newGuest, mode: roomMode, code: invitation, maxPlayers: Number(roomSize) });
    if (revision !== connectionEpoch) return;
    soloReturnPosition = previousPosition;
    self = joined.self;
    peers = joined.peers;
    room = joined.room;
    roomResources = joined.nodeReadyAt;
    farming = joined.farm;
    crankActive = joined.generator?.active === true;
    world?.setPosition(joined.self);
    progress = joined.progress;
    income = [];
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
  if (self && (!prefs.workshop.keepAssigned || prefs.workshop.recallOnWorldChange)) {
    await updateFarmSettings({ area: null });
  }
}

function clearOnline() {
  const wasOnline = Boolean(self);
  connectionEpoch++;
  connecting = false;
  stopAuto('Session ended');
  if (room) {
    if (room.code) invitation = room.code;
    roomMode = 'join';
  }
  self = null;
  peers = [];
  room = null;
  roomResources = {};
  farming = null;
  income = [];
  crankActive = false;
  crankPending = false;
  stopRequested = false;
  rankState = undefined;
  rankRevision++;
  trade = undefined;
  tradeDraft = undefined;
  auto = undefined;
  lastReveal = [];
  progress = solo;
  if (wasOnline) {
    const position = soloReturnPosition || MEADOW_ARRIVAL;
    world?.setPosition(position, { reorient: true });
    updateLocation(biomeAt(position));
    soloReturnPosition = undefined;
  }
  if (wasOnline && (!prefs.workshop.keepAssigned || prefs.workshop.recallOnWorldChange) && farmSettings(solo).area) {
    commit(applyAction(solo, { type: 'farm-settings', settings: { area: null } }).progress);
  }
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
  interact.textContent = target?.type === 'gather' ? 'Gather ' + target.label : target?.type === 'generator' ?
    (crankActive ? 'Press E to Stop Generator' : 'Press E to Operate Generator') : target?.label || 'Interact';
  interact.disabled = !target;
}

function updateLocation(biome) {
  if (visibleBiome === biome?.id) return;
  visibleBiome = biome?.id;
  worldLabel.textContent = biome?.label || 'Sunstep Meadow';
  play.setAttribute('aria-label', 'Explore ' + worldLabel.textContent);
  if (screen === 'Explore') refreshPanel();
}

let altarNearby = false;

async function startWorld() {
  try {
    const { mountWorld } = await import('./world.js?v=20261123-4');
    if (signal.aborted) return;
    world = mountWorld(terrain, {
      onGather: nodeId => void act({ type: 'gather', nodeId }),
      async onCollect(dropId) {
        if (document.hidden || connecting) return false;
        const event = await act({ type: 'collect', dropId }, { quiet: false });
        return event?.type === 'collect';
      },
      onInteract(id) {
        if (id === 'generator') void setCranking(!crankActive);
        else if (id === 'stop-generator') void setCranking(false);
        else if (id === 'upgrades') { upgradeView = 'All'; openScreen('Upgrades'); }
        else if (id === 'rebirth') openJournal('Rebirth Cave');
        else if (id === 'leaderboard') openJournal('Leaderboards');
        else {
          if (eggsById.has(id)) activeEgg = id;
          openScreen('Hatch');
        }
      },
      onMove(position) {
        if (self) online.move(position);
        if (crankActive && !canOperateGenerator(position)) void setCranking(false);
        if (farmingControls || generatorControls) updateActivity();
        const station = EXPEDITION_BIOMES.find(item => expeditionEggAt(position, item.id));
        if (station?.id !== hatchStationInRange) {
          hatchStationInRange = station?.id;
          const automaticBiome = eggsById.get(auto?.eggId)?.biomeId;
          if (automaticBiome && automaticBiome !== station?.id) stopAuto(stopLabels['egg-out-of-range']);
          if (screen === 'Hatch') refreshPanel();
          else syncAutoPanel();
        }
        const canReach = isAtAltar(position);
        if (canReach !== altarNearby) {
          altarNearby = canReach;
          if (screen === 'Journal' && journalView === 'Rebirth Cave') refreshPanel();
        }
      },
      onBiome: updateLocation,
      onProximity: setProximity,
      onReady({ available }) {
        worldReady = available;
        worldNotice.hidden = available;
        worldNotice.textContent = available ? '' : '3D graphics are unavailable on this device.';
        if (screen === 'Explore') refreshPanel();
      }
    });
    soloFarm = createFarmingWorld({ stats: petCombatStats });
    if (!self) farming = soloFarm.snapshot();
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
      Math.max(progress.nodeReadyAt[nearby.id] || 0, roomResources[nearby.id] || 0) > Date.now()) return;
  void act({ type: 'gather', nodeId: nearby.id, mode: 'auto' }, { quiet: true });
}, 550);
farmingTimer = setInterval(tickFarming, 200);

document.addEventListener('visibilitychange', () => {
  previousFarmTick = Date.now();
  if (document.hidden) void setCranking(false);
}, { signal });

window.addEventListener('pagehide', event => {
  stopAuto('Game closed');
  online.disconnect();
  clearOnline();
  if (event.persisted) { refreshPanel(); return; }
  clearInterval(collectTimer);
  clearInterval(farmingTimer);
  clearTimeout(feedbackTimer);
  scope.abort();
  online.destroy();
  world?.destroy();
  sound.destroy();
}, { signal });

if (!prefs.workshop.keepAssigned && farmSettings(solo).area) {
  commit(applyAction(solo, { type: 'farm-settings', settings: { area: null } }).progress);
}
updateHeader();
refreshPanel();
void startWorld();
