const geocodingEndpoint = "https://geocoding-api.open-meteo.com/v1/search";
const osmOrigin = "https://www.openstreetmap.org";
const maxLatitude = 85;
const requestInterval = 2_000;
const cacheLifetime = 30 * 60 * 1_000;
const resultLimit = 6;
const london = { name: "London", region: "England, United Kingdom", latitude: 51.50853, longitude: -0.12574 };
const placeCache = new Map();
let latestRequest = -Infinity;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function external(url, label, className) {
  const link = element("a", className, label);
  link.href = url;
  link.rel = "noopener noreferrer";
  return link;
}

function inMapBounds(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= maxLatitude && Math.abs(longitude) <= 180;
}

export function parseMapCoordinates(query) {
  const coordinates = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/.exec(query.trim());
  if (!coordinates) return null;
  const latitude = Number(coordinates[1]);
  const longitude = Number(coordinates[2]);
  return { latitude, longitude, valid: inMapBounds(latitude, longitude) };
}

export function mapLocationLinks(latitude, longitude) {
  if (!inMapBounds(latitude, longitude)) throw new RangeError("Coordinates are outside the map's bounds.");
  const latitudeSpan = .045;
  const longitudeSpan = Math.min(.22, .045 / Math.cos(latitude * Math.PI / 180));
  const west = Math.max(-180, longitude - longitudeSpan);
  const east = Math.min(180, longitude + longitudeSpan);
  const south = Math.max(-85.051, latitude - latitudeSpan);
  const north = Math.min(85.051, latitude + latitudeSpan);
  const frame = new URL("/export/embed.html", osmOrigin);
  frame.search = new URLSearchParams({
    bbox: [west, south, east, north].map(value => value.toFixed(6)).join(","),
    layer: "mapnik",
    marker: `${latitude},${longitude}`,
  });
  const original = new URL("/", osmOrigin);
  original.search = new URLSearchParams({ mlat: latitude, mlon: longitude });
  original.hash = `map=12/${latitude}/${longitude}`;
  return { frame: frame.href, original: original.href };
}

function formatPlaces(data) {
  if (!Array.isArray(data?.results)) return [];
  return data.results.filter(place => place && typeof place.name === "string"
    && place.name.trim() && inMapBounds(place.latitude, place.longitude))
    .slice(0, resultLimit)
    .map(place => ({
      name: place.name,
      region: [...new Set([place.admin1, place.country].filter(value => typeof value === "string" && value && value !== place.name))].join(", "),
      latitude: place.latitude,
      longitude: place.longitude,
    }));
}

function getCachedPlaces(key) {
  const cached = placeCache.get(key);
  if (cached && Date.now() - cached.saved < cacheLifetime) return cached.places;
  placeCache.delete(key);
  return null;
}

function keepPlaces(key, places) {
  if (placeCache.size >= 30) placeCache.delete(placeCache.keys().next().value);
  placeCache.set(key, { places, saved: Date.now() });
}

