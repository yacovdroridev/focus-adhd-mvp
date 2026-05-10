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
  noise: $('noise'),
  pulse: $('pulse'),
  binaural: $('binaural'),
  timeLeft: $('timeLeft'),
  status: $('status'),
};

const presets = {
  deep: { root: 110, chord: [1, 1.5, 2, 2.5], bpm: 54, filter: 760, pulseDepth: 0.12 },
  coding: { root: 130.81, chord: [1, 1.25, 1.5, 2], bpm: 72, filter: 980, pulseDepth: 0.18 },
  reading: { root: 98, chord: [1, 1.333, 1.5, 2], bpm: 48, filter: 620, pulseDepth: 0.08 },
  energy: { root: 146.83, chord: [1, 1.25, 1.667, 2], bpm: 88, filter: 1280, pulseDepth: 0.24 },
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

  master.gain.value = 0;
  lowpass.type = 'lowpass';
  lowpass.Q.value = 0.7;
  lowpass.connect(compressor);
  compressor.connect(master);
  master.connect(ctx.destination);

  return { ctx, master, lowpass, oscillators: [], gains: [], lfos: [], noiseNode: null, pulseTimer: null, driftTimer: null };
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
    const now = audio.ctx.currentTime;
    audio.master.gain.setTargetAtTime(0, now, 0.05);
    setTimeout(() => {
      if (!audio) return;
      if (audio.pulseTimer) clearInterval(audio.pulseTimer);
      audio.oscillators.forEach((osc) => { try { osc.stop(); } catch {} });
      audio.lfos.forEach((osc) => { try { osc.stop(); } catch {} });
      if (audio.noiseNode) audio.noiseNode.disconnect();
      audio.ctx.close();
      audio = null;
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
ui.minutes.addEventListener('change', () => {
  if (!audio) {
    remainingSeconds = Number(ui.minutes.value) * 60;
    updateTimerDisplay();
  }
});

updateTimerDisplay();
