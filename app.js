const $ = (id) => document.getElementById(id);

const ui = {
  play: $('playButton'),
  stop: $('stopButton'),
  mode: $('mode'),
  minutes: $('minutes'),
  adhd: $('adhd'),
  adhdValue: $('adhdValue'),
  volume: $('volume'),
  volumeValue: $('volumeValue'),
  musicAmount: $('musicAmount'),
  musicAmountValue: $('musicAmountValue'),
  melodyPattern: $('melodyPattern'),
  melodyClarity: $('melodyClarity'),
  melodyClarityValue: $('melodyClarityValue'),
  songFeel: $('songFeel'),
  groove: $('groove'),
  grooveValue: $('grooveValue'),
  noise: $('noise'),
  pulse: $('pulse'),
  musicBits: $('musicBits'),
  binaural: $('binaural'),
  timeLeft: $('timeLeft'),
  status: $('status'),
};

const presets = {
  deep: {
    root: 110,
    chord: [1, 1.5, 2, 2.5],
    bpm: 54,
    filter: 760,
    pulseDepth: 0.12,
    scale: [0, 3, 5, 7, 10, 12, 15],
    pattern: [0, 2, 4, 2, 5, 4, 2, 1],
  },
  coding: {
    root: 130.81,
    chord: [1, 1.25, 1.5, 2],
    bpm: 72,
    filter: 980,
    pulseDepth: 0.18,
    scale: [0, 2, 3, 7, 9, 12, 14],
    pattern: [0, 2, 4, 6, 4, 2, 3, 1],
  },
  reading: {
    root: 98,
    chord: [1, 1.333, 1.5, 2],
    bpm: 48,
    filter: 620,
    pulseDepth: 0.08,
    scale: [0, 2, 5, 7, 9, 12, 14],
    pattern: [0, 1, 3, 1, 4, 3, 1, 0],
  },
  energy: {
    root: 146.83,
    chord: [1, 1.25, 1.667, 2],
    bpm: 88,
    filter: 1280,
    pulseDepth: 0.24,
    scale: [0, 2, 4, 7, 9, 12, 16],
    pattern: [0, 2, 4, 5, 6, 4, 2, 3],
  },
};

let audio = null;
let timer = null;
let endAt = 0;
let remainingSeconds = 25 * 60;

function makeBrownNoise(ctx) {
  const bufferSize = 4096;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);
  let lastOut = 0;
  node.onaudioprocess = (event) => {
    const output = event.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }
  };
  return node;
}

function createEngine() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  const lowpass = ctx.createBiquadFilter();
  const musicDelay = ctx.createDelay(1.2);
  const musicFeedback = ctx.createGain();
  const musicWet = ctx.createGain();

  master.gain.value = 0;
  lowpass.type = 'lowpass';
  lowpass.Q.value = 0.7;

  // A very small echo makes the note bits feel musical without adding busy melodies.
  musicDelay.delayTime.value = 0.28;
  musicFeedback.gain.value = 0.18;
  musicWet.gain.value = 0.22;
  musicDelay.connect(musicFeedback).connect(musicDelay);
  musicDelay.connect(musicWet).connect(lowpass);

  lowpass.connect(compressor);
  compressor.connect(master);
  master.connect(ctx.destination);

  return {
    ctx,
    master,
    lowpass,
    musicDelay,
    oscillators: [],
    gains: [],
    lfos: [],
    noiseNode: null,
    pulseTimer: null,
    musicTimer: null,
    melodyTimer: null,
    arrangementTimer: null,
    tone: null,
    musicStep: 0,
    melodyStep: 0,
    arrangementStep: 0,
  };
}

function startPads(engine, preset, stimulation) {
  preset.chord.forEach((ratio, index) => {
    const osc = engine.ctx.createOscillator();
    const gain = engine.ctx.createGain();
    const lfo = engine.ctx.createOscillator();
    const lfoGain = engine.ctx.createGain();

    osc.type = index % 2 ? 'triangle' : 'sine';
    osc.frequency.value = preset.root * ratio;
    gain.gain.value = 0.035 + stimulation * 0.00035;

    lfo.type = 'sine';
    lfo.frequency.value = 0.025 + index * 0.011;
    lfoGain.gain.value = 1.2 + stimulation * 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);

    osc.connect(gain).connect(engine.lowpass);
    osc.start();
    lfo.start();
    engine.oscillators.push(osc);
    engine.gains.push(gain);
    engine.lfos.push(lfo);
  });
}

