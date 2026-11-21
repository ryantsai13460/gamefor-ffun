const TRACKS = [
  {
    name: 'Blue Hour',
    tempo: 68,
    beatsPerBar: 4,
    keys: 'electric',
    pad: 'soft',
    chords: [
      ['D2', 'F#3', 'A3', 'C#4', 'E4'],
      ['C#2', 'E3', 'A3', 'B3', 'E4'],
      ['B1', 'F#3', 'A3', 'B3', 'D4'],
      ['G1', 'F#3', 'G3', 'B3', 'D4'],
      ['D2', 'F#3', 'A3', 'C#4', 'E4'],
      ['A1', 'E3', 'A3', 'B3', 'C#4'],
      ['B1', 'F#3', 'A3', 'B3', 'D4'],
      ['G1', 'F#3', 'A3', 'B3', 'D4']
    ],
    melodies: [
      [[.5, 'A4'], [2, 'C#5'], [3.25, 'E5']],
      [[.5, 'E5'], [1.75, 'B4'], [3, 'A4']],
      [[0, 'F#4'], [1.5, 'A4'], [2.75, 'D5']],
      [[.5, 'B4'], [2.5, 'A4']],
      [[0, 'A4'], [1.5, 'D5'], [3, 'F#5']],
      [[.5, 'E5'], [2.5, 'C#5']],
      [[0, 'B4'], [1.75, 'F#4'], [3, 'A4']],
      [[1, 'G4'], [3.25, 'E4']]
    ]
  },
  {
    name: 'Moss Signal',
    tempo: 58,
    beatsPerBar: 3,
    keys: 'glass',
    pad: 'soft',
    echo: .72,
    chords: [
      ['G1', 'D3', 'G3', 'A3', 'Bb3'],
      ['Eb2', 'G3', 'Bb3', 'D4'],
      ['C2', 'G3', 'Bb3', 'D4', 'Eb4'],
      ['D2', 'F3', 'G3', 'A3'],
      ['G1', 'D3', 'A3', 'Bb3', 'D4'],
      ['Eb2', 'G3', 'A3', 'Bb3', 'D4'],
      ['C2', 'G3', 'Bb3', 'C4', 'Eb4'],
      ['D2', 'F3', 'A3', 'C4']
    ],
    melodies: [
      [[.2, 'D5'], [2.25, 'A4']],
      [[.4, 'Bb4'], [1.65, 'G5']],
      [[1, 'D5'], [2.6, 'Eb5']],
      [[.4, 'A4'], [1.85, 'F5']],
      [[.25, 'G5'], [1.4, 'D5']],
      [[.65, 'Bb4'], [2.1, 'F5']],
      [[0, 'Eb5'], [1.8, 'D5']],
      [[.8, 'C5'], [2.4, 'A4']]
    ]
  },
  {
    name: 'Night Transit',
    tempo: 87,
    beatsPerBar: 4,
    keys: 'pulse',
    pad: 'haze',
    groove: true,
    chords: [
      ['E2', 'G3', 'B3', 'D4', 'F#4'],
      ['F#2', 'A3', 'C#4', 'E4'],
      ['G2', 'B3', 'D4', 'F#4'],
      ['A1', 'G3', 'B3', 'C#4', 'E4'],
      ['E2', 'G3', 'B3', 'D4', 'F#4'],
      ['F#2', 'A3', 'C#4', 'E4'],
      ['G2', 'B3', 'D4', 'F#4'],
      ['A1', 'G3', 'B3', 'C#4', 'E4']
    ],
    melodies: [
      [[.75, 'B4'], [1.75, 'D5'], [2.5, 'F#5'], [3.25, 'B4']],
      [[.5, 'C#5'], [1.5, 'A4'], [3, 'E5']],
      [[.75, 'D5'], [2, 'F#5'], [3.25, 'G5']],
      [[.5, 'E5'], [1.5, 'C#5'], [2.75, 'B4']],
      [[.75, 'B4'], [1.75, 'D5'], [2.5, 'E5'], [3.25, 'F#5']],
      [[.5, 'A4'], [1.5, 'C#5'], [3, 'E5']],
      [[1, 'G5'], [2, 'D5'], [3.25, 'B4']],
      [[.5, 'C#5'], [1.75, 'E5'], [3, 'G4']]
    ]
  }
];

