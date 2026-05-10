# Focus Field — ADHD Music MVP

Focus Field is a small browser + Ubuntu desktop MVP that generates procedural, low-distraction focus audio for ADHD-friendly work sessions.

The goal is not to create “songs”. The goal is to create stable sound fields: no vocals, no hooks, no sudden drops, and no attention-grabbing surprises.

## Quick start — web

From the project folder:

```bash
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173
```

If the server is running on another machine on your network, use that machine hostname/IP instead of `localhost`.

## Quick start — Ubuntu desktop client

Install dependencies:

```bash
npm install
```

Run the desktop app:

```bash
npm start
```

Build installable Ubuntu packages:

```bash
npm run pack:linux
```

Build outputs:

```text
dist/Focus Field-0.1.0.AppImage
dist/focus-field_0.1.0_amd64.deb
```

See [Ubuntu install guide](docs/ubuntu-install.md) for install options.

## MVP features

- Procedural ambient pads
- Brown/pink-ish noise bed
- Soft rhythmic pulse
- Gentle musical bits / pluck patterns
- Optional binaural drift
- ADHD stimulation dial
- Music bits amount control
- Session lengths: 15 / 25 / 45 / 90 minutes
- Modes: Deep focus, Coding pulse, Reading calm, Energy boost
- Browser mode and Ubuntu desktop mode
- No backend
- No tracking
- Works offline after dependencies/build are installed

## How it works

The audio is generated locally with the Web Audio API:

- Oscillators create slow ambient pads.
- A generated noise layer creates a soft bed.
- A low rhythmic pulse adds enough structure to reduce restlessness.
- Gentle pentatonic/minor pluck patterns add musicality without becoming distracting lead melodies.
- The ADHD dial changes stimulation level by adjusting movement, brightness, density, and pulse intensity.
- The Music bits control changes how present the note patterns are.

The Ubuntu app is an Electron wrapper around the same local Web Audio app. That keeps the MVP simple while leaving room for native features later.

## Development

Run web version:

```bash
npm run web
```

Run desktop version:

```bash
npm start
```

Package desktop version:

```bash
npm run pack:linux
```

Check production dependency audit:

```bash
npm audit --omit=dev --audit-level=high
```

## Notes

The dev start script uses Electron's `--no-sandbox` flag because many Ubuntu dev machines do not have Electron's setuid sandbox configured. The app currently loads only local files.

## Roadmap

Good next steps:

1. Save presets in `localStorage`.
2. Add tray controls for Ubuntu.
3. Add autostart/minimize-to-tray.
4. Add session completion sounds.
5. Add export/import of focus profiles.
6. Add custom icon and release workflow.
