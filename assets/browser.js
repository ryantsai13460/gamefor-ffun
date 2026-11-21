import { games } from "./catalog.js";
import { mountLocalGame } from "./local-games.js";
import { arcadeEmbed, browserApps, isMiniplayAddress } from "./embedded-content.js";

const legacyViewer = "https://proxy-arcade-play.base44.app/browse";
const home = { kind: "home", title: "Start page", address: "" };
const localPage = "catch-the-star.html";
const shortcuts = [
  ["Catch the Star", localPage, "Local arcade"],
  ["Stacktris", "https://play.fancade.com/5BEC8352E4E078B1", "Game player"],
  ["Wikipedia", "https://www.wikipedia.org/", "Homepage preview"],
];
const gameShortcuts = [
  ["Territorial.io", "https://territorial.io/"],
  ["Bloxd.io", "https://bloxd.io/"],
  ["Paper.io 2", "https://voodoo.io/paper2"],
  ["Hexanaut.io", "https://hexanaut.io/"],
];
const youtubeHosts = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com",
  "youtu.be", "www.youtu.be", "www.youtube-nocookie.com",
]);
const browserViews = new WeakMap();
const browsingStorageKey = "gamefor-ffun-proxy-v1";
const addressLimit = 2048;
const savedLimits = { favorites: 40, history: 30 };
const builtInGames = games.filter(game => game.local);
const embeddedGames = games.filter(arcadeEmbed);
const gameEmbeds = new Map(
  embeddedGames.flatMap(game => [[game.url, game], [arcadeEmbed(game), game]])
);
const appEmbeds = new Map(browserApps.flatMap(app => [[app.embed, app], [app.url, app]]));

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
    return {
      kind: "youtube", title: "YouTube", address: url.href,
      url: `https://www.youtube.com/${watchPath}`,
      embed: `https://www.youtube-nocookie.com/embed/${videoId}`,
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

  if (isMiniplayAddress(url)) {
    return { kind: "miniplay", title: "Miniplay", address: url.href };
  }

  if (url.origin === new URL(legacyViewer).origin && url.pathname.replace(/\/$/, "") === "/browse") {
    return { kind: "unavailable", title: "Base44 viewer", address: url.href, url: url.href };
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

function createBrowser() {
  const shell = element("section", "proxy-viewer");
  const heading = element("div", "proxy-heading");
  const title = element("h1", "", "Proxy Gemini");
  const description = element("p", "", "Preview websites, games, and videos. Back and Forward follow the addresses you open in this viewer.");
  heading.append(title, description);

  const windowPanel = element("div", "proxy-window");
  const tabsRow = element("div", "proxy-tab-row");
  const tabs = element("div", "proxy-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Browser tabs");

  const toolbar = element("div", "proxy-toolbar");
  const navigation = element("div", "proxy-navigation");
  const stage = element("div", "proxy-stage");
  stage.id = "proxy-tab-content";
  stage.setAttribute("role", "tabpanel");
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

  let counter = 0;
  const createTab = () => ({ id: ++counter, entries: [home], index: 0 });
  let active = createTab();
  const items = [active];
  let present = false;
  let releaseFrame;
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

  function showSaved(kind) {
    const favorites = kind === "favorites";
    const title = favorites ? "Favorite pages" : "Browsing history";
    const dialog = element("dialog", "proxy-saved");
    const heading = element("h2", "", title);
    const close = control("Close " + title.toLowerCase(), "×", () => dialog.close());
    close.autofocus = true;
    const header = element("div", "proxy-saved-heading");
    header.append(heading, close);
    const contents = element("div", "proxy-saved-content");
    dialog.setAttribute("aria-label", title);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.append(header, contents);

    function drawSaved() {
      const entries = browsing[kind];
      if (!entries.length) {
        contents.replaceChildren(element("p", "proxy-saved-empty", favorites
          ? "You can save a page using the star beside the address bar."
          : "Addresses and searches you open appear here."));
        return;
      }
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
          syncFavorite();
          drawSaved();
          close.focus();
        });
        row.append(open, remove);
        list.append(row);
      }
      contents.replaceChildren(list);
      if (!favorites) {
        const clear = control("Clear browsing history", "Clear history", () => {
          browsing.history = [];
          storeBrowsing("Browsing history cleared.");
          drawSaved();
          close.focus();
        });
        clear.className = "button proxy-clear-history";
        contents.append(clear);
      }
    }

    drawSaved();
    windowPanel.append(dialog);
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
      select.id = `proxy-tab-${tab.id}`;
      select.setAttribute("role", "tab");
      select.setAttribute("aria-selected", String(tab === active));
      select.setAttribute("aria-controls", stage.id);
      select.tabIndex = tab === active ? 0 : -1;
      select.addEventListener("keydown", event => {
        const index = items.indexOf(tab);
        const ends = { Home: 0, End: items.length - 1 };
        const move = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (!move && !(event.key in ends)) return;
        event.preventDefault();
        activate(items[ends[event.key] ?? (index + move + items.length) % items.length]);
      });
      const close = control(`Close ${label} tab`, "×", () => closeTab(tab));
      close.classList.add("proxy-tab-close");
      item.append(select, close);
      return item;
    });
    tabs.replaceChildren(...entries);
    const tabButton = tabs.querySelector(`[id="proxy-tab-${active.id}"]`);
    stage.setAttribute("aria-labelledby", tabButton.id);
    if (focus) tabButton.focus();
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
    items.splice(index, 1);
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

  function visit(page) {
    if (page.kind !== current().kind || page.address !== current().address) {
      active.entries.splice(active.index + 1, Infinity, page);
      active.index++;
    }
    showPage();
    renderTabs();
  }

  function navigate(offset) {
    const index = active.index + offset;
    if (!active.entries[index]) return;
    active.index = index;
    showPage();
    renderTabs();
  }

  function submit(value) {
    const page = resolveBrowserAddress(value, window.location.href);
    if (page) {
      recordVisit(page);
      visit(page);
    } else {
      address.setAttribute("aria-invalid", "true");
      status.textContent = "Enter a public HTTPS address or a search term.";
      address.focus();
    }
  }

  function landing() {
    const content = element("div", "proxy-start");
    const headline = element("h2", "", "Start browsing");
    const message = element("p", "", "Enter an HTTPS address, paste a YouTube link, or try a shortcut.");
    const links = element("div", "proxy-shortcuts");
    for (const [label, url, type] of shortcuts) {
      const shortcut = control(`Open ${label}`, "", () => submit(url));
      shortcut.className = "proxy-shortcut";
      shortcut.append(element("strong", "", label), element("span", "", type));
      links.append(shortcut);
    }
    const bookmarks = element("div", "proxy-bookmarks");
    bookmarks.setAttribute("aria-label", "Game bookmarks");
    for (const [label, url] of gameShortcuts) {
      const shortcut = control(`Open ${label}`, label, () => submit(url));
      shortcut.className = "proxy-bookmark";
      bookmarks.append(shortcut);
    }
    const apps = element("section", "proxy-playable");
    const appLinks = element("div", "proxy-shortcuts proxy-apps");
    for (const app of browserApps) {
      const shortcut = control(`Open ${app.title}`, "", () => submit(app.embed));
      shortcut.className = "proxy-shortcut";
      shortcut.append(element("strong", "", app.title), element("span", "", app.description));
      appLinks.append(shortcut);
    }
    apps.append(element("h2", "", "Apps"), appLinks);
    const playable = element("section", "proxy-playable");
    playable.append(element("h2", "", "Play inside the arcade"));
    for (const [label, entries, destination] of [
      ["Built-in games", builtInGames, game => `arcade:${game.id}`],
      ["Official game players", embeddedGames, arcadeEmbed]
    ]) {
      const group = element("section", "proxy-playable-group");
      const list = element("ul", "proxy-playable-list");
      for (const game of entries) {
        const item = element("li");
        const play = control(`Play ${game.title}`, game.title, () => submit(destination(game)));
        play.className = "proxy-bookmark";
        item.append(play);
        list.append(item);
      }
      group.append(element("h3", "", label));
      if (entries === embeddedGames) group.append(element("p", "", "Playback depends on the provider and your connection."));
      group.append(list);
      playable.append(group);
    }
    content.append(headline, message, links, bookmarks, apps, playable);
    return content;
  }

  function directPage(page) {
    const search = page.kind === "search";
    const content = element("div", "proxy-direct");
    if (page.kind === "miniplay") {
      const homeLink = element("a", "button proxy-action", "Go to Home");
      homeLink.href = "#home";
      content.append(element("h2", "", "Miniplay links are on Home"), homeLink);
      return content;
    }
    const title = element("h2", "", search ? `Search for “${page.title}”` : page.title);
    const actions = element("div", "proxy-direct-actions");
    if (search) {
      const params = new URLSearchParams({ q: page.title }).toString();
      const webSearch = element("a", "button proxy-action", "Search web and YouTube");
      webSearch.href = `#web-search?${params}`;
      const arcadeSearch = element("a", "button", "Search arcade games");
      arcadeSearch.href = `#games?${params}`;
      actions.append(webSearch, arcadeSearch);
    }
    actions.append(external(page.url, search ? "Search Google in new tab" : "Open Base44 in new tab", "proxy-source"));
    content.append(title);
    if (!search) content.append(element("p", "", "Base44 blocks embedding this viewer."));
    content.append(actions);
    return content;
  }

  function mountFrame(page) {
    const frame = element("iframe", "proxy-frame");
    const local = page.kind === "local";
    const youtube = page.kind === "youtube";
    const controller = new window.AbortController();
    const listenerOptions = { signal: controller.signal, once: true };
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
    progress.hidden = false;
    status.textContent = `Opening ${page.title}…`;
    stage.setAttribute("aria-busy", "true");
    source.href = page.url;
    source.hidden = local;
    const finish = message => {
      clearTimeout(timer);
      progress.hidden = true;
      stage.removeAttribute("aria-busy");
      status.textContent = message;
    };
    const fail = (heading, message) => {
      controller.abort();
      source.hidden = false;
      finish("");
      const panel = element("div", "proxy-direct");
      panel.append(element("h2", "", heading), element("p", "", message));
      stage.replaceChildren(panel);
      syncFullscreen();
    };
    const timer = setTimeout(() => fail("Preview timed out", "Try Refresh to start again, or open the original in a new tab."), 10000);
    frame.addEventListener("load", () => {
      if (local) {
        const ready = Boolean(frame.contentDocument?.getElementById("star"));
        if (ready) finish("The game is ready.");
        else fail("The local game could not load", "Try Refresh, or open the game in a new tab.");
      } else {
        finish("If the preview is blank, the site may block embedding. Go back or open it in a new tab.");
      }
    }, listenerOptions);
    frame.addEventListener("error", () => {
      fail("Preview unavailable", "Try Refresh, or open the original in a new tab.");
    }, listenerOptions);
    frame.src = page.embed || page.url;
    stage.append(frame);
    return () => {
      controller.abort();
      clearTimeout(timer);
      frame.remove();
    };
  }

  function syncFullscreen() {
    const fullscreen = document.fullscreenElement === windowPanel;
    const player = stage.querySelector("iframe, .local-game");
    const label = fullscreen ? "Exit fullscreen" : "Fullscreen";
    expand.setAttribute("aria-label", label);
    expand.title = label;
    expand.disabled = !fullscreen && (!player || !document.fullscreenEnabled || !windowPanel.requestFullscreen);
  }

  function showPage() {
    releaseFrame?.();
    releaseFrame = undefined;
    stage.replaceChildren();
    stage.removeAttribute("aria-busy");
    progress.hidden = true;
    source.hidden = true;
    source.removeAttribute("href");
    status.textContent = "";
    const page = current();
    address.value = page.address;
    address.removeAttribute("aria-invalid");
    back.disabled = active.index === 0;
    forward.disabled = active.index === active.entries.length - 1;
    refresh.disabled = page.kind !== "local" && page.kind !== "built-in" && !page.embed;
    homeButton.disabled = page.kind === "home";
    syncFavorite();

    if (page.kind === "home") {
      stage.append(landing());
    } else if (page.kind === "built-in") {
      try {
        releaseFrame = mountLocalGame(page.id, stage);
      } catch {
        const panel = element("div", "proxy-direct");
        panel.append(element("h2", "", "The game did not start"), element("p", "", "Try Refresh to start the game again."));
        stage.replaceChildren(panel);
      }
    } else if (page.kind === "local" || page.embed) {
      releaseFrame = mountFrame(page);
    } else {
      stage.append(directPage(page));
    }
    syncFullscreen();
  }

  const add = control("New tab", "+", addTab);
  const back = control("Back", "‹", () => navigate(-1));
  const forward = control("Forward", "›", () => navigate(1));
  const refresh = control("Refresh", "↻", showPage);
  const homeButton = control("Home", "⌂", () => visit(home));
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
  address.placeholder = "Enter an HTTPS address or search games";
  address.autocapitalize = "off";
  address.autocomplete = "off";
  address.spellcheck = false;
  address.setAttribute("aria-label", "Address or search query");
  address.addEventListener("input", () => address.removeAttribute("aria-invalid"));
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
  savedTools.setAttribute("aria-label", "Saved browsing");
  const favorites = control("Favorite pages", "Favorites", () => showSaved("favorites"));
  const history = control("Browsing history", "History", () => showSaved("history"));
  favorites.classList.add("proxy-saved-trigger");
  history.classList.add("proxy-saved-trigger");
  savedTools.append(favorites, history);
  const panelActions = element("div", "proxy-panel-actions");
  panelActions.append(saveFavorite, expand);
  tabsRow.append(tabs, add, savedTools);
  toolbar.append(navigation, form, panelActions);
  statusRow.append(status, source);
  windowPanel.append(tabsRow, toolbar, statusRow, progress, stage);
  const legacy = element("details", "proxy-legacy");
  legacy.append(element("summary", "", "Legacy Base44 viewer"),
    external(legacyViewer, "Open Base44 in new tab", "proxy-source"));
  shell.append(heading, windowPanel, legacy, savedStatus);

  return {
    shell,
    show(initialAddress) {
      if (!present) {
        renderTabs();
        showPage();
      }
      present = true;
      if (initialAddress) submit(initialAddress);
    },
    suspend() {
      releaseFrame?.();
      releaseFrame = undefined;
      windowPanel.querySelector("dialog[open]")?.close();
      present = false;
    },
  };
}

export function renderBrowser(target, initialAddress = "") {
  let browser = browserViews.get(target);
  if (!browser) {
    browser = createBrowser();
    browserViews.set(target, browser);
  }
  if (browser.shell.parentNode !== target) target.replaceChildren(browser.shell);
  browser.show(initialAddress);
}

export function suspendBrowser(target) {
  browserViews.get(target)?.suspend();
}
