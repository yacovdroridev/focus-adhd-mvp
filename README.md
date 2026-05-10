# Focus Field — ADHD Music MVP

Focus Field is a small browser + Ubuntu desktop MVP that generates procedural, low-distraction focus audio for ADHD-friendly work sessions.

The goal is to create stable **sound fields** that induce flow states using 40Hz Gamma-wave binaural beats and deep ambient washes.

## Quick start — web

From the project folder:

```bash
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173
```

## Quick start — Ubuntu desktop client

Install dependencies:

```bash
npm install
```

Run the desktop app:

```bash
npm start
```

## MVP features

- **40Hz Gamma Binaural Beats:** Steady frequency interference interference for deep focus and high-output states.
- **External Audio Capture:** Layer focus frequencies over external sources like YouTube, Spotify, or your Microphone.
- **Deep Ambient Flow:** Ethereal, slow-swelling soundscapes with no sharp percussion or distracting lead melodies.
- **Procedural Ambient Pads:** Pure sine-wave drones with slow modulation.
- **Brown/Pink Noise Bed:** Grounding background texture to mask distractions.
- **Ethereal Note Bits:** Gentle, sparse note patterns that add musicality without stealing attention.
- **Real-Time UI:** All settings (volume, ADHD dial, toggles, modes) update the audio engine instantly.
- **ADHD Stimulation Dial:** Tunable stimulation level by adjusting movement, brightness, and density.
- **Session Timer:** 15 / 25 / 45 / 90 minute focus blocks.
- **Offline Capable:** Works entirely in your browser/desktop without a backend.

## How it works

The audio is generated locally with the Web Audio API and Tone.js:

- **Binaural Beats:** Creates a precise 40Hz phantom tone in the brain by playing slightly offset frequencies in each ear.
- **Ambient Wash:** Uses massive 15-second reverb decays and long feedback delays to create a "seamless" auditory environment.
- **Sine Wave Purity:** Most oscillators use pure sine waves to reduce harmonic complexity and "attentional capture."
- **External Capture:** Uses `getDisplayMedia` and `getUserMedia` to route external audio through the app's master engine, allowing for perfect mixing with focus frequencies.

## Development

Run web version:
```bash
npm run web
```

Run desktop version:
```bash
npm start
```

## Roadmap

1. Save presets in `localStorage`.
2. Add tray controls for Ubuntu.
3. Add session completion sounds.
4. Add export/import of focus profiles.
