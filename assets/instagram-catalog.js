const instagramOrigin = 'https://www.instagram.com';
const permittedHosts = new Set(['instagram.com', 'www.instagram.com']);

export function parseInstagramPost(value) {
  if (typeof value !== 'string' || value.length > 1500) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !permittedHosts.has(url.hostname) || url.port || url.username || url.password) return null;
    const match = url.pathname.match(/^\/(p|reel|reels)\/([a-zA-Z0-9_-]{5,32})\/?$/);
    if (!match) return null;
    const kind = match[1] === 'p' ? 'p' : 'reel';
    const id = match[2];
    const href = `${instagramOrigin}/${kind}/${id}/`;
    return { kind, id, href, embedUrl: `${href}embed/` };
  } catch {
    return null;
  }
}

// Each record was confirmed on the public original and Instagram's own embed surface.
export const instagramPosts = [
  ['reel', 'DUa5b_BDmmD', 'See that ice? That’s sea ice.', 'NASA Earth', 'How sea ice forms and why NASA observes it from space.', ['Education', 'Nature', 'Science']],
  ['reel', 'DeTUk4sDSp-', 'POV: you’re watching the Earth set', 'NASA', 'Artemis II footage of Earth setting beyond the Moon.', ['Education', 'Space', 'Science']],
  ['reel', 'DbL6n0ggXDZ', 'Sound on! The sonification of NGC 4736', 'NASA', 'This sonification translates an image of a spiral galaxy into sound.', ['Science', 'Space', 'Music']],
  ['reel', 'DfF3eqGSKKc', 'More power loading', 'NASA’s Johnson Space Center', 'Two astronauts install a roll-out solar array on the International Space Station.', ['Education', 'Space', 'Technology']],
].map(([kind, id, title, creator, description, tags]) => ({
  ...parseInstagramPost(`${instagramOrigin}/${kind}/${id}/`), title, creator, description, tags,
}));
