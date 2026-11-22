const version = new URL(import.meta.url).search;
const [{ createMusicProfile, musicProfileState, renderMusicDiscovery }, { reviewedLyrics }] = await Promise.all([
  import(`./music-discovery.js${version}`),
  import(`./lyrics-reviewed.js${version}`)
]);

const lyricVideos = reviewedLyrics.map(track => ({...track, href: `#music?track=${track.id}`}));
const profile = createMusicProfile(lyricVideos, {
  lyrics: true,
  storageKey: 'ffun-lyrics-preferences-v1',
  corrections: new Map([['house wifre', 'housewife'], ['house wife', 'housewife'], ['drcula', 'dracula']])
});
const archiveViews = new Set(['chart', 'legacy', '7clouds', 'channels']);

export const findLyricVideos = query => profile.find(query);
export const getLyricLibraryState = () => musicProfileState(profile);

export function renderLyrics(target, params) {
  if (!archiveViews.has(params?.get('lyrics'))) return renderMusicDiscovery(target, params, profile);
  const status = document.createElement('p');
  status.className = 'boot-note';
  status.setAttribute('role', 'status');
  status.textContent = 'Loading music sources…';
  target.replaceChildren(status);
  let active = true;
  let closeArchive;
  void import(`./lyrics-archive.js${version}`).then(({ renderLyricsArchive }) => {
    if (active) closeArchive = renderLyricsArchive(target, params);
  }).catch(() => {
    if (active) status.textContent = 'The music archive could not load. Try opening it again.';
  });
  return () => {
    active = false;
    closeArchive?.();
  };
}
