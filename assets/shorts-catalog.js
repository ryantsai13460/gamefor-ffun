const assetVersion = new URL(import.meta.url).search;
const [{ getCuratedVideos }, { instagramPosts }] = await Promise.all([
  import(`./media.js${assetVersion}`), import(`./instagram-catalog.js${assetVersion}`),
]);

export const shortProviders = {
  youtube: { label: 'YouTube', compactLabel: 'YT', discover: 'https://www.youtube.com/shorts/' },
  tiktok: { label: 'TikTok', compactLabel: 'TT', discover: 'https://www.tiktok.com/explore' },
  instagram: { label: 'Instagram', compactLabel: 'IG', discover: 'https://www.instagram.com/reels/' },
};

export const shortCategories = [
  ['Gaming', ['Gaming']], ['Minecraft', ['Minecraft']], ['Roblox', ['Roblox']], ['Funny', ['Funny']],
  ['Animals', ['Animals', 'Nature', 'Wildlife']], ['Technology', ['Technology', 'Engineering', 'Coding', 'Robotics']],
  ['Learning', ['Education', 'Science', 'History', 'Math']], ['Creative', ['Arts', 'Art', 'DIY', 'Drawing', 'Maker']],
  ['Music', ['Music']], ['Food', ['Food']], ['Sports', ['Sports']], ['Travel', ['Travel']],
];

// The full YouTube library keeps its broader selection. This feed leaves out mature game franchises.
const matureGames = new Set(['Grand Theft Auto', 'Valorant', 'Apex Legends', 'Warframe', 'Fighting Games']);
const matureTitles = /\b(?:grand theft auto|gta\s*[56iv]+|five nights at freddy|call of duty|assassin.s creed|mortal kombat|dead by daylight|of the dead|doom eternal|gore|porn|onlyfans)\b/i;

function withCategories(video) {
  const categories = shortCategories.filter(([, tags]) => tags.some(tag => video.tags.includes(tag)));
  return { ...video, categories: categories.length ? categories.map(([label]) => label) : ['Other'] };
}

const youtube = getCuratedVideos().filter(video => video.short && !video.tags.some(tag => matureGames.has(tag)) && !matureTitles.test(video.title))
  .map(video => withCategories({
    ...video, provider: 'youtube', id: `youtube-${video.id}`, videoId: video.id,
    href: `https://www.youtube.com/shorts/${video.id}`,
    thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
  }));

// The public post and TikTok oEmbed both confirm these IDs. The native player supplies its own poster.
const tiktok = [
  {
    videoId: '6718335390845095173', creator: 'Scout, Suki & Stella', handle: 'scout2015',
    title: 'Scramble up your name and I’ll try to guess it',
    description: 'The pet video TikTok uses in its official embedded-player documentation.',
    tags: ['Animals'],
  },
  {
    videoId: '7667244788046892319', creator: 'NASA', handle: 'nasa',
    title: 'Drop your questions below! 🚀',
    description: 'NASA invites viewers to share their questions.',
    tags: ['Education', 'Science', 'Space'],
  },
].map(video => withCategories({
  ...video, provider: 'tiktok', id: `tiktok-${video.videoId}`,
  href: `https://www.tiktok.com/@${video.handle}/video/${video.videoId}`,
}));

const instagram = instagramPosts.filter(post => post.kind === 'reel').map(post => withCategories({
  ...post, provider: 'instagram', id: `instagram-${post.id}`, videoId: post.id,
}));

const featured = [];
for (const [label] of shortCategories) {
  const match = youtube.find(video => video.categories.includes(label) && !featured.includes(video));
  if (match) featured.push(match);
}

const catalog = [...featured.slice(0, 4), ...tiktok, ...instagram, ...featured.slice(4), ...youtube.filter(video => !featured.includes(video))];

export function getShortCatalog() {
  return [...catalog];
}

export function shortsLink(video, filters = {}) {
  const params = new URLSearchParams(filters);
  if (video) {
    params.set('source', video.provider);
    params.set('video', video.id);
  }
  return params.size ? `#shorts?${params}` : '#shorts';
}