function startNoise(engine, stimulation) {
  if (!ui.noise.checked) return;
  const noise = makeBrownNoise(engine.ctx);
  const filter = engine.ctx.createBiquadFilter();
  const gain = engine.ctx.createGain();
  filter.type = 'lowpass';
  filter.frequency.value = 340 + stimulation * 8;
  gain.gain.value = 0.055;
  noise.connect(filter).connect(gain).connect(engine.lowpass);
  engine.noiseNode = noise;
}

function startPulse(engine, preset, stimulation) {
  if (!ui.pulse.checked) return;
  const interval = 60000 / preset.bpm;
  const gain = engine.ctx.createGain();
  const osc = engine.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = preset.root / 2;
  gain.gain.value = 0;
  osc.connect(gain).connect(engine.lowpass);
  osc.start();
  engine.oscillators.push(osc);
  engine.gains.push(gain);

  engine.pulseTimer = setInterval(() => {
    const now = engine.ctx.currentTime;
    const depth = preset.pulseDepth * (0.45 + stimulation / 100);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(depth, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(0.42, interval / 1700));
  }, interval);
}

function noteFrequency(root, semitones, octave = 1) {
  return root * octave * Math.pow(2, semitones / 12);
}

function playPluck(engine, frequency, amount, stimulation, accent = 1) {
  const now = engine.ctx.currentTime;
  const osc = engine.ctx.createOscillator();
  const gain = engine.ctx.createGain();
  const filter = engine.ctx.createBiquadFilter();
  const pan = engine.ctx.createStereoPanner();

  osc.type = stimulation > 70 ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(frequency, now);
  osc.detune.setValueAtTime((Math.random() - 0.5) * 7, now);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900 + amount * 15 + stimulation * 8, now);
  filter.Q.value = 1.1;

  pan.pan.value = (Math.random() - 0.5) * 0.42;

  const peak = (0.012 + amount * 0.00055) * accent;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42 + amount * 0.006);

  osc.connect(filter).connect(gain);
  gain.connect(pan).connect(engine.lowpass);
  gain.connect(engine.musicDelay);

  osc.start(now);
  osc.stop(now + 1.35);
}

function startMusicBits(engine, preset, stimulation) {
  if (!ui.musicBits.checked) return;

  const beatMs = 60000 / preset.bpm;
  const interval = Math.max(160, beatMs / (stimulation > 70 ? 2 : 1));

  engine.musicTimer = setInterval(() => {
    if (!ui.musicBits.checked) return;
    const amount = Number(ui.musicAmount.value);
    if (amount <= 0) return;

    const density = 0.34 + amount / 180 + stimulation / 260;
    const isRest = Math.random() > density;
    const step = engine.musicStep++;

    if (isRest && step % 8 !== 0) return;

    const patternIndex = preset.pattern[step % preset.pattern.length];
    const semitone = preset.scale[patternIndex % preset.scale.length];
    const octave = step % 16 >= 12 ? 2 : 1;
    const frequency = noteFrequency(preset.root, semitone, octave);
    const accent = step % 8 === 0 ? 1.28 : 1;

    playPluck(engine, frequency, amount, stimulation, accent);

    // Occasional soft harmony note, quiet enough to add music without stealing attention.
    if (amount > 58 && step % 8 === 4) {
      playPluck(engine, noteFrequency(preset.root, preset.scale[(patternIndex + 2) % preset.scale.length], octave), amount * 0.55, stimulation, 0.65);
    }
  }, interval);
}


const melodyMotifs = {
  simple: [0, 2, 4, 2, 0, 2, 5, 4],
  ascending: [0, 1, 2, 4, 5, 4, 2, 1],
  call: [0, 2, 4, -1, 4, 5, 2, -1],
  minimal: [0, -1, 2, -1, 0, -1, 2, -1],
};

