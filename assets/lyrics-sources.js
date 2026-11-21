function appleLyrics(songId) {
  return { url: `https://music.apple.com/us/song/${songId}` };
}

// Exact Apple Music song pages for chart lyrics.
export const lyricsSources = {
  'boston|stella lefty': appleLyrics('1884403093'),
  'dracula|tame impala jennie': appleLyrics('1874125269'),
  'dracula|tame impala and jennie': appleLyrics('1874125269'),
  'dracula|tame impala feat jennie': appleLyrics('1874125269'),
  'dracula jennie remix|tame impala': appleLyrics('1874125269'),
  'dracula jennie remix|tame impala jennie': appleLyrics('1874125269'),
  'dracula jennie remix official lyric video|tame impala jennie': appleLyrics('1874125269'),
  'dracula with jennie|tame impala': appleLyrics('1874125269'),
  'dracula with jennie|tame impala jennie': appleLyrics('1874125269'),
  'stupid song|olivia rodrigo': appleLyrics('1889992115'),
  'bby wow|karol g judeline rusowsky': appleLyrics('6796864754'),
  'bby wow|karol g with judeline rusowsky': appleLyrics('6796864754'),
  'nicole kidman|adela': appleLyrics('6792884088'),
  'hate that i made you love me|ariana grande': appleLyrics('6774398128'),
  'been by now|morgan wallen': appleLyrics('6792676860'),
  'patient zero|taylor swift': appleLyrics('6814832201'),
  'babydoll|dominic fike': appleLyrics('1880180463'),
  'last christmas|wham': appleLyrics('1541963875'),
  'i just might|bruno mars': appleLyrics('1866732800'),
  'all i want for christmas is you|mariah carey': appleLyrics('1487022972'),
  'be her|ella langley': appleLyrics('1869436845'),
  'beautiful things|benson boone': appleLyrics('1731801833'),
  'mystical magical|benson boone': appleLyrics('1807490820'),
  'man i need|olivia dean': appleLyrics('1817609509'),
  'where is my husband|raye': appleLyrics('1871085734'),
  'risk it all|bruno mars': appleLyrics('1866732797'),
  'aperture|harry styles': appleLyrics('1870984033'),
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
