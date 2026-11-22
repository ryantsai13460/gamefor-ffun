// Public players published by their creators. Keep the embedded player branding
// visible and show the publisher credit link for Afternoon Games and Yuzool.
export const independentGames = [
  {
    id: 'afternoon-wordsash',
    title: 'WordSash',
    category: 'Word Games',
    creator: 'Afternoon Games',
    collection: 'afternoon',
    description: 'Find five words tied to the daily theme in a grid of letters.',
    url: 'https://afternoongames.com/word-sash',
    embed: 'https://afternoongames.com/embed/word-sash',
    source: 'https://afternoongames.com/free-games-for-your-website',
    art: 'https://afternoongames.com/og/word-sash.png',
    artCredit: 'Afternoon Games',
    attribution: true
  },
  {
    id: 'afternoon-killer-sudoku',
    title: 'Killer Sudoku',
    category: 'Puzzle',
    creator: 'Afternoon Games',
    collection: 'afternoon',
    description: 'Solve a Sudoku grid using the sums marked on groups of squares.',
    url: 'https://afternoongames.com/killer-sudoku',
    embed: 'https://afternoongames.com/embed/killer-sudoku',
    source: 'https://afternoongames.com/free-games-for-your-website',
    art: 'https://afternoongames.com/og/killer-sudoku.png',
    artCredit: 'Afternoon Games',
    attribution: true
  },
  {
    id: 's7gs-pings-portal',
    title: 'Pings Portal',
    category: 'Arcade',
    creator: 'S7GS / Riftworks',
    collection: 's7gs',
    description: 'Steer a paddle to return the Shard through shifting obstacles.',
    url: 'https://s7gs.com/Arcade/pings-portal.html',
    embed: 'https://s7gs.com/Play/pings-portal.html',
    source: 'https://s7gs.com/Play/'
  },
  {
    id: 's7gs-breachfield',
    title: 'Breachfield',
    category: 'Cards',
    creator: 'S7GS / Riftworks',
    collection: 's7gs',
    description: 'Build a card strategy against three rivals or take turns with a friend on one screen.',
    url: 'https://s7gs.com/Games/breachfield/',
    embed: 'https://s7gs.com/Play/breachfield.html',
    source: 'https://s7gs.com/Play/'
  },
  {
    id: 'yuzool-pier-putt',
    title: 'Pier Putt',
    category: 'Sports',
    creator: 'Yuzool',
    collection: 'yuzool',
    description: 'Play three miniature-golf holes in the daily challenge. Drag back from the ball to putt.',
    url: 'https://www.yuzool.com/pier-putt/',
    embed: 'https://www.yuzool.com/pier-putt/?embed=1',
    source: 'https://www.yuzool.com/embed/',
    art: 'https://www.yuzool.com/catalog/og/pier-putt.png',
    artCredit: 'Yuzool',
    attribution: true
  }
].map(game => ({ ...game, status: 'embed', addedOn: '2026-11-22' }));
