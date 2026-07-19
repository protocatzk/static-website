/**
 * Lazy-loaded v86 guest: real Linux kernel (buildroot bzImage) + serial console.
 * Assets live under public/v86/ and are only fetched when the user boots.
 */

export type LinuxVmAssetConfig = {
  /** Absolute or site-relative URLs (already include Astro `base`) */
  libUrl: string;
  wasmUrl: string;
  biosUrl: string;
  vgaBiosUrl: string;
  bzImageUrl: string;
  /** Optional initrd (uncompressed cpio) — used for bash overlay */
  initrdUrl?: string;
  memoryMb: number;
  cmdline: string;
  /** When true, send `exec bash` after the buildroot ash prompt appears */
  autoBash: boolean;
};

export type LinuxVmStatus =
  | { phase: "idle" }
  | { phase: "loading"; message: string; percent?: number }
  | { phase: "booting"; message: string }
  | { phase: "running" }
  | { phase: "stopped" }
  | { phase: "error"; message: string };

type StatusListener = (status: LinuxVmStatus) => void;
type OutputListener = (chunk: string) => void;

// Minimal surface we need from the v86 package (avoids hard type coupling on dynamic import)
type V86Instance = {
  add_listener: (event: string, cb: (arg: unknown) => void) => void;
  remove_listener?: (event: string, cb: (arg: unknown) => void) => void;
  serial0_send: (data: string) => void;
  run: () => void;
  stop: () => void;
  destroy?: () => void;
  is_running?: () => boolean;
};

const MAX_BUFFER = 180_000;

/**
 * Load an ES module from a public/ URL without going through Vite's import graph.
 * (Vite forbids `import()` of files under /public — they must be fetched or used as <script>.)
 */
