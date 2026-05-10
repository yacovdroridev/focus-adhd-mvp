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
    root: 55, // A1
    chord: [1, 1.5, 2, 3],
    bpm: 30,
    filter: 400,
    pulseDepth: 0.05,
    scale: [0, 7, 12],
    pattern: [0, 0, 0, 0],
  },
  coding: {
    root: 65.41, // C2
    chord: [1, 1.25, 1.5, 2],
    bpm: 40,
    filter: 500,
    pulseDepth: 0.08,
    scale: [0, 4, 7, 12],
    pattern: [0, 0, 0, 0],
  },
  reading: {
    root: 49, // G1
    chord: [1, 1.333, 1.5, 2],
    bpm: 25,
    filter: 300,
    pulseDepth: 0.04,
    scale: [0, 5, 7, 12],
    pattern: [0, 0, 0, 0],
  },
  energy: {
    root: 73.42, // D2
    chord: [1, 1.5, 2, 2.5],
    bpm: 50,
    filter: 600,
    pulseDepth: 0.1,
    scale: [0, 7, 14],
    pattern: [0, 0, 0, 0],
  },
};

let audio = null;
let timer = null;
let endAt = 0;
let remainingSeconds = 25 * 60;

function makeBrownNoise(ctx) {
  const bufferSize = 8192;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);
  let lastOut = 0;
  node.onaudioprocess = (event) => {
    const output = event.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.01 * white)) / 1.01;
      lastOut = output[i];
      output[i] *= 2.5;
    }
  };
  return node;
}

function createEngine() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  const lowpass = ctx.createBiquadFilter();
  const musicDelay = ctx.createDelay(2.0);
  const musicFeedback = ctx.createGain();
  const musicWet = ctx.createGain();

  master.gain.value = 0;
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 800;
  lowpass.Q.value = 0.5;

  musicDelay.delayTime.value = 1.5;
  musicFeedback.gain.value = 0.6;
  musicWet.gain.value = 0.4;
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
    pads: [],
    noiseGain: ctx.createGain(),
    pulseGain: ctx.createGain(),
    binauralGain: ctx.createGain(),
    noiseNode: null,
    pulseOsc: null,
    binauralNodes: [],
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

    osc.type = 'sine';
    osc.frequency.value = preset.root * ratio;
    gain.gain.value = 0.04 + stimulation * 0.0002;

    lfo.type = 'sine';
    lfo.frequency.value = 0.01 + index * 0.005;
    lfoGain.gain.value = 2.0 + stimulation * 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);

    osc.connect(gain).connect(engine.lowpass);
    osc.start();
    lfo.start();
    engine.pads.push({ osc, gain, ratio, lfo });
  });
}

function startNoise(engine) {
  const noise = makeBrownNoise(engine.ctx);
  const filter = engine.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;
  engine.noiseGain.gain.value = 0;
  noise.connect(filter).connect(engine.noiseGain).connect(engine.lowpass);
  engine.noiseNode = noise;
}

function startPulse(engine, preset) {
  const osc = engine.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = preset.root;
  engine.pulseGain.gain.value = 0;
  osc.connect(engine.pulseGain).connect(engine.lowpass);
  osc.start();
  engine.pulseOsc = osc;
}

function startBinaural(engine) {
  const merger = engine.ctx.createChannelMerger(2);
  const left = engine.ctx.createOscillator();
  const right = engine.ctx.createOscillator();
  left.type = right.type = 'sine';
  const baseFreq = 130.81; 
  left.frequency.value = baseFreq;
  right.frequency.value = baseFreq + 40; 
  engine.binauralGain.gain.value = 0;
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  merger.connect(engine.binauralGain).connect(engine.lowpass);
  left.start();
  right.start();
  engine.binauralNodes = [left, right, merger];
}

function applySettings() {
  if (!audio) return;
  const preset = presets[ui.mode.value];
  const stimulation = Number(ui.adhd.value);
  const volume = Number(ui.volume.value) / 100;
  const now = audio.ctx.currentTime;

  audio.master.gain.setTargetAtTime(volume * 0.42, now, 0.08);
  audio.lowpass.frequency.setTargetAtTime(preset.filter + stimulation * 8, now, 0.2);

  audio.pads.forEach(pad => {
    pad.osc.frequency.setTargetAtTime(preset.root * pad.ratio, now, 0.5);
    pad.gain.gain.setTargetAtTime(0.04 + stimulation * 0.0002, now, 0.2);
  });

  audio.noiseGain.gain.setTargetAtTime(ui.noise.checked ? 0.08 : 0, now, 0.5);
  audio.pulseGain.gain.setTargetAtTime(ui.pulse.checked ? 0.05 : 0, now, 0.5);
  if (audio.pulseOsc) audio.pulseOsc.frequency.setTargetAtTime(preset.root, now, 0.5);
  audio.binauralGain.gain.setTargetAtTime(ui.binaural.checked ? 0.025 : 0, now, 0.5);

  if (window.Tone && Tone.Transport.state === 'started') {
    Tone.Transport.bpm.rampTo(preset.bpm, 0.5);
  }
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
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, now);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400 + amount * 5, now);
  pan.pan.value = (Math.random() - 0.5) * 0.8;
  const peak = (0.005 + amount * 0.0001) * accent;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 2.0);
  gain.gain.linearRampToValueAtTime(0, now + 6.0);
  osc.connect(filter).connect(gain);
  gain.connect(pan).connect(engine.musicDelay);
  osc.start(now);
  osc.stop(now + 7.0);
}