function startClearMelody(engine, preset, stimulation) {
  const selected = ui.melodyPattern.value;
  if (selected === 'none') return;

  const motif = melodyMotifs[selected] || melodyMotifs.simple;
  const beatMs = 60000 / preset.bpm;
  const stepMs = beatMs * 1.25;

  engine.melodyTimer = setInterval(() => {
    const selectedNow = ui.melodyPattern.value;
    if (selectedNow === 'none') return;

    const currentMotif = melodyMotifs[selectedNow] || melodyMotifs.simple;
    const clarity = Number(ui.melodyClarity.value);
    if (clarity <= 0) return;

    const step = engine.melodyStep++;
    const motifValue = currentMotif[step % currentMotif.length];
    if (motifValue < 0) return;

    const phrase = Math.floor(step / currentMotif.length) % 4;
    const variation = phrase === 3 && step % currentMotif.length === currentMotif.length - 1 ? 1 : 0;
    const scaleIndex = Math.min(preset.scale.length - 1, motifValue + variation);
    const semitone = preset.scale[scaleIndex];
    const octave = 2;
    const frequency = noteFrequency(preset.root, semitone, octave);
    const accent = step % currentMotif.length === 0 ? 1.38 : 1.05;

    playMelodyNote(engine, frequency, clarity, stimulation, accent);
  }, stepMs);
}

function playMelodyNote(engine, frequency, clarity, stimulation, accent = 1) {
  const now = engine.ctx.currentTime;
  const osc = engine.ctx.createOscillator();
  const gain = engine.ctx.createGain();
  const filter = engine.ctx.createBiquadFilter();
  const pan = engine.ctx.createStereoPanner();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(frequency, now);
  osc.detune.setValueAtTime((Math.random() - 0.5) * 3, now);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1150 + clarity * 18 + stimulation * 4, now);
  filter.Q.value = 1.6;
  pan.pan.value = (Math.random() - 0.5) * 0.18;

  const peak = (0.018 + clarity * 0.00062) * accent;
  const sustain = peak * (0.28 + clarity / 320);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.024);
  gain.gain.exponentialRampToValueAtTime(sustain, now + 0.17);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.74 + clarity * 0.003);

  osc.connect(filter).connect(gain);
  gain.connect(pan).connect(engine.lowpass);
  gain.connect(engine.musicDelay);
  osc.start(now);
  osc.stop(now + 1.4);
}


const progressions = {
  deep: [0, 5, 3, 6],
  coding: [0, 4, 5, 3],
  reading: [0, 3, 5, 4],
  energy: [0, 5, 2, 4],
};

const songMotifs = {
  ambient: [0, -1, 2, -1, 4, 2, -1, 1, 0, -1, 2, 4, 5, -1, 4, 2],
  lofi: [0, 2, -1, 4, 2, -1, 0, 1, 3, -1, 2, 0, -1, 4, 2, -1],
  synth: [0, 2, 4, 2, 5, 4, 2, 0, 0, 3, 5, 3, 6, 5, 3, 1],
};

function scaleTone(preset, index, octave = 1) {
  const safe = ((index % preset.scale.length) + preset.scale.length) % preset.scale.length;
  return noteFrequency(preset.root, preset.scale[safe], octave);
}

