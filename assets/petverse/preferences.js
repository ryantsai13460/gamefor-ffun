import { audioDefaults } from './sound.js';

export const soloKey = 'ffun-petverse-solo-v1';
export const preferencesKey = 'ffun-petverse-preferences-v1';

export function defaultPreferences() {
  return {
    reveal: { animations: true, skipCommon: false, results: true },
    notifications: { shiny: true, metallic: true, gold: true, diamond: true, obsidian: true, titanium: true, mythic: true, newPet: true },
    audio: { ...audioDefaults },
    graphics: {
      quality: 'medium', particles: 'medium', petGlow: true, shinyEffects: true, rareAnimations: true,
      showPeerPets: true, showPetNames: true, collectionNumbers: true, shake: false,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
    },
    inventory: { sort: 'power', showDuplicates: true }
  };
}

const availableValues = {
  quality: ['low', 'medium', 'high'],
  particles: ['off', 'low', 'medium', 'high'],
  sort: ['power', 'rarity', 'name', 'recent']
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
