import { arcadeEmbed, browserApps } from "./embedded-content.js";
import { createGameAddressLookup, isGamePortalAddress } from "./game-play-policy.js";
import { createLibrary, normalize, queryLibrary } from "./library.js";

const assetVersion = new URL(import.meta.url).search;
const [{ games }, { mountLocalGame }] = await Promise.all([
  import(`./catalog.js${assetVersion}`), import(`./local-games.js${assetVersion}`)
]);

const legacyViewerOrigin = "https://proxy-arcade-play.base44.app";
const home = { kind: "home", title: "Start page", address: "" };
const localPage = "catch-the-star.html";
const shortcuts = [
  ["Catch the Star", localPage, "Local arcade"],
  ["Stacktris", "https://play.fancade.com/5BEC8352E4E078B1", "Game player"],
  ["Wikipedia", "https://www.wikipedia.org/", "Homepage preview"],
];
const youtubeHosts = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com",
  "youtu.be", "www.youtu.be", "www.youtube-nocookie.com",
]);
const browserViews = new WeakMap();
const browsingStorageKey = "gamefor-ffun-proxy-v1";
const closedTabsStorageKey = "gamefor-ffun-proxy-closed-v1";
const addressLimit = 2048;
const savedLimits = { favorites: 40, history: 30 };
const closedTabLimit = 8;
const closedEntryLimit = 24;
const youtubeApiUrl = "https://www.youtube.com/iframe_api";
let viewerCount = 0;
let youtubeApi;
const builtInGames = games.filter(game => game.local);
const embeddedGames = games.filter(arcadeEmbed);
const inPageLibrary = createLibrary([...builtInGames, ...embeddedGames]);
const gameEmbeds = new Map(
  embeddedGames.flatMap(game => [[game.url, game], [arcadeEmbed(game), game]])
);
const appEmbeds = new Map(browserApps.flatMap(app => [[app.embed, app], [app.url, app]]));
const catalogGameTitles = new Map(games.map(game => [normalize(game.title), game]));
const catalogGameAtAddress = createGameAddressLookup(games);
const featuredAlternatives = ["ffun-circuit-v1", "ffun-skyline-v1", "2048"];

function gameLaunchAddress(game) {
  return game.local ? `arcade:${game.id}` : arcadeEmbed(game);
}

function suggestedGames(category) {
  const sameCategory = category ? queryLibrary(inPageLibrary, { source: builtInGames, category }) : [];
  const featured = featuredAlternatives.map(id => inPageLibrary.byId.get(id)).filter(Boolean);
  return [...new Set([...sameCategory, ...featured, ...builtInGames])].slice(0, 3);
}

function catalogGameForQuery(query) {
  const title = normalize(query);
  if (catalogGameTitles.has(title)) return catalogGameTitles.get(title);
  if (title.length < 4) return undefined;
  return [...catalogGameTitles].find(([name]) => name.startsWith(`${title} `))?.[1];
}

function externalPreviewSource(page) {
  return page.kind === "game" || page.kind === "local" ? "" : page.url;
}

export function youtubeVideoId(url) {
  if (!youtubeHosts.has(url.hostname)) return "";
  const parts = url.pathname.split("/");
  let id;
  if (url.hostname.endsWith("youtu.be")) {
    id = parts[1];
  } else if (parts[1] === "watch") {
    id = url.searchParams.get("v");
  } else if (["shorts", "live", "embed"].includes(parts[1])) {
    id = parts[2];
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : "";
}

function youtubeStart(url) {
  const timestamp = url.searchParams.get("t") || url.searchParams.get("start") ||
    new URLSearchParams(url.hash.slice(1)).get("t") || "";
  if (/^\d{1,9}$/.test(timestamp)) return Number(timestamp);
  const parts = /^(?:(\d{1,6})h)?(?:(\d{1,6})m)?(?:(\d{1,6})s)?$/.exec(timestamp);
  if (!parts) return 0;
  const seconds = Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0);
  return seconds <= 2_147_483_647 ? seconds : 0;
}