async function importPublicEsModule<T extends Record<string, unknown>>(
  url: string,
): Promise<T> {
  // Absolute URL so the browser fetches the static asset as-is
  const absolute =
    url.startsWith("http://") || url.startsWith("https://")
      ? url
      : new URL(url, window.location.href).href;

  const res = await fetch(absolute);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${absolute}: ${res.status} ${res.statusText}`);
  }

  const source = await res.text();
  const blob = new Blob([source], { type: "text/javascript" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    // Hide from Vite static analysis (do not use bare import(objectUrl))
    const dynamicImport = new Function(
      "u",
      "return import(u)",
    ) as (u: string) => Promise<T>;
    return await dynamicImport(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export class LinuxVm {
  private emulator: V86Instance | null = null;
  private assets: LinuxVmAssetConfig;
  private statusListeners = new Set<StatusListener>();
  private outputListeners = new Set<OutputListener>();
  private buffer = "";
  private started = false;
  private autoBashSent = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private pasteHandler: ((e: ClipboardEvent) => void) | null = null;
  private focusEl: HTMLElement | null = null;

  constructor(assets: LinuxVmAssetConfig) {
    this.assets = assets;
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  onOutput(fn: OutputListener): () => void {
    this.outputListeners.add(fn);
    return () => this.outputListeners.delete(fn);
  }

  getBuffer(): string {
    return this.buffer;
  }

  isRunning(): boolean {
    return this.started && !!this.emulator;
  }

  private setStatus(status: LinuxVmStatus) {
    for (const fn of this.statusListeners) fn(status);
  }

  private appendOutput(text: string) {
    if (!text) return;
    this.buffer += text;
    if (this.buffer.length > MAX_BUFFER) {
      this.buffer = this.buffer.slice(-MAX_BUFFER);
    }
    for (const fn of this.outputListeners) fn(text);
  }

  /** Buildroot default prompt is `~% ` (busybox ash). Switch to GNU bash once. */
  private maybeAutoBash() {
    if (!this.assets.autoBash || this.autoBashSent || !this.emulator) return;
    if (!this.buffer.endsWith("~% ")) return;
    this.autoBashSent = true;
    // --norc/--noprofile: Alpine bashrc assumes a full Alpine userspace and can break Buildroot
    window.setTimeout(() => {
      this.emulator?.serial0_send(
        "export TERM=linux; exec /bin/bash --norc --noprofile\n",
      );
    }, 80);
  }

  /** Boot guest (idempotent if already running). Dynamically imports v86. */
  async boot(): Promise<void> {
    if (this.emulator) {
      this.setStatus({ phase: "running" });
      return;
    }

    this.setStatus({
      phase: "loading",
      message: "Lade v86 + Kernel-Image…",
      percent: 0,
    });

    try {
      // public/v86/libv86.mjs — fetch + blob import (Vite blocks import of /public)
      const mod = await importPublicEsModule<{
        V86: new (opts: Record<string, unknown>) => V86Instance;
        default?: new (opts: Record<string, unknown>) => V86Instance;
      }>(this.assets.libUrl);
      const V86 = mod.V86 ?? mod.default;
      if (!V86) {
        throw new Error("v86 module loaded but V86 export is missing");
      }

      this.setStatus({
        phase: "loading",
        message: "Initialisiere Emulator…",
        percent: 5,
      });

      const v86opts: Record<string, unknown> = {
        wasm_path: this.assets.wasmUrl,
        memory_size: this.assets.memoryMb * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024,
        bios: { url: this.assets.biosUrl },
        vga_bios: { url: this.assets.vgaBiosUrl },
        bzimage: { url: this.assets.bzImageUrl },
        cmdline: this.assets.cmdline,
        autostart: true,
        disable_keyboard: true,
        disable_mouse: true,
        disable_speaker: true,
        filesystem: {},
      };
      // Uncompressed cpio only (v86 does not gunzip initrd for us)
      if (this.assets.initrdUrl) {
        v86opts.initrd = { url: this.assets.initrdUrl };
      }

      const emulator = new V86(v86opts) as unknown as V86Instance;

      this.emulator = emulator;

      emulator.add_listener("download-progress", (raw) => {
        const e = raw as {
          file_name?: string;
          lengthComputable?: boolean;
          loaded?: number;
          total?: number;
        };
        if (e.lengthComputable && e.total && e.total > 0) {
          const percent = Math.min(
            99,
            Math.round(((e.loaded ?? 0) / e.total) * 100),
          );
          this.setStatus({
            phase: "loading",
            message: `Lade ${e.file_name ?? "image"}…`,
            percent,
          });
        } else {
          this.setStatus({
            phase: "loading",
            message: `Lade ${e.file_name ?? "image"}…`,
          });
        }
      });

      emulator.add_listener("download-error", (raw) => {
        const e = raw as { file_name?: string };
        this.setStatus({
          phase: "error",
          message: `Download fehlgeschlagen: ${e.file_name ?? "unbekannt"}`,
        });
      });

      emulator.add_listener("emulator-loaded", () => {
        this.setStatus({
          phase: "booting",
          message: "Kernel bootet (serial console)…",
        });
      });

      emulator.add_listener("emulator-ready", () => {
        this.started = true;
        this.setStatus({ phase: "running" });
      });

      emulator.add_listener("serial0-output-byte", (byte) => {
        const code = byte as number;
        if (code === 0) return;
        // Drop pure CR (keep LF); strip other control noise lightly
        if (code === 0x0d) return;
        const char = String.fromCharCode(code);
        this.appendOutput(char);
        this.maybeAutoBash();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus({ phase: "error", message: `Boot fehlgeschlagen: ${message}` });
      this.emulator = null;
      throw err;
    }
  }

  /** Attach keyboard/paste to an element while linux mode is active. */
  attachInput(el: HTMLElement): void {
    this.detachInput();
    this.focusEl = el;

    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.emulator || !this.started) return;
      // Don't steal browser shortcuts with meta/alt alone
      if (e.metaKey || e.altKey) return;

      const send = (s: string) => {
        e.preventDefault();
        this.emulator?.serial0_send(s);
      };

      if (e.key === "Enter") return send("\n");
      if (e.key === "Backspace") return send("\x7f");
      if (e.key === "Tab") return send("\t");
      if (e.key === "Escape") return send("\x1b");
      if (e.key === "ArrowUp") return send("\x1b[A");
      if (e.key === "ArrowDown") return send("\x1b[B");
      if (e.key === "ArrowRight") return send("\x1b[C");
      if (e.key === "ArrowLeft") return send("\x1b[D");
      if (e.key === "Home") return send("\x1b[H");
      if (e.key === "End") return send("\x1b[F");
      if (e.key === "Delete") return send("\x1b[3~");

      if (e.ctrlKey && e.key.length === 1) {
        const code = e.key.toLowerCase().charCodeAt(0);
        if (code >= 97 && code <= 122) {
          return send(String.fromCharCode(code - 96));
        }
      }

      if (!e.ctrlKey && e.key.length === 1) {
        return send(e.key);
      }
    };

    this.pasteHandler = (e: ClipboardEvent) => {
      if (!this.emulator || !this.started) return;
      const text = e.clipboardData?.getData("text");
      if (!text) return;
      e.preventDefault();
      this.emulator.serial0_send(text.replace(/\r\n/g, "\n"));
    };

    el.addEventListener("keydown", this.keyHandler);
    el.addEventListener("paste", this.pasteHandler);
    el.tabIndex = 0;
    el.focus({ preventScroll: true });
  }

  detachInput(): void {
    if (this.focusEl && this.keyHandler) {
      this.focusEl.removeEventListener("keydown", this.keyHandler);
    }
    if (this.focusEl && this.pasteHandler) {
      this.focusEl.removeEventListener("paste", this.pasteHandler);
    }
    this.keyHandler = null;
    this.pasteHandler = null;
    this.focusEl = null;
  }

  pause(): void {
    try {
      this.emulator?.stop();
      this.setStatus({ phase: "stopped" });
    } catch {
      /* ignore */
    }
  }

  resume(): void {
    try {
      this.emulator?.run();
      this.setStatus({ phase: "running" });
    } catch {
      /* ignore */
    }
  }

  destroy(): void {
    this.detachInput();
    try {
      this.emulator?.stop();
      this.emulator?.destroy?.();
    } catch {
      /* ignore */
    }
    this.emulator = null;
    this.started = false;
    this.setStatus({ phase: "idle" });
  }
}

/** Join Astro base URL with a public asset path. */
export function publicAsset(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}${path.replace(/^\//, "")}`;
}