function playKick(engine, strength = 0.45) {
  const now = engine.ctx.currentTime;
  const osc = engine.ctx.createOscillator();
  const gain = engine.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(92, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(strength, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.connect(gain).connect(engine.lowpass);
  osc.start(now);
  osc.stop(now + 0.28);
}

function playHat(engine, strength = 0.05) {
  const now = engine.ctx.currentTime;
  const noise = makeBrownNoise(engine.ctx);
  const filter = engine.ctx.createBiquadFilter();
  const gain = engine.ctx.createGain();
  filter.type = 'highpass';
  filter.frequency.value = 5200;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(strength, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  noise.connect(filter).connect(gain).connect(engine.lowpass);
  setTimeout(() => noise.disconnect(), 120);
}

function playBass(engine, frequency, strength = 0.12) {
  const now = engine.ctx.currentTime;
  const osc = engine.ctx.createOscillator();
  const gain = engine.ctx.createGain();
  const filter = engine.ctx.createBiquadFilter();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(frequency, now);
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(strength, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
  osc.connect(filter).connect(gain).connect(engine.lowpass);
  osc.start(now);
  osc.stop(now + 0.55);
}

function playChord(engine, preset, chordRootIndex, amount = 0.12) {
  const chord = [0, 2, 4, 6];
  chord.forEach((offset, i) => {
    const now = engine.ctx.currentTime;
    const osc = engine.ctx.createOscillator();
    const gain = engine.ctx.createGain();
    const filter = engine.ctx.createBiquadFilter();
    const pan = engine.ctx.createStereoPanner();
    osc.type = i % 2 ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(scaleTone(preset, chordRootIndex + offset, i >= 2 ? 2 : 1), now);
    osc.detune.value = (i - 1.5) * 4;
    filter.type = 'lowpass';
    filter.frequency.value = 820 + amount * 900;
    filter.Q.value = 0.8;
    pan.pan.value = (i - 1.5) * 0.18;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(amount * 0.16, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);
    osc.connect(filter).connect(gain);
    gain.connect(pan).connect(engine.lowpass);
    gain.connect(engine.musicDelay);
    osc.start(now);
    osc.stop(now + 2.1);
  });
}

function playSongLead(engine, preset, chordRootIndex, motifValue, clarity, style, accent = 1) {
  if (motifValue < 0) return;
  const frequency = scaleTone(preset, chordRootIndex + motifValue, 2);
  const now = engine.ctx.currentTime;
  const osc = engine.ctx.createOscillator();
  const gain = engine.ctx.createGain();
  const filter = engine.ctx.createBiquadFilter();
  osc.type = style === 'lofi' ? 'sine' : 'triangle';
  osc.frequency.setValueAtTime(frequency, now);
  filter.type = 'lowpass';
  filter.frequency.value = style === 'synth' ? 2600 : 1500;
  filter.Q.value = 1.4;
  const peak = (0.018 + clarity * 0.00055) * accent;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(peak * 0.35, now + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (style === 'ambient' ? 0.9 : 0.48));
  osc.connect(filter).connect(gain).connect(engine.lowpass);
  gain.connect(engine.musicDelay);
  osc.start(now);
  osc.stop(now + 1.1);
}

function startSongArrangement(engine, preset, stimulation) {
  const feel = ui.songFeel.value;
  if (feel === 'off') return;

  const beatMs = 60000 / preset.bpm;
  const sixteenthMs = beatMs / 2;
  const presetName = ui.mode.value;
  const progression = progressions[presetName] || progressions.coding;

  engine.arrangementTimer = setInterval(() => {
    const style = ui.songFeel.value;
    if (style === 'off') return;

    const step = engine.arrangementStep++;
    const groove = Number(ui.groove.value);
    const clarity = Number(ui.melodyClarity.value);
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    const chordRootIndex = progression[bar % progression.length];
    const chordRootFreq = scaleTone(preset, chordRootIndex, 0.5);
    const motif = songMotifs[style] || songMotifs.ambient;

    if (inBar === 0) playChord(engine, preset, chordRootIndex, 0.10 + groove / 900);

    // Soft, regular rhythm gives the ear something musical to lock onto.
    if (style !== 'ambient' && (inBar === 0 || inBar === 8)) playKick(engine, 0.16 + groove / 350);
    if (style === 'lofi' && (inBar === 4 || inBar === 12)) playHat(engine, 0.018 + groove / 1800);
    if (style === 'synth' && inBar % 4 === 2) playHat(engine, 0.014 + groove / 2200);

    const leadDensity = style === 'ambient' ? [0, 4, 8, 12] : [0, 2, 4, 6, 8, 10, 12, 14];
    if (leadDensity.includes(inBar)) {
      const motifIndex = Math.floor(step / 2) % motif.length;
      const phraseLift = bar % 4 === 3 && inBar >= 12 ? 1 : 0;
      playSongLead(engine, preset, chordRootIndex, motif[motifIndex] + phraseLift, clarity, style, inBar === 0 ? 1.25 : 1);
    }
  }, sixteenthMs);
}


function midiLikeFrequency(root, semitone, octaveMultiplier = 1) {
  return root * octaveMultiplier * Math.pow(2, semitone / 12);
}

function makeToneEngine(preset) {
  if (!window.Tone) return null;

  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.bpm.value = preset.bpm;

  const reverb = new Tone.Reverb({ decay: 4.8, wet: 0.18 }).toDestination();
  const delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.22, wet: 0.16 }).connect(reverb);
  const chorus = new Tone.Chorus({ frequency: 0.7, delayTime: 3.5, depth: 0.35, wet: 0.16 }).start().connect(delay);

  const chord = new Tone.PolySynth(Tone.AMSynth, {
    volume: -22,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.18, decay: 0.35, sustain: 0.55, release: 2.4 },
    harmonicity: 1.5,
    modulationIndex: 5,
  }).connect(chorus);

  const lead = new Tone.FMSynth({
    volume: -18,
    harmonicity: 1.8,
    modulationIndex: 2.4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.015, decay: 0.22, sustain: 0.2, release: 0.55 },
    modulationEnvelope: { attack: 0.01, decay: 0.18, sustain: 0.1, release: 0.35 },
  }).connect(delay);

  const bass = new Tone.MonoSynth({
    volume: -20,
    oscillator: { type: 'triangle' },
    filter: { Q: 1.1, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.025, decay: 0.2, sustain: 0.32, release: 0.42 },
    filterEnvelope: { attack: 0.02, decay: 0.16, sustain: 0.2, release: 0.35, baseFrequency: 90, octaves: 2.3 },
  }).connect(reverb);

  const kick = new Tone.MembraneSynth({
    volume: -24,
    pitchDecay: 0.04,
    octaves: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.22, sustain: 0.01, release: 0.18 },
  }).toDestination();

  const hat = new Tone.NoiseSynth({
    volume: -34,
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.025 },
  }).toDestination();

  return { chord, lead, bass, kick, hat, reverb, delay, chorus, step: 0 };
}

