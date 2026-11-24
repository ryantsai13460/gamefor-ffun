function freezeRecords(records) {
  return Object.freeze(records.map(Object.freeze));
}

// The weight belongs to the entire rarity band. Each egg shares it among the species in that band.
export const PET_RARITIES = freezeRecords([
  { id: 'common', label: 'Common', color: '#52675d', points: 10, weight: 3000, speciesCount: 5 },
  { id: 'uncommon', label: 'Uncommon', color: '#2b6a4b', points: 14, weight: 2300, speciesCount: 4 },
  { id: 'rare', label: 'Rare', color: '#205d7d', points: 22, weight: 1650, speciesCount: 3 },
  { id: 'epic', label: 'Epic', color: '#6b438b', points: 35, weight: 1150, speciesCount: 3 },
  { id: 'legendary', label: 'Legendary', color: '#8e521a', points: 55, weight: 850, speciesCount: 2 },
  { id: 'mythic', label: 'Mythic', color: '#883e61', points: 85, weight: 550, speciesCount: 2 },
  { id: 'exalted', label: 'Exalted', color: '#87452f', points: 115, weight: 250, speciesCount: 1 },
  { id: 'celestial', label: 'Celestial', color: '#3c4f99', points: 150, weight: 140, speciesCount: 1 },
  { id: 'ethereal', label: 'Ethereal', color: '#205e64', points: 210, weight: 80, speciesCount: 1 },
  { id: 'primordial', label: 'Primordial', color: '#66501c', points: 300, weight: 30, speciesCount: 1 }
]);

export const BESTIARY_HABITATS = freezeRecords([
  { id: 'sunstep', label: 'Sunstep Meadow', description: 'Wildflowers, open fields and the first pets in the journal.', level: 1, generation: 1 },
  { id: 'fernwild', label: 'Fernwild Grove', description: 'Leaf-covered trails shelter swift woodland pets.', level: 2, generation: 1 },
  { id: 'emberdeep', label: 'Emberdeep', description: 'Companions from the crystal caverns beyond the first rebirth.', level: 3, generation: 2 },
  { id: 'glasswater', label: 'Glasswater Coast', description: 'Shoreline companions hatch at the coastal egg station.', level: 3, generation: 1, biomeId: 'glasswater' },
  { id: 'frostpine', label: 'Frostpine Reach', description: 'Cold-weather companions hatch at the alpine egg station.', level: 5, generation: 2, biomeId: 'frostpine' },
  { id: 'cinderbloom', label: 'Cinderbloom Basin', description: 'Volcanic companions hatch at the caldera egg station.', level: 7, generation: 3, biomeId: 'cinderbloom' }
]);

export const BESTIARY_PROFILES = freezeRecords([
  { shape: 'hare', label: 'Hare', combatRole: 'scout' },
  { shape: 'fox', label: 'Fox', combatRole: 'balanced' },
  { shape: 'owl', label: 'Owl', combatRole: 'balanced' },
  { shape: 'axolotl', label: 'Axolotl', combatRole: 'balanced' },
  { shape: 'turtle', label: 'Turtle', combatRole: 'striker' },
  { shape: 'otter', label: 'Otter', combatRole: 'scout' },
  { shape: 'crab', label: 'Crab', combatRole: 'striker' },
  { shape: 'yak', label: 'Yak', combatRole: 'striker' },
  { shape: 'stoat', label: 'Stoat', combatRole: 'scout' },
  { shape: 'moth', label: 'Moth', combatRole: 'scout' },
  { shape: 'salamander', label: 'Salamander', combatRole: 'balanced' },
  { shape: 'armadillo', label: 'Armadillo', combatRole: 'striker' },
  { shape: 'dragon', label: 'Dragon', combatRole: 'striker' },
  { shape: 'manta', label: 'Manta', combatRole: 'balanced' },
  { shape: 'seahorse', label: 'Seahorse', combatRole: 'balanced' },
  { shape: 'gecko', label: 'Gecko', combatRole: 'scout' },
  { shape: 'magpie', label: 'Magpie', combatRole: 'scout' },
  { shape: 'lynx', label: 'Lynx', combatRole: 'balanced' },
  { shape: 'ibex', label: 'Ibex', combatRole: 'striker' },
  { shape: 'beetle', label: 'Beetle', combatRole: 'striker' },
  { shape: 'octopus', label: 'Octopus', combatRole: 'balanced' },
  { shape: 'hummingbird', label: 'Hummingbird', combatRole: 'scout' },
  { shape: 'porcupine', label: 'Porcupine', combatRole: 'striker' }
]);

