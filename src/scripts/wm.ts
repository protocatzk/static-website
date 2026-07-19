export type WmWindowOptions = {
  id: string;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  defaultX: number | "center";
  defaultY: number | "center";
};

type DragMode = "move" | "resize";
type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type DragState = {
  mode: DragMode;
  edge?: ResizeEdge;
  startX: number;
  startY: number;
  origLeft: number;
  origTop: number;
  origWidth: number;
  origHeight: number;
};

/**
 * Lightweight X11-style window manager for a single (or few) windows.
 * Drag titlebar, resize edges, minimize / maximize / close / restore.
 */
export class WindowManager {
  private desktop: HTMLElement;
  private panelHeight: number;
  private zCounter = 10;
  private drag: DragState | null = null;
  private activeId: string | null = null;
  private windows = new Map<
    string,
    {
      el: HTMLElement;
      opts: WmWindowOptions;
      restored: { left: number; top: number; width: number; height: number } | null;
      maximized: boolean;
      minimized: boolean;
    }
  >();

  constructor(desktop: HTMLElement, panelHeight = 32) {
    this.desktop = desktop;
    this.panelHeight = panelHeight;

    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("resize", this.onViewportResize);
  }

  register(el: HTMLElement, opts: WmWindowOptions): void {
    const rect = this.desktop.getBoundingClientRect();
    const width = Math.min(opts.defaultWidth, rect.width - 16);
    const height = Math.min(
      opts.defaultHeight,
      rect.height - this.panelHeight - 16,
    );

    let left: number;
    let top: number;

    if (opts.defaultX === "center") {
      left = Math.max(8, Math.round((rect.width - width) / 2));
    } else {
      left = opts.defaultX;
    }

    if (opts.defaultY === "center") {
      top = Math.max(
        8,
        Math.round((rect.height - this.panelHeight - height) / 2),
      );
    } else {
      top = opts.defaultY;
    }

    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.dataset.windowId = opts.id;

    this.windows.set(opts.id, {
      el,
      opts,
      restored: null,
      maximized: false,
      minimized: false,
    });

    this.bindWindow(el, opts.id);
    this.focus(opts.id);
  }

  focus(id: string): void {
    const win = this.windows.get(id);
    if (!win || win.minimized) return;

    this.activeId = id;
    this.zCounter += 1;
    win.el.style.zIndex = String(this.zCounter);
    win.el.classList.add("is-focused");
    win.el.setAttribute("aria-hidden", "false");

    for (const [otherId, other] of this.windows) {
      if (otherId !== id) {
        other.el.classList.remove("is-focused");
      }
    }

    this.desktop.dispatchEvent(
      new CustomEvent("wm:focus", { detail: { id } }),
    );

    // Focus terminal input if present
    const input = win.el.querySelector<HTMLInputElement>("[data-term-input]");
    input?.focus({ preventScroll: true });
  }

  minimize(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    win.minimized = true;
    win.el.classList.add("is-minimized");
    win.el.setAttribute("aria-hidden", "true");
    this.desktop.dispatchEvent(
      new CustomEvent("wm:minimize", { detail: { id } }),
    );
  }

  restore(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    win.minimized = false;
    win.el.classList.remove("is-minimized");
    win.el.setAttribute("aria-hidden", "false");
    this.focus(id);
    this.desktop.dispatchEvent(
      new CustomEvent("wm:restore", { detail: { id } }),
    );
  }

  toggleMinimize(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    if (win.minimized) {
      this.restore(id);
    } else if (this.activeId === id) {
      this.minimize(id);
    } else {
      this.focus(id);
    }
  }

  maximize(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;

    if (win.maximized) {
      this.unmaximize(id);
      return;
    }

    const r = win.el.getBoundingClientRect();
    const desk = this.desktop.getBoundingClientRect();
    win.restored = {
      left: r.left - desk.left,
      top: r.top - desk.top,
      width: r.width,
      height: r.height,
    };

    const deskRect = this.workArea();
    win.el.style.left = `${deskRect.left}px`;
    win.el.style.top = `${deskRect.top}px`;
    win.el.style.width = `${deskRect.width}px`;
    win.el.style.height = `${deskRect.height}px`;
    win.maximized = true;
    win.el.classList.add("is-maximized");
    this.focus(id);
  }

  unmaximize(id: string): void {
    const win = this.windows.get(id);
    if (!win || !win.restored) {
      if (win) {
        win.maximized = false;
        win.el.classList.remove("is-maximized");
      }
      return;
    }
    win.el.style.left = `${win.restored.left}px`;
    win.el.style.top = `${win.restored.top}px`;
    win.el.style.width = `${win.restored.width}px`;
    win.el.style.height = `${win.restored.height}px`;
    win.restored = null;
    win.maximized = false;
    win.el.classList.remove("is-maximized");
  }

  close(id: string): void {
    // Soft-close: minimize + flag closed (reopen from icon/task)
    this.minimize(id);
    const win = this.windows.get(id);
    win?.el.classList.add("is-closed");
    this.desktop.dispatchEvent(
      new CustomEvent("wm:close", { detail: { id } }),
    );
  }

  open(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    win.el.classList.remove("is-closed");
    this.restore(id);
  }

  isOpen(id: string): boolean {
    const win = this.windows.get(id);
    return !!win && !win.minimized && !win.el.classList.contains("is-closed");
  }

