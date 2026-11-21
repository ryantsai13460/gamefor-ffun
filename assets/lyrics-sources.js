function appleLyrics(songId) {
  return {url: `https://music.apple.com/us/song/${songId}`, label: 'Lyrics on Apple Music'};
}

function officialLyricVideo(videoId) {
  return {url: `https://www.youtube.com/watch?v=${videoId}`, label: 'Official lyric video on YouTube', videoId};
}

const draculaRemix = officialLyricVideo('0UPDBODtxzw');
const bbyWow = appleLyrics('6796864754');

// Sources are linked to the official service. The catalog does not store lyric text.
export const lyricsSources = {
  'choosin texas|ella langley': officialLyricVideo('hLOheGDwD_0'),
  'boston|stella lefty': appleLyrics('1884403093'),
  'dracula|tame impala jennie': draculaRemix,
  'dracula|tame impala and jennie': draculaRemix,
  'dracula|tame impala feat jennie': draculaRemix,
  'dracula jennie remix|tame impala': draculaRemix,
  'dracula jennie remix|tame impala jennie': draculaRemix,
  'dracula jennie remix official lyric video|tame impala jennie': draculaRemix,
  'dracula with jennie|tame impala': draculaRemix,
  'dracula with jennie|tame impala jennie': draculaRemix,
  'housewife|tate mcrae': {
    url: 'https://music.apple.com/us/music-video/housewife-official-lyric-video/6825140454',
    label: 'Official lyric video on Apple Music'
  },
  'stupid song|olivia rodrigo': appleLyrics('1889992115'),
  'bby wow|karol g judeline rusowsky': bbyWow,
  'bby wow|karol g with judeline rusowsky': bbyWow,
  'nicole kidman|adela': appleLyrics('6792884088'),
  'hate that i made you love me|ariana grande': officialLyricVideo('v1t4MTqdfyI'),
  'been by now|morgan wallen': officialLyricVideo('6q5F7UUiXK0'),
  'patient zero|taylor swift': appleLyrics('6814832201'),
  'babydoll|dominic fike': appleLyrics('1880180463'),
  'last christmas|wham': appleLyrics('1541963875'),
  'i just might|bruno mars': appleLyrics('1866732800'),
  'all i want for christmas is you|mariah carey': appleLyrics('1487022972'),
  'be her|ella langley': appleLyrics('1869436845'),
  'beautiful things|benson boone': appleLyrics('1731801833'),
  'mystical magical|benson boone': appleLyrics('1807490820'),
  'man i need|olivia dean': appleLyrics('1817609509'),
  'ordinary|alex warren': officialLyricVideo('A8dH4cKGa6s'),
  'where is my husband|raye': appleLyrics('1871085734'),
  'risk it all|bruno mars': appleLyrics('1866732797'),
  'aperture|harry styles': officialLyricVideo('d9mB75_BiAo'),
  'golden|huntr x': appleLyrics('1837843445')
};

export function normalizeLyricsText(value) {
  return value.toLowerCase().normalize('NFKD').replace(/\p{Mark}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function appleMusicSearchUrl(title, artist) {
  const url = new URL('https://music.apple.com/us/search');
  url.searchParams.set('term', [title, artist].filter(Boolean).join(' '));
  return url.href;
}