function toneFreq(preset, scaleIndex, octaveMultiplier = 1) {
  const safe = ((scaleIndex % preset.scale.length) + preset.scale.length) % preset.scale.length;
  return midiLikeFrequency(preset.root, preset.scale[safe], octaveMultiplier);
}

async function startToneArrangement(engine, preset) {
  if (!window.Tone || ui.songFeel.value === 'off') return;

  await Tone.start();
  const tone = makeToneEngine(preset);
  if (!tone) return;

  const presetName = ui.mode.value;
  const progression = progressions[presetName] || progressions.coding;

  const repeatId = Tone.Transport.scheduleRepeat((time) => {
    const style = ui.songFeel.value;
    if (style === 'off') return;

    const groove = Number(ui.groove.value);
    const clarity = Number(ui.melodyClarity.value);
    const step = tone.step++;
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    const chordRoot = progression[bar % progression.length];
    const motif = songMotifs[style] || songMotifs.ambient;

    if (inBar === 0) {
      const chordNotes = [0, 2, 4, 6].map((offset, i) => toneFreq(preset, chordRoot + offset, i >= 2 ? 2 : 1));
      tone.chord.triggerAttackRelease(chordNotes, style === 'ambient' ? '1m' : '2n.', time, 0.42 + groove / 260);
    }

    if (style !== 'ambient' && (inBar === 0 || inBar === 8)) {
      tone.kick.triggerAttackRelease('C1', '8n', time, 0.28 + groove / 180);
    }

    if ((style === 'lofi' && [4, 7, 12, 15].includes(inBar)) || (style === 'synth' && inBar % 4 === 2)) {
      tone.hat.triggerAttackRelease('32n', time, 0.12 + groove / 260);
    }

    const leadSteps = style === 'ambient' ? [0, 4, 8, 12] : [0, 2, 4, 6, 8, 10, 12, 14];
    if (leadSteps.includes(inBar)) {
      const motifIndex = Math.floor(step / 2) % motif.length;
      const motifValue = motif[motifIndex];
      if (motifValue >= 0) {
        const phraseLift = bar % 4 === 3 && inBar >= 12 ? 1 : 0;
        tone.lead.triggerAttackRelease(toneFreq(preset, chordRoot + motifValue + phraseLift, 2), style === 'ambient' ? '4n' : '8n.', time, 0.28 + clarity / 180);
      }
    }
  }, '16n');

  tone.repeatId = repeatId;
  engine.tone = tone;
  Tone.Transport.start('+0.05');
}

function stopToneArrangement(engineToClose) {
  if (!engineToClose?.tone || !window.Tone) return;
  try {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Object.values(engineToClose.tone).forEach((item) => {
      if (item && typeof item.dispose === 'function') item.dispose();
    });
  } catch {}
  engineToClose.tone = null;
}

