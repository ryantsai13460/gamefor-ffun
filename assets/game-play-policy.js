const gamePortals = [
  'armorgames.com', 'coolmath-games.com', 'coolmathgames.com', 'crazygames.com', 'friv.com',
  'gamedistribution.com', 'gamepix.com', 'kongregate.com', 'minijuegos.com',
  'minijuegosgratis.com', 'miniplay.com', 'play.fancade.com', 'poki.com', 'proxy-arcade-play.base44.app',
  'y8.com',
];

function onDomain(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isGamePortalAddress(value) {
  let address;
  try { address = new URL(value); } catch { return false; }
  if (address.protocol !== 'https:' && address.protocol !== 'http:') return false;

  const host = address.hostname.replace(/\.$/, '');
  const path = address.pathname.toLowerCase();
  if (gamePortals.some(portal => onDomain(host, portal))) return true;
  if (onDomain(host, 'geometrydash.com')) return /^\/game(?:\/|$)/.test(path);
  if (onDomain(host, 'miniclip.com')) return /^\/games(?:\/|$)/.test(path);
  if (onDomain(host, 'yandex.com')) return /^\/games(?:\/|$)/.test(path);
  return false;
}

export function createGameAddressLookup(games) {
  const index = new Map();

  function key(value) {
    try {
      const address = new URL(value);
      if (address.protocol !== 'https:' && address.protocol !== 'http:') return '';
      const host = address.hostname.replace(/^(?:www|m)\./, '').replace(/\.$/, '');
      return host + address.pathname.replace(/\/+$/, '');
    } catch {
      return '';
    }
  }

  for (const game of games) {
    const addresses = [game.url, game.embed, game.embedUrl, game.demo, ...(game.legacyUrls || [])];
    if (isGamePortalAddress(game.relatedUrl) || (!game.url && game.relatedLabel?.endsWith('closure notice'))) {
      addresses.push(game.relatedUrl);
    }
    if (game.id === 'paperio') addresses.push('https://voodoo.io/paper2');
    for (const value of addresses) {
      const address = key(value);
      if (address && !index.has(address)) index.set(address, game);
    }
  }

  return value => index.get(key(value));
}