const TIMBRES = {
  electric: { attack: .018, release: .48, partials: [[1, .82], [2, .12], [3.015, .045]] },
  glass: { attack: .012, release: .65, partials: [[1, .62], [2.005, .19], [3.99, .10], [5.12, .033]] },
  pulse: { attack: .015, release: .19, partials: [[1, .7, 'triangle'], [2, .13], [4, .032]] },
  soft: { attack: .62, release: 1.18, partials: [[1, .66], [.998, .21, 'triangle'], [2, .07]] },
  haze: { attack: .34, release: .64, partials: [[1, .62, 'triangle'], [1.004, .21], [2, .07]] },
  bass: { attack: .055, release: .58, partials: [[1, .83], [2, .105, 'triangle']] },
  kick: { attack: .007, release: .12, partials: [[1, .89], [2, .055]] }
};
const SEMITONES = {C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, A: 9, Bb: 10, B: 11};
const SAMPLE_RATE = 24000;

function frequency(note) {
  const octave = Number(note.at(-1));
  const midi = 12 * (octave + 1) + SEMITONES[note.slice(0, -1)];
  return 440 * 2 ** ((midi - 69) / 12);
}

function tone(context, output, {note, time, length, voice, level, pan = 0}) {
  const {attack, release, partials} = TIMBRES[voice];
  const amp = context.createGain();
  amp.gain.setValueAtTime(.0001, time);
  amp.gain.exponentialRampToValueAtTime(level, time + attack);
  amp.gain.exponentialRampToValueAtTime(level * .37, time + attack + length * .58);
  amp.gain.exponentialRampToValueAtTime(.0001, time + attack + length + release);
  if (pan && typeof context.createStereoPanner === 'function') {
    const balance = context.createStereoPanner();
    balance.pan.value = pan;
    amp.connect(balance).connect(output);
  } else {
    amp.connect(output);
  }
  const pitch = frequency(note);
  for (const [ratio, weight, type = 'sine'] of partials) {
    const oscillator = context.createOscillator();
    const partial = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = pitch * ratio;
    partial.gain.value = weight;
    oscillator.connect(partial).connect(amp);
    oscillator.start(time);
    oscillator.stop(time + attack + length + release);
  }
}