function startBinaural(engine, preset) {
  if (!ui.binaural.checked) return;
  const merger = engine.ctx.createChannelMerger(2);
  const left = engine.ctx.createOscillator();
  const right = engine.ctx.createOscillator();
  const gain = engine.ctx.createGain();
  left.type = right.type = 'sine';
  left.frequency.value = preset.root;
  right.frequency.value = preset.root + 6;
  gain.gain.value = 0.018;
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  merger.connect(gain).connect(engine.lowpass);
  left.start();
  right.start();
  engine.oscillators.push(left, right);
}

function applySettings() {
  if (!audio) return;
  const preset = presets[ui.mode.value];
  const stimulation = Number(ui.adhd.value);
  const volume = Number(ui.volume.value) / 100;
  const now = audio.ctx.currentTime;
  audio.master.gain.setTargetAtTime(volume * 0.42, now, 0.08);
  audio.lowpass.frequency.setTargetAtTime(preset.filter + stimulation * 8, now, 0.2);
}

function format(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  ui.timeLeft.textContent = format(remainingSeconds);
}

async function start() {
  stop(false);
  const preset = presets[ui.mode.value];
  const stimulation = Number(ui.adhd.value);
  audio = createEngine();
  startPads(audio, preset, stimulation);
  startNoise(audio, stimulation);
  startPulse(audio, preset, stimulation);
  startMusicBits(audio, preset, stimulation);
  startClearMelody(audio, preset, stimulation);
  if (!window.Tone) startSongArrangement(audio, preset, stimulation);
  await startToneArrangement(audio, preset);
  startBinaural(audio, preset);
  applySettings();

  remainingSeconds = Number(ui.minutes.value) * 60;
  endAt = Date.now() + remainingSeconds * 1000;
  updateTimerDisplay();
  timer = setInterval(() => {
    remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    updateTimerDisplay();
    if (remainingSeconds <= 0) stop(true);
  }, 250);

  ui.play.disabled = true;
  ui.stop.disabled = false;
  ui.status.textContent = 'Playing';
}

function stop(completed = false) {
  if (timer) clearInterval(timer);
  timer = null;

  if (audio) {
    const engineToClose = audio;
    const now = engineToClose.ctx.currentTime;
    engineToClose.master.gain.setTargetAtTime(0, now, 0.05);
    audio = null;
    setTimeout(() => {
      if (engineToClose.pulseTimer) clearInterval(engineToClose.pulseTimer);
      if (engineToClose.musicTimer) clearInterval(engineToClose.musicTimer);
      if (engineToClose.melodyTimer) clearInterval(engineToClose.melodyTimer);
      if (engineToClose.arrangementTimer) clearInterval(engineToClose.arrangementTimer);
      stopToneArrangement(engineToClose);
      engineToClose.oscillators.forEach((osc) => { try { osc.stop(); } catch {} });
      engineToClose.lfos.forEach((osc) => { try { osc.stop(); } catch {} });
      if (engineToClose.noiseNode) engineToClose.noiseNode.disconnect();
      engineToClose.ctx.close();
    }, 180);
  }

  ui.play.disabled = false;
  ui.stop.disabled = true;
  ui.status.textContent = completed ? 'Session complete' : 'Ready';
}

ui.play.addEventListener('click', start);
ui.stop.addEventListener('click', () => stop(false));
['mode', 'adhd', 'volume'].forEach((id) => ui[id].addEventListener('input', applySettings));
ui.adhd.addEventListener('input', () => ui.adhdValue.textContent = ui.adhd.value);
ui.volume.addEventListener('input', () => ui.volumeValue.textContent = ui.volume.value);
ui.musicAmount.addEventListener('input', () => ui.musicAmountValue.textContent = ui.musicAmount.value);
ui.melodyClarity.addEventListener('input', () => ui.melodyClarityValue.textContent = ui.melodyClarity.value);
ui.groove.addEventListener('input', () => ui.grooveValue.textContent = ui.groove.value);
ui.minutes.addEventListener('change', () => {
  if (!audio) {
    remainingSeconds = Number(ui.minutes.value) * 60;
    updateTimerDisplay();
  }
});

updateTimerDisplay();