export function renderSearchMaps(target, initialQuery = "") {
  const root = element("section", "search-map-panel");
  const heading = element("h2", "search-map-heading", "Maps");
  const form = element("form", "search-map-form");
  const label = element("label", "search-map-label");
  const input = element("input", "field search-map-input");
  input.type = "search";
  input.placeholder = "London or 51.51, -0.13";
  input.value = initialQuery;
  input.maxLength = 120;
  input.required = true;
  label.append(element("span", "", "City, postal code, or coordinates"), input);
  const submit = element("button", "button primary search-map-submit", "Find on map");
  submit.type = "submit";
  form.append(label, submit);

  const status = element("p", "search-map-status");
  status.setAttribute("role", "status");
  const matches = element("ul", "search-map-results");
  matches.setAttribute("aria-label", "Matching places");
  matches.hidden = true;

  const map = element("figure", "search-map-preview");
  map.hidden = true;
  const mapCaption = element("figcaption", "search-map-preview-caption");
  const mapStage = element("div", "search-map-stage");
  const mapStatus = element("p", "search-map-preview-status");
  mapStatus.setAttribute("role", "status");
  map.append(mapCaption, mapStage, mapStatus);

  const example = element("button", "button search-map-example", "Show London");
  example.type = "button";
  example.addEventListener("click", () => {
    input.value = london.name;
    input.removeAttribute("aria-invalid");
    showPlaces(london.name, [london]);
  });

  const credit = element("p", "search-map-credit");
  credit.append(
    document.createTextNode("Geocoding by "),
    external("https://open-meteo.com/en/docs/geocoding-api", "Open-Meteo"),
    document.createTextNode(" using "),
    external("https://www.geonames.org/", "GeoNames"),
    document.createTextNode(". Map © "),
    external(`${osmOrigin}/copyright`, "OpenStreetMap contributors"),
    document.createTextNode("."),
  );

  let request;
  let frameTimer;
  let active = true;

  function showMap(place) {
    window.clearTimeout(frameTimer);
    const { frame, original } = mapLocationLinks(place.latitude, place.longitude);
    const placeTitle = [place.name, place.region].filter(Boolean).join(" · ");
    const iframe = element("iframe", "search-map-frame");
    iframe.title = `OpenStreetMap for ${placeTitle}`;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    iframe.addEventListener("load", () => {
      if (!active || iframe.parentNode !== mapStage) return;
      window.clearTimeout(frameTimer);
      mapStage.removeAttribute("aria-busy");
      mapStatus.textContent = "If the map stays blank, open the location on OpenStreetMap.";
    }, { once: true });
    iframe.addEventListener("error", () => {
      if (!active || iframe.parentNode !== mapStage) return;
      window.clearTimeout(frameTimer);
      mapStage.removeAttribute("aria-busy");
      mapStatus.textContent = "The map could not load here. You can open it on OpenStreetMap.";
    }, { once: true });
    mapCaption.replaceChildren(
      element("strong", "", placeTitle),
      external(original, "Open on OpenStreetMap", "text-action search-map-original"),
    );
    mapStatus.textContent = "Opening OpenStreetMap…";
    mapStage.setAttribute("aria-busy", "true");
    iframe.src = frame;
    map.hidden = false;
    mapStage.replaceChildren(iframe);
    frameTimer = window.setTimeout(() => {
      mapStage.removeAttribute("aria-busy");
      mapStatus.textContent = "The map is taking longer than expected. You can open it on OpenStreetMap.";
    }, 10_000);
  }

  function clearResults() {
    matches.replaceChildren();
    matches.hidden = true;
    map.hidden = true;
    mapStage.replaceChildren();
    window.clearTimeout(frameTimer);
  }

  function showPlaces(query, places) {
    clearResults();
    if (!places.length) {
      status.textContent = `No places found for “${query}”. Try a city, a postal code, or coordinates.`;
      return;
    }
    status.textContent = `${places.length} ${places.length === 1 ? "place" : "places"} found for “${query}”.`;
    const buttons = [];
    for (const [index, place] of places.entries()) {
      const item = element("li", "search-map-result");
      const option = element("button", "button search-map-choice");
      option.type = "button";
      option.setAttribute("aria-pressed", String(index === 0));
      option.append(element("strong", "", place.name));
      if (place.region) option.append(element("span", "", place.region));
      option.addEventListener("click", () => {
        if (option.getAttribute("aria-pressed") === "true") return;
        buttons.forEach(button => button.setAttribute("aria-pressed", String(button === option)));
        showMap(place);
      });
      buttons.push(option);
      item.append(option);
      matches.append(item);
    }
    matches.hidden = false;
    showMap(places[0]);
  }

  async function findPlaces(event) {
    event.preventDefault();
    if (!active || request) return;
    const query = input.value.trim().replace(/\s+/g, " ");
    const coordinates = parseMapCoordinates(query);
    if (coordinates) {
      if (!coordinates.valid) {
        input.setAttribute("aria-invalid", "true");
        status.textContent = "Enter a latitude from −85 to 85 and a longitude from −180 to 180.";
        return;
      }
      clearResults();
      status.textContent = "Showing the supplied coordinates.";
      showMap({ ...coordinates, name: `${coordinates.latitude}, ${coordinates.longitude}` });
      return;
    }
    if (query.length < 2) {
      input.setAttribute("aria-invalid", "true");
      status.textContent = "Enter at least two characters or use latitude, longitude.";
      return;
    }

    const key = query.toLowerCase();
    const cached = getCachedPlaces(key);
    if (cached) {
      showPlaces(query, cached);
      return;
    }
    if (Date.now() - latestRequest < requestInterval) {
      status.textContent = "Wait a moment before starting another place search.";
      return;
    }

    clearResults();
    latestRequest = Date.now();
    const controller = new window.AbortController();
    request = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    submit.disabled = true;
    example.disabled = true;
    status.textContent = `Looking up “${query}”…`;
    try {
      // Open-Meteo's public API is available for non-commercial use.
      const url = new URL(geocodingEndpoint);
      url.search = new URLSearchParams({ name: query, count: resultLimit, language: "en", format: "json" });
      const response = await window.fetch(url, { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new Error(`Place lookup returned HTTP ${response.status}.`);
      const places = formatPlaces(await response.json());
      if (!active) return;
      keepPlaces(key, places);
      showPlaces(query, places);
    } catch {
      if (active) status.textContent = "Place lookup is unavailable right now. Try again or enter latitude, longitude.";
    } finally {
      window.clearTimeout(timeout);
      request = undefined;
      submit.disabled = false;
      example.disabled = false;
    }
  }

  input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
  form.addEventListener("submit", findPlaces);
  root.append(heading, form, example, status, matches, map, credit);
  target.append(root);

  return () => {
    active = false;
    request?.abort();
    window.clearTimeout(frameTimer);
    root.remove();
  };
}