export function resolveBrowserAddress(input, pageUrl) {
  if (typeof input !== "string" || input.length > addressLimit) return null;
  const address = input.trim();
  if (!address) return home;

  if (address.startsWith("arcade:")) {
    const game = builtInGames.find(entry => entry.id === address.slice("arcade:".length));
    if (!game) return null;
    if (game.local === true) return { kind: "built-in", title: game.title, address, id: game.id };
    return resolveBrowserAddress(game.local, pageUrl);
  }

  const local = new URL(localPage, pageUrl);
  if ([localPage, `./${localPage}`, local.pathname, local.href].includes(address)) {
    return { kind: "local", title: "Catch the Star", address: localPage, url: local.href };
  }

  const hasDomain = /^(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+(?::\d+)?(?:[/?#].*)?$/u.test(address);
  const hasScheme = !hasDomain && /^[a-z][a-z0-9+.-]*:/i.test(address);
  if (!hasScheme && !hasDomain) {
    const search = new URL("https://www.google.com/search");
    search.searchParams.set("q", address);
    return { kind: "search", title: address, address, url: search.href };
  }

  let url;
  try {
    url = new URL(hasScheme ? address : `https://${address}`);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port || /\s/.test(address)) return null;
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
  if (/^[\d.]+$/.test(url.hostname) || url.hostname.includes(":")) return null;
  if (/\.(?:local|localhost|home|lan|internal|test|invalid|example|onion)$/i.test(url.hostname)) return null;

  const videoId = youtubeVideoId(url);
  if (videoId) {
    const watchPath = url.pathname.startsWith("/shorts/") ? `shorts/${videoId}` : `watch?v=${videoId}`;
    const watch = new URL(watchPath, "https://www.youtube.com/");
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    const start = youtubeStart(url);
    if (start) {
      watch.searchParams.set("t", `${start}s`);
      embed.searchParams.set("start", String(start));
    }
    return {
      kind: "youtube", title: "YouTube", address: url.href,
      url: watch.href, embed: embed.href,
    };
  }

  const game = gameEmbeds.get(url.href);
  if (game) {
    return { kind: "game", title: game.title, address: url.href, url: game.url, embed: arcadeEmbed(game) };
  }

  const app = appEmbeds.get(url.href);
  if (app) {
    return { ...app, kind: "app", address: url.href };
  }

  if (url.origin === legacyViewerOrigin) {
    return { kind: "unavailable", title: "Base44 viewer", address: url.href };
  }

  const knownGame = catalogGameAtAddress(url);
  if (knownGame || isGamePortalAddress(url)) {
    return { kind: "external-game", title: knownGame?.title || url.hostname, address: url.href, game: knownGame };
  }

  return { kind: "website", title: url.hostname, address: url.href, url: url.href, embed: url.href };
}

function recoverBrowsingData(pageUrl) {
  const data = { favorites: [], history: [] };
  try {
    const stored = JSON.parse(window.localStorage.getItem(browsingStorageKey));
    for (const [key, limit] of Object.entries(savedLimits)) {
      if (!Array.isArray(stored?.[key])) continue;
      const addresses = stored[key].slice(0, limit).map(value => resolveBrowserAddress(value, pageUrl)?.address);
      data[key] = [...new Set(addresses.filter(Boolean))];
    }
  } catch {
    // Browsing is still available when private mode or browser policy disables storage.
  }
  return data;
}

function recoverClosedTabs(pageUrl) {
  try {
    const text = window.sessionStorage.getItem(closedTabsStorageKey);
    if (!text || text.length > 1_000_000) return [];
    const saved = JSON.parse(text);
    if (!Array.isArray(saved)) return [];
    const recovered = [];
    for (const tab of saved.slice(0, closedTabLimit)) {
      const addresses = tab?.addresses;
      if (!Array.isArray(addresses) || addresses.length > closedEntryLimit || !Number.isInteger(tab.index)
          || tab.index < 0 || tab.index >= addresses.length) continue;
      const entries = [];
      let index = -1;
      for (const [position, address] of addresses.entries()) {
        const page = resolveBrowserAddress(address, pageUrl);
        if (!page) continue;
        if (position === tab.index) index = entries.length;
        entries.push(page);
      }
      if (index !== -1 && entries.some(page => page.address)) recovered.push({ entries, index });
    }
    return recovered;
  } catch {
    return [];
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function control(label, symbol, action) {
  const button = element("button", "proxy-control", symbol);
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", action);
  return button;
}

function external(url, label, className) {
  const link = element("a", className, label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApi) return youtubeApi;
  youtubeApi = new Promise(resolve => {
    const existing = document.querySelector(`script[src="${youtubeApiUrl}"]`);
    const script = existing || element("script");
    const onError = () => finish(null);
    function finish(api) {
      clearInterval(poll);
      clearTimeout(timeout);
      script.removeEventListener("error", onError);
      if (!api && !existing) script.remove();
      resolve(api);
    }
    const poll = setInterval(() => {
      if (window.YT?.Player) finish(window.YT);
    }, 125);
    const timeout = setTimeout(() => finish(null), 6500);
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = youtubeApiUrl;
      script.async = true;
      document.head.append(script);
    }
  }).then(api => {
    if (!api) youtubeApi = undefined;
    return api;
  });
  return youtubeApi;
}

function createBrowser() {
  const shell = element("section", "proxy-viewer");
  const heading = element("div", "proxy-heading");
  const title = element("h1", "", "Proxy Gemini");
  const description = element("p", "", "Play arcade games here, search the web, or preview sites that allow embedding.");
  heading.append(title, description);

  const windowPanel = element("div", "proxy-window");
  const tabsRow = element("div", "proxy-tab-row");
  const tabs = element("div", "proxy-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Browser tabs");

  const toolbar = element("div", "proxy-toolbar");
  const navigation = element("div", "proxy-navigation");
  const viewerId = ++viewerCount;
  const panels = element("div", "proxy-panels");
  const addressError = element("p", "proxy-address-error");
  addressError.id = `proxy-address-error-${viewerId}`;
  addressError.setAttribute("role", "alert");
  addressError.hidden = true;
  const status = element("p", "proxy-status");
  status.setAttribute("role", "status");
  const statusRow = element("div", "proxy-status-row");
  const source = external("", "Open in new tab", "proxy-source");
  const progress = element("div", "proxy-progress");
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "Loading preview");
  progress.hidden = true;
  const savedStatus = element("p", "sr-only");
  savedStatus.setAttribute("role", "status");
  const browsing = recoverBrowsingData(window.location.href);
  const closedTabs = recoverClosedTabs(window.location.href);

  let counter = 0;
  function createTab(entries = [home], index = 0) {
    const id = ++counter;
    const panel = element("div", "proxy-tab-panel");
    panel.id = `proxy-tab-content-${viewerId}-${id}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `proxy-tab-${viewerId}-${id}`);
    panel.tabIndex = 0;
    panel.hidden = true;
    panels.append(panel);
    return { id, entries, index, panel, preview: null, draft: undefined, invalid: false, gameQuery: "" };
  }
  let active = createTab();
  const items = [active];
  let searchCache = new WeakMap();
  let searchWeb;
  let present = false;
  const current = () => active.entries[active.index];

  function storeBrowsing(message = "") {
    try {
      window.localStorage.setItem(browsingStorageKey, JSON.stringify(browsing));
      savedStatus.textContent = message;
    } catch {
      savedStatus.textContent = "Your browser could not save this change. It is available during this visit.";
    }
  }

  function recordVisit(page) {
    if (!page.address) return;
    browsing.history = [page.address, ...browsing.history.filter(value => value !== page.address)].slice(0, savedLimits.history);
    storeBrowsing();
  }

  function saveClosedTabs() {
    reopen.disabled = !closedTabs.length;
    try {
      const saved = closedTabs.map(tab => ({ addresses: tab.entries.map(page => page.address), index: tab.index }));
      window.sessionStorage.setItem(closedTabsStorageKey, JSON.stringify(saved));
    } catch {
      // Closed tabs are still available in this viewer while the page is open.
    }
  }

  function syncFavorite() {
    const pageAddress = current().address;
    const isSaved = browsing.favorites.includes(pageAddress);
    saveFavorite.disabled = !pageAddress;
    saveFavorite.textContent = isSaved ? "★" : "☆";
    saveFavorite.title = isSaved ? "Remove current page from favorites" : "Save current page to favorites";
    saveFavorite.setAttribute("aria-label", saveFavorite.title);
    saveFavorite.setAttribute("aria-pressed", String(isSaved));
  }

  function toggleFavorite() {
    const pageAddress = current().address;
    if (!pageAddress) return;
    const isSaved = browsing.favorites.includes(pageAddress);
    browsing.favorites = isSaved
      ? browsing.favorites.filter(value => value !== pageAddress)
      : [pageAddress, ...browsing.favorites].slice(0, savedLimits.favorites);
    storeBrowsing(isSaved ? "Page removed from favorites." : "Page saved to favorites.");
    syncFavorite();
  }

  function createDialog(title, contents) {
    const dialog = element("dialog", "proxy-saved");
    const heading = element("h2", "", title);
    const close = control("Close " + title.toLowerCase(), "×", () => dialog.close());
    close.autofocus = true;
    const header = element("div", "proxy-saved-heading");
    header.append(heading, close);
    dialog.setAttribute("aria-label", title);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.append(header, contents);
    windowPanel.append(dialog);
    return { dialog, close };
  }

  function showShare() {
    const page = current();
    if (!page.address) return;
    const url = new URL(window.location.href);
    url.search = "";
    url.username = "";
    url.password = "";
    url.hash = `browse?${new URLSearchParams({ address: page.address })}`;

    const contents = element("div", "proxy-saved-content proxy-share-content");
    const label = element("label", "", "Viewer link");
    const field = element("input", "field");
    field.readOnly = true;
    field.value = url.href;
    label.append(field);
    const status = element("p");
    status.setAttribute("role", "status");
    const copy = control("Copy link", "Copy link", async () => {
      try {
        await navigator.clipboard.writeText(field.value);
        status.textContent = "Link copied.";
      } catch {
        field.focus();
        field.select();
        status.textContent = "The link is selected. Use your device’s Copy command.";
      }
    });
    copy.className = "button";
    contents.append(element("p", "", "This link opens the current address in Proxy Gemini."), label, copy, status);
    const { dialog } = createDialog("Share page", contents);
    dialog.showModal();
    field.focus();
    field.select();
  }

  function showSaved(kind) {
    const favorites = kind === "favorites";
    const title = favorites ? "Favorite pages" : "Browsing history";
    const contents = element("div", "proxy-saved-content");
    const { dialog, close } = createDialog(title, contents);

    function drawSaved() {
      const entries = browsing[kind];
      if (!entries.length) {
        contents.replaceChildren(element("p", "proxy-saved-empty", favorites
          ? "You can save a page using the star beside the address bar."
          : "Addresses and searches you open appear here."));
      } else {
        const list = element("ul", "proxy-saved-list");
        for (const value of entries) {
          const page = resolveBrowserAddress(value, window.location.href);
          if (!page?.address) continue;
          const row = element("li");
          const open = control(`Open ${value}`, "", () => {
            dialog.close();
            submit(value);
            address.focus();
          });
          open.className = "proxy-saved-link";
          open.append(element("strong", "", page.title));
          if (page.title !== value) open.append(element("small", "", value));
          const remove = control(`Remove ${value}`, "×", () => {
            browsing[kind] = browsing[kind].filter(item => item !== value);
            storeBrowsing(favorites ? "Favorite removed." : "History entry removed.");
            if (current().kind === "home") showPage(true);
            else syncFavorite();
            drawSaved();
            close.focus();
          });
          row.append(open, remove);
          list.append(row);
        }
        contents.replaceChildren(list);
      }
      if (!favorites && (entries.length || closedTabs.length)) {
        const clear = control("Clear browsing history and closed tabs", "Clear history and closed tabs", () => {
          browsing.history = [];
          closedTabs.length = 0;
          saveClosedTabs();
          storeBrowsing("Browsing history cleared.");
          if (current().kind === "home") showPage(true);
          drawSaved();
          close.focus();
        });
        clear.className = "button proxy-clear-history";
        contents.append(clear);
      }
    }

    drawSaved();
    dialog.showModal();
  }

  function renderTabs(focus = false) {
    const entries = items.map(tab => {
      const label = tab.entries[tab.index].title;
      const item = element("div", "proxy-tab");
      item.dataset.active = String(tab === active);
      item.setAttribute("role", "presentation");
      const select = control(label, label, () => activate(tab));
      select.className = "proxy-tab-name";
      select.id = `proxy-tab-${viewerId}-${tab.id}`;
      select.setAttribute("role", "tab");
      select.setAttribute("aria-selected", String(tab === active));
      select.setAttribute("aria-controls", tab.panel.id);
      select.setAttribute("aria-keyshortcuts", "Delete");
      select.tabIndex = tab === active ? 0 : -1;
      select.addEventListener("keydown", event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === "Delete") {
          event.preventDefault();
          closeTab(tab);
          return;
        }
        const index = items.indexOf(tab);
        const ends = { Home: 0, End: items.length - 1 };
        const move = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (!move && !(event.key in ends)) return;
        event.preventDefault();
        activate(items[ends[event.key] ?? (index + move + items.length) % items.length]);
      });
      item.append(select);
      return item;
    });
    tabs.replaceChildren(...entries);
    closeActive.title = `Close ${current().title} tab`;
    closeActive.setAttribute("aria-label", closeActive.title);
    const tabButton = tabs.querySelector(`[id="proxy-tab-${viewerId}-${active.id}"]`);
    if (focus) {
      tabButton.focus({ preventScroll: true });
      tabButton.closest(".proxy-tab").scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }

  function activate(tab) {
    if (active !== tab) {
      active = tab;
      showPage();
    }
    renderTabs(true);
  }

  function closeTab(tab) {
    const index = items.indexOf(tab);
    if (index === -1) return;
    if (tab.entries.some(page => page.address)) {
      const latestStart = Math.max(0, tab.entries.length - closedEntryLimit);
      const start = Math.max(0, Math.min(latestStart, tab.index - Math.floor(closedEntryLimit / 2)));
      closedTabs.unshift({ entries: tab.entries.slice(start, start + closedEntryLimit), index: tab.index - start });
      closedTabs.length = Math.min(closedTabs.length, closedTabLimit);
      saveClosedTabs();
    }
    items.splice(index, 1);
    unloadTab(tab);
    tab.panel.remove();
    if (!items.length) items.push(createTab());
    if (active === tab) {
      active = items[Math.min(index, items.length - 1)];
      showPage();
    }
    renderTabs(true);
  }

  function addTab() {
    active = createTab();
    items.push(active);
    showPage();
    renderTabs();
    address.focus();
  }

  function openResultInTab(page) {
    const tab = createTab([home, page], 1);
    items.splice(items.indexOf(active) + 1, 0, tab);
    recordVisit(page);
    activate(tab);
  }

  function duplicateTab() {
    const next = createTab(active.entries.slice(), active.index);
    items.splice(items.indexOf(active) + 1, 0, next);
    activate(next);
    savedStatus.textContent = "Tab duplicated.";
  }

  function reopenTab() {
    const next = closedTabs.shift();
    if (!next) return;
    const tab = createTab(next.entries, next.index);
    items.push(tab);
    saveClosedTabs();
    activate(tab);
    savedStatus.textContent = "Closed tab reopened.";
  }

  function visit(page) {
    const restoreFocus = active.panel.contains(document.activeElement);
    active.draft = undefined;
    active.invalid = false;
    const repeatSearch = page.kind === "search" && page.address === current().address;
    if (page.kind !== current().kind || page.address !== current().address) {
      active.entries.splice(active.index + 1, Infinity, page);
      active.index++;
    }
    showPage(true, repeatSearch);
    renderTabs();
    if (restoreFocus) active.panel.focus({ preventScroll: true });
  }

  function navigate(offset) {
    const index = active.index + offset;
    if (!active.entries[index]) return;
    active.index = index;
    active.draft = undefined;
    active.invalid = false;
    showPage(true);
    renderTabs();
  }

  function submit(value) {
    const page = resolveBrowserAddress(value, window.location.href);
    if (page) {
      recordVisit(page);
      visit(page);
    } else {
      showAddressError(value);
    }
  }

  function clearAddressError() {
    address.removeAttribute("aria-invalid");
    address.removeAttribute("aria-describedby");
    addressError.hidden = true;
  }

  function showAddressError(value, focus = true) {
    active.draft = typeof value === "string" ? value.slice(0, addressLimit) : "";
    active.invalid = true;
    address.value = active.draft;
    address.setAttribute("aria-invalid", "true");
    address.setAttribute("aria-describedby", addressError.id);
    addressError.textContent = "Enter a public HTTPS address or a search term.";
    addressError.hidden = false;
    if (focus) address.focus();
  }

  function playableGames(tab) {
    const section = element("section", "proxy-playable proxy-game-shelf");
    const heading = element("div", "proxy-playable-heading");
    const title = element("h2", "", "Play inside the arcade");
    title.tabIndex = -1;
    const browse = element("a", "text-action", "Games you can play here");
    browse.href = "#games?option=in-page";
    heading.append(title, browse);
    const filter = element("input", "field proxy-game-filter");
    filter.type = "search";
    filter.placeholder = "Find an in-page game";
    filter.setAttribute("aria-label", filter.placeholder);
    filter.maxLength = 80;
    filter.value = tab.gameQuery;
    const matchCount = element("p", "proxy-game-count");
    matchCount.setAttribute("role", "status");
    section.append(heading, filter, matchCount);

    const groups = [
      ["Built-in games", builtInGames],
      ["Official in-page players", embeddedGames]
    ].map(([label, entries]) => {
      const group = element("section", "proxy-playable-group");
      const list = element("ul", "proxy-playable-list");
      const items = entries.map(game => {
        const item = element("li");
        const play = control(`Play ${game.title}`, game.title, () => submit(gameLaunchAddress(game)));
        play.className = "proxy-bookmark";
        item.append(play);
        list.append(item);
        return { id: game.id, item };
      });
      group.append(element("h3", "", label));
      if (entries === embeddedGames) group.append(element("p", "", "Playback depends on the publisher and your connection."));
      group.append(list);
      section.append(group);
      return { group, items };
    });

    function syncGames() {
      tab.gameQuery = filter.value;
      const query = filter.value.trim();
      const matches = new Set(queryLibrary(inPageLibrary, { search: query }).map(game => game.id));
      for (const { group, items } of groups) {
        group.hidden = !items.some(({ id }) => matches.has(id));
        for (const { id, item } of items) item.hidden = !matches.has(id);
      }
      if (!query) matchCount.textContent = "";
      else if (matches.size) matchCount.textContent = `${matches.size} ${matches.size === 1 ? "game" : "games"} found.`;
      else matchCount.textContent = "No in-page games match this search.";
    }

    filter.addEventListener("input", syncGames);
    syncGames();
    return section;
  }

  function startShortcut(label, description, url) {
    const shortcut = control(`Open ${label}`, "", () => submit(url));
    shortcut.className = "proxy-shortcut";
    shortcut.removeAttribute("aria-label");
    shortcut.append(element("strong", "", label), " ", element("span", "", description));
    return shortcut;
  }

  function landing(tab) {
    const content = element("div", "proxy-start");
    const headline = element("h2", "", "Start browsing");
    const quick = element("section", "proxy-playable");
    const links = element("div", "proxy-shortcuts");
    for (const [label, url, type] of shortcuts) {
      links.append(startShortcut(label, type, url));
    }
    quick.append(element("h2", "", "Quick links"), links);
    const apps = element("section", "proxy-playable");
    const appLinks = element("div", "proxy-shortcuts proxy-apps");
    for (const app of browserApps) {
      appLinks.append(startShortcut(app.title, app.description, app.embed));
    }
    apps.append(element("h2", "", "Apps"), appLinks);
    content.append(headline, playableGames(tab), quick, apps);
    if (browsing.favorites.length) {
      const favoritesSection = element("section", "proxy-playable");
      const list = element("ul", "proxy-playable-list proxy-start-favorites");
      for (const value of browsing.favorites.slice(0, 6)) {
        const saved = resolveBrowserAddress(value, window.location.href);
        if (!saved?.address) continue;
        const item = element("li");
        const open = control(`Open saved page ${saved.title}`, saved.title, () => submit(value));
        open.className = "proxy-bookmark";
        item.append(open);
        list.append(item);
      }
      favoritesSection.append(element("h2", "", "Saved pages"), list);
      if (browsing.favorites.length > 6) {
        const all = control("Show all favorite pages", "Show all", () => showSaved("favorites"));
        all.className = "button proxy-all-favorites";
        favoritesSection.append(all);
      }
      content.append(favoritesSection);
    }
    if (browsing.history.length) {
      const recent = element("section", "proxy-playable");
      const recentHeading = element("div", "proxy-playable-heading");
      const all = control("Show browsing history", "Show history", () => showSaved("history"));
      all.className = "button proxy-all-favorites";
      recentHeading.append(element("h2", "", "Recent pages"), all);
      const list = element("ul", "proxy-playable-list proxy-start-favorites");
      for (const value of browsing.history.slice(0, 4)) {
        const page = resolveBrowserAddress(value, window.location.href);
        const entry = element("li");
        const open = control(`Reopen ${value}`, page.title, () => submit(value));
        open.className = "proxy-bookmark";
        entry.append(open);
        list.append(entry);
      }
      recent.append(recentHeading, list);
      content.append(recent);
    }
    return content;
  }

  function playHereAction() {
    const choose = control("Choose an in-page game", "Choose an in-page game", () => {
      active.gameQuery = "";
      visit(home);
      active.panel.querySelector(".proxy-game-shelf h2")?.focus();
    });
    choose.className = "button proxy-action";
    return choose;
  }

  function gameSuggestions(games) {
    const section = element("section", "proxy-game-suggestions");
    const options = element("div", "proxy-direct-actions");
    for (const game of games) {
      const play = control(`Play ${game.title}`, game.title, () => submit(gameLaunchAddress(game)));
      play.className = "proxy-bookmark";
      options.append(play);
    }
    section.append(element("h3", "", "Play here"), options);
    return section;
  }

  function directPage(page) {
    const content = element("div", "proxy-direct");
    if (page.kind !== "search") {
      const title = page.game?.title ? `${page.game.title} isn’t available in-page`
        : page.kind === "unavailable" ? "This legacy viewer can’t open here" : "This game site isn’t available in-page";
      const actions = element("div", "proxy-direct-actions");
      actions.append(playHereAction());
      content.append(element("h2", "", title),
        element("p", "", "Try a game you can play inside the arcade."),
        gameSuggestions(suggestedGames(page.game?.category)), actions);
      return content;
    }

    const title = element("h2", "", `Search for “${page.title}”`);
    const actions = element("div", "proxy-direct-actions");
    content.append(title);
    const matches = queryLibrary(inPageLibrary, { search: page.title }).slice(0, 3);
    const externalGame = !matches.length && catalogGameForQuery(page.title);
    if (matches.length || externalGame) {
      content.append(gameSuggestions(externalGame ? suggestedGames(externalGame.category) : matches));
    }
    const gameQuery = Boolean(matches.length || externalGame);
    const webSearch = element("a", gameQuery ? "button" : "button proxy-action", "Search web and YouTube");
    webSearch.href = `#web-search?${new URLSearchParams({ q: page.title })}`;
    const arcadeSearch = element("a", gameQuery ? "button proxy-action" : "button",
      externalGame ? "Browse arcade alternatives" : "Search arcade games");
    const gameParams = new URLSearchParams({ option: "in-page" });
    if (externalGame) {
      if (externalGame.category && queryLibrary(inPageLibrary, { category: externalGame.category }).length) {
        gameParams.set("category", externalGame.category);
      }
    } else {
      gameParams.set("q", page.title);
    }
    arcadeSearch.href = `#games?${gameParams}`;
    if (gameQuery) actions.append(arcadeSearch, webSearch);
    else actions.append(webSearch, arcadeSearch);
    actions.append(external(page.url, "Search Google in new tab", "proxy-source"));
    content.append(actions);
    return content;
  }

  function mountSearch(tab, page, panel, refresh) {
    const preview = tab.preview;
    const controller = new AbortController();
    const statusText = element("p", "proxy-search-note");
    statusText.setAttribute("role", "status");
    const section = element("section", "proxy-search-results");
    const list = element("ul", "proxy-search-result-list");
    section.append(element("h3", "", "Web results"), statusText, list);

    function draw(records) {
      const destinations = new Set();
      for (const result of records) {
        const destination = resolveBrowserAddress(result.url, window.location.href);
        if (!destination?.address.startsWith("https:")) continue;
        const destinationUrl = destination.url || destination.address;
        if (destinations.has(destinationUrl)) continue;
        destinations.add(destinationUrl);
        const row = element("li");
        row.append(element("h4", "", result.title), element("p", "proxy-search-source", new URL(destinationUrl).hostname));
        if (result.description) row.append(element("p", "", result.description));
        const actions = element("div", "proxy-result-actions");
        if (destination.kind === "external-game" || destination.kind === "unavailable") {
          const play = control(`See in-page options for ${result.title}`, "See in-page options", () => submit(destination.address));
          play.className = "button";
          actions.append(play);
        } else {
          if (destination.embed) {
            const openPreview = control(`Preview ${result.title}`, "Preview here", () => submit(destination.address));
            openPreview.className = "button";
            actions.append(openPreview);
          }
          const openTab = control(`New viewer tab for ${result.title}`, "New viewer tab", () => openResultInTab(destination));
          openTab.className = "button";
          actions.append(openTab);
          if (externalPreviewSource(destination)) {
            const official = external(destination.url, "Open in new tab", "proxy-source");
            official.setAttribute("aria-label", `Open ${result.title} in new tab`);
            actions.append(official);
          }
        }
        row.append(actions);
        list.append(row);
      }
      return destinations.size;
    }

    function show(records) {
      const count = draw(records);
      statusText.textContent = count
        ? `${count} ${count === 1 ? "result" : "results"} from your connected search provider.`
        : "The connected provider found no results that can be listed here.";
    }

    const cached = !refresh && searchCache.get(page);
    if (cached) {
      preview.canRefresh = Boolean(searchWeb);
      show(cached);
      panel.append(section);
      return;
    }
    const shortQuery = page.title.length <= 200;
    const request = shortQuery && searchWeb?.(page.title,
      AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]));
    if (!request) {
      const note = element("p", "proxy-search-unconfigured");
      if (shortQuery) {
        const settings = element("a", "proxy-source", "Connect a provider in Web Search");
        settings.href = "#web-search";
        note.append(settings, " to see live results here.");
      } else {
        note.textContent = "Use a query of up to 200 characters for results from a connected provider.";
      }
      panel.append(note);
      return;
    }
    preview.canRefresh = true;
    statusText.textContent = "Searching the connected provider…";
    panel.append(section);
    preview.busy = true;
    preview.busyLabel = "Searching the web";
    request.then(records => {
      if (controller.signal.aborted) return;
      const results = records.slice(0, 10);
      searchCache.set(page, results);
      show(results);
    }).catch(error => {
      if (controller.signal.aborted) return;
      statusText.textContent = error.name === "TimeoutError" ? "Web search timed out. Try Refresh or choose another search option above."
        : "The connected search provider could not return results. Try Refresh or choose another search option above.";
    }).finally(() => {
      if (controller.signal.aborted) return;
      preview.busy = false;
      if (tab === active) syncPreview();
    });
    return () => controller.abort();
  }

  function refreshPage() {
    active.draft = undefined;
    active.invalid = false;
    showPage(true, true);
  }

  function previewRecovery(heading, message, retryLabel = "Retry preview") {
    const panel = element("div", "proxy-direct proxy-recovery");
    const actions = element("div", "proxy-direct-actions");
    const retry = control(retryLabel, retryLabel, () => {
      refreshPage();
      active.panel.focus();
    });
    retry.className = "button";
    actions.append(playHereAction(), retry);
    panel.append(element("h2", "", heading), element("p", "", message), actions);
    return panel;
  }

  function mountFrame(tab, page) {
    const stage = tab.panel;
    const preview = tab.preview;
    const frame = element("iframe", "proxy-frame");
    const local = page.kind === "local";
    const youtube = page.kind === "youtube";
    const controller = new window.AbortController();
    const listenerOptions = { signal: controller.signal, once: true };
    let player;
    let frameResponded = false;
    frame.title = youtube ? "YouTube video player" : page.title;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allowFullscreen = true;
    if (youtube) {
      frame.allow = "fullscreen; encrypted-media; picture-in-picture";
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
    } else if (page.kind === "game") {
      frame.allow = "fullscreen; gamepad";
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock allow-presentation");
    } else if (page.kind === "app") {
      frame.allow = "fullscreen";
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    } else if (!local) {
      frame.referrerPolicy = "no-referrer";
      frame.setAttribute("sandbox", "allow-scripts");
    }
    preview.frame = frame;
    preview.message = `Opening ${page.title}…`;
    preview.busy = true;
    preview.source = externalPreviewSource(page);
    stage.setAttribute("aria-busy", "true");
    const update = () => {
      if (tab === active) syncPreview();
    };
    const stopPlayer = () => {
      try { player?.destroy(); } catch {}
      player = undefined;
    };
    const finish = (message, dismissible = false) => {
      clearTimeout(timer);
      preview.busy = false;
      preview.message = message;
      preview.dismissible = dismissible;
      stage.removeAttribute("aria-busy");
      update();
    };
    const fail = (heading, message) => {
      controller.abort();
      stopPlayer();
      preview.source = externalPreviewSource(page);
      preview.frame = null;
      stage.replaceChildren(previewRecovery(heading, message));
      finish(heading);
    };
    const unverified = page.kind === "game"
      ? "Official game player preview. Playback depends on the publisher and your connection."
      : "Preview unverified. If it stays blank, the site may block embedding. Hide it for other options.";
    const retryMessage = preview.source ? "Retry the preview or open the original in a new tab."
      : "Retry the player or choose another in-page game.";
    const timer = setTimeout(() => {
      if (frameResponded && youtube) finish("YouTube playback could not be verified. Open the video on YouTube if it does not play here.", true);
      else fail("Preview timed out", retryMessage);
    }, 10000);
    frame.addEventListener("load", () => {
      frameResponded = true;
      if (local) {
        const ready = Boolean(frame.contentDocument?.getElementById("star"));
        if (ready) finish("The game is ready.");
        else fail("The local game could not load", retryMessage);
      } else if (!youtube) finish(unverified, true);
    }, listenerOptions);
    frame.addEventListener("error", () => {
      fail("Preview unavailable", retryMessage);
    }, listenerOptions);
    const url = new URL(page.embed || page.url);
    if (youtube) {
      url.searchParams.set("enablejsapi", "1");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("origin", window.location.origin);
    }
    frame.src = url.href;
    stage.append(frame);
    if (youtube) loadYouTubeApi().then(api => {
      if (!api || controller.signal.aborted || !frame.isConnected) return;
      player = new api.Player(frame, {
        events: {
          onReady: () => {
            if (!controller.signal.aborted) finish("YouTube player ready. Use the player’s Play control.", true);
          },
          onError: () => {
            if (!controller.signal.aborted) fail("YouTube playback unavailable", "Open the original video on YouTube for details.");
          },
          onStateChange: event => {
            if (event.data === 1 && !controller.signal.aborted) finish("The video is playing in YouTube.", true);
          }
        }
      });
    }).catch(() => {});
    return () => {
      controller.abort();
      clearTimeout(timer);
      stopPlayer();
      frame.remove();
    };
  }

  function syncFullscreen() {
    const fullscreen = document.fullscreenElement === windowPanel;
    const player = active.panel.querySelector("iframe, .local-game");
    const label = fullscreen ? "Exit fullscreen" : "Fullscreen";
    expand.setAttribute("aria-label", label);
    expand.title = label;
    expand.disabled = !fullscreen && (!player || active.preview?.busy || !document.fullscreenEnabled || !windowPanel.requestFullscreen);
  }

  function syncPreview() {
    const preview = active.preview;
    status.textContent = preview?.message || "";
    progress.hidden = !preview?.busy;
    progress.setAttribute("aria-label", preview?.busyLabel || "Loading preview");
    if (current().kind === "search") refresh.disabled = !preview?.canRefresh;
    source.hidden = !preview?.source;
    dismissPreview.hidden = !preview?.dismissible;
    if (preview?.source) source.href = preview.source;
    else source.removeAttribute("href");
    syncFullscreen();
  }

  function unloadTab(tab) {
    tab.preview?.release?.();
    tab.preview = null;
    tab.panel.replaceChildren();
    tab.panel.removeAttribute("aria-busy");
  }

  function hidePreview() {
    const tab = active;
    const page = current();
    unloadTab(tab);
    const original = externalPreviewSource(page);
    tab.preview = { source: original };
    const message = original ? "You can still open the original in a new tab." : "Retry the player or choose another in-page game.";
    const panel = previewRecovery("Preview hidden", message);
    tab.panel.append(panel);
    syncPreview();
    panel.querySelector(".proxy-action").focus();
  }

  function showPage(reset = false, refreshSearch = false) {
    for (const tab of items) {
      const selected = tab === active;
      tab.panel.hidden = !selected;
      tab.panel.classList.toggle("proxy-stage", selected);
      tab.preview?.frame?.classList.toggle("proxy-frame", selected);
    }
    const stage = active.panel;
    const page = current();
    address.value = active.draft ?? page.address;
    if (active.invalid) showAddressError(active.draft, false);
    else clearAddressError();
    back.disabled = active.index === 0;
    forward.disabled = active.index === active.entries.length - 1;
    refresh.disabled = page.kind !== "local" && page.kind !== "built-in" && page.kind !== "search" && !page.embed;
    homeButton.disabled = page.kind === "home";
    share.disabled = !page.address;
    syncFavorite();

    if (reset || !active.preview || page.kind === "home") {
      unloadTab(active);
      const preview = active.preview = {};
      if (page.kind === "home") {
        stage.append(landing(active));
      } else if (page.kind === "built-in") {
        try {
          preview.release = mountLocalGame(page.id, stage);
        } catch {
          stage.replaceChildren(previewRecovery("The game did not start", "Restart this game or choose another from the arcade.", "Restart game"));
        }
      } else if (page.kind === "local" || page.embed) {
        preview.release = mountFrame(active, page);
      } else {
        const panel = directPage(page);
        stage.append(panel);
        if (page.kind === "search") preview.release = mountSearch(active, page, panel, refreshSearch);
      }
    }
    syncPreview();
  }

  const add = control("New tab", "+", addTab);
  const closeActive = control("Close current tab", "×", () => closeTab(active));
  closeActive.classList.add("proxy-tab-close");
  const back = control("Back", "‹", () => navigate(-1));
  const forward = control("Forward", "›", () => navigate(1));
  const refresh = control("Refresh", "↻", refreshPage);
  const homeButton = control("Home", "⌂", () => visit(home));
  const share = control("Share current page", "Share", showShare);
  share.classList.add("proxy-saved-trigger", "proxy-share-trigger");
  const saveFavorite = control("Save current page to favorites", "☆", toggleFavorite);
  saveFavorite.classList.add("proxy-save-favorite");
  const expand = control("Fullscreen", "⛶", async () => {
    try {
      if (document.fullscreenElement === windowPanel) await document.exitFullscreen();
      else await windowPanel.requestFullscreen();
    } catch {
      status.textContent = "Fullscreen is unavailable in this browser window.";
    }
  });
  windowPanel.addEventListener("fullscreenchange", syncFullscreen);

  const form = element("form", "proxy-address");
  const address = element("input", "field");
  address.type = "text";
  address.maxLength = addressLimit;
  address.placeholder = "HTTPS address or search";
  address.autocapitalize = "off";
  address.autocomplete = "off";
  address.spellcheck = false;
  address.setAttribute("aria-label", "Address or search query");
  address.addEventListener("input", () => {
    active.draft = address.value;
    active.invalid = false;
    clearAddressError();
  });
  const go = element("button", "button proxy-action", "Go");
  go.type = "submit";
  form.addEventListener("submit", event => {
    event.preventDefault();
    submit(address.value);
  });
  form.append(address, go);
  navigation.append(back, forward, refresh, homeButton);
  const savedTools = element("div", "proxy-saved-tools");
  savedTools.setAttribute("role", "group");
  savedTools.setAttribute("aria-label", "Tab tools and saved browsing");
  const favorites = control("Favorites", "Favorites", () => showSaved("favorites"));
  const history = control("Browsing history", "History", () => showSaved("history"));
  const duplicate = control("Duplicate current tab", "Duplicate", duplicateTab);
  const reopen = control("Reopen closed tab", "Reopen", reopenTab);
  reopen.disabled = !closedTabs.length;
  for (const tool of [duplicate, reopen, favorites, history]) tool.classList.add("proxy-saved-trigger");
  savedTools.append(duplicate, reopen, favorites, history);
  const panelActions = element("div", "proxy-panel-actions");
  panelActions.append(share, saveFavorite, expand);
  const dismissPreview = control("Hide preview", "Hide preview", hidePreview);
  dismissPreview.className = "button proxy-preview-dismiss";
  dismissPreview.hidden = true;
  tabsRow.append(tabs, closeActive, add, savedTools);
  toolbar.append(navigation, form, panelActions);
  statusRow.append(status, source, dismissPreview);
  windowPanel.append(tabsRow, toolbar, addressError, statusRow, progress, panels);
  shell.append(heading, windowPanel, savedStatus);

  return {
    shell,
    show(initialAddress, options) {
      searchWeb = options.searchWeb;
      const firstShow = !present;
      present = true;
      const destination = initialAddress ? resolveBrowserAddress(initialAddress, window.location.href) : null;
      if (destination && (destination.address !== current().address || destination.kind !== current().kind)) {
        recordVisit(destination);
        visit(destination);
      } else if (firstShow) {
        renderTabs();
        showPage();
      }
      if (initialAddress && !destination) showAddressError(initialAddress);
    },
    suspend() {
      for (const tab of items) unloadTab(tab);
      windowPanel.querySelector("dialog[open]")?.close();
      searchCache = new WeakMap();
      present = false;
    },
  };
}

export function renderBrowser(target, initialAddress = "", options = {}) {
  let browser = browserViews.get(target);
  if (!browser) {
    browser = createBrowser();
    browserViews.set(target, browser);
  }
  if (browser.shell.parentNode !== target) target.replaceChildren(browser.shell);
  browser.show(initialAddress, options);
}

export function suspendBrowser(target) {
  browserViews.get(target)?.suspend();
}
