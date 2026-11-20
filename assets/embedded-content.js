export const browserApps = [
  {
    title: 'Photopea',
    description: 'Image editor',
    url: 'https://www.photopea.com/',
    embed: 'https://www.photopea.com/#%7B%7D'
  },
  {
    title: 'OpenStreetMap',
    description: 'Interactive map of London',
    url: 'https://www.openstreetmap.org/#map=13/51.511/-0.121',
    embed: 'https://www.openstreetmap.org/export/embed.html?bbox=-0.168%2C51.489%2C-0.073%2C51.533&layer=mapnik'
  }
];

export function isMiniplayAddress(value) {
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return hostname === 'miniplay.com' || hostname.endsWith('.miniplay.com') ||
      hostname === 'minijuegos.com' || hostname.endsWith('.minijuegos.com');
  } catch {
    return false;
  }
}

export function arcadeEmbed(game) {
  const url = game.embedUrl ?? game.embed;
  return isMiniplayAddress(url) ? undefined : url;
}
