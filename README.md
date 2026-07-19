# Terminal Desktop (Astro)

Statische Website als **Linux-Window-Manager-Desktop** mit interaktivem Terminal.
Stil angelehnt an Openbox / IceWM / Fluxbox — nicht macOS oder Windows.

Optional: **echter Linux-Kernel** im Browser via [v86](https://github.com/copy/v86) (Buildroot + BusyBox).

## Quick start

```sh
yarn install
yarn fetch-v86   # falls public/v86/ fehlt
yarn dev
```

Build & Preview:

```sh
yarn build
yarn preview
```

## Desktop / Window Manager

- Terminal-Fenster **ziehen** (Titelleiste), **resizen** (Ränder/Ecken)
- **Minimieren / Maximieren / Schließen** (X11-Buttons rechts)
- Doppelklick Titelleiste = Maximize
- **Panel** unten: Menu, Task, Workspaces, Uhr
- **Rechtsklick** auf den Desktop → Root-Menu
- Desktop-Icons (Doppelklick)

## Terminal

Zwei Modi im Terminal-Fenster:

| Tab / Befehl | Beschreibung |
| --- | --- |
| **portfolio** | Sofortige Fake-Shell (Inhalte aus Config) |
| **linux** / `linux` | Echter Kernel (v86), lazy-load ~5 MB bzImage |

Portfolio-Befehle: `help`, `about`, `skills`, `projects`, `social`, `contact`, `neofetch`, `ls`, `cat`, …

### Echter Linux-Gast (v86)

- Emulator: [v86](https://github.com/copy/v86) (x86 → WASM JIT)
- Gast: offizielles **Buildroot bzImage** (BusyBox auf `ttyS0`)
- Assets unter `public/v86/` (wasm, SeaBIOS, VGA-BIOS, Kernel)
- Erneut laden: `yarn fetch-v86`
- Config: `siteConfig.linux` in `src/config/site.ts`

Start über:

- Terminal-Tab **linux**
- Befehl `linux` / `v86` / `kernel`
- Desktop-Icon 🐧 oder Root-Menu → *Boot Linux*

## Konfiguration

```text
src/config/site.ts
```

| Bereich | Was |
| --- | --- |
| `meta` / `identity` | Titel, Prompt |
| `desktop` | WM, Wallpaper, Panel, Fenster, Icons |
| `theme` + `theme.wm` | Farben / Window-Chrome |
| `linux` | v86 an/aus, RAM, Asset-Pfade |
| `about`, `skills`, `projects`, … | Portfolio-Shell-Inhalte |
| `customCommands` | Eigene Fake-Shell-Befehle |

## Deployment (GitHub Pages)

CI: `.github/workflows/deploy.yml` (Push auf `master`)

1. **Settings → Pages → Source:** *GitHub Actions*
2. Pushen → Site: **https://protocatzk.github.io/static-website/**

`astro.config.mjs`:

```js
site: 'https://protocatzk.github.io',
base: '/static-website',
```

## Projektstruktur

```text
src/
├── config/site.ts
├── components/
│   ├── Desktop.astro
│   ├── XWindow.astro
│   └── Terminal.astro      # portfolio + linux tabs
├── scripts/
│   ├── desktop.ts / wm.ts
│   ├── terminal.ts         # portfolio shell
│   ├── terminal-app.ts     # dual-mode controller
│   └── linux-vm.ts         # v86 bridge
public/v86/                 # kernel, bios, wasm
scripts/fetch-v86-assets.sh
```

## Stack

- [Astro](https://astro.build) (static)
- TypeScript, Vanilla CSS
- [v86](https://github.com/copy/v86) (optional real guest)
