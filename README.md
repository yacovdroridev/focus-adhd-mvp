# Focus Field — ADHD Music MVP

A tiny browser + Ubuntu desktop MVP that generates procedural focus audio for ADHD-friendly work sessions.

## Run as web app

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 4173
```

Then visit http://localhost:4173

## Run as Ubuntu desktop app

Install dependencies once:

```bash
npm install
```

Start the desktop client:

```bash
npm start
```

The dev start script uses Electron's `--no-sandbox` flag because many Ubuntu dev machines do not have Electron's setuid sandbox configured. The app loads only local files.

Build Ubuntu packages:

```bash
npm run pack:linux
```

Outputs will be created under `dist/` as AppImage and `.deb` packages.

## MVP features

- Procedural ambient pads
- Brown/pink-ish noise bed
- Soft rhythmic pulse
- Optional binaural drift
- ADHD stimulation dial
- 15/25/45/90 minute sessions
- Browser mode and Ubuntu desktop mode
- No backend, no tracking

## Notes

The desktop client is an Electron wrapper around the same local Web Audio app. That keeps the MVP simple while leaving room for native features later: tray control, global shortcuts, autostart, saved presets, and offline sound packs.
