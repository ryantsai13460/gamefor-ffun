export const audioDefaults = Object.freeze({
  master: .65,
  music: .25,
  ambient: .28,
  effects: .55,
  hatch: .54,
  rare: .62,
  ui: .28,
  enableMusic: true,
  enableAmbient: true,
  enableEffects: true,
  enableCrystalHits: true,
  enableCrystalBreaks: true,
  enableHatch: true,
  enableRare: true,
  enableTitanium: true,
  enableUI: true,
  muteBackground: true
});

const channels = {
  music: "enableMusic",
  ambient: "enableAmbient",
  effects: "enableEffects",
  hatch: "enableHatch",
  rare: "enableRare",
  ui: "enableUI"
};

// Each measure pairs a low arpeggio with a small, spacious melody.
const meadowScore = [
  [[50, 57, 62, 66], [[0, 74], [1.5, 78], [2.75, 76]]],
  [[47, 54, 62, 69], [[.5, 74], [2, 71]]],
  [[43, 55, 62, 66], [[0, 69], [1, 71], [2.5, 74]]],
  [[45, 57, 64, 71], [[1.25, 76], [2.75, 69]]],
  [[50, 57, 64, 69], [[0, 74], [1.5, 76], [2.5, 81]]],
  [[47, 54, 62, 66], [[.5, 78], [2, 74], [3, 71]]],
  [[43, 55, 62, 66], [[0, 69], [1.25, 74], [2.5, 76]]],
  [[45, 57, 64, 69], [[0, 78], [1.5, 76], [2.75, 74]]]
];
const beat = 60 / 86;
const habitatSounds = {
  meadow: { wind: 540, swell: .16, transpose: 0, pace: 1, calls: [88, 91, 86, 89], interval: 1 },
  glasswater: { wind: 320, swell: .35, transpose: 2, pace: 1.12, calls: [79, 85, 81, 83], interval: 1.05 },
  frostpine: { wind: 940, swell: .12, transpose: 5, pace: 1.27, calls: [91, 95, 90, 93], interval: 1.45 },
  cinderbloom: { wind: 180, swell: .21, transpose: -7, pace: 1.18, calls: [60, 67, 63, 68], interval: 1.38 }
};
const cueNotes = {
  ui: { channel: "ui", gap: .05, notes: [74], length: .10, gain: .12 },
  gather: { channel: "effects", gap: .065, notes: [69, 74], length: .21, gain: .135 },
  crystalHit: { channel: "effects", setting: "enableCrystalHits", gap: .034, notes: [71, 66], length: .095,
    gain: .035, oscillator: "triangle", interval: .36 },
  crystalBreak: { channel: "effects", setting: "enableCrystalBreaks", gap: .032, notes: [49, 64, 78], length: .22,
    gain: .075, oscillator: "triangle", interval: .28 },
  portal: { channel: "effects", gap: .085, notes: [55, 62, 71, 79], length: .37, gain: .075 },
  fusion: { channel: "hatch", gap: .055, notes: [62, 69, 77, 74, 81], length: .31, gain: .084 },
  upgrade: { channel: "effects", gap: .068, notes: [60, 67, 72], length: .19, gain: .085 },
  hatch: { channel: "hatch", gap: .095, notes: [62, 69, 74, 78], length: .38, gain: .14 },
  crank: { channel: "effects", gap: .09, notes: [33, 31], length: .13, gain: .065, oscillator: "triangle" },
  rare: { channel: "rare", gap: .085, notes: [66, 73, 78, 81, 86], length: .49, gain: .16 },
  titanium: { channel: "rare", gap: .10, notes: [43, 55, 62, 74, 79], length: .76, gain: .16 }
};

const midiFrequency = pitch => 440 * 2 ** ((pitch - 69) / 12);