// Names, color families, and silhouette order are authored for each set. A species ID is its
// permanent set slug and silhouette, so names and art can evolve without invalidating saves.
const sets = [
  {
    slug: 'clover', name: 'Clover Egg', habitat: 'sunstep', level: 1, cost: 28, basePower: 5, tierStep: 3, rotation: 0,
    description: 'A soft green shell dotted with the colors of spring wildflowers.',
    palette: ['#91b85f', '#ddad58', '#779d7b', '#b584a7'], accents: ['#f3e697', '#ffe6bb', '#def2b3'],
    names: 'Bellbud Poppy Larkspur Sprig Buttercap Creekmint Cloverbar Mossbell Thimbleweed Petaldrift Brightridge Amberseed Maythunder Dewwake Sunthread Greenwink Finchwhistle Lilacshade Honeystep Prismroot Meadowmist Goldmurmur Firstlight'
  },
  {
    slug: 'thistle', name: 'Thistle Egg', habitat: 'sunstep', level: 2, cost: 45, basePower: 8, tierStep: 3, rotation: 15,
    description: 'A woven thistle shell for agile pets and hardy seed collectors.',
    palette: ['#9186bb', '#738153', '#aa7198', '#b68e61'], accents: ['#f4ddbc', '#e7c9ed', '#deef9f'],
    names: 'Burrcap Plumehook Barley Briarstalk Needleleaf Fearn Tuftkin Oatwisp Bristlemere Cushionburr Hedgerun Pollenwick Spindledew Silkshade Brushhopper Tansy Tallowbloom Burrglint Thornlark Asterwing Crownthistle Hushbriar AncientBurr'
  },
  {
    slug: 'ambergrass', name: 'Ambergrass Egg', habitat: 'sunstep', level: 2, cost: 64, basePower: 11, tierStep: 4, rotation: 6,
    description: 'A flax-colored shell whose warm markings glow like dried summer grass.',
    palette: ['#bc8d53', '#cd762f', '#a66348', '#a9a36a'], accents: ['#ffe4a0', '#ffd7a1', '#f4f0b6'],
    names: 'Wheatlace Sedge Wickgrass Haywhistle Sunwick Ochergrain Goldenrod Coppersedge Duskstraw Lionstalk Peatgold Saffron Shoalwheat Silstalk Barleymoon Seedwhorl Braidsun Ryecrest Granary GildedWhisk Suncairn Sunveil Evergrain'
  },
  {
    slug: 'moonpetal', name: 'Moonpetal Egg', habitat: 'sunstep', level: 3, cost: 92, basePower: 14, tierStep: 4, rotation: 9,
    description: 'A shell with pale pink petals that open after the meadow cools at dusk.',
    palette: ['#7e77b7', '#a584ba', '#936c99', '#527998'], accents: ['#f5d4eb', '#d4edfa', '#fff0d4'],
    names: 'Lullpetal Latepollen Silkbud Astrabloom Eveningdew Palefern Duskquill Nightvine Bloomcurl Violetwane Dreamleaf Mooncrest Petalhush Lilacglow Blueorbit Moondrop Fluttermyst Nightpetal Silverbloom Tidelune Moonhalo SoftEclipse PetalEon'
  },
  {
    slug: 'fernshade', name: 'Fernshade Egg', habitat: 'fernwild', level: 2, cost: 52, basePower: 15, tierStep: 4, rotation: 4,
    description: 'A fern-green shell with veins like the leaves beside the woodland trail.',
    palette: ['#668f5b', '#4c8876', '#687b4d', '#896d46'], accents: ['#d7e7a8', '#acf4ca', '#f4d996'],
    names: 'Fiddlefern Sori Tawnbark Greencurl Sporewake Frayfrond Ladderleaf Fernwhisk Siltbranch Shadefiddle Barkloop Springbolt Newbracken Aldercoil Branchglide Acornchime Clovercanopy Rootdrift Heartfrond Fernwrought CanopyCrown VerdantVeil FirstFrond'
  },
  {
    slug: 'rainfern', name: 'Rainfern Egg', habitat: 'fernwild', level: 3, cost: 79, basePower: 19, tierStep: 4, rotation: 10,
    description: 'A glossy, mossy shell patterned with droplets caught under the canopy.',
    palette: ['#4a8d81', '#689c93', '#4d6f8b', '#7675a1'], accents: ['#cdeec3', '#ddf4f0', '#d4cedf'],
    names: 'Mizzle Rindle Pluvine Wetwillow Rainglass Dewfin Splashreed Dropleaf Seepwood Lindendrip Bayrain Stormtuss Mistplume Petrichor Raincurl Waterleaf Fernmist Rainstave Fogbough Opaldamp DrizzleHalo DownpourVeil FirstRain'
  },
  {
    slug: 'wildbloom', name: 'Wildbloom Egg', habitat: 'fernwild', level: 4, cost: 113, basePower: 25, tierStep: 5, rotation: 17,
    description: 'A painted shell from the flowering clearings above Fernwild Grove.',
    palette: ['#bb6f95', '#a75988', '#b27a58', '#728e65'], accents: ['#f4cbb9', '#ffe6ad', '#e0f2a7'],
    names: 'Flox Wildrose Anise Lotusbell Marigold Balsam Catmint Rhodaflare Foxglove Mossmallow Beeorchid Irisbloom Gentian Silkvine Nectarwick Berrypetal Scentwood Roseglint Blossomtide Sweetspine BloomCrown PetalWarden RootOfSpring'
  },
  {
    slug: 'embershade', name: 'Embershade Egg', habitat: 'emberdeep', level: 3, cost: 96, basePower: 24, tierStep: 5, rotation: 12,
    description: 'A coal-dark shell whose thin seams keep a steady orange light.',
    palette: ['#8c534c', '#a46255', '#694d60', '#be7247'], accents: ['#ffb982', '#e9a6a5', '#ffdf9a'],
    names: 'Ashcap Cinderweb Smoldershade Coalglint Brimwing Scorchcurl Flintdust Burnseed Sootstep Charveil Hearthbud Emberditch Scoria Critchstone Basaltwillow Warmcoal Flickered Sparkshell Emberbolt CinderLatch HiddenGlow AshOracle HearthOrigin'
  },
  {
    slug: 'forgeglow', name: 'Forgeglow Egg', habitat: 'emberdeep', level: 4, cost: 137, basePower: 34, tierStep: 6, rotation: 19,
    description: 'A copper shell with hammered stripes and a bright hot-forge center.',
    palette: ['#b06e50', '#a24d3d', '#81675d', '#946e89'], accents: ['#ffc982', '#edcaaa', '#ffa567'],
    names: 'Rivet Emberbar Bronzewick Emberjaw Hammergrain Coalknurl Coppersnap Foundry Anvilcrest Brassridge Wirecoil Tinbell Slagbloom Chiselmouth Firedglass Kilnshine Porphyry Forgelace Solderleaf Crucible AmberSmith FlameWeaver ForgeGenesis'
  },
  {
    slug: 'gemrift', name: 'Gemrift Egg', habitat: 'emberdeep', level: 6, cost: 199, basePower: 50, tierStep: 7, rotation: 2,
    description: 'A fractured violet shell with pocket colors from the deepest geodes.',
    palette: ['#68599a', '#805795', '#4f7997', '#985a7f'], accents: ['#eaceff', '#adeae7', '#ffcfe4'],
    names: 'Rutile Amethyst Geodetail Facetfoot Lusterchip Vugstone Quartzlace Berylbloom Lodeshadow Chalcet Spinelstream Gemtide Cuprite Echochert Prismtine Azurespark Orpiment SpectralHop CrystalSkein NightFacet RiftCrown GlassDepth DeepFirst'
  },
  {
    slug: 'shorecrest', name: 'Shorecrest Egg', habitat: 'glasswater', level: 3, cost: 122, basePower: 28, tierStep: 4, rotation: 5,
    description: 'A salt-white shell with color bands left by the rising tide.',
    palette: ['#5da995', '#5d92b1', '#a5a575', '#bd8d79'], accents: ['#ddfbdf', '#ffdfce', '#f9e7a2'],
    names: 'Marram Sandlace Ripplewink Saltfoot Driftfern Shelltide Ternwhisk Shingletooth Kelpkin Beachglint Surflet Sunnysalt Scallopfin Flotsam Coralwick Seabreeze PaleGrit Tidecall Estuary Saltwoven ShoreCrown FoamVeil OldWater'
  },
  {
    slug: 'lagoon', name: 'Lagoon Egg', habitat: 'glasswater', level: 4, cost: 148, basePower: 34, tierStep: 5, rotation: 14,
    description: 'A teal shell with bright ripples like the pools inside the reef.',
    palette: ['#4b9b91', '#288876', '#6d91a5', '#cb8b77'], accents: ['#d1fcda', '#ffe1b7', '#bcebee'],
    names: 'Algal Bluepurl Purlfin Baypepper Poolleaf Lilywake Tangledrift Tidelagoon Pebblewash Basinblue Seafern Kelpwhorl Oarfleck Clearlet Reefly Turquoise Sandmint Shellshore Greenwater LagoonBloom BrackishCrown Ebbshade LiminalTide'
  },
  {
    slug: 'moonreef', name: 'Moonreef Egg', habitat: 'glasswater', level: 5, cost: 176, basePower: 42, tierStep: 6, rotation: 20,
    description: 'A pearl shell with pink and blue crescents from the reef after dusk.',
    palette: ['#777ab0', '#458997', '#9273a2', '#517098'], accents: ['#d8f7f4', '#f8d3ed', '#d9e2ff'],
    names: 'Nacrelace Dimtide Bluering Duskcoral Glimmerpool Capiz Seaopal Lenswake PaleCurrent Reefshade Wanepool GhostKelp StarSilt CoralMoon Lunefoam Depthflare Moonplankton PearlAster Lullwater ReefOracle NacreHalo MoonDrifter ReefEon'
  },
  {
    slug: 'deepcurrent', name: 'Deepcurrent Egg', habitat: 'glasswater', level: 6, cost: 215, basePower: 52, tierStep: 7, rotation: 8,
    description: 'A dark shell whose bright ridges curl like a strong offshore current.',
    palette: ['#426583', '#405c98', '#367e89', '#665a91'], accents: ['#a2efe7', '#9fd7ff', '#d7cafe'],
    names: 'Underfan Twistsilt Riptide Vortexseed Kelpjet Curlwave Longswell Pressurite Trenchleaf Slidefin Backrush Abysswake Seachannel TideSpiral Coldwell Ventshore Trenchflare OceanVein Thalass Driftward SaltConstellation DeepHalo FirstCurrent'
  },
  {
    slug: 'snowdrift', name: 'Snowdrift Egg', habitat: 'frostpine', level: 5, cost: 228, basePower: 55, tierStep: 7, rotation: 7,
    description: 'A pale shell rimmed with needle ice and fresh pine pollen.',
    palette: ['#93b4c9', '#7e9cb8', '#8a98c7', '#778e93'], accents: ['#e2f8fe', '#f5f5d8', '#e1f4f9'],
    names: 'Firfluff Frostneedle Driftpine Sastrugi Juniper Snowtuft Hoarfir Flurryank Snowberry Rimefern Cottonrime Flakebriar Hailpearl Sleethook PaleSpruce Northwind Snowchimney Spindrift Firsnow Whitebough SnowLodestar DriftVeil FirstSnow'
  },
  {
    slug: 'opal-aurora', name: 'Opal Aurora Egg', habitat: 'frostpine', level: 6, cost: 270, basePower: 76, tierStep: 8, rotation: 16,
    description: 'An icy opal shell that carries a green and violet shimmer.',
    palette: ['#6c9cb0', '#6276b1', '#5c9f9b', '#916eaa'], accents: ['#baf4c5', '#cddfff', '#f5d2fa'],
    names: 'Polarflare Mirrorrime Opalbough Nighthaze Skythread Lumenfrost Halfglow Northmist Coldflare Highaura Irisveil BlueRibbon Pinelight NeonRime Halofern AuroraMist Skyfold Lightfall OpalWick NightRibbon BorealCrown VeilSinger NorthOrigin'
  },
  {
    slug: 'glacierheart', name: 'Glacierheart Egg', habitat: 'frostpine', level: 7, cost: 328, basePower: 90, tierStep: 9, rotation: 22,
    description: 'A steel-blue glacial shell with deep grooves cut by an ancient freeze.',
    palette: ['#59839d', '#6386a6', '#6581a7', '#769db3'], accents: ['#d1f7ff', '#c5efea', '#e4e8ff'],
    names: 'Felsen Berglace Crevassel Icegrain Chion Frostmill Moraine Alpenhorn Firnglint PolarClast Greave Shardgale Winterwhorl Icevein GlaceFog Glacierpetal Frostdive TundraRidge GlacierSkein Rimemantle ShiverCrown IceShade FirstThaw'
  },
  {
    slug: 'ashbloom', name: 'Ashbloom Egg', habitat: 'cinderbloom', level: 7, cost: 390, basePower: 98, tierStep: 10, rotation: 11,
    description: 'A dusty crimson shell from the flowers growing between warm stones.',
    palette: ['#955447', '#aa5953', '#685459', '#ad6b59'], accents: ['#ffa585', '#f2bbab', '#ffd49b'],
    names: 'Ashpetal Pyrestem Sootroot Coalrose Bedrock Dustring CinderFern Warmlichen Emberleaf Shatterbud Ashstave RedPomace Smokethistle Firebough Cinderpollen Hefe Stemcoal Brimclover Ashvine EmberBramble AshCrown SmokeWarden FirstAsh'
  },
  {
    slug: 'magma', name: 'Magma Egg', habitat: 'cinderbloom', level: 8, cost: 455, basePower: 117, tierStep: 12, rotation: 3,
    description: 'A basalt shell with orange lines that follow the magma channel.',
    palette: ['#945449', '#af503d', '#735569', '#ac6750'], accents: ['#ffd078', '#ffa576', '#ffb9a0'],
    names: 'Pahoehoe Spatter Lavawhorl Vesicle Conecrest Igneous Torchtide Furnacebank ScoriaCrag Tubevent RadiantSoot Magmalace InfernalBraid Lavafin Brimflare CinderPillar Calcine PyreBraid MagmaPlume CalderaRook MoltenCrown FireVeil FirstMagma'
  },
  {
    slug: 'starforged', name: 'Starforged Egg', habitat: 'cinderbloom', level: 9, cost: 545, basePower: 138, tierStep: 14, rotation: 18,
    description: 'A cooled lava shell whose dark surface catches tiny points of starlight.',
    palette: ['#625785', '#714b71', '#9c555d', '#5c6293'], accents: ['#ffcd91', '#ffad88', '#e7c7ff'],
    names: 'DustStar NovaCoal CinderOrbit Pyrolume Meteoroid StarGrain Ostra GlowVeil FlareGlass HearthOrbit Noctilux StellarHusk UmbralTide MercuryCinder TorchGalaxy FlareRoot NightForge MeteorFall Starcinder ReforgedHalo SolarCrown NebulaEmber ForgeOfDawn'
  }
];