function startMusicBits(engine, preset, stimulation) {
  const beatMs = 60000 / preset.bpm;
  engine.musicTimer = setInterval(() => {
    if (!ui.musicBits.checked) return;
    const amount = Number(ui.musicAmount.value);
    const density = 0.34 + amount / 180 + stimulation / 260;
    if (Math.random() > density) return;
    const step = engine.musicStep++;
    const patternIndex = preset.pattern[step % preset.pattern.length];
    const semitone = preset.scale[patternIndex % preset.scale.length];
    const octave = step % 16 >= 12 ? 2 : 1;
    playPluck(engine, noteFrequency(preset.root, semitone, octave), amount, stimulation);
  }, 1000);
}

function playMelodyNote(engine, frequency, clarity, stimulation, accent = 1) {
  const now = engine.ctx.currentTime;
  const osc = engine.ctx.createOscillator();
  const gain = engine.ctx.createGain();
  const filter = engine.ctx.createBiquadFilter();
  const pan = engine.ctx.createStereoPanner();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, now);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400 + clarity * 18, now);
  pan.pan.value = (Math.random() - 0.5) * 0.18;
  const peak = (0.018 + clarity * 0.00062) * accent;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 2.0);
  gain.gain.linearRampToValueAtTime(0, now + 6.0);
  osc.connect(filter).connect(gain);
  gain.connect(pan).connect(engine.musicDelay);
  osc.start(now);
  osc.stop(now + 7.0);
}

function startClearMelody(engine, preset, stimulation) {
  engine.melodyTimer = setInterval(() => {
    if (ui.melodyPattern.value === 'none') return;
    const clarity = Number(ui.melodyClarity.value);
    const step = engine.melodyStep++;
    const semitone = preset.scale[step % preset.scale.length];
    playMelodyNote(engine, noteFrequency(preset.root, semitone, 2), clarity, stimulation);
  }, 5000);
}

function scaleTone(preset, index, octave = 1) {
  const safe = ((index % preset.scale.length) + preset.scale.length) % preset.scale.length;
  return noteFrequency(preset.root, preset.scale[safe], octave);
}

function playChord(engine, preset, chordRootIndex, amount = 0.12) {
  const chord = [0, 7, 12];
  chord.forEach((offset, i) => {
    const now = engine.ctx.currentTime;
    const osc = engine.ctx.createOscillator();
    const gain = engine.ctx.createGain();
    const filter = engine.ctx.createBiquadFilter();
    const pan = engine.ctx.createStereoPanner();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(scaleTone(preset, chordRootIndex + offset, i >= 2 ? 2 : 1), now);
    filter.type = 'lowpass';
    filter.frequency.value = 400 + amount * 200;
    pan.pan.value = (i - 1) * 0.4;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(amount * 0.1, now + 4.0);
    gain.gain.linearRampToValueAtTime(0, now + 12.0);
    osc.connect(filter).connect(gain);
    gain.connect(pan).connect(engine.musicDelay);
    osc.start(now);
    osc.stop(now + 13.0);
  });
}

function playSongLead(engine, preset, chordRootIndex, motifValue, clarity, style, accent = 1) {
  if (motifValue < 0) return;
  const frequency = scaleTone(preset, chordRootIndex + motifValue, 2);
  const now = engine.ctx.currentTime;
  const osc = engine.ctx.createOscillator();
  const gain = engine.ctx.createGain();
  const filter = engine.ctx.createBiquadFilter();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, now);
  filter.type = 'lowpass';
  filter.frequency.value = 600 + clarity * 2;
  const peak = (0.005 + clarity * 0.0001) * accent;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 3.0);
  gain.gain.linearRampToValueAtTime(0, now + 10.0);
  osc.connect(filter).connect(gain).connect(engine.lowpass);
  gain.connect(engine.musicDelay);
  osc.start(now);
  osc.stop(now + 11.0);
}

