import { WindowManager } from "./wm";
import type { DesktopClientConfig } from "../config/site";

function formatClock(d: Date): string {
  const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const day = days[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${dd}.${mm}.  ${hh}:${mi}`;
}

export function initDesktop(
  root: HTMLElement,
  config: DesktopClientConfig,
): WindowManager {
  const panel = root.querySelector<HTMLElement>("[data-panel]");
  const panelHeight = panel?.offsetHeight ?? 32;

  const wm = new WindowManager(root, panelHeight);

  const termWin = root.querySelector<HTMLElement>('[data-window="term"]');
  if (termWin) {
    const t = config.terminal;
    wm.register(termWin, {
      id: "term",
      minWidth: t.minWidth,
      minHeight: t.minHeight,
      defaultWidth: t.width,
      defaultHeight: t.height,
      defaultX: t.x,
      defaultY: t.y,
    });
  }

  // Clock
  const clockEl = root.querySelector<HTMLElement>("[data-panel-clock]");
  if (clockEl && config.panel.showClock) {
    const tick = () => {
      clockEl.textContent = formatClock(new Date());
    };
    tick();
    window.setInterval(tick, 15_000);
  }

  // Task button
  const taskBtn = root.querySelector<HTMLButtonElement>("[data-task-term]");
  const syncTask = () => {
    if (!taskBtn) return;
    const open = wm.isOpen("term");
    taskBtn.classList.toggle("is-active", open);
    taskBtn.setAttribute("aria-pressed", open ? "true" : "false");
  };

  taskBtn?.addEventListener("click", () => {
    if (wm.isOpen("term")) {
      wm.toggleMinimize("term");
    } else {
      wm.open("term");
    }
    syncTask();
  });

  root.addEventListener("wm:focus", syncTask);
  root.addEventListener("wm:minimize", syncTask);
  root.addEventListener("wm:restore", syncTask);
  root.addEventListener("wm:close", syncTask);
  syncTask();

  // Desktop icons
  root.querySelectorAll<HTMLElement>("[data-desktop-icon]").forEach((icon) => {
    const open = () => {
      const action = icon.dataset.action;
      if (action === "focus-terminal") {
        wm.open("term");
        syncTask();
      }
    };
    icon.addEventListener("dblclick", open);
    icon.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    // Single click selects
    icon.addEventListener("click", () => {
      root
        .querySelectorAll("[data-desktop-icon]")
        .forEach((el) => el.classList.remove("is-selected"));
      icon.classList.add("is-selected");
    });
  });

  // Root menu (right-click desktop)
  const menu = root.querySelector<HTMLElement>("[data-root-menu]");
  const menuBtn = root.querySelector<HTMLButtonElement>("[data-menu-btn]");

  const closeMenu = () => {
    menu?.classList.remove("is-open");
    menuBtn?.setAttribute("aria-expanded", "false");
  };

  const openMenuAt = (x: number, y: number) => {
    if (!menu) return;
    menu.classList.add("is-open");
    menuBtn?.setAttribute("aria-expanded", "true");

    const desk = root.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = x - desk.left;
    let top = y - desk.top;
    left = Math.min(left, desk.width - mw - 4);
    top = Math.min(top, desk.height - panelHeight - mh - 4);
    left = Math.max(4, left);
    top = Math.max(4, top);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  root.addEventListener("contextmenu", (e) => {
    const target = e.target as HTMLElement;
    // Only on wallpaper / desktop surface, not inside windows
    if (target.closest("[data-window]") || target.closest("[data-panel]")) {
      return;
    }
    if (target.closest("[data-root-menu]")) return;
    e.preventDefault();
    openMenuAt(e.clientX, e.clientY);
  });

  menuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu?.classList.contains("is-open")) {
      closeMenu();
      return;
    }
    const rect = menuBtn.getBoundingClientRect();
    // Open above panel near menu button
    openMenuAt(rect.left, rect.top - 4);
    // Adjust: menu opens upward from panel
    if (menu && config.panel.position === "bottom") {
      const desk = root.getBoundingClientRect();
      menu.style.left = `${rect.left - desk.left}px`;
      menu.style.top = `${rect.top - desk.top - menu.offsetHeight - 2}px`;
    }
  });

  menu?.querySelectorAll<HTMLElement>("[data-menu-action]").forEach((item) => {
    item.addEventListener("click", () => {
      const action = item.dataset.menuAction;
      if (action === "open-term") {
        wm.open("term");
        syncTask();
      } else if (action === "minimize-term") {
        wm.minimize("term");
        syncTask();
      } else if (action === "about-wm") {
        wm.open("term");
        // Inject a soft notice via custom event for terminal consumers (optional)
        root.dispatchEvent(
          new CustomEvent("wm:about", {
            detail: {
              text: `${config.wmName} — static X11-style desktop (Astro)`,
            },
          }),
        );
        syncTask();
      }
      closeMenu();
    });
  });

  document.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    if (!t.closest("[data-root-menu]") && !t.closest("[data-menu-btn]")) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // Deselect icons when clicking empty desktop
  root.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    if (
      t.matches("[data-desktop-surface]") ||
      t.matches(".desktop-wallpaper")
    ) {
      root
        .querySelectorAll("[data-desktop-icon]")
        .forEach((el) => el.classList.remove("is-selected"));
    }
  });

  return wm;
}
