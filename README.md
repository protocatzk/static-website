# Terminal Desktop (Astro)

Statische Website als **Linux-Window-Manager-Desktop** mit interaktivem Terminal.
Stil angelehnt an Openbox / IceWM / Fluxbox — nicht macOS oder Windows.

Inhalt und Erscheinungsbild steuerst du über **eine** Config-Datei.

## Quick start

```sh
yarn install
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
- Doppelklick auf Titelleiste = Maximize
- **Panel** unten: Menu, Task, Workspaces, Uhr
- **Rechtsklick** auf den Desktop → Root-Menu
- Desktop-Icons (Doppelklick öffnet Terminal)

## Konfiguration

Alles Wichtige liegt in:

```text
src/config/site.ts
```

| Bereich | Was |
| --- | --- |
| `meta` / `identity` | Titel, Prompt (`user@host`) |
| `desktop` | WM-Name, Wallpaper, Panel, Fenstergröße, Icons |
| `theme` + `theme.wm` | Terminal-Farben + Window-Chrome |
| `about`, `skills`, `projects`, … | Shell-Inhalte |
| `customCommands` | Eigene Befehle |

## Terminal-Befehle

- `help`, `about`, `skills`, `projects`, `social`, `contact`
- `neofetch`, `ls`, `cat`, `echo`, `date`, `history`, `banner`
- `clear` / `Ctrl+L`, History `↑`/`↓`, Tab-Complete

## Projektstruktur

```text
src/
├── config/site.ts
├── components/
│   ├── Desktop.astro      # Desktop + Panel + Menu
│   ├── XWindow.astro      # X11-Fensterrahmen
│   └── Terminal.astro
├── scripts/
│   ├── desktop.ts
│   ├── wm.ts              # Drag / Resize / Focus
│   └── terminal.ts
├── layouts/BaseLayout.astro
└── pages/index.astro
```

## Deployment

`yarn build` → `dist/` (static). GitHub Pages, Netlify, Cloudflare Pages, Nginx, …
