# Ubuntu install guide

Focus Field can run on Ubuntu in three ways:

1. Web mode from a local server
2. AppImage package
3. `.deb` package

## Option 1 — run without installing

From the project directory:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Open locally:

```text
http://localhost:4173
```

Open from another device on the same network, replacing the hostname/IP:

```text
http://HOSTNAME_OR_IP:4173
```

## Option 2 — AppImage

Build packages first:

```bash
npm install
npm run pack:linux
```

Make the AppImage executable:

```bash
chmod +x "dist/Focus Field-0.1.0.AppImage"
```

Run it:

```bash
./dist/Focus\ Field-0.1.0.AppImage
```

If Ubuntu asks about FUSE/AppImage support, install FUSE:

```bash
sudo apt install libfuse2
```

## Option 3 — `.deb` package

Build packages first:

```bash
npm install
npm run pack:linux
```

Install:

```bash
sudo apt install ./dist/focus-field_0.1.0_amd64.deb
```

Run from the app launcher, or from terminal if a launcher entry is available.

Uninstall:

```bash
sudo apt remove focus-field
```

## Download from a temporary local server

If someone is serving the project folder with:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Then download the built packages from:

```text
http://HOSTNAME_OR_IP:4173/dist/Focus%20Field-0.1.0.AppImage
http://HOSTNAME_OR_IP:4173/dist/focus-field_0.1.0_amd64.deb
```

## Troubleshooting

### Electron sandbox error during development

On some Ubuntu machines Electron fails with a `chrome-sandbox` permission error. The development script uses `--no-sandbox` to keep the MVP easy to run:

```bash
npm start
```

This is acceptable for this MVP because the app loads only local project files.

### No sound

Check:

- System output device
- Browser/Electron volume mixer
- Focus Field volume slider
- Whether the session is actually started

### Browser blocks audio until interaction

This is normal. Press **Start focus**. Browsers require a user gesture before audio playback.