  private workArea() {
    const desk = this.desktop.getBoundingClientRect();
    return {
      left: 0,
      top: 0,
      width: desk.width,
      height: Math.max(120, desk.height - this.panelHeight),
    };
  }

  private bindWindow(el: HTMLElement, id: string): void {
    el.addEventListener("pointerdown", () => this.focus(id));

    const titlebar = el.querySelector<HTMLElement>("[data-drag-handle]");
    titlebar?.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      if (e.button !== 0) return;
      e.preventDefault();
      this.focus(id);
      const win = this.windows.get(id);
      if (!win || win.maximized) return;

      const r = el.getBoundingClientRect();
      const desk = this.desktop.getBoundingClientRect();
      this.drag = {
        mode: "move",
        startX: e.clientX,
        startY: e.clientY,
        origLeft: r.left - desk.left,
        origTop: r.top - desk.top,
        origWidth: r.width,
        origHeight: r.height,
      };
      el.classList.add("is-dragging");
      titlebar.setPointerCapture?.(e.pointerId);
    });

    titlebar?.addEventListener("dblclick", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      this.maximize(id);
    });

    el.querySelector("[data-win-min]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.minimize(id);
    });
    el.querySelector("[data-win-max]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.maximize(id);
    });
    el.querySelector("[data-win-close]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close(id);
    });

    for (const handle of el.querySelectorAll<HTMLElement>("[data-resize]")) {
      handle.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        this.focus(id);
        const win = this.windows.get(id);
        if (!win || win.maximized) return;

        const edge = handle.dataset.resize as ResizeEdge;
        const r = el.getBoundingClientRect();
        const desk = this.desktop.getBoundingClientRect();
        this.drag = {
          mode: "resize",
          edge,
          startX: e.clientX,
          startY: e.clientY,
          origLeft: r.left - desk.left,
          origTop: r.top - desk.top,
          origWidth: r.width,
          origHeight: r.height,
        };
        el.classList.add("is-resizing");
        handle.setPointerCapture?.(e.pointerId);
      });
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag || !this.activeId) return;
    const win = this.windows.get(this.activeId);
    if (!win) return;

    const dx = e.clientX - this.drag.startX;
    const dy = e.clientY - this.drag.startY;
    const area = this.workArea();
    const { minWidth, minHeight } = win.opts;

    if (this.drag.mode === "move") {
      let left = this.drag.origLeft + dx;
      let top = this.drag.origTop + dy;

      // Keep titlebar reachable
      const maxLeft = area.width - 64;
      const maxTop = area.height - 28;
      left = Math.min(Math.max(-win.el.offsetWidth + 64, left), maxLeft);
      top = Math.min(Math.max(0, top), maxTop);

      win.el.style.left = `${left}px`;
      win.el.style.top = `${top}px`;
      return;
    }

    // resize
    let left = this.drag.origLeft;
    let top = this.drag.origTop;
    let width = this.drag.origWidth;
    let height = this.drag.origHeight;
    const edge = this.drag.edge ?? "se";

    if (edge.includes("e")) {
      width = Math.max(minWidth, this.drag.origWidth + dx);
    }
    if (edge.includes("s")) {
      height = Math.max(minHeight, this.drag.origHeight + dy);
    }
    if (edge.includes("w")) {
      width = Math.max(minWidth, this.drag.origWidth - dx);
      left = this.drag.origLeft + (this.drag.origWidth - width);
    }
    if (edge.includes("n")) {
      height = Math.max(minHeight, this.drag.origHeight - dy);
      top = this.drag.origTop + (this.drag.origHeight - height);
    }

    // Clamp into work area roughly
    if (left < 0) {
      width += left;
      left = 0;
    }
    if (top < 0) {
      height += top;
      top = 0;
    }
    width = Math.min(width, area.width - left);
    height = Math.min(height, area.height - top);
    width = Math.max(minWidth, width);
    height = Math.max(minHeight, height);

    win.el.style.left = `${left}px`;
    win.el.style.top = `${top}px`;
    win.el.style.width = `${width}px`;
    win.el.style.height = `${height}px`;
  };

  private onPointerUp = () => {
    if (!this.drag || !this.activeId) return;
    const win = this.windows.get(this.activeId);
    win?.el.classList.remove("is-dragging", "is-resizing");
    this.drag = null;
  };

  private onViewportResize = () => {
    for (const [id, win] of this.windows) {
      if (win.maximized) {
        const area = this.workArea();
        win.el.style.left = `${area.left}px`;
        win.el.style.top = `${area.top}px`;
        win.el.style.width = `${area.width}px`;
        win.el.style.height = `${area.height}px`;
      } else {
        // Keep window on-screen
        const area = this.workArea();
        const left = parseFloat(win.el.style.left) || 0;
        const top = parseFloat(win.el.style.top) || 0;
        const width = win.el.offsetWidth;
        const height = win.el.offsetHeight;
        if (left + 64 > area.width) {
          win.el.style.left = `${Math.max(0, area.width - 64)}px`;
        }
        if (top + 28 > area.height) {
          win.el.style.top = `${Math.max(0, area.height - 28)}px`;
        }
        if (width > area.width) {
          win.el.style.width = `${area.width}px`;
        }
        if (height > area.height) {
          win.el.style.height = `${area.height}px`;
        }
        void id;
      }
    }
  };
}