export function createSound() {
  let settings = { ...audioDefaults };
  let context;
  let output;
  let foreground;
  let buses;
  let timer;
  let wind;
  let windFilter;
  let windSwell;
  let habitat = habitatSounds.meadow;
  let nextMeasure;
  let nextBird;
  let measure = 0;
  let bird = 0;
  let disposed = false;
  const previousGains = new WeakMap();
  const lastCue = new Map();

  function smooth(parameter, level) {
    if (previousGains.get(parameter) === level) return;
    previousGains.set(parameter, level);
    const time = context.currentTime;
    parameter.cancelScheduledValues(time);
    parameter.setTargetAtTime(level, time, .025);
  }

  function mutedInBackground() {
    return settings.muteBackground && document.hidden;
  }

  function channelEnabled(channel) {
    return settings[channels[channel]] && settings[channel] > 0;
  }

  function tone(bus, pitch, time, duration, level, kind = "sine", endPitch = pitch) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = kind;
    oscillator.frequency.setValueAtTime(midiFrequency(pitch), time);
    if (endPitch !== pitch) {
      oscillator.frequency.exponentialRampToValueAtTime(midiFrequency(endPitch), time + duration * .75);
    }
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(level, time + Math.min(.045, duration * .23));
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope).connect(bus);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      envelope.disconnect();
    }, { once: true });
    oscillator.start(time);
    oscillator.stop(time + duration + .025);
  }

  function startWind() {
    const samples = Math.round(context.sampleRate * 2.6);
    const buffer = context.createBuffer(1, samples, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 218107;
    for (let index = 0; index < samples; index++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[index] = (seed >>> 0) / 2147483648 - 1;
    }
    wind = context.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    windFilter = context.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = habitat.wind;
    windFilter.Q.value = .47;
    const air = context.createGain();
    air.gain.value = .065;
    windSwell = context.createOscillator();
    windSwell.frequency.value = habitat.swell;
    const depth = context.createGain();
    depth.gain.value = .025;
    windSwell.connect(depth).connect(air.gain);
    wind.connect(windFilter).connect(air).connect(buses.ambient);
    wind.start();
    windSwell.start();
  }

  function setHabitat(id) {
    const next = Object.hasOwn(habitatSounds, id) ? habitatSounds[id] : habitatSounds.meadow;
    if (next === habitat || disposed) return;
    habitat = next;
    nextBird = undefined;
    if (windFilter) {
      windFilter.frequency.setTargetAtTime(habitat.wind, context.currentTime, .45);
      windSwell.frequency.setTargetAtTime(habitat.swell, context.currentTime, .45);
    }
  }

  function tick() {
    const now = context.currentTime;
    if (channelEnabled("music")) {
      if (nextMeasure === undefined || nextMeasure < now - .24) nextMeasure = now + .05;
      if (nextMeasure < now + .22) {
        const [arpeggio, melody] = meadowScore[measure];
        const start = Math.max(nextMeasure, now + .008);
        const regionalBeat = beat * habitat.pace;
        arpeggio.forEach((pitch, step) => tone(buses.music, pitch + habitat.transpose, start + step * regionalBeat, 1.22, step ? .08 : .11));
        melody.forEach(([step, pitch]) => {
          const at = start + step * regionalBeat;
          tone(buses.music, pitch + habitat.transpose, at, 1.05, .085);
          tone(buses.music, pitch + habitat.transpose + 12, at, .22, .013);
        });
        measure = (measure + 1) % meadowScore.length;
        nextMeasure = start + 4 * regionalBeat;
      }
    } else nextMeasure = undefined;

    if (channelEnabled("ambient")) {
      if (nextBird === undefined) nextBird = now + 2.5;
      if (nextBird < now + .15) {
        const at = Math.max(nextBird, now + .025);
        const pitch = habitat.calls[bird];
        tone(buses.ambient, pitch, at, .19, .028, "sine", pitch + 4);
        tone(buses.ambient, pitch + 1, at + .22, .17, .021, "sine", pitch - 3);
        nextBird = at + [8.4, 12.1, 7.6, 10.9][bird] * habitat.interval;
        bird = (bird + 1) % 4;
      }
    } else nextBird = undefined;
  }

  function synchronize() {
    if (!context || disposed) return;
    const muted = mutedInBackground();
    smooth(output.gain, settings.master);
    smooth(foreground.gain, muted ? 0 : 1);
    for (const [channel, bus] of Object.entries(buses)) {
      smooth(bus.gain, settings[channels[channel]] ? settings[channel] : 0);
    }
    const listening = context.state === "running" && !muted && settings.master > 0;
    if (listening && channelEnabled("ambient") && !wind) startWind();
    if (listening && (channelEnabled("music") || channelEnabled("ambient"))) {
      if (timer === undefined) {
        tick();
        timer = setInterval(tick, 95);
      }
    } else {
      clearInterval(timer);
      timer = undefined;
      nextMeasure = undefined;
      nextBird = undefined;
    }
  }

  function configure(value) {
    if (!value || disposed) return;
    for (const [key, fallback] of Object.entries(audioDefaults)) {
      if (typeof fallback === "boolean" && typeof value[key] === "boolean") {
        settings[key] = value[key];
      } else if (typeof fallback === "number" && Number.isFinite(value[key])) {
        settings[key] = Math.max(0, Math.min(1, value[key]));
      }
    }
    synchronize();
  }

  async function unlock() {
    if (disposed) return false;
    try {
      if (!context) {
        const AudioContextType = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextType) return false;
        context = new AudioContextType();
        output = context.createGain();
        foreground = context.createGain();
        output.gain.value = settings.master;
        foreground.gain.value = mutedInBackground() ? 0 : 1;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 18;
        compressor.ratio.value = 2.5;
        output.connect(foreground).connect(compressor).connect(context.destination);
        buses = Object.fromEntries(Object.entries(channels).map(([channel, enabled]) => {
          const bus = context.createGain();
          bus.gain.value = settings[enabled] ? settings[channel] : 0;
          bus.connect(output);
          return [channel, bus];
        }));
        context.addEventListener("statechange", synchronize);
        document.addEventListener("visibilitychange", synchronize);
      }
      // Calling resume before yielding preserves the caller's click activation.
      if (context.state !== "running") await context.resume();
      synchronize();
      return !disposed && context?.state === "running";
    } catch {
      return false;
    }
  }

  function play(cue) {
    const effect = Object.hasOwn(cueNotes, cue) && cueNotes[cue];
    if (!effect || (effect.setting && !settings[effect.setting]) || (cue === "titanium" && !settings.enableTitanium) ||
        disposed || context?.state !== "running" || mutedInBackground() ||
        settings.master === 0 || !channelEnabled(effect.channel)) return;
    const now = context.currentTime;
    if (now - (lastCue.get(cue) ?? -10) < (effect.interval ?? .10)) return;
    lastCue.set(cue, now);
    effect.notes.forEach((pitch, index) => {
      const time = now + .008 + index * effect.gap;
      tone(buses[effect.channel], pitch, time, effect.length, effect.gain, effect.oscillator);
      if (cue === "rare" || cue === "titanium") tone(buses.rare, pitch + 12, time, .24, .028);
    });
  }

  function destroy() {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    if (!context) return;
    document.removeEventListener("visibilitychange", synchronize);
    context.removeEventListener("statechange", synchronize);
    if (context.state !== "closed") void context.close().catch(() => {});
    context = undefined;
    wind = undefined;
    windFilter = undefined;
    windSwell = undefined;
    buses = undefined;
    foreground = undefined;
    output = undefined;
  }

  return { configure, unlock, play, setHabitat, destroy };
}