const patterns = ['stripe', 'spot', 'wave', 'band', 'speckle'];
const crests = ['leaf', 'fin', 'tuft', 'horn', 'gem'];
const habitatById = new Map(BESTIARY_HABITATS.map(habitat => [habitat.id, habitat]));
const raritySlots = PET_RARITIES.flatMap((rarity, tier) => Array.from({ length: rarity.speciesCount }, (_, slot) => ({
  id: rarity.id, tier, weight: Math.floor(rarity.weight / rarity.speciesCount) + Number(slot < rarity.weight % rarity.speciesCount)
})));

function tintColor(color, accent, strength) {
  const first = Number.parseInt(color.slice(1), 16);
  const second = Number.parseInt(accent.slice(1), 16);
  const channels = [16, 8, 0].map(shift => {
    const start = (first >> shift) & 255;
    const end = (second >> shift) & 255;
    return Math.round(start + (end - start) * strength).toString(16).padStart(2, '0');
  });
  return '#' + channels.join('');
}

const setsWithSpecies = sets.map(set => {
  const habitat = habitatById.get(set.habitat);
  const eggId = set.slug + '-egg';
  const adjectives = set.names.split(' ');
  const region = habitat.biomeId ? { biomeId: habitat.biomeId } : {};
  const species = freezeRecords(raritySlots.map((rarity, index) => {
    const profile = BESTIARY_PROFILES[(index + set.rotation) % BESTIARY_PROFILES.length];
    const accent = set.accents[(index + set.rotation) % set.accents.length];
    const modifier = adjectives[index].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\bOf\b/g, 'of');
    return {
      id: set.slug + '-' + profile.shape, name: modifier + ' ' + profile.label,
      generation: habitat.generation, habitatId: habitat.id, eggId, bestiary: true, theme: set.slug, ...region,
      rarity: rarity.id, power: set.basePower + rarity.tier * set.tierStep + Math.floor(index / 4),
      shape: profile.shape, combatRole: profile.combatRole,
      color: tintColor(set.palette[index % set.palette.length], accent, .05 + (index % 5) * .045), accent,
      appearance: Object.freeze({ pattern: patterns[(index + 2 * set.rotation + rarity.tier) % patterns.length],
        crest: crests[(Math.floor(index / 3) + set.rotation + 2 * rarity.tier) % crests.length] })
    };
  }));
  return { species, egg: {
    id: eggId, name: set.name, description: set.description, cost: set.cost, level: set.level, generation: habitat.generation,
    color: set.palette[0], habitatId: habitat.id, bestiary: true, ...region,
    pool: freezeRecords(species.map((pet, index) => ({ speciesId: pet.id, weight: raritySlots[index].weight })))
  } };
});

export const BESTIARY_PETS = Object.freeze(setsWithSpecies.flatMap(set => set.species));
export const BESTIARY_EGGS = freezeRecords(setsWithSpecies.map(set => set.egg));
