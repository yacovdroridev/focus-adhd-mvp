# Product notes

## Positioning

Focus Field is not a music generator for entertainment. It is a focus-state audio generator.

The main design rule: enough movement to keep the ADHD brain engaged, not enough novelty to steal attention. It aims to create a "Deep Ambient Wash" that grounds the listener.

## Current controls

- **Start Focus:** Initializes the audio engine.
- **Capture Tab/System Audio:** Hooks into another tab (e.g., YouTube) to layer focus sounds over it.
- **Capture Microphone:** Routes mic audio through the app's engine.
- **Mode:** Selects a base grounding frequency profile (A1, C2, G1, D2).
- **Session length:** Sets timer duration.
- **ADHD dial:** Increases/decreases stimulation (density and brightness).
- **Volume:** Master output level for both generated and captured audio.
- **Noise bed:** Adds brown/pink-ish background texture.
- **Pulse:** Adds slow, ethereal volume swells.
- **Music bits:** Adds very sparse, slow-swelling note patterns.
- **Melody pattern:** Selects a recognizable repeating motif (extremely slow).
- **Song feel:** Adds a deep Tone.js wash with chord swells and rare lead notes.
- **Binaural drift:** Adds a steady **40Hz Gamma-wave** interference pattern.

## Design constraints

Avoid:
- Vocals
- Clear lead melodies
- Sharp transitions
- Big drops
- Percussion (including kicks/hats)
- Fast note attacks
- Low-end rumble/noise below 100Hz

Prefer:
- **40Hz Gamma Waves** for focus.
- **15-second Reverb Decays** for infinite space.
- **Pure Sine Waves** for minimal distraction.
- **Glacial Attacks** (2s-10s) for seamless sound.
- Stable tonality.
- Grounding root frequencies.

## Candidate next features

- Saved focus profiles
- Tray icon for desktop
- Release automation with GitHub Actions
- Custom icons and polish
