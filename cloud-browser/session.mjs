import { chromium } from "playwright";
import { approvedUrl } from "./egress.mjs";

const width = 1280;
const height = 800;
const commandTimeout = 12_000;
const frameBufferLimit = 512 * 1024;
const homeUrl = "about:blank";
const homeTitle = "Workspace home";
const homePage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${homeTitle}</title><style>
  html { color-scheme: dark; }
  body { min-height: 100vh; display: grid; place-items: center; margin: 0; background: #10192d;
    color: #e9efff; font: 20px system-ui, sans-serif; }
  main { max-width: 46rem; padding: 2rem; text-align: center; }
  h1 { margin: 0 0 1rem; font-size: 3rem; letter-spacing: -.04em; }
  p { margin: 0; color: #b5c4e4; line-height: 1.55; }
</style></head><body><main><h1>${homeTitle}</h1>
<p>Enter an approved address in the workspace toolbar.</p></main></body></html>`;

const profiles = {
  high: { format: "jpeg", quality: 83, maxWidth: width, maxHeight: height, everyNthFrame: 1 },
  auto: { format: "jpeg", quality: 73, maxWidth: 1120, maxHeight: 700, everyNthFrame: 1 },
  data: { format: "jpeg", quality: 60, maxWidth: 896, maxHeight: 560, everyNthFrame: 2 }
};
const buttons = new Set(["left", "middle", "right"]);
const inputActions = new Set(["move", "down", "up", "wheel", "keyDown", "keyUp", "text", "reset"]);

export function validQuality(value) {
  return typeof value === "string" && Object.hasOwn(profiles, value);
}

export function validInput(message) {
  if (!inputActions.has(message.action)) return false;
  if (message.action === "reset") return true;
  if (message.action === "text") return typeof message.text === "string" && message.text.length <= 256;
  if (message.action === "keyDown" || message.action === "keyUp") {
    return typeof message.key === "string" && (message.key === " " || /^[\x21-\x7e]$|^[A-Za-z0-9]{2,20}$/.test(message.key));
  }
  if (!Number.isFinite(message.x) || message.x < 0 || message.x >= width ||
      !Number.isFinite(message.y) || message.y < 0 || message.y >= height) return false;
  if (message.action === "move") return true;
  if (message.action === "wheel") {
    return Number.isFinite(message.deltaX) && Math.abs(message.deltaX) <= 2000 &&
      Number.isFinite(message.deltaY) && Math.abs(message.deltaY) <= 2000;
  }
  return buttons.has(message.button) && (message.clickCount === undefined ||
    Number.isInteger(message.clickCount) && message.clickCount >= 1 && message.clickCount <= 3);
}

export async function createSession({ allowedOrigins, searchUrl, fixtureRoutes, maxTabs, chromiumPath,
  chromiumSandbox, egress, quality, send, sendFrame, bufferedAmount, isOpen, onDisconnect }) {
  const browser = await chromium.launch({
    executablePath: chromiumPath || undefined,
    headless: true,
    chromiumSandbox,
    timeout: 15_000,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    ignoreDefaultArgs: ["--disable-popup-blocking"],
    env: { PATH: process.env.PATH || "/usr/bin:/bin", LANG: "C.UTF-8", TZ: "UTC" },
    proxy: { server: egress, bypass: "<-loopback>" },
    args: [
      "--disable-quic",
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"
    ]
  });
  const tabs = new Map();
  const knownPages = new Set();
  let context;
  let openingPage;
  let active;
  let cast;
  let castQueue = Promise.resolve();
  let stateTimer;
  let closed;
  let nextTab = 1;
  let lastPressure = 0;
  let autoReduced = false;

  browser.on("disconnected", () => {
    if (!closed) onDisconnect();
  });

  function fail(message) {
    send({ type: "error", message });
  }

  function close() {
    if (closed) return closed;
    clearTimeout(stateTimer);
    closed = browser.close().catch(() => {});
    return closed;
  }

  function tabUrl(entry) {
    const url = entry.page.url();
    return approvedUrl(url, allowedOrigins)?.href ?? homeUrl;
  }

  async function sendState() {
    if (closed || !active || !isOpen()) return;
    const entry = active;
    const history = await entry.client.send("Page.getNavigationHistory").catch(() => null);
    if (closed || entry !== active) return;
    const { currentIndex = 0, entries = [] } = history ?? {};
    send({
      type: "state", width, height, searchEnabled: Boolean(searchUrl), activeId: entry.id,
      loading: entry.loading, canBack: currentIndex > 0, canForward: currentIndex < entries.length - 1,
      tabs: [...tabs.values()].map(tab => ({ id: tab.id, title: tab.title, url: tabUrl(tab) }))
    });
  }

  function queueState() {
    if (closed || stateTimer) return;
    stateTimer = setTimeout(() => {
      stateTimer = undefined;
      void sendState();
    }, 40);
    stateTimer.unref();
  }

  async function syncTitle(entry) {
    const url = entry.page.url();
    const fallback = approvedUrl(url, allowedOrigins)?.hostname || homeTitle;
    const title = await entry.page.title().catch(() => "");
    if (entry.page.url() !== url || entry.page.isClosed()) return;
    entry.title = title.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim().slice(0, 140) || fallback;
    queueState();
  }

  function receiveFrame(entry, frame) {
    void entry.client.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {});
    if (closed || entry !== active || cast !== entry || !isOpen()) return;
    const now = Date.now();
    const congested = bufferedAmount() > frameBufferLimit;
    if (congested) lastPressure = now;
    if (quality === "auto" && autoReduced !== (now - lastPressure < 6000)) {
      autoReduced = !autoReduced;
      void syncCast(false).catch(() => {});
    }
    if (!congested) sendFrame(Buffer.from(frame.data, "base64"));
  }

  function syncCast(snapshot = true) {
    const next = castQueue.then(async () => {
      if (closed || !active || !isOpen()) return;
      if (cast) await cast.client.send("Page.stopScreencast").catch(() => {});
      const entry = active;
      cast = entry;
      const profile = profiles[quality === "auto" && autoReduced ? "data" : quality];
      await entry.client.send("Page.startScreencast", profile);
      if (snapshot && bufferedAmount() <= frameBufferLimit) {
        const frame = await entry.client.send("Page.captureScreenshot", { format: "jpeg", quality: profile.quality }).catch(() => null);
        if (!closed && cast === entry && active === entry && frame) sendFrame(Buffer.from(frame.data, "base64"));
      }
    });
    castQueue = next.catch(() => {});
    return next;
  }

  async function releaseInput(entry) {
    for (const button of entry.buttons) await entry.page.mouse.up({ button }).catch(() => {});
    for (const key of entry.keys) await entry.page.keyboard.up(key).catch(() => {});
    entry.buttons.clear();
    entry.keys.clear();
  }

  async function openHome(entry) {
    if (entry.page.url() !== homeUrl) await entry.page.goto(homeUrl, { timeout: commandTimeout });
    await entry.page.setContent(homePage, { timeout: commandTimeout });
    entry.title = homeTitle;
  }

  async function addTab() {
    openingPage = context.newPage().then(page => {
      knownPages.add(page);
      return page;
    });
    const page = await openingPage.finally(() => { openingPage = undefined; });
    try {
      const client = await context.newCDPSession(page);
      const entry = { id: String(nextTab++), page, client, title: homeTitle, loading: false, keys: new Set(), buttons: new Set() };
      tabs.set(entry.id, entry);
      client.on("Page.screencastFrame", frame => receiveFrame(entry, frame));
      page.on("popup", popup => void popup.close().catch(() => {}));
      page.on("dialog", dialog => void dialog.dismiss().catch(() => {}));
      page.on("domcontentloaded", () => void syncTitle(entry));
      page.on("load", () => {
        entry.loading = false;
        void syncTitle(entry);
      });
      page.on("requestfailed", request => {
        if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return;
        entry.loading = false;
        queueState();
      });
      page.on("framenavigated", frame => {
        if (frame !== page.mainFrame()) return;
        const url = frame.url();
        const unsupported = url !== homeUrl && !approvedUrl(url, allowedOrigins);
        entry.title = unsupported ? "Page unavailable" : approvedUrl(url, allowedOrigins)?.hostname || homeTitle;
        queueState();
        if (unsupported && !url.startsWith("chrome-error:")) {
          if (entry === active) fail("This address is outside the approved workspace.");
          void openHome(entry).catch(() => {});
        } else if (!unsupported) {
          void syncTitle(entry);
        }
      });
      page.on("close", () => knownPages.delete(page));
      page.on("crash", () => {
        if (entry === active) fail("This tab stopped responding. Close it and open another tab.");
      });
      await openHome(entry);
      return entry;
    } catch (error) {
      for (const [id, entry] of tabs) if (entry.page === page) tabs.delete(id);
      knownPages.delete(page);
      await page.close().catch(() => {});
      throw error;
    }
  }

  async function selectTab(entry) {
    if (active && active !== entry) await releaseInput(active);
    active = entry;
    await entry.page.bringToFront();
    await sendState();
    await syncCast();
  }

  async function closeTab(entry) {
    const next = entry === active ? ([...tabs.values()].find(tab => tab !== entry) || await addTab()) : undefined;
    tabs.delete(entry.id);
    if (next) await selectTab(next);
    await entry.page.close();
    await sendState();
  }

  async function runNavigation(entry, navigate) {
    entry.loading = true;
    queueState();
    try {
      await navigate();
      if (entry.page.url() === homeUrl) await openHome(entry);
    } catch {
      fail("The page did not load in the workspace. Check the address or try again.");
    } finally {
      entry.loading = false;
      await syncTitle(entry);
      queueState();
    }
  }

  async function navigateUrl(entry, raw) {
    const url = approvedUrl(raw, allowedOrigins);
    if (!url) {
      fail("Enter an HTTPS address on a site approved for this workspace.");
      return;
    }
    await runNavigation(entry, () => entry.page.goto(url.href, { timeout: commandTimeout, waitUntil: "domcontentloaded" }));
  }

  async function handleInput(entry, message) {
    const { action, x, y, button, clickCount = 1, deltaX, deltaY, key, text } = message;
    const { page } = entry;
    if (action === "reset") await releaseInput(entry);
    else if (action === "text") await page.keyboard.insertText(text);
    else if (action === "keyDown") {
      await page.keyboard.down(key).catch(() => {});
      if (entry.keys.size < 128) entry.keys.add(key);
    } else if (action === "keyUp") {
      await page.keyboard.up(key).catch(() => {});
      entry.keys.delete(key);
    } else {
      if (entry.mouseX !== x || entry.mouseY !== y) {
        await page.mouse.move(x, y);
        entry.mouseX = x;
        entry.mouseY = y;
      }
      if (action === "wheel") await page.mouse.wheel(deltaX, deltaY);
      else if (action === "down") {
        await page.mouse.down({ button, clickCount });
        entry.buttons.add(button);
      } else if (action === "up") {
        await page.mouse.up({ button, clickCount });
        entry.buttons.delete(button);
      }
    }
  }

  async function handle(message) {
    if (closed || !active) return;
    const entry = active;
    const byId = tabs.get(message.id);
    const options = { timeout: commandTimeout, waitUntil: "domcontentloaded" };
    switch (message.type) {
      case "input": return handleInput(entry, message);
      case "navigate": return navigateUrl(entry, message.url);
      case "search": {
        if (!searchUrl) return fail("Search is not configured for this workspace.");
        const url = new URL(searchUrl);
        url.searchParams.set("q", message.query.trim());
        return navigateUrl(entry, url.href);
      }
      case "back": return runNavigation(entry, () => entry.page.goBack(options));
      case "forward": return runNavigation(entry, () => entry.page.goForward(options));
      case "reload": return runNavigation(entry, () => entry.page.reload(options));
      case "home": return runNavigation(entry, () => openHome(entry));
      case "new-tab": {
        if (tabs.size >= maxTabs) return fail(`This session supports up to ${maxTabs} tabs.`);
        return selectTab(await addTab());
      }
      case "select-tab": if (byId && byId !== entry) await selectTab(byId); return;
      case "close-tab": if (byId) await closeTab(byId); return;
      case "quality": {
        quality = message.quality;
        autoReduced = bufferedAmount() > frameBufferLimit;
        return syncCast();
      }
    }
  }

  try {
    if (!isOpen()) throw new Error("Session disconnected during startup.");
    context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", acceptDownloads: false });
    context.setDefaultTimeout(commandTimeout);
    context.on("page", async page => {
      await openingPage?.catch(() => {});
      if (!knownPages.has(page)) await page.close().catch(() => {});
    });
    await context.routeWebSocket("**/*", route => route.close());
    await context.route("**/*", async (route, request) => {
      let frame;
      try { frame = request.frame(); } catch { /* Requests without an approved page are rejected. */ }
      const page = frame?.page();
      const allowed = approvedUrl(request.url(), allowedOrigins) && knownPages.has(page);
      const fixture = fixtureRoutes?.get(request.url());
      if (!allowed || (fixtureRoutes && !fixture)) {
        if (active && page === active.page && request.isNavigationRequest() && frame === page.mainFrame()) {
          fail("The requested address is outside the approved workspace.");
        }
        return route.abort("blockedbyclient");
      }
      if (request.isNavigationRequest() && frame === page.mainFrame()) {
        const entry = [...tabs.values()].find(tab => tab.page === page);
        entry.loading = true;
        queueState();
      }
      if (fixture) return route.fulfill(fixture);
      return route.continue();
    });
    await selectTab(await addTab());
    return { handle, close };
  } catch (error) {
    await close();
    throw error;
  }
}
