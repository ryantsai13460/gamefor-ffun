import { audioDefaults } from './sound.js?v=20261125-1';

export const soloKey = 'ffun-petverse-solo-v1';
export const preferencesKey = 'ffun-petverse-preferences-v1';

export const shiftLockKeys = Object.freeze([['ShiftLeft', 'Left Shift'], ['ShiftRight', 'Right Shift'],
  ['KeyQ', 'Q'], ['KeyC', 'C'], ['KeyV', 'V']]);
export const sprintKeys = Object.freeze([['KeyR', 'R'], ['KeyX', 'X'], ['KeyZ', 'Z'], ['KeyB', 'B']]);

export function defaultPreferences() {
  return {
    reveal: { animations: true, skipCommon: false, results: true, titaniumAnimation: true },
    notifications: { shiny: true, metallic: true, gold: true, diamond: true, obsidian: true, titanium: true, mythic: true,
      giant: true, newPet: true },
    audio: { ...audioDefaults },
    graphics: {
      quality: 'medium', particles: 'medium', shadows: true, petGlow: true, shinyEffects: true, rareAnimations: true,
      showPeerPets: true, showPeerTitanium: true, showPeerGiants: true, giantEffects: true,
      showPetNames: true, collectionNumbers: true, shake: false, cameraSensitivity: .5, cameraDistance: .5,
      resolution: .5, drawDistance: .5, shadowQuality: 'medium', textureQuality: 'medium', antiAliasing: true, bloom: false,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
    },
    controls: { shiftLockEnabled: true, shiftLockKey: 'ShiftLeft', sprintEnabled: true, sprintKey: 'KeyR' },
    hatching: { autoLimit: 'none' },
    inventory: { sort: 'power', showDuplicates: true },
    workshop: { keepAssigned: true, recallOnWorldChange: false, generatorSounds: true, crankAnimations: true,
      showProgress: true, showRemoteRewards: true, showIncome: true, showPetActivity: true }
  };
}

const availableValues = {
  quality: ['low', 'medium', 'high', 'ultra'],
  shadowQuality: ['low', 'medium', 'high', 'ultra'],
  textureQuality: ['low', 'medium', 'high'],
  particles: ['off', 'low', 'medium', 'high'],
  shiftLockKey: shiftLockKeys.map(([key]) => key),
  sprintKey: sprintKeys.map(([key]) => key),
  autoLimit: ['none', '10', '25', '50', '100'],
  sort: ['power', 'rarity', 'name', 'recent', 'generation', 'variant']
};

export function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

export function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function readPreferences() {
  const stored = readStorage(preferencesKey);
  const defaults = defaultPreferences();
  for (const [group, fields] of Object.entries(defaults)) {
    for (const [id, fallback] of Object.entries(fields)) {
      const value = stored?.[group]?.[id];
      if (typeof fallback === 'boolean' && typeof value === 'boolean') fields[id] = value;
      if (typeof fallback === 'number' && Number.isFinite(value)) fields[id] = Math.max(0, Math.min(1, value));
      if (availableValues[id]?.includes(value)) fields[id] = value;
    }
  }
  return defaults;
}