async function renderLoop(OfflineContext, track) {
  const beat = 60 / track.tempo;
  const barLength = track.beatsPerBar * beat;
  const frames = Math.round(track.chords.length * barLength * SAMPLE_RATE);
  const duration = frames / SAMPLE_RATE;
  const context = new OfflineContext(2, frames * 2, SAMPLE_RATE);
  const output = context.createGain();
  output.gain.value = 1.95;
  output.connect(context.destination);

  for (let cycle = 0; cycle < 2; cycle++) {
    track.chords.forEach(([bass, ...chord], bar) => {
      const start = cycle * duration + bar * barLength;
      tone(context, output, {
        note: bass, time: start, length: track.groove ? .98 * beat : .74 * barLength,
        voice: 'bass', level: track.groove ? .16 : .11
      });
      chord.forEach((note, index) => tone(context, output, {
        note, time: start + index * .025, length: .79 * barLength, voice: track.pad,
        level: .043, pan: (index - 1.5) * .33
      }));
      track.melodies[bar].forEach(([position, note], index) => {
        const time = start + position * beat;
        const pan = index % 2 ? .29 : -.29;
        tone(context, output, {note, time, length: .40 * beat, voice: track.keys, level: .145, pan});
        if (track.echo) tone(context, output, {
          note, time: time + track.echo * beat, length: .28 * beat, voice: track.keys, level: .036, pan: -pan
        });
      });
      if (track.groove) {
        tone(context, output, {note: bass, time: start + 2.5 * beat, length: .45 * beat, voice: 'bass', level: .12});
        for (const position of [0, 2.5]) {
          tone(context, output, {note: 'E1', time: start + position * beat, length: .08, voice: 'kick', level: .088});
        }
      }
    });
  }
  // The second cycle includes the note tails from the previous cycle.
  const rendered = await context.startRendering();
  const loop = context.createBuffer(2, frames, SAMPLE_RATE);
  for (let channel = 0; channel < 2; channel++) {
    loop.copyToChannel(rendered.getChannelData(channel).subarray(frames, frames * 2), channel);
  }
  return loop;
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

export function mountBlipMusic(target) {
  const panel = element('section', 'blip-music');
  const heading = element('div', 'blip-music-header');
  const title = element('h2', '', 'Background music');
  const play = element('button', 'button blip-music-toggle', 'Play music');
  play.type = 'button';
  heading.append(title, play);
  const controls = element('div', 'blip-music-controls');
  const trackLabel = element('label', '', 'Track');
  const track = element('select', 'field');
  for (const [index, tune] of TRACKS.entries()) {
    const item = element('option', '', tune.name);
    item.value = String(index);
    track.append(item);
  }
  trackLabel.append(track);
  const volumeLabel = element('label');
  const volumeCaption = element('span', 'blip-music-volume-label', 'Volume');
  const volumeValue = element('span', 'blip-music-volume-value', '30%');
  volumeValue.setAttribute('aria-hidden', 'true');
  volumeCaption.append(volumeValue);
  const slider = element('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = '30';
  slider.setAttribute('aria-label', 'Music volume');
  slider.setAttribute('aria-valuetext', '30%');
  volumeLabel.append(volumeCaption, slider);
  controls.append(trackLabel, volumeLabel);
  const status = element('p', 'blip-music-status', 'Music is off.');
  status.setAttribute('role', 'status');
  panel.append(heading, controls, status);
  target.append(panel);

  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!AudioContextType || !OfflineContext) {
    play.disabled = track.disabled = slider.disabled = true;
    status.textContent = 'Background music is unavailable in this browser.';
    return () => panel.remove();
  }

  const loops = new Map();
  let context;
  let master;
  let playing;
  let position = 0;
  let enabled = false;
  let closed = false;
  let generation = 0;

  const volume = () => (Number(slider.value) / 100) ** 1.12;
  function prepareContext() {
    if (context) return;
    context = new AudioContextType();
    master = context.createGain();
    master.gain.value = volume();
    master.connect(context.destination);
  }

  function stopSound(reset = false) {
    if (playing) {
      const {source, gain, start, offset} = playing;
      const now = context.currentTime;
      position = (offset + now - start) % source.buffer.duration;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + .045);
      source.stop(now + .05);
      playing = null;
    }
    if (reset) position = 0;
  }

  async function start() {
    const version = ++generation;
    const selected = Number(track.value);
    const tune = TRACKS[selected];
    enabled = true;
    play.textContent = 'Pause music';
    status.textContent = `Preparing ${tune.name}…`;
    try {
      prepareContext();
      const resumed = context.resume();
      if (!loops.has(selected)) {
        loops.set(selected, renderLoop(OfflineContext, tune).catch((error) => {
          loops.delete(selected);
          throw error;
        }));
      }
      const [, buffer] = await Promise.all([resumed, loops.get(selected)]);
      if (closed || version !== generation) return;
      const gain = context.createGain();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain).connect(master);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + .08);
      source.start(now, position);
      playing = {source, gain, start: now, offset: position};
      status.textContent = `Playing ${tune.name}.`;
    } catch {
      if (closed || version !== generation) return;
      enabled = false;
      play.textContent = 'Play music';
      status.textContent = 'Music could not start. Try Play music again.';
    }
  }

  play.addEventListener('click', () => {
    if (!enabled) {
      start();
      return;
    }
    generation++;
    enabled = false;
    stopSound();
    play.textContent = 'Play music';
    status.textContent = 'Music paused.';
  });

  track.addEventListener('change', () => {
    stopSound(true);
    if (enabled) start();
  });

  slider.addEventListener('input', () => {
    const display = `${slider.value}%`;
    volumeValue.textContent = display;
    slider.setAttribute('aria-valuetext', display);
    if (master) master.gain.setTargetAtTime(volume(), context.currentTime, .04);
  });

  return () => {
    if (closed) return;
    closed = true;
    generation++;
    stopSound(true);
    loops.clear();
    if (context && context.state !== 'closed') context.close().catch(() => {});
    panel.remove();
  };
}
