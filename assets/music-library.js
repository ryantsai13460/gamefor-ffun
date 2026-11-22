const version = new URL(import.meta.url).search;
const [{ createMusicProfile, musicProfileState, renderMusicDiscovery }, { featuredTrack, musicCatalog }] = await Promise.all([
  import(`./music-discovery.js${version}`),
  import(`./music-catalog.js${version}`)
]);

export { featuredTrack, musicCatalog };

const archive = createMusicProfile(musicCatalog, {
  featured: featuredTrack, storageKey: 'ffun-music-preferences-v1'
});

export const findMusicTracks = query => archive.find(query);
export const getMusicLibraryState = () => musicProfileState(archive);
export const renderMusic = (target, params) => renderMusicDiscovery(target, params, archive);
