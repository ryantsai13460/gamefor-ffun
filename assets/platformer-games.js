const authorHosted = {
  category: 'Platformer',
  collection: 'open-web',
  status: 'embed',
  license: 'MIT',
  isNew: true,
  addedOn: '2026-11-22'
};

// Each player is the author's own published web build. Source and license links
// point to the corresponding release rather than to a third-party mirror.
export const platformerGames = [
  {
    id: 'tether-demo',
    title: 'TETHER',
    creator: 'Nikita Andreiev',
    description: 'Chain grapple swings, air dashes, and pogos through 19 stages. Replay your runs and race against your own splits.',
    controls: 'Steer with A/D and reel with W/S. Grapple with E or right-click, jump or release with Space, and dash with Shift.',
    url: 'https://nikita-andreiev.com/tether-demo/',
    source: 'https://github.com/Barabosik/tether-demo',
    licenseUrl: 'https://github.com/Barabosik/tether-demo/blob/main/LICENSE',
    platformerTags: ['speedrun', 'parkour', 'hard']
  },
  {
    id: 'blips-grove',
    title: "Blip’s Grove",
    creator: 'r4nd3l',
    description: 'Jump, dash, and stomp across four handmade biomes and earn medals for fast, clean runs.',
    controls: 'Move with Left/Right, jump with Space, and dash with Shift. Hold Down in the air to charge a stomp.',
    url: 'https://r4nd3l.github.io/Platformer/',
    source: 'https://github.com/r4nd3l/Platformer',
    licenseUrl: 'https://github.com/r4nd3l/Platformer/blob/main/LICENSE',
    platformerTags: ['speedrun', 'parkour']
  },
  {
    id: 'ninja-vs-evil-corp',
    title: 'Ninja vs Evil Corp: Rage Run',
    creator: 'Ritik Thakur',
    category: 'Parkour',
    description: 'Wall-kick and air-dash past traps in a precision runner that grades finishes by time and deaths.',
    controls: 'A/D to move, Space to jump or wall-jump, and Shift to dash.',
    url: 'https://ritikthakur22.github.io/game/',
    source: 'https://github.com/ritikthakur22/game',
    licenseUrl: 'https://github.com/ritikthakur22/game/blob/main/LICENSE',
    platformerTags: ['speedrun', 'parkour', 'hard']
  },
  {
    id: 'stolen-sword',
    title: 'Stolen Sword',
    creator: 'Ian Chiao',
    description: 'Time your leaps in a one-button action platformer.',
    controls: 'Drag to aim, then release to leap and slash.',
    url: 'https://chiaogu.github.io/stolen-sword/',
    source: 'https://github.com/chiaogu/stolen-sword',
    licenseUrl: 'https://github.com/chiaogu/stolen-sword/blob/master/LICENSE.md',
    platformerTags: ['parkour']
  },
  {
    id: 'jumping-journey',
    title: 'Jumping Journey',
    creator: 'cs3-4-team',
    description: 'Jump between platforms over lava and collect coins on the way through each stage.',
    controls: 'Tab to Play and press Enter. Move with Left/Right and jump with Up.',
    url: 'https://cs3-4-team.github.io/jumping-journey/',
    source: 'https://github.com/cs3-4-team/jumping-journey',
    licenseUrl: 'https://github.com/cs3-4-team/jumping-journey/blob/main/LICENSE',
    platformerTags: ['parkour']
  },
  {
    id: 'euphrosine-ten-dots',
    title: 'Euphrosine Wants Ten Dots',
    creator: 'Quinten Clause',
    description: 'Run, jump, climb, and float as a ladybug looking for ten dots.',
    controls: 'Use the arrow keys and Space.',
    url: 'https://quinten.github.io/euphrosine-wants-ten-dots/',
    source: 'https://github.com/Quinten/euphrosine-wants-ten-dots',
    licenseUrl: 'https://github.com/Quinten/euphrosine-wants-ten-dots/blob/master/LICENSE',
    platformerTags: ['parkour']
  },
  {
    id: 'super-bunny-strikes-back',
    title: 'Super Bunny Strikes Back!',
    creator: 'Foumart',
    description: 'Hop across scrolling platforms, dodge creatures, and collect power-ups to clear each stage.',
    controls: 'Move with the arrow keys or A/D. Press R to restart and P to pause.',
    url: 'https://www.foumartgames.com/games/SuperBunny/',
    embed: 'https://www.foumartgames.com/game/SuperBunny/',
    source: 'https://github.com/js13kGames/super-bunny-strikes-back',
    license: 'BSD-2-Clause',
    licenseUrl: 'https://github.com/js13kGames/super-bunny-strikes-back/blob/master/LICENSE',
    platformerTags: ['parkour']
  },
  {
    id: 'melon-man',
    title: 'The Melon Man',
    creator: 'Karol Świerczek',
    description: 'Climb as high as you can by jumping between randomized platforms.',
    controls: 'Move with A/D or Left/Right and jump with Space.',
    url: 'https://who-is-apo.github.io/The-Melon-Man/',
    source: 'https://github.com/who-is-apo/The-Melon-Man',
    licenseUrl: 'https://github.com/who-is-apo/The-Melon-Man/blob/master/LICENSE',
    platformerTags: ['parkour']
  },
  {
    id: 'vectraclash',
    title: 'VectraClash',
    creator: 'Sahir Punjwani',
    description: 'Guide a geometric energy core through a fast, rhythm-inspired precision platformer.',
    controls: 'Press Space to jump.',
    url: 'https://sahirpunjwani.github.io/vectraclash/',
    source: 'https://github.com/sahirpunjwani/vectraclash',
    licenseUrl: 'https://github.com/sahirpunjwani/vectraclash/blob/main/LICENSE',
    platformerTags: ['parkour']
  }
].map(game => ({ ...authorHosted, embed: game.url, ...game }));
