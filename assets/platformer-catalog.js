export const existingPlatformerDetails = {
  ovo: { platformerTags: ['parkour', 'hard'] },
  'ffun-skyline-v1': {
    platformerTags: ['parkour', 'speedrun'],
    description: 'Double-jump across rooftops, collect three crystals, then race to the flag.',
    controls: 'A/D or Left/Right to move. Space, W or Up to jump. Press jump again in midair for a double jump.'
  },
  onoff: { platformerTags: ['puzzle'] },
  'tapamine-dash': { platformerTags: ['hard'] },
  'tapamine-spire': { platformerTags: ['parkour'] },
  'tapamine-wallhop': { platformerTags: ['parkour'] },
  'tapamine-flipside': { platformerTags: ['parkour'] }
};

// Lexaloffle exposes these widgets when the cartridge's author enables external playback.
// https://www.lexaloffle.com/bbs/?pid=59457
const publisherGames = [
  {
    id: 'moss-moss', title: 'Moss Moss', creator: 'Noel Cody', platformerTags: ['parkour'],
    description: 'Jump and dash through a moss-covered PICO-8 platformer.',
    controls: 'Arrow keys move, C jumps, and X dashes.',
    url: 'https://www.lexaloffle.com/bbs/?pid=mossmoss-17',
    embed: 'https://www.lexaloffle.com/bbs/widget.php?pid=mossmoss'
  },
  {
    id: 'to-a-starling', title: 'To a Starling', creator: 'Peteksi', platformerTags: ['puzzle', 'parkour'],
    description: 'Use teleportation to solve compact platforming rooms.',
    controls: 'Arrow keys move, C jumps, and X teleports.',
    url: 'https://www.lexaloffle.com/bbs/?pid=112422',
    embed: 'https://www.lexaloffle.com/bbs/widget.php?pid=to_a_starling_v1_1'
  },
  {
    id: 'celeste-classic', title: 'CELESTE Classic', creator: 'Maddy Thorson and Noel Berry', platformerTags: ['hard', 'speedrun'],
    description: 'Dash through short precision-platforming rooms on the way up Celeste Mountain.',
    url: 'https://maddymakesgamesinc.itch.io/celesteclassic'
  },
  {
    id: 'tricky-keys', title: 'Tricky Keys', creator: 'Team Bugulon', platformerTags: ['puzzle', 'hard'],
    description: 'Solve platform puzzles while a computer virus interferes with your keys.',
    controls: 'Use arrows or WASD to move and Space to jump.',
    url: 'https://saturnyoshi.itch.io/tricky-keys'
  },
  {
    id: 'deepest-sword', title: 'Deepest Sword', creator: 'Cosmic Adventure Squad', platformerTags: ['puzzle'],
    description: 'Try to reach the dragon as a growing sword makes the platforming trickier.',
    controls: 'A/D moves, arrows or mouse control the sword, and R returns to a checkpoint.',
    url: 'https://cosmicadventuresquad.itch.io/deepest-sword'
  },
  {
    id: 'pikwip', title: 'Pikwip', creator: 'Cookiecrayon', platformerTags: ['puzzle', 'parkour'],
    description: 'Guide two linked climbers up a mountain alone or with a second player.',
    controls: 'Use WASD and Arrow keys for the two climbers. R restarts.',
    url: 'https://cookiecrayon.itch.io/pikwip'
  },
  {
    id: 'alpine-oddly-shaped-pixels', title: 'Alpine', creator: 'Oddly Shaped Pixels', platformerTags: ['puzzle', 'parkour'],
    description: 'Climb through a mountain-themed puzzle platformer.',
    controls: 'Arrow keys move and Z jumps.',
    url: 'https://oddly-shaped-pixels.itch.io/alpine'
  },
  {
    id: 'frogfall', title: 'Frogfall', creator: 'Kultisti', platformerTags: ['puzzle', 'speedrun'],
    description: 'Hop through bite-sized platform puzzles, with B-sides and a speedrun mode.',
    url: 'https://kultisti.itch.io/frogfall'
  },
  {
    id: 'platformer-toolkit', title: 'Platformer Toolkit', creator: 'Game Maker’s Toolkit', platformerTags: [],
    description: 'Tune movement settings and see how they change the feel of a platformer.',
    controls: 'Space or J jumps. T opens the toolkit.',
    url: 'https://gmtk.itch.io/platformer-toolkit'
  },
  {
    id: 'mobility-precision-platformer', title: 'Mobility! Accessible Precision Platformer', creator: 'Auroriax', platformerTags: ['parkour', 'hard'],
    description: 'Clear precision jumps with configurable difficulty and movement assistance.',
    controls: 'Arrows move, Space or Z jumps, X crouches, and R returns to a checkpoint.',
    url: 'https://auroriax.itch.io/mobility'
  }
];

export const platformerSpotlights = [
  {
    id: 'beacon-ascent', title: 'Beacon Ascent', category: 'Platformer', collection: 'original', status: 'local', local: true,
    description: 'Climb three mountain relay stations with wall jumps, a rechargeable air dash, and checkpoints.',
    controls: 'A/D or Left/Right to move. W, Up or Space to jump or wall-jump. X dashes in midair. P pauses. Touch controls are provided.',
    platformerTags: ['parkour', 'speedrun'], addedOn: '2026-11-22',
    art: './assets/local-art/beacon-ascent.webp', artCredit: 'Gamefor Ffun gameplay'
  },
  ...publisherGames.map(game => ({ ...game, category: 'Platformer', collection: 'platformer-library',
    status: game.embed ? 'embed' : 'external', addedOn: '2026-11-22' }))
];
