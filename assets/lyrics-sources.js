function appleLyrics(songId) {
  return {kind: 'lyrics', url: `https://music.apple.com/us/song/${songId}`, label: 'Lyrics on Apple Music'};
}

function officialLyricVideo(videoId, appleSongId) {
  const source = {
    kind: 'lyric-video', url: `https://www.youtube.com/watch?v=${videoId}`,
    label: 'Official lyric video on YouTube', videoId
  };
  if (!appleSongId) return source;
  const {url, label} = appleLyrics(appleSongId);
  return {...source, alternateUrl: url, alternateLabel: label};
}

const draculaRemix = officialLyricVideo('0UPDBODtxzw', '1874125269');
const bbyWow = appleLyrics('6796864754');

// Sources are linked to the official service. The catalog does not store lyric text.
export const lyricsSources = {
  'choosin texas|ella langley': officialLyricVideo('hLOheGDwD_0'),
  'boston|stella lefty': officialLyricVideo('v2ttAph6PhM', '1884403093'),
  'dracula|tame impala jennie': draculaRemix,
  'dracula|tame impala and jennie': draculaRemix,
  'dracula|tame impala feat jennie': draculaRemix,
  'dracula jennie remix|tame impala': draculaRemix,
  'dracula jennie remix|tame impala jennie': draculaRemix,
  'dracula jennie remix official lyric video|tame impala jennie': draculaRemix,
  'dracula with jennie|tame impala': draculaRemix,
  'dracula with jennie|tame impala jennie': draculaRemix,
  'housewife|tate mcrae': {
    ...officialLyricVideo('yi24DPRG0Sg'),
    alternateUrl: 'https://music.apple.com/us/music-video/housewife-official-lyric-video/6825140454',
    alternateLabel: 'Official lyric video on Apple Music'
  },
  'stupid song|olivia rodrigo': officialLyricVideo('ngyaXb9BohU', '1889992115'),
  'bby wow|karol g judeline rusowsky': bbyWow,
  'bby wow|karol g with judeline rusowsky': bbyWow,
  'nicole kidman|adela': appleLyrics('6792884088'),
  'hate that i made you love me|ariana grande': officialLyricVideo('v1t4MTqdfyI', '6774398128'),
  'been by now|morgan wallen': officialLyricVideo('6q5F7UUiXK0', '6792676860'),
  'patient zero|taylor swift': officialLyricVideo('BpR280fXISA', '6814832201'),
  'babydoll|dominic fike': appleLyrics('1880180463'),
  'last christmas|wham': officialLyricVideo('LcglfxoonDo', '1541963875'),
  'i just might|bruno mars': appleLyrics('1866732800'),
  'all i want for christmas is you|mariah carey': officialLyricVideo('NrGGIoDL6U4', '1487022972'),
  'be her|ella langley': appleLyrics('1869436845'),
  'beautiful things|benson boone': officialLyricVideo('HU08BcK5SUY', '1731801833'),
  'mystical magical|benson boone': officialLyricVideo('U8QhB8_0t2g', '1807490820'),
  'sorry i m here for someone else|benson boone': officialLyricVideo('O7Dt2L_rAhI'),
  'man i need|olivia dean': officialLyricVideo('JGKgbmz_gcU', '1817609509'),
  'ordinary|alex warren': officialLyricVideo('A8dH4cKGa6s'),
  'where is my husband|raye': appleLyrics('1871085734'),
  'risk it all|bruno mars': appleLyrics('1866732797'),
  'aperture|harry styles': officialLyricVideo('d9mB75_BiAo', '1870984033'),
  'golden|huntr x': officialLyricVideo('yebNIHKAC4A', '1837843445'),
  'the fate of ophelia|taylor swift': officialLyricVideo('rbmdfEQODOw'),
  'opalite|taylor swift': officialLyricVideo('3PJC6uPIekc'),
  'anything but love|tate mcrae': officialLyricVideo('yvStZj7l5sQ'),
  'tit for tat|tate mcrae': officialLyricVideo('LIHy038SJA0'),
  'nobody s girl|tate mcrae': officialLyricVideo('9P_tdUFE6Ns'),
  'horseshoe|tate mcrae': officialLyricVideo('Ax9LBet8ZlM'),
  'trying on shoes|tate mcrae': officialLyricVideo('ct1hJwBfhME'),
  'young american heart|benson boone': officialLyricVideo('pzZdYTSZePg'),
  'i wanna be the one you call|benson boone': officialLyricVideo('diLDtlbmu2M'),
  'reminds me of you|benson boone': officialLyricVideo('SqVQmhar1DQ'),
  'i had some help feat morgan wallen|post malone': officialLyricVideo('11T6kF66dKY'),
  'shape of you|ed sheeran': officialLyricVideo('_dK2tDK9grQ'),
  'so easy to fall in love|olivia dean': officialLyricVideo('FX1_FXlKxXY'),
  'iris|the goo goo dolls': officialLyricVideo('zDOILKOOUCo'),
  'willing and able|noah kahan': officialLyricVideo('2f4gu97XWFg'),
  'coming up roses|harry styles': officialLyricVideo('_3GKsIFtEoE'),
  'cause you have to|lany': officialLyricVideo('9t3xxOAMh4Q'),
  'honeybee|olivia rodrigo': officialLyricVideo('60rlboK94mE'),
  'blinding lights|the weeknd': officialLyricVideo('o6ytLPKscrU'),
  'lose control|teddy swims': officialLyricVideo('FkOpwodhROI'),
  'perfect|ed sheeran': officialLyricVideo('iKzRIweSBLA'),
  'new rules|dua lipa': officialLyricVideo('AyWsHs5QdiY'),
  'santa tell me|ariana grande': officialLyricVideo('qlWp9B7hr3A'),
  'one more sleep|leona lewis': officialLyricVideo('sXIQK8lcOOc'),
  'step into christmas|elton john': officialLyricVideo('Jay_-l6NaC8'),
  'drop dead|olivia rodrigo': officialLyricVideo('t_OyQhiqXgA'),
  'khuda jaane|vishal shekhar kk shilpa rao': officialLyricVideo('RJD1fQ15I9Y'),
  'jaiye sajana|shashwat sachdev jasmine sandlas satinder sartaaj': officialLyricVideo('xV1-V1E5ZlQ'),
  'dardos|romeo santos prince royce': officialLyricVideo('D6XR9GfBfwY'),
  'my body isn t ready|sombr': officialLyricVideo('WjnsaO-q3BE'),
  'don t we|morgan wallen': officialLyricVideo('1xvg5fHLhWM'),
  'snooze|sza': officialLyricVideo('bs0qR3-7lIY'),
  'midnight sun|zara larsson': officialLyricVideo('rovyNQH7HFY'),
  'loving life again|ella langley': officialLyricVideo('QemG9NDH2zI'),
  'thinkin bout me|morgan wallen': officialLyricVideo('5DCdL1zdpdM'),
  'wasted on you|morgan wallen': officialLyricVideo('OqaznqwGkrs'),
  'i m the problem|morgan wallen': officialLyricVideo('wIA-4LeRgsc'),
  'the cure|olivia rodrigo': officialLyricVideo('UbbrZTfjkdk')
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
