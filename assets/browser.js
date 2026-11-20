const legacyViewer = "https://proxy-arcade-play.base44.app/browse";
const home = { kind: "home", title: "Start page", address: "" };
const localPage = "catch-the-star.html";
const shortcuts = [
  ["Catch the Star", localPage, "Local arcade"],
  ["Example Domain", "https://example.com/", "In-page preview"],
  ["Wikipedia", "https://www.wikipedia.org/", "Original site"],
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
  const address = input.trim();
  if (!address) return home;

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

  if (["https://example.com/", "https://www.example.com/"].includes(url.href)) {
    return { kind: "example", title: "Example Domain", address: url.href, url: url.href, embed: url.href };
  }

  return { kind: "external", title: url.hostname, address: url.href, url: url.href };
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
  const description = element("p", "", "Open supported games and videos, or use the address bar to search the web.");
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
  const source = external("", "Open original", "proxy-source");
  const progress = element("div", "proxy-progress");
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "Loading preview");
  progress.hidden = true;

  let counter = 0;
  const createTab = () => ({ id: ++counter, entries: [home], index: 0 });
  let active = createTab();
  const items = [active];
  let present = false;
  let releaseFrame;
  const current = () => active.entries[active.index];

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
    const message = element("p", "", "Enter an address, paste a YouTube link, or try a shortcut.");
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
    content.append(headline, message, links, bookmarks);
    return content;
  }

  function directPage(page) {
    const search = page.kind === "search";
    const content = element("div", "proxy-direct");
    const title = element("h2", "", search ? `Search for “${page.title}”` : page.title);
    const detail = element("p", "", search
      ? "Web search results open on Google in a new tab."
      : "This address opens on the original site. The viewer embeds supported content only.");
    const link = external(page.url, search ? "Open Google results" : "Open original website", "button proxy-action");
    content.append(title, detail, link);
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
    } else if (!local) {
      frame.setAttribute("sandbox", "");
    }
    progress.hidden = false;
    status.textContent = `Opening ${page.title}…`;
    stage.setAttribute("aria-busy", "true");
    source.href = page.url;
    source.hidden = false;
    const finish = message => {
      clearTimeout(timer);
      progress.hidden = true;
      stage.removeAttribute("aria-busy");
      status.textContent = message;
    };
    const timer = setTimeout(() => {
      finish("The preview is taking longer than expected. You can open the original directly.");
    }, 10000);
    frame.addEventListener("load", () => {
      if (local) {
        finish(frame.contentDocument?.getElementById("star")
          ? "The game is ready."
          : "The local game could not be confirmed. Try refreshing or opening the original.");
      } else {
        finish("If the preview is blank or the player reports an error, try opening the original directly.");
      }
    }, listenerOptions);
    frame.addEventListener("error", () => {
      finish("The preview failed to load. Try opening the original directly.");
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
    const frame = stage.querySelector("iframe");
    const label = fullscreen ? "Exit fullscreen" : "Fullscreen";
    expand.setAttribute("aria-label", label);
    expand.title = label;
    expand.disabled = !fullscreen && (!frame || !document.fullscreenEnabled || !windowPanel.requestFullscreen);
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
    refresh.disabled = page.kind !== "local" && !page.embed;
    homeButton.disabled = page.kind === "home";

    if (page.kind === "home") {
      stage.append(landing());
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
  address.placeholder = "Search the web or enter an HTTPS address";
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
  tabsRow.append(tabs, add);
  toolbar.append(navigation, form, expand);
  statusRow.append(status, source);
  windowPanel.append(tabsRow, toolbar, progress, stage, statusRow);
  shell.append(heading, windowPanel, external(legacyViewer, "Open the original Base44 site viewer", "proxy-legacy"));

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
