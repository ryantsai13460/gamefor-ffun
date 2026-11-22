const sessionPath = "/v1/session";
const bookmarkKey = "gamefor-ffun-cloud-bookmarks-v1";
const savedLimit = 30;
const addressLimit = 2_048;
const frameLimit = 4 * 1024 * 1024;
const inputBufferLimit = 16 * 1024;
const qualityLevels = ["auto", "high", "data"];

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(label, text, handler, className = "cloud-button") {
  const control = node("button", className, text);
  control.type = "button";
  control.setAttribute("aria-label", label);
  control.title = label;
  control.addEventListener("click", handler);
  return control;
}

function field(label, input) {
  const container = node("label", "cloud-field");
  container.append(node("span", "", label), input);
  return container;
}

function webAddress(value) {
  if (typeof value !== "string" || value.length > addressLimit) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function sessionEndpoint(value) {
  try {
    const url = new URL(value.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const localPage = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const validProtocol = url.protocol === "wss:" || (url.protocol === "ws:" && local && localPage);
    if (!validProtocol || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname === "/") url.pathname = sessionPath;
    return url.pathname === sessionPath ? url.href : null;
  } catch {
    return null;
  }
}

function readBookmarks() {
  try {
    const saved = JSON.parse(localStorage.getItem(bookmarkKey) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.slice(0, savedLimit).filter(item => item && webAddress(item.url) && typeof item.title === "string");
  } catch {
    return [];
  }
}

function tabName(tab) {
  return (typeof tab.title === "string" && tab.title) || webAddress(tab.url)?.hostname || "New tab";
}

function keyName(event) {
  const { key } = event;
  if (event.isComposing || ["Unidentified", "Dead", "Process"].includes(key)) return "";
  if (key === " " || /^[ -~]$/.test(key)) return key;
  return /^(?:F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Alt|Backspace|CapsLock|Control|Delete|End|Enter|Escape|Home|Insert|Meta|PageDown|PageUp|Shift|Tab)$/.test(key) ? key : "";
}

export function mountCloudBrowser(host) {
  const lifetime = new AbortController();
  const root = node("section", "cloud-workspace");
  root.setAttribute("aria-label", "Cloud Browser");
  const header = node("header", "cloud-workspace-header");
  const introduction = node("div", "cloud-introduction");
  introduction.append(node("h1", "", "Cloud Browser"), node("p", "", "Connect to your authorized browser host to open a private session."));
  const contextLinks = node("div", "cloud-workspace-links");
  const proxy = node("a", "cloud-back-link", "Back to Proxy Gemini");
  proxy.href = "#browse";
  const status = node("p", "cloud-session-status", "Disconnected");
  status.setAttribute("role", "status");
  contextLinks.append(proxy, status);
  header.append(introduction, contextLinks);

  const alert = node("p", "cloud-notice");
  alert.setAttribute("role", "alert");
  alert.hidden = true;

  const connect = node("form", "cloud-connect");
  const endpoint = node("input", "cloud-control");
  endpoint.type = "text";
  endpoint.inputMode = "url";
  endpoint.placeholder = "wss://browser.example.org";
  endpoint.autocomplete = "off";
  endpoint.spellcheck = false;
  endpoint.maxLength = addressLimit;
  endpoint.required = true;
  const access = node("input", "cloud-control");
  access.type = "password";
  access.autocomplete = "off";
  access.maxLength = 256;
  access.required = true;
  const connectionFields = node("div", "cloud-connect-fields");
  connectionFields.append(field("Session endpoint", endpoint), field("Access code", access));
  const start = node("button", "cloud-button cloud-primary", "Start session");
  start.type = "submit";
  const connectionActions = node("div", "cloud-connect-actions");
  const cancel = button("Cancel connection", "Cancel", () => end("Connection canceled.", true));
  cancel.hidden = true;
  connectionActions.append(start, cancel);
  connect.append(connectionFields, connectionActions);

  const browser = node("div", "cloud-frame");
  browser.hidden = true;
  const chrome = node("div", "cloud-chrome");
  const tabRow = node("div", "cloud-tab-row");
  const tabList = node("div", "cloud-tab-list");
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", "Remote browser tabs");
  const newTab = button("New remote tab", "+", () => send("new-tab"), "cloud-button cloud-icon-button");
  const closeTab = button("Close active tab", "×", () => send("close-tab", { id: state?.activeId }), "cloud-button cloud-icon-button");
  const disconnect = button("End session", "End session", () => end("Session ended.", true));
  tabRow.append(tabList, newTab, closeTab, disconnect);

  const toolbar = node("div", "cloud-toolbar");
  const navigation = node("div", "cloud-navigation");
  const back = button("Back", "←", () => send("back"), "cloud-button cloud-icon-button");
  const forward = button("Forward", "→", () => send("forward"), "cloud-button cloud-icon-button");
  const reload = button("Reload", "↻", () => send("reload"), "cloud-button cloud-icon-button");
  const home = button("Home", "⌂", () => send("home"), "cloud-button cloud-icon-button");
  navigation.append(back, forward, reload, home);
  const addressForm = node("form", "cloud-address-form");
  const address = node("input", "cloud-control");
  address.setAttribute("aria-label", "Address or search");
  address.type = "text";
  address.placeholder = "HTTPS address or search";
  address.maxLength = addressLimit;
  address.autocomplete = "off";
  address.spellcheck = false;
  address.autocapitalize = "off";
  const go = node("button", "cloud-button cloud-primary", "Go");
  go.type = "submit";
  addressForm.append(address, go);
  const fullscreen = button("Fullscreen", "⛶", toggleFullscreen, "cloud-button cloud-icon-button");
  toolbar.append(navigation, addressForm, fullscreen);

  const utilities = node("div", "cloud-utility-row");
  const quality = node("select", "cloud-control cloud-quality");
  quality.setAttribute("aria-label", "Stream quality");
  ["Auto quality", "High quality", "Data saver"].forEach((label, index) => {
    const option = node("option", "", label);
    option.value = qualityLevels[index];
    quality.append(option);
  });
  quality.addEventListener("change", () => send("quality", { quality: quality.value }));
  const bookmark = button("Bookmark this tab", "☆", saveBookmark, "cloud-button cloud-icon-button");
  bookmark.setAttribute("aria-pressed", "false");
  const bookmarks = button("Bookmarks", "Bookmarks", () => openLibrary("bookmarks"));
  const historyButton = button("Session history", "History", () => openLibrary("history"));
  const showText = button("Type text", "Type text", () => {
    textForm.hidden = !textForm.hidden;
    showText.setAttribute("aria-expanded", String(!textForm.hidden));
    if (!textForm.hidden) textInput.focus();
    else surface.focus();
  });
  for (const toggle of [bookmarks, historyButton, showText]) toggle.setAttribute("aria-expanded", "false");
  utilities.append(quality, bookmark, bookmarks, historyButton, showText);

  const library = node("section", "cloud-library");
  library.hidden = true;
  const libraryTitle = node("h3", "");
  const libraryList = node("ul", "cloud-library-list");
  library.append(libraryTitle, libraryList);

  const textForm = node("form", "cloud-text-form");
  textForm.hidden = true;
  const textInput = node("input", "cloud-control");
  textInput.setAttribute("aria-label", "Text to type in remote browser");
  textInput.maxLength = 256;
  textInput.autocomplete = "off";
  const type = node("button", "cloud-button cloud-primary", "Send text");
  type.type = "submit";
  textForm.append(textInput, type);

  const notice = node("p", "cloud-notice cloud-session-notice");
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  chrome.append(tabRow, toolbar, utilities, notice, library, textForm);

  const stage = node("div", "cloud-stage");
  const stageStatus = node("p", "cloud-stage-status", "Waiting for browser display…");
  stageStatus.setAttribute("role", "status");
  const surface = node("canvas", "cloud-surface");
  const context = surface.getContext("2d", { alpha: false });
  surface.width = 1280;
  surface.height = 800;
  surface.tabIndex = 0;
  surface.setAttribute("role", "application");
  surface.setAttribute("aria-label", "Remote browser display");
  surface.title = "Focus the display to send input. Shift+Tab returns to the toolbar.";
  stage.append(surface, stageStatus);
  browser.append(chrome, stage);
  root.append(header, alert, connect, browser);
  host.append(root);

  let socket;
  let timeout;
  let state;
  let frame;
  let drawing = false;
  let revision = 0;
  let displayReady = false;
  let visibleTabs = "";
  let libraryMode = "";
  let saved = readBookmarks();
  let history = [];
  const keys = new Map();
  const pointers = new Map();
  let moveFrame = 0;
  let pendingMove;

  function showNotice(message = "") {
    const output = state ? notice : alert;
    output.textContent = message;
    output.hidden = !message;
  }

  function setStatus(message, phase) {
    status.textContent = message;
    root.dataset.cloudPhase = phase;
  }

  function send(type, fields = {}, bestEffort = false) {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    if (bestEffort && socket.bufferedAmount > inputBufferLimit) return false;
    socket.send(JSON.stringify({ type, ...fields }));
    return true;
  }

  function sendInput(action, fields, bestEffort) {
    if (!state || !displayReady) return false;
    return send("input", { action, ...fields }, bestEffort);
  }

  function resetInput() {
    if (keys.size || pointers.size) sendInput("reset");
    keys.clear();
    pointers.clear();
    pendingMove = undefined;
    cancelAnimationFrame(moveFrame);
    moveFrame = 0;
  }

  function resetDisplay() {
    frame = undefined;
    revision++;
    displayReady = false;
    stageStatus.hidden = false;
    context?.clearRect(0, 0, surface.width, surface.height);
  }

  function end(message, focus = false) {
    const restoreFocus = focus || root.contains(document.activeElement);
    clearTimeout(timeout);
    resetInput();
    const ended = socket;
    socket = undefined;
    ended?.close();
    if (document.fullscreenElement === browser) document.exitFullscreen().catch(() => {});
    state = undefined;
    history = [];
    address.value = "";
    textInput.value = "";
    textForm.hidden = true;
    showText.setAttribute("aria-expanded", "false");
    libraryMode = "";
    renderLibrary();
    visibleTabs = "";
    tabList.replaceChildren();
    resetDisplay();
    browser.hidden = true;
    notice.hidden = true;
    notice.textContent = "";
    connect.hidden = false;
    start.disabled = false;
    endpoint.disabled = false;
    access.disabled = false;
    cancel.hidden = true;
    setStatus("Disconnected", "offline");
    showNotice(message);
    if (restoreFocus) start.focus();
  }

  connect.addEventListener("submit", event => {
    event.preventDefault();
    const url = sessionEndpoint(endpoint.value);
    if (!url) {
      showNotice("Enter a WSS session endpoint. A local development page can also use a loopback WS endpoint.");
      endpoint.focus();
      return;
    }
    let code = access.value;
    access.value = "";
    let connection;
    try {
      connection = new WebSocket(url);
    } catch {
      showNotice("Could not open the session endpoint.");
      return;
    }
    socket = connection;
    connection.binaryType = "blob";
    showNotice();
    setStatus("Connecting…", "connecting");
    start.disabled = true;
    endpoint.disabled = true;
    access.disabled = true;
    cancel.hidden = false;
    cancel.focus();
    timeout = setTimeout(() => {
      if (socket === connection && !state) end("The browser host did not start a session in time.");
    }, 30_000);

    connection.addEventListener("open", () => {
      if (socket === connection) send("start", { accessCode: code, quality: quality.value });
      code = "";
    });
    connection.addEventListener("message", event => {
      if (connection !== socket) return;
      if (typeof event.data === "string") receiveMessage(event.data);
      else if (state && event.data instanceof Blob && event.data.size <= frameLimit) {
        frame = { data: event.data, revision };
        draw();
      }
    });
    connection.addEventListener("error", () => {
      if (socket === connection) end("Could not reach the browser host. Check the endpoint and connection.");
    });
    connection.addEventListener("close", () => {
      code = "";
      if (socket !== connection) return;
      const message = (!alert.hidden && alert.textContent) || (!notice.hidden && notice.textContent) ||
        "The browser host closed the session.";
      end(message);
    });
  });

  function receiveMessage(body) {
    if (body.length > 64 * 1024) return;
    let message;
    try {
      message = JSON.parse(body);
    } catch {
      return;
    }
    if (!message || typeof message !== "object") return;
    const description = typeof message.message === "string" ? message.message.slice(0, 260) : "";
    if (message.type === "ended") {
      end(description || "Session ended.");
    } else if (message.type === "error") {
      showNotice(description || "The browser host could not complete that action.");
    } else if (message.type === "state") {
      updateState(message);
    }
  }

  function updateState(next) {
    if (!Array.isArray(next.tabs) || next.tabs.length > 16) return;
    const tabs = next.tabs.filter(tab => tab && (typeof tab.id === "string" || Number.isInteger(tab.id)) && typeof tab.url === "string");
    const active = tabs.find(tab => tab.id === next.activeId);
    if (!active) return;
    const wasConnected = !!state;
    const activeChanged = state?.activeId !== next.activeId;
    const validSize = Number.isInteger(next.width) && Number.isInteger(next.height) &&
      next.width > 0 && next.width <= 3840 && next.height > 0 && next.height <= 2160;
    const resized = validSize && (next.width !== surface.width || next.height !== surface.height);
    if (activeChanged || resized) {
      resetInput();
      resetDisplay();
    }
    if (resized) {
      surface.width = next.width;
      surface.height = next.height;
      stage.style.setProperty("--cloud-aspect", String(next.width / next.height));
    }
    state = { ...next, tabs, active };
    clearTimeout(timeout);
    setStatus("Session connected", "online");
    connect.hidden = true;
    browser.hidden = false;
    browser.setAttribute("aria-busy", next.loading ? "true" : "false");
    stageStatus.textContent = next.loading ? "Loading page…" : "Waiting for browser display…";
    if (!wasConnected) {
      alert.hidden = true;
      alert.textContent = "";
      notice.hidden = true;
      address.focus();
    }
    if (activeChanged || document.activeElement !== address) address.value = webAddress(active.url)?.href || "";
    address.placeholder = next.searchEnabled === false ? "HTTPS address" : "HTTPS address or search";
    back.disabled = !next.canBack;
    forward.disabled = !next.canForward;
    const title = String(active.title || "").slice(0, 120);
    const url = webAddress(active.url);
    bookmark.disabled = !url;
    bookmark.setAttribute("aria-pressed", String(!!url && saved.some(item => item.url === bookmarkAddress(url))));
    if (url && !next.loading) {
      if (history[0]?.url !== url.href) {
        history = [{ url: url.href, title }, ...history.filter(item => item.url !== url.href)].slice(0, savedLimit);
        if (libraryMode === "history") renderLibrary();
      }
    }
    renderTabs(tabs, next.activeId);
  }

  function renderTabs(tabs, activeId) {
    const signature = JSON.stringify([activeId, tabs.map(({ id, title }) => [id, title])]);
    if (signature === visibleTabs) return;
    visibleTabs = signature;
    const restoreFocus = tabList.contains(document.activeElement);
    tabList.replaceChildren();
    for (const tab of tabs) {
      const isActive = tab.id === activeId;
      const title = tabName(tab).slice(0, 120);
      const select = button(title, title, () => send("select-tab", { id: tab.id }), "cloud-tab");
      select.setAttribute("role", "tab");
      select.setAttribute("aria-selected", String(isActive));
      select.tabIndex = isActive ? 0 : -1;
      select.addEventListener("keydown", event => {
        const index = tabs.indexOf(tab);
        const next = {
          ArrowLeft: tabs[(index + tabs.length - 1) % tabs.length],
          ArrowRight: tabs[(index + 1) % tabs.length],
          Home: tabs[0],
          End: tabs.at(-1)
        }[event.key];
        if (!next) return;
        event.preventDefault();
        send("select-tab", { id: next.id });
      });
      tabList.append(select);
      if (isActive && restoreFocus) select.focus({ preventScroll: true });
    }
  }

  async function draw() {
    if (drawing || !context) return;
    drawing = true;
    while (frame) {
      const next = frame;
      frame = undefined;
      let image;
      try {
        image = await createImageBitmap(next.data);
        if (next.revision === revision) {
          context.drawImage(image, 0, 0, surface.width, surface.height);
          displayReady = true;
          stageStatus.hidden = true;
        }
      } catch {
        // A later frame can recover a failed decode.
      } finally {
        image?.close();
      }
    }
    drawing = false;
  }

  function launch(value) {
    if (!value) return;
    const explicitHttps = /^https:\/\//i.test(value);
    const hostLike = /^[^\s:/]+(?:\.[^\s:/.]+)+(?:[/?#:].*)?$/u.test(value);
    const url = webAddress(explicitHttps ? value : hostLike ? `https://${value}` : "");
    if (url) send("navigate", { url: url.href });
    else if (explicitHttps || hostLike || /^[a-z][a-z\d+.-]*:|^\/\//i.test(value)) {
      showNotice("Enter a public HTTPS address or search terms.");
      return;
    } else if (state?.searchEnabled === false) {
      showNotice("Search is unavailable for this session. Enter an approved HTTPS address.");
      return;
    } else if (value.length > 200) {
      showNotice("Enter up to 200 characters for a search.");
      return;
    } else send("search", { query: value });
    showNotice();
    surface.focus({ preventScroll: true });
  }

  addressForm.addEventListener("submit", event => {
    event.preventDefault();
    launch(address.value.trim());
  });

  function bookmarkAddress(value) {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.href;
  }

  function persistBookmarks() {
    try {
      localStorage.setItem(bookmarkKey, JSON.stringify(saved));
    } catch {
      showNotice("Bookmarks are available for this visit. This browser could not save them.");
    }
  }

  function saveBookmark() {
    const active = state?.active;
    if (!webAddress(active?.url)) return;
    const url = bookmarkAddress(active.url);
    if (saved.some(item => item.url === url)) saved = saved.filter(item => item.url !== url);
    else saved = [{ url, title: String(active.title || "").slice(0, 120) }, ...saved].slice(0, savedLimit);
    persistBookmarks();
    bookmark.setAttribute("aria-pressed", String(saved.some(item => item.url === url)));
    renderLibrary();
  }

  function openLibrary(mode) {
    libraryMode = libraryMode === mode ? "" : mode;
    renderLibrary();
  }

  function renderLibrary() {
    library.hidden = !libraryMode;
    bookmarks.setAttribute("aria-expanded", String(libraryMode === "bookmarks"));
    historyButton.setAttribute("aria-expanded", String(libraryMode === "history"));
    if (!libraryMode) {
      libraryList.replaceChildren();
      return;
    }
    const showBookmarks = libraryMode === "bookmarks";
    const entries = showBookmarks ? saved : history;
    libraryTitle.textContent = showBookmarks ? "Bookmarks saved on this device" : "Pages visited this session";
    libraryList.replaceChildren();
    if (!entries.length) {
      libraryList.append(node("li", "cloud-library-empty", showBookmarks ? "No bookmarks yet." : "No pages visited yet."));
      return;
    }
    for (const entry of entries) {
      const item = node("li", "cloud-library-entry");
      const title = tabName(entry).slice(0, 120);
      const open = button(`Open ${title}`, title, () => {
        openLibrary(libraryMode);
        launch(entry.url);
      }, "cloud-button cloud-saved-address");
      open.append(node("small", "", webAddress(entry.url)?.hostname || ""));
      item.append(open);
      if (showBookmarks) {
        const remove = button(`Remove bookmark for ${title}`, "×", () => {
          saved = saved.filter(candidate => candidate.url !== entry.url);
          persistBookmarks();
          if (webAddress(state?.active.url) && bookmarkAddress(state.active.url) === entry.url) {
            bookmark.setAttribute("aria-pressed", "false");
          }
          renderLibrary();
          bookmarks.focus();
        }, "cloud-button cloud-icon-button");
        item.append(remove);
      }
      libraryList.append(item);
    }
  }

  textForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!textInput.value || !sendInput("text", { text: textInput.value })) return;
    textInput.value = "";
    textForm.hidden = true;
    showText.setAttribute("aria-expanded", "false");
    surface.focus({ preventScroll: true });
  });

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === browser) await document.exitFullscreen();
      else if (typeof browser.requestFullscreen === "function") await browser.requestFullscreen();
    } catch {
      showNotice("Fullscreen could not start in this browser.");
    }
  }

  fullscreen.disabled = !document.fullscreenEnabled || typeof browser.requestFullscreen !== "function";
  document.addEventListener("fullscreenchange", () => {
    const enabled = document.fullscreenElement === browser;
    const label = enabled ? "Exit fullscreen" : "Fullscreen";
    fullscreen.setAttribute("aria-label", label);
    fullscreen.title = label;
    fullscreen.textContent = enabled ? "⤢" : "⛶";
  }, { signal: lifetime.signal });

  root.addEventListener("keydown", event => {
    if (!state || event.defaultPrevented) return;
    if (event.key === "Escape" && document.fullscreenElement === browser) {
      event.preventDefault();
      toggleFullscreen();
      return;
    }
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.code === "KeyU") {
      event.preventDefault();
      address.focus();
      address.select();
    } else if (event.code === "ArrowLeft" && !back.disabled) {
      event.preventDefault();
      send("back");
    } else if (event.code === "ArrowRight" && !forward.disabled) {
      event.preventDefault();
      send("forward");
    } else if (event.code === "KeyR") {
      event.preventDefault();
      send("reload");
    }
  }, { capture: true });

  surface.addEventListener("keydown", event => {
    if (!displayReady || event.defaultPrevented || (event.key === "Escape" && document.fullscreenElement === browser)) return;
    if (event.key === "Tab" && event.shiftKey) return;
    const key = keyName(event);
    if (!key) return;
    event.preventDefault();
    const identity = event.code || key;
    const held = keys.get(identity);
    if (sendInput("keyDown", { key: held || key })) keys.set(identity, held || key);
  });

  surface.addEventListener("keyup", event => {
    const identity = event.code || keyName(event);
    const key = keys.get(identity);
    if (!key) return;
    event.preventDefault();
    keys.delete(identity);
    sendInput("keyUp", { key });
  });

  function position(event, clamp = false) {
    const rect = surface.getBoundingClientRect();
    const scale = Math.min(rect.width / surface.width, rect.height / surface.height);
    if (!scale) return null;
    const x = (event.clientX - rect.left - (rect.width - surface.width * scale) / 2) / scale;
    const y = (event.clientY - rect.top - (rect.height - surface.height * scale) / 2) / scale;
    if (!clamp && (x < 0 || y < 0 || x >= surface.width || y >= surface.height)) return null;
    return {
      x: Math.max(0, Math.min(surface.width - 1, Math.floor(x))),
      y: Math.max(0, Math.min(surface.height - 1, Math.floor(y)))
    };
  }

  let click;
  function clickCount(button, point) {
    const time = performance.now();
    const repeated = click?.button === button && time - click.time < 400 &&
      Math.hypot(point.x - click.x, point.y - click.y) < 8;
    const count = repeated ? Math.min(3, click.count + 1) : 1;
    click = { ...point, button, time, count };
    return count;
  }

  surface.addEventListener("pointerdown", event => {
    const point = position(event);
    const button = ["left", "middle", "right"][event.button];
    if (!displayReady || !point || !button || (event.pointerType === "touch" && !event.isPrimary)) return;
    event.preventDefault();
    surface.focus({ preventScroll: true });
    surface.setPointerCapture(event.pointerId);
    pendingMove = undefined;
    const touch = event.pointerType === "touch";
    const count = touch ? 1 : clickCount(button, point);
    pointers.set(event.pointerId, { button, count, point, touch, scrolling: false });
    if (!touch) sendInput("down", { ...point, button, clickCount: count });
  });

  surface.addEventListener("pointermove", event => {
    if (!displayReady) return;
    const pointer = pointers.get(event.pointerId);
    const point = position(event, !!pointer);
    if (!point) return;
    if (event.pointerType === "touch") {
      if (!pointer) return;
      const deltaY = pointer.point.y - point.y;
      const deltaX = pointer.point.x - point.x;
      if (!pointer.scrolling && Math.hypot(deltaX, deltaY) < 10) return;
      pointer.scrolling = true;
      pointer.point = point;
      sendInput("wheel", { ...point, deltaX, deltaY }, true);
    } else {
      pendingMove = point;
      if (moveFrame) return;
      moveFrame = requestAnimationFrame(() => {
        const next = pendingMove;
        moveFrame = 0;
        pendingMove = undefined;
        if (next) sendInput("move", next, true);
      });
    }
  });

  surface.addEventListener("pointerup", event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const point = position(event, true) || pointer.point;
    pointers.delete(event.pointerId);
    pendingMove = undefined;
    if (!pointer.touch || !pointer.scrolling) {
      const fields = { ...point, button: pointer.button, clickCount: pointer.count };
      if (pointer.touch) sendInput("down", fields);
      sendInput("up", fields);
    }
  });

  surface.addEventListener("wheel", event => {
    const point = position(event);
    if (!displayReady || !point) return;
    event.preventDefault();
    const unit = [1, 16, surface.height][event.deltaMode] || 1;
    const bounded = value => Math.max(-1_000, Math.min(1_000, value * unit));
    sendInput("wheel", { ...point, deltaX: bounded(event.deltaX), deltaY: bounded(event.deltaY) }, true);
  }, { passive: false });
  surface.addEventListener("contextmenu", event => event.preventDefault());
  surface.addEventListener("pointercancel", resetInput);
  surface.addEventListener("lostpointercapture", event => {
    if (pointers.has(event.pointerId)) resetInput();
  });
  surface.addEventListener("blur", resetInput);
  window.addEventListener("blur", resetInput, { signal: lifetime.signal });

  setStatus("Disconnected", "offline");
  return {
    destroy() {
      end("");
      lifetime.abort();
      root.remove();
    }
  };
}
