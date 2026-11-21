export const arcadeModes = [
  {
    id: 'arcade', label: 'Arcade', icon: 'home', tone: 'gold',
    detail: 'Games, videos, and search together'
  },
  {
    id: 'school', label: 'School', icon: 'layers', tone: 'mint',
    detail: 'Research, study, and practice',
    title: 'School mode',
    description: 'Look up a topic, get help writing or studying, or practice with a quick learning game.',
    links: [
      ['AI Study Help', '#web-search?mode=ai', 'spark', 'Get a guide, explanation, or calculation'],
      ['blip.ai', '#blip', 'activity', 'Work through a question in chat'],
      ['Learning videos', '#youtube?format=all&topic=Education', 'video', 'Science, math, history, and more'],
      ['Documentaries', '#movies?collection=full&genre=Documentary', 'film', 'Explore real stories and discoveries']
    ]
  },
  {
    id: 'gaming', label: 'Gaming', icon: 'gamepad', tone: 'gold',
    detail: 'Games you can play here',
    title: 'Gaming mode',
    description: 'Jump into the built-in arcade or revisit a favorite.',
    links: [
      ['In-page games', '#games?option=in-page', 'gamepad', 'Built-in games and approved players'],
      ['Built-in puzzles', '#games?local=1&category=Puzzle', 'grid', 'Play a quick puzzle or try a harder board'],
      ['Favorites', '#favorites', 'heart', 'Go back to the games you saved'],
      ['Game viewer', '#browse', 'globe', 'Open the in-page game picker']
    ]
  },
  {
    id: 'watching', label: 'Watching', icon: 'film', tone: 'coral',
    detail: 'Films, YouTube, Shorts, and music',
    title: 'Watching mode',
    description: 'Find something for movie night, watch a short, or put on a lyric video.',
    links: [
      ['Family films', '#movies?collection=family', 'film', 'Browse films for movie night'],
      ['YouTube', '#youtube?format=all', 'video', 'Search videos from the arcade catalog'],
      ['Shorts', '#youtube?format=shorts', 'play', 'Open the scrollable Shorts collection'],
      ['Lyric videos', '#music?lyrics=watch', 'music', 'Watch lyrics and browse music']
    ]
  },
  {
    id: 'library', label: 'Library', icon: 'heart', tone: 'violet',
    detail: 'Your favorites and recent activity',
    title: 'Library mode',
    description: 'Pick up a film, game, or saved chat where you left it.',
    links: [
      ['My library', '#library', 'layers', 'Saved games, videos, and music'],
      ['Recently played', '#recent', 'clock', 'Games opened from this browser'],
      ['Watchlist', '#movies?collection=watchlist', 'film', 'Find the films you saved'],
      ['Saved chats', '#blip', 'spark', 'Return to your blip.ai conversations']
    ]
  }
];
