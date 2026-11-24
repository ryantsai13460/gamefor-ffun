export const GENERATOR_SITE = Object.freeze({ id: 'generator', label: 'Operate Generator',
  type: 'generator', x: -14.78, z: 23.30, heading: Math.PI, radius: 2.6 });

const milliPerUnit = 1000;
const maxStored = 1_000_000_000;
const machines = [
  { name: 'Meadow flywheel', level: 1, rebirths: 0, speed: 8, capacity: 1 },
  { name: 'Fernwild compressor', level: 4, rebirths: 0, speed: 15, capacity: 2 },
  { name: 'Emberdeep reactor', level: 6, rebirths: 1, speed: 25, capacity: 3 }
];

export const GENERATOR_UPGRADES = [
  { id: 'generationSpeed', name: 'Flywheel speed', description: 'Adds 2 energy per second per rank.', costs: [32, 75, 144], level: 1 },
  { id: 'crankEfficiency', name: 'Crank efficiency', description: 'Raises energy production by 12% per rank.', costs: [42, 95, 180], level: 2 },
  { id: 'energyProduction', name: 'Crystal amplifier', description: 'Adds 3 energy per second per rank.', costs: [2, 5, 10], currency: 'crystals', level: 2 },
  { id: 'generatorCapacity', name: 'Charge reservoir', description: 'Stores one extra full egg charge per rank.', costs: [54, 125, 245], level: 2 },
  { id: 'generationProgress', name: 'Precision governor', description: 'Cuts the energy required per charge by 6 per rank.', costs: [65, 135, 250], level: 3 },
  { id: 'permanentGeneration', name: 'Ascension flywheel', description: 'Permanently adds 4 energy per second per rank.', costs: [2, 4, 8], currency: 'ascension', level: 3, rebirths: 1 },
  { id: 'rebirthGeneration', name: 'Ember conduit', description: 'Adds 5% production per rebirth per rank.', costs: [2, 5, 9], currency: 'ascension', level: 3, rebirths: 1 }
];

export const GENERATOR_ACHIEVEMENTS = [
  { id: 'generator-started', name: 'Turn the Flywheel', description: 'Operate the generator.', source: 'generatorOperations', target: 1, reward: 1, points: 10 },
  { id: 'generator-first-upgrade', name: 'Better Bearings', description: 'Purchase a generator upgrade.', source: 'generatorUpgradeRanks', target: 1, reward: 1, points: 15 },
  { id: 'generator-seven-upgrades', name: 'Machine Tuner', description: 'Purchase seven generator upgrade ranks.', source: 'generatorUpgradeRanks', target: 7, reward: 3, points: 45 },
  { id: 'generator-energy', name: 'Stored Lightning', description: 'Produce 500 energy.', source: 'generatorEnergy', target: 500, reward: 2, points: 25 },
  { id: 'generator-hatch', name: 'Charged Shell', description: 'Hatch three charged eggs.', source: 'generatorHatches', target: 3, reward: 2, points: 25 },
  { id: 'generator-assignment', name: 'Field Team', description: 'Assign your pets to a crystal field.', source: 'assignedAreas', target: 1, reward: 1, points: 10 },
  { id: 'generator-double-duty', name: 'Double Duty', description: 'Collect Gold from your pets during a crank session.', source: 'crankGold', target: 1, reward: 2, points: 25 },
  { id: 'generator-advanced', name: 'Workshop Engineer', description: 'Reach the Fernwild compressor tier.', source: 'generatorTier', target: 2, reward: 3, points: 35 },
  { id: 'generator-reborn', name: 'Ember Engineer', description: 'Hatch three charged eggs after rebirth.', source: 'rebirthGeneratorHatches', target: 3, reward: 3, points: 45 }
];

const counters = ['energy', 'produced', 'operations', 'hatches', 'rebirthHatches'];

export function createGeneratorProgress() {
  return { eggId: 'sunmeadow', energy: 0, produced: 0, operations: 0, hatches: 0, rebirthHatches: 0 };
}

export function restoreGeneratorProgress(value, eggs) {
  const generator = createGeneratorProgress();
  if (eggs?.some(egg => egg.id === value?.eggId)) generator.eggId = value.eggId;
  for (const key of counters) {
    const candidate = value?.[key];
    if (Number.isSafeInteger(candidate) && candidate >= 0) generator[key] = Math.min(maxStored, candidate);
  }
  return generator;
}

export function canOperateGenerator(position) {
  return Number.isFinite(position?.x) && Number.isFinite(position.z) &&
    Math.hypot(position.x - GENERATOR_SITE.x, position.z - GENERATOR_SITE.z) <= GENERATOR_SITE.radius;
}

export function generatorEggCost(egg) {
  return Math.ceil(egg.cost * .8);
}

export function generatorStats(progress) {
  const level = Math.floor((1 + Math.sqrt(1 + (progress.xp || 0) / 3)) / 2);
  const rebirths = progress.rebirths || 0;
  const machine = machines.findLast(item => level >= item.level && rebirths >= item.rebirths);
  const tier = machines.indexOf(machine) + 1;
  const generator = progress.generator || createGeneratorProgress();
  const upgrades = progress.upgrades || {};
  const rank = id => upgrades[id] || 0;
  const speed = Math.round((machine.speed + 2 * rank('generationSpeed') + 3 * rank('energyProduction') +
    4 * rank('permanentGeneration')) * (1 + .12 * rank('crankEfficiency') + rebirths * (.06 + .05 * rank('rebirthGeneration'))) * 100) / 100;
  const threshold = (100 - 6 * rank('generationProgress')) * milliPerUnit;
  const capacity = threshold * (machine.capacity + rank('generatorCapacity'));
  const energy = Math.min(generator.energy, capacity);
  return { ...generator, energy, level, tier, machine: machine.name, nextMachine: machines[tier], speed,
    threshold, capacity, ready: energy >= threshold, ratio: energy / capacity,
    upgradeRanks: GENERATOR_UPGRADES.reduce((total, item) => total + rank(item.id), 0) };
}

export const generatorPlan = generatorStats;

export function generatorAction(progress, action, { eggs, level, generation }) {
  const egg = eggs.find(item => item.id === action.eggId);
  if (!egg || level < egg.level || generation < egg.generation) {
    return { progress, event: { type: 'error', code: 'generator-egg-locked', message: 'Unlock this egg before selecting it for the generator.' } };
  }
  return { progress: { ...progress, generator: { ...progress.generator, eggId: egg.id } },
    event: { type: 'generator-selected', eggId: egg.id } };
}

export function markGeneratorStart(progress) {
  const generator = progress.generator || createGeneratorProgress();
  return { ...progress, generator: { ...generator, operations: Math.min(maxStored, generator.operations + 1) } };
}

export function advanceGenerator(progress, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return progress;
  const plan = generatorStats(progress);
  const amount = Math.min(plan.capacity - plan.energy, Math.round(plan.speed * Math.min(1000, elapsedMs)));
  if (amount <= 0) return progress;
  return { ...progress, generator: { ...progress.generator,
    energy: plan.energy + amount, produced: Math.min(maxStored, plan.produced + amount) } };
}

export function spendGeneratorCharge(progress, event) {
  const plan = generatorStats(progress);
  return { progress: { ...progress, generator: { ...progress.generator, energy: plan.energy - plan.threshold,
    hatches: Math.min(maxStored, plan.hatches + 1),
    rebirthHatches: Math.min(maxStored, plan.rebirthHatches + (progress.rebirths ? 1 : 0)) } },
    event: { ...event, fromGenerator: true } };
}
