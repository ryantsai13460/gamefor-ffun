const PAGE_SIZE = 12;
const CHECKS_KEY = "ffun-play-hub-checks-v2";
const LEGACY_KEY = "ffun-hub-device-checks-v1";
const validResults = ["plays", "failed"];

const accessTypes = [
  ["all", "All sources"],
  ["built-in", "Built in"],
  ["embedded", "In-page player"],
  ["miniplay", "Miniplay"],
  ["external", "External publisher"],
  ["catalog", "Catalog only"],
  ["unverified", "Playback unverified"]
];

const publisherAlternates = new Map([
  ["ovo", "https://www.coolmathgames.com/0-ovo"],
  ["territorialio", "https://territorial.io/"],
  ["minefunio", "https://poki.com/en/g/minefun-io"],
  ["bloxdio", "https://www.crazygames.com/game/bloxdhop-io"]
]);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, action, className = "ph-button") {
  const node = element("button", text, className);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function safeUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !host.includes(".") || /^\d+\./.test(host) || /\.(?:local|localhost|internal)\.?$/.test(host)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isMiniplay(url) {
  return /(?:^|\.)(?:miniplay\.com|minijuegos\.com|minijuegosgratis\.com)$/i.test(url?.hostname ?? "");
}

function readChecks(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function validCheck(check) {
  return Boolean(check && validResults.includes(check.result) && Number.isFinite(Date.parse(check.date)));
}

function normalize(text) {
  return String(text ?? "").normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function countAcross(entries, getKey) {
  const counts = new Map();
  for (const entry of entries) {
    const key = getKey(entry);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function identifyGames(games) {
  const entries = games.map(game => {
    const sourceValue = game.sourceUrl ?? game.url ?? game.publisherUrl ?? "";
    const playerValue = game.embedUrl ?? game.embed ?? "";
    const source = safeUrl(sourceValue);
    const player = safeUrl(playerValue);
    const name = game.name ?? game.title ?? "";
    const category = game.category ?? "";
    const local = Boolean(game.local);
    const miniplay = isMiniplay(source) || isMiniplay(player);
    const type = local ? "built-in" : player ? "embedded" : source ? "external" : "catalog";
    const alternate = safeUrl(publisherAlternates.get(normalize(name).replace(/[^a-z0-9]/g, "")));
    const related = safeUrl(game.relatedUrl);
    const links = [...new Map([source, alternate, related, player].filter(Boolean).map(url => [url.href, url])).values()];
    const search = normalize([name, category, ...links.map(url => url.hostname), ...(game.aliases ?? [])].join(" "));
    const fingerprint = JSON.stringify([game.id, local, source?.href ?? "", player?.href ?? ""]);
    return { game, name, category, local, sourceValue, playerValue, source, player, related, links, miniplay, type, search, fingerprint };
  });
  const idCounts = countAcross(entries, entry => entry.game.id);
  const playerCounts = countAcross(entries, entry => entry.player?.href);
  for (const entry of entries) {
    const issues = [];
    if (!entry.game.id) issues.push("Missing game ID");
    if (!entry.name) issues.push("Missing game title");
    if (!entry.category) issues.push("Missing category");
    if (idCounts.get(entry.game.id) > 1) issues.push("Duplicate game ID");
    if (entry.local && entry.player) issues.push("Built-in flag and external player both present");
    if (entry.sourceValue && !entry.source) issues.push("Invalid public HTTPS source");
    if (entry.playerValue && !entry.player) issues.push("Invalid public HTTPS player");
    if (playerCounts.get(entry.player?.href) > 1) issues.push("Player URL shared by multiple entries");
    if (entry.type === "catalog") issues.push("No playable source in the catalog");
    entry.issues = issues;
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function selectField(label, options) {
  const field = element("label", undefined, "ph-field");
  const select = element("select");
  for (const [value, text] of options) {
    const option = element("option", text);
    option.value = value;
    select.append(option);
  }
  field.append(element("span", label), select);
  return [field, select];
}

function externalLink(text, url) {
  const link = element("a", text, "ph-button");
  link.href = url.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

export function renderPlayHub(target, games, { openGame, openBrowser, isFavorite, toggleFavorite }) {
  let entries = identifyGames(games);
  let sessionChecks = {};
  const legacyChecks = readChecks(LEGACY_KEY);
  let page = 0;
  let mode = "access";
  const hub = element("section", undefined, "ph-hub");
  const heading = element("h1", "Play Hub");
  heading.id = "play-hub-title";
  hub.setAttribute("aria-labelledby", heading.id);

  const modes = element("div", undefined, "ph-modes");
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "Play hub views");
  const intro = element("p", undefined, "ph-intro");
  const toolbar = element("div", undefined, "ph-toolbar");
  const searchField = element("label", undefined, "ph-field ph-search");
  const search = element("input");
  search.type = "search";
  search.placeholder = "Title, category or provider";
  searchField.append(element("span", "Search the catalog"), search);
  const [accessField, accessSelect] = selectField("Source", accessTypes);
  const [reviewField, reviewSelect] = selectField("Playback check", [
    ["all", "All results"],
    ["unchecked", "Unchecked"],
    ["plays", "Played on this device"],
    ["failed", "Did not load on this device"],
    ["issues", "Configuration issues"]
  ]);
  const feedback = element("p", undefined, "ph-message");
  feedback.setAttribute("role", "status");
  const result = element("p", undefined, "ph-results");
  result.setAttribute("role", "status");
  result.tabIndex = -1;
  const list = element("ul", undefined, "ph-list");
  list.setAttribute("aria-label", "Catalog results");
  const pagination = element("nav", undefined, "ph-pagination");
  pagination.setAttribute("aria-label", "Play hub pagination");
  const pageLabel = element("span");
  const previous = button("Previous", () => changePage(-1));
  const next = button("Next", () => changePage(1));
  pagination.append(previous, pageLabel, next);

  const manual = element("textarea", undefined, "ph-copy");
  manual.hidden = true;
  manual.readOnly = true;
  manual.setAttribute("aria-label", "Link or report text to copy");
  const modesList = [
    ["access", "Game access", "See which games run here, use a publisher's player, or are listed for reference."],
    ["links", "Game links", "Open a publisher page, copy its address, or pass it to Proxy Gemini."],
    ["reviews", "Playback checks", "Record what played on this device and check the catalog for configuration issues."]
  ];
  const modeButtons = new Map(modesList.map(([key, title]) => [
    key, button(title, () => setMode(key))
  ]));
  modes.append(...modeButtons.values());

  function getCheck(entry, savedChecks) {
    const current = sessionChecks[entry.fingerprint] ?? savedChecks[entry.fingerprint];
    if (validCheck(current)) return current;
    if (!entry.player) return null;
    const keys = [entry.game.id, ...(entry.game.aliases ?? []), ...(entry.game.legacyIds ?? [])];
    for (const id of keys) {
      for (const url of new Set([entry.playerValue, entry.player.href])) {
        const legacy = legacyChecks[JSON.stringify([id, url])];
        if (validCheck(legacy)) return legacy;
      }
    }
    return null;
  }

  function saveCheck(entry, review) {
    const record = {
      result: review,
      date: new Date().toISOString()
    };
    try {
      const latest = readChecks(CHECKS_KEY);
      localStorage.setItem(CHECKS_KEY, JSON.stringify({ ...latest, ...sessionChecks, [entry.fingerprint]: record }));
      sessionChecks = {};
      feedback.textContent = `Playback check saved for ${entry.name}.`;
    } catch {
      sessionChecks[entry.fingerprint] = record;
      feedback.textContent = "Playback check saved for this visit. Browser storage is unavailable.";
    }
  }

  async function copyLink(entry, url) {
    try {
      await navigator.clipboard.writeText(url.href);
      feedback.textContent = `Copied the link for ${entry.name}.`;
    } catch {
      showCopyText(url.href);
      feedback.textContent = "The link is selected. Use your browser's Copy command.";
    }
  }

  function showCopyText(value) {
    manual.value = value;
    manual.hidden = false;
    manual.focus();
    manual.select();
  }

  function exportReport() {
    const savedChecks = readChecks(CHECKS_KEY);
    const report = {
      generatedAt: new Date().toISOString(),
      method: "Catalog configuration and device playback reports",
      total: entries.length,
      entries: entries.map(entry => ({
        id: entry.game.id,
        name: entry.name,
        category: entry.category,
        type: entry.type,
        status: entry.game.status ?? entry.type,
        miniplay: entry.miniplay,
        source: entry.source?.href ?? "",
        player: entry.player?.href ?? "",
        links: entry.links.map(url => url.href),
        issues: entry.issues,
        deviceReview: getCheck(entry, savedChecks)
      }))
    };
    const content = JSON.stringify(report, null, 2);
    manual.value = content;
    manual.hidden = false;
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const link = element("a");
    link.href = url;
    link.download = "gamefor-ffun-catalog-report.json";
    hub.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    feedback.textContent = `Prepared a report with ${entries.length} entries. A copy is available below.`;
  }

  function refreshChecks() {
    entries = identifyGames(games);
    draw();
    feedback.textContent = `Checked ${entries.length} entries for catalog configuration issues.`;
  }

  function setMode(key) {
    mode = key;
    page = 0;
    accessSelect.value = "all";
    reviewSelect.value = "all";
    for (const [value, control] of modeButtons) {
      control.setAttribute("aria-pressed", String(value === key));
    }
    intro.textContent = modesList.find(([value]) => value === key)[2];
    reviewField.hidden = mode !== "reviews";
    manual.hidden = true;
    feedback.textContent = "";
    draw();
  }

  function makeReview(entry, title, actions, savedChecks) {
    const check = getCheck(entry, savedChecks);
    if (check) {
      const outcome = check.result === "plays" ? "Played on this device" : "Did not load on this device";
      const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(check.date));
      title.append(element("p", `${outcome} · ${date}`, "ph-meta"));
    }
    if (entry.issues.length) title.append(element("p", entry.issues.join(" · "), "ph-meta"));
    if (entry.type === "catalog") return;
    const confirm = button("Record playback", () => {
      reviewDialog(entry);
    });
    confirm.setAttribute("aria-label", `Record playback for ${entry.name}`);
    actions.append(confirm);
  }

  function reviewDialog(entry) {
    const dialog = element("dialog", undefined, "ph-dialog");
    const heading = element("h2", "Record playback");
    heading.id = "ph-dialog-title";
    dialog.setAttribute("aria-labelledby", heading.id);
    const description = element("p", entry.name);
    const instructions = element("p", "Choose the result you observed on this device after trying the game.");
    const controls = element("div", undefined, "ph-actions");
    const mark = value => {
      saveCheck(entry, value);
      dialog.close();
      draw();
      result.focus();
    };
    const played = button("Played", () => mark("plays"));
    const failed = button("Did not load", () => mark("failed"));
    const cancel = button("Cancel", () => dialog.close());
    cancel.autofocus = true;
    controls.append(cancel, failed, played);
    dialog.append(heading, description, instructions, controls);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    hub.append(dialog);
    dialog.showModal();
  }

  function makeRow(entry, savedChecks) {
    const row = element("li", undefined, "ph-row");
    const title = element("div", undefined, "ph-row-title");
    const titleText = element("h2", entry.name || "Untitled game");
    const label = accessTypes.find(([value]) => value === entry.type)[1];
    const detail = [entry.category, label, entry.miniplay ? "Miniplay" : "", entry.game.status === "unverified" ? "Playback unverified" : ""]
      .filter(Boolean).join(" · ");
    title.append(titleText, element("p", detail, "ph-meta"));
    const actions = element("div", undefined, "ph-actions");
    if (mode === "links") {
      actions.classList.add("ph-links");
      for (const url of entry.links) {
        const linkActions = element("div", undefined, "ph-actions");
        const sourceLabel = url === entry.player ? "Open player" :
          url === entry.related ? entry.game.relatedLabel || "Related publisher" : "Open source";
        const link = externalLink(sourceLabel, url);
        link.textContent = `${sourceLabel} · ${url.hostname}`;
        linkActions.append(link, button("Copy link", () => copyLink(entry, url)));
        if (openBrowser) linkActions.append(button("Open in viewer", () => openBrowser(url.href)));
        actions.append(linkActions);
      }
    } else {
      actions.append(button("Game details", () => openGame(entry.game.id)));
      if (mode === "reviews") makeReview(entry, title, actions, savedChecks);
    }
    if (isFavorite && toggleFavorite) {
      const favorite = button("", () => {
        toggleFavorite(entry.game.id);
        setFavoriteState();
      }, "ph-button ph-favorite");
      function setFavoriteState() {
        const saved = Boolean(isFavorite(entry.game.id));
        favorite.textContent = saved ? "★" : "☆";
        favorite.setAttribute("aria-pressed", String(saved));
        favorite.setAttribute("aria-label", `Favorite ${entry.name}`);
      }
      setFavoriteState();
      actions.append(favorite);
    }
    row.append(title, actions);
    return row;
  }

  function changePage(delta) {
    page += delta;
    draw();
    result.focus();
  }

  function draw() {
    const access = accessSelect.value;
    const review = reviewSelect.value;
    const savedChecks = readChecks(CHECKS_KEY);
    const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    const visible = entries.filter(entry => {
      if (mode === "links" && !entry.links.length) return false;
      if (access === "miniplay" && !entry.miniplay) return false;
      if (access === "unverified" && entry.game.status !== "unverified") return false;
      if (!["all", "miniplay", "unverified"].includes(access) && entry.type !== access) return false;
      if (!words.every(word => entry.search.includes(word))) return false;
      if (mode !== "reviews" || review === "all") return true;
      if (review === "issues") return entry.issues.length > 0;
      return (getCheck(entry, savedChecks)?.result ?? "unchecked") === review;
    });
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    page = Math.min(Math.max(page, 0), pages - 1);
    const start = page * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, visible.length);
    result.textContent = visible.length
      ? `Showing ${start + 1}–${end} of ${visible.length} games`
      : "No games match these filters.";
    list.replaceChildren(...visible.slice(start, end).map(entry => makeRow(entry, savedChecks)));
    pageLabel.textContent = `Page ${page + 1} of ${pages}`;
    pagination.hidden = pages <= 1;
    previous.disabled = page === 0;
    next.disabled = page + 1 >= pages;
  }

  function onFilter() {
    page = 0;
    draw();
  }

  search.addEventListener("input", onFilter);
  accessSelect.addEventListener("change", onFilter);
  reviewSelect.addEventListener("change", onFilter);
  toolbar.append(searchField, accessField, reviewField);
  const tools = element("div", undefined, "ph-actions");
  tools.append(button("Check catalog", refreshChecks), button("Export report", exportReport));
  hub.append(heading, modes, intro, toolbar, tools, feedback, manual, result, list, pagination);
  target.append(hub);
  setMode("access");
}
