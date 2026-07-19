/**
 * Zentrale Site-Konfiguration.
 * Passe hier Inhalt, Theme und Verhalten an — der Rest der Site leitet sich davon ab.
 */

export const siteConfig = {
  meta: {
    title: "heliac@portfolio — heliacwm",
    description:
      "Statische Terminal-Portfolio-Website im Linux-Window-Manager-Look.",
    lang: "de",
  },

  /** Identität im Prompt: user@host:path$ */
  identity: {
    name: "Heliac",
    username: "heliac",
    hostname: "portfolio",
    path: "~",
    role: "Full-Stack Developer",
    location: "Earth",
  },

  /** Fenster-Titel der Terminal-App */
  window: {
    title: "heliac@portfolio: ~",
    appName: "xterm",
  },

  /**
   * Desktop / Window Manager (X11-ähnlicher Look, nicht macOS/Windows)
   * Stil: Openbox / IceWM / Fluxbox
   */
  desktop: {
    /** Name in Panel / About */
    wmName: "heliacwm",
    wmVersion: "0.1",
    /** Wallpaper-Stil: slate | grid | mesh */
    wallpaper: "mesh" as "slate" | "grid" | "mesh",
    panel: {
      position: "bottom" as "bottom" | "top",
      menuLabel: "Menu",
      showClock: true,
      showWorkspaces: true,
      workspaces: 4,
      activeWorkspace: 1,
    },
    /** Startposition & Größe des Terminal-Fensters */
    terminal: {
      width: 760,
      height: 480,
      /** "center" oder Pixel-Offset von links/oben */
      x: "center" as number | "center",
      y: "center" as number | "center",
      minWidth: 360,
      minHeight: 240,
    },
    /** Desktop-Icons (Doppelklick / Klick öffnet App) */
    icons: [
      {
        id: "term",
        label: "Terminal",
        glyph: ">_",
        action: "focus-terminal" as const,
      },
      {
        id: "linux",
        label: "Linux",
        glyph: "🐧",
        action: "boot-linux" as const,
      },
      {
        id: "readme",
        label: "README",
        glyph: "📄",
        action: "focus-terminal" as const,
      },
    ],
  },

  /** Farbschema & Look (CSS-Variablen) */
  theme: {
    /** Desktop-Hintergrund (unter Wallpaper-Muster) */
    background: "#1a1d1a",
    surface: "#0c100c",
    border: "#3a463a",
    text: "#c8e6c9",
    muted: "#6b8f6e",
    accent: "#39ff14",
    accentDim: "#2bb30f",
    promptUser: "#39ff14",
    promptHost: "#7ee787",
    promptPath: "#79c0ff",
    error: "#ff6b6b",
    link: "#79c0ff",
    selection: "#1a3d1a",
    cursor: "#39ff14",
    /** Subtile CRT-Scanlines (nur Terminal-Inhalt) */
    crtEffect: true,
    fontFamily:
      "'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace",
    fontSize: "14px",

    /** Window-Manager Chrome (Linux X11) */
    wm: {
      /** Aktive Titelleiste (klassisch Metacity/GTK-ish) */
      titleActiveBg: "#2e5a2e",
      titleActiveFg: "#e8ffe8",
      titleInactiveBg: "#2a2e2a",
      titleInactiveFg: "#8a9a8a",
      /** Fensterrahmen */
      frameActive: "#3d6b3d",
      frameInactive: "#3a403a",
      clientBg: "#0c100c",
      /** Panel */
      panelBg: "#222822",
      panelFg: "#c8e6c9",
      panelBorder: "#0a0c0a",
      panelHighlight: "#3a463a",
      buttonBg: "#2a322a",
      buttonBorder: "#4a5a4a",
      buttonHover: "#3a4a3a",
      buttonDanger: "#6b2e2e",
    },
  },

  /** Zeilen beim „Boot“ (optional) */
  boot: {
    enabled: true,
    lines: [
      "heliacwm: starting session...",
      "xterm: connected to display :0",
      "shell: /bin/sh",
      "",
    ],
  },

  /** Willkommensbanner nach dem Boot */
  welcome: [
    "╔══════════════════════════════════════╗",
    "║   welcome to heliac@portfolio        ║",
    "║   help · linux (echter Kernel/v86)   ║",
    "╚══════════════════════════════════════╝",
    "",
  ],

  /**
   * Echter Linux-Gast via v86 (lazy-load).
   * Assets unter public/v86/ — siehe scripts/fetch-v86-assets.sh
   */
  linux: {
    enabled: true,
    /** Gast-RAM in MiB (Power of two friendly; 32 reicht für Buildroot) */
    memoryMb: 32,
    cmdline:
      "console=ttyS0,115200 tsc=reliable mitigations=off random.trust_cpu=on",
    paths: {
      /** Prebuilt browser ESM (copied from node_modules/v86) */
      lib: "v86/libv86.mjs",
      wasm: "v86/v86.wasm",
      bios: "v86/seabios.bin",
      vgaBios: "v86/vgabios.bin",
      bzImage: "v86/buildroot-bzimage.bin",
    },
  },

  about: [
    "Hallo — ich bin Heliac.",
    "Ich baue schnelle, statische Websites und CLI-Tools.",
    "Diese Seite ist ein Astro-Static-Build im Linux-WM-Look.",
    "Optional: 'linux' bootet einen echten Buildroot-Kernel (v86).",
    "",
    "Tipp: probiere 'neofetch', 'projects' oder 'linux'.",
  ],

  skills: [
    { name: "TypeScript", level: 90 },
    { name: "Astro", level: 85 },
    { name: "React / Vue", level: 80 },
    { name: "Node.js", level: 85 },
    { name: "CSS / Design Systems", level: 75 },
    { name: "Linux / CLI", level: 90 },
  ],

  projects: [
    {
      name: "terminal-site",
      description: "Diese Website — konfigurierbares Terminal-Portfolio.",
      stack: ["Astro", "TypeScript", "CSS"],
      url: "https://github.com/",
      status: "active" as const,
    },
    {
      name: "static-kit",
      description: "Minimaler Starter für blitzschnelle Landing Pages.",
      stack: ["Astro", "MDX"],
      url: "https://github.com/",
      status: "wip" as const,
    },
    {
      name: "cli-notes",
      description: "Markdown-Notizen in der Shell, synchronisiert als Git-Repo.",
      stack: ["Rust", "Git"],
      url: "https://github.com/",
      status: "archived" as const,
    },
  ],

  social: [
    { name: "GitHub", url: "https://github.com/", handle: "@heliac" },
    { name: "X / Twitter", url: "https://x.com/", handle: "@heliac" },
    {
      name: "LinkedIn",
      url: "https://linkedin.com/",
      handle: "heliac",
    },
  ],

  contact: {
    email: "hello@example.com",
    note: "Schreib mir gerne — Antworten meist innerhalb von 48h.",
  },

  /**
   * Zusätzliche / überschreibbare Befehle.
   * output: statischer Text (Array = Zeilen).
   */
  customCommands: {
    coffee: {
      description: "Braut Kaffee.",
      output: [
        "  ( (",
        "   ) )",
        ".........",
        "|       |]",
        "\\       /",
        " `-----'",
        "",
        "Hier, frisch gebrüht. ☕",
      ],
    },
  } satisfies Record<
    string,
    { description: string; output: string | string[] }
  >,
} as const;

export type SiteConfig = typeof siteConfig;

/** Nur das, was der Client für die interaktive Shell braucht */
export function getClientConfig() {
  return {
    identity: siteConfig.identity,
    boot: siteConfig.boot,
    welcome: siteConfig.welcome,
    about: siteConfig.about,
    skills: siteConfig.skills,
    projects: siteConfig.projects,
    social: siteConfig.social,
    contact: siteConfig.contact,
    customCommands: siteConfig.customCommands,
  };
}

export type ClientConfig = ReturnType<typeof getClientConfig>;

/** Client-Config für Window Manager / Desktop */
export function getDesktopClientConfig() {
  const d = siteConfig.desktop;
  return {
    wmName: d.wmName,
    panel: d.panel,
    terminal: d.terminal,
    windowTitle: siteConfig.window.title,
  };
}

export type DesktopClientConfig = ReturnType<typeof getDesktopClientConfig>;