const progressions = { deep: [0, 5, 3, 6], coding: [0, 4, 5, 3], reading: [0, 3, 5, 4], energy: [0, 5, 2, 4] };
const songMotifs = { ambient: [0, -1, 2, -1, 4, 2], lofi: [0, 2, -1, 4], synth: [0, 2, 4, 2] };

function startSongArrangement(engine, preset, stimulation) {
  const beatMs = 60000 / preset.bpm;
  engine.arrangementTimer = setInterval(() => {
    if (ui.songFeel.value === 'off') return;
    const step = engine.arrangementStep++;
    const bar = Math.floor(step / 4);
    const inBar = step % 4;
    const chordRootIndex = progressions[ui.mode.value][bar % 4];
    if (inBar === 0) playChord(engine, preset, chordRootIndex, 0.08);
  }, beatMs * 4);
}

function makeToneEngine(preset) {
  if (!window.Tone) return null;
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.bpm.value = preset.bpm;
  const reverb = new Tone.Reverb({ decay: 15.0, wet: 0.6 }).toDestination();
  const delay = new Tone.FeedbackDelay({ delayTime: '2n', feedback: 0.7, wet: 0.4 }).connect(reverb);
  const chorus = new Tone.Chorus({ frequency: 0.1, delayTime: 10.5, depth: 0.8, wet: 0.3 }).start().connect(delay);
  const chord = new Tone.PolySynth(Tone.Synth, { volume: -28, oscillator: { type: 'sine' }, envelope: { attack: 8.0, decay: 5.0, sustain: 0.8, release: 10.0 } }).connect(chorus);
  const lead = new Tone.Synth({ volume: -32, oscillator: { type: 'sine' }, envelope: { attack: 10.0, decay: 8.0, sustain: 0.5, release: 12.0 } }).connect(delay);
  return { chord, lead, reverb, delay, chorus, step: 0 };
}

function toneFreq(preset, scaleIndex, octaveMultiplier = 1) {
  const safe = ((scaleIndex % preset.scale.length) + preset.scale.length) % preset.scale.length;
  return preset.root * octaveMultiplier * Math.pow(2, preset.scale[safe] / 12);
}

async function startToneArrangement(engine, preset) {
  if (!window.Tone) return;
  await Tone.start();
  const tone = makeToneEngine(preset);
  if (!tone) return;
  const repeatId = Tone.Transport.scheduleRepeat((time) => {
    if (ui.songFeel.value === 'off') return;
    const step = tone.step++;
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    const chordRoot = progressions[ui.mode.value][bar % 4];
    if (inBar === 0) {
      const chordNotes = [0, 7, 12].map((offset) => toneFreq(preset, chordRoot + offset, 1));
      tone.chord.triggerAttackRelease(chordNotes, '4m', time, 0.5);
    }
  }, '1n');
  tone.repeatId = repeatId;
  engine.tone = tone;
  Tone.Transport.start('+0.1');
}

function stopToneArrangement(engineToClose) {
  if (!engineToClose?.tone || !window.Tone) return;
  try {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Object.values(engineToClose.tone).forEach((item) => { if (item && typeof item.dispose === 'function') item.dispose(); });
  } catch {}
  engineToClose.tone = null;
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
  startNoise(audio);
  startPulse(audio, preset);
  startBinaural(audio);
  startMusicBits(audio, preset, stimulation);
  startClearMelody(audio, preset, stimulation);
  if (!window.Tone) startSongArrangement(audio, preset, stimulation);
  await startToneArrangement(audio, preset);
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
      if (engineToClose.musicTimer) clearInterval(engineToClose.musicTimer);
      if (engineToClose.melodyTimer) clearInterval(engineToClose.melodyTimer);
      if (engineToClose.arrangementTimer) clearInterval(engineToClose.arrangementTimer);
      stopToneArrangement(engineToClose);
      engineToClose.pads.forEach((p) => { try { p.osc.stop(); p.lfo.stop(); } catch {} });
      if (engineToClose.pulseOsc) engineToClose.pulseOsc.stop();
      engineToClose.binauralNodes.forEach(n => { if (n.stop) n.stop(); });
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

// Global listener for all controls
document.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('input', applySettings);
});

// Specific label updates
ui.adhd.addEventListener('input', () => ui.adhdValue.textContent = ui.adhd.value);
ui.volume.addEventListener('input', () => ui.volumeValue.textContent = ui.volume.value);
ui.musicAmount.addEventListener('input', () => ui.musicAmountValue.textContent = ui.musicAmount.value);
ui.melodyClarity.addEventListener('input', () => ui.melodyClarityValue.textContent = ui.melodyClarity.value);
ui.groove.addEventListener('input', () => ui.grooveValue.textContent = ui.groove.value);
ui.minutes.addEventListener('change', () => { if (!audio) { remainingSeconds = Number(ui.minutes.value) * 60; updateTimerDisplay(); } });

updateTimerDisplay();
