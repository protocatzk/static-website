/**
 * Terminal dual-mode controller: portfolio shell + optional real Linux (v86).
 */
import { initTerminal } from "./terminal";
import {
  LinuxVm,
  publicAsset,
  type LinuxVmAssetConfig,
  type LinuxVmStatus,
} from "./linux-vm";
import type { ClientConfig } from "../config/site";

export type TerminalAppConfig = {
  shell: ClientConfig;
  linux: {
    enabled: boolean;
    memoryMb: number;
    cmdline: string;
    autoBash: boolean;
    paths: {
      lib: string;
      wasm: string;
      bios: string;
      vgaBios: string;
      bzImage: string;
      initrd?: string;
    };
  };
};

export function initTerminalApp(
  root: HTMLElement,
  config: TerminalAppConfig,
): void {
  const portfolioPane = root.querySelector<HTMLElement>("[data-pane-portfolio]");
  const linuxPane = root.querySelector<HTMLElement>("[data-pane-linux]");
  const serialEl = root.querySelector<HTMLElement>("[data-linux-serial]");
  const statusEl = root.querySelector<HTMLElement>("[data-linux-status]");
  const progressEl = root.querySelector<HTMLElement>("[data-linux-progress]");
  const btnPortfolio = root.querySelector<HTMLButtonElement>("[data-mode-portfolio]");
  const btnLinux = root.querySelector<HTMLButtonElement>("[data-mode-linux]");
  const btnBoot = root.querySelector<HTMLButtonElement>("[data-linux-boot]");
  const btnReset = root.querySelector<HTMLButtonElement>("[data-linux-reset]");

  if (!portfolioPane || !linuxPane || !serialEl) return;

  // Portfolio shell
  initTerminal(root, config.shell);

  let mode: "portfolio" | "linux" = "portfolio";
  let vm: LinuxVm | null = null;
  let booting = false;

  function setMode(next: "portfolio" | "linux") {
    mode = next;
    root.dataset.mode = next;
    portfolioPane!.hidden = next !== "portfolio";
    linuxPane!.hidden = next !== "linux";
    btnPortfolio?.classList.toggle("is-active", next === "portfolio");
    btnLinux?.classList.toggle("is-active", next === "linux");
    btnPortfolio?.setAttribute("aria-pressed", next === "portfolio" ? "true" : "false");
    btnLinux?.setAttribute("aria-pressed", next === "linux" ? "true" : "false");

    if (next === "linux") {
      vm?.attachInput(serialEl!);
      serialEl!.focus({ preventScroll: true });
      scrollSerial();
    } else {
      vm?.detachInput();
      const input = root.querySelector<HTMLInputElement>("[data-term-input]");
      input?.focus({ preventScroll: true });
    }
  }

  function scrollSerial() {
    serialEl!.scrollTop = serialEl!.scrollHeight;
  }

  function renderStatus(status: LinuxVmStatus) {
    if (!statusEl) return;
    switch (status.phase) {
      case "idle":
        statusEl.textContent = "Kernel nicht geladen.";
        break;
      case "loading":
        statusEl.textContent =
          status.percent != null
            ? `${status.message} ${status.percent}%`
            : status.message;
        if (progressEl) {
          progressEl.hidden = false;
          progressEl.style.setProperty(
            "--p",
            `${status.percent ?? 10}%`,
          );
        }
        break;
      case "booting":
        statusEl.textContent = status.message;
        if (progressEl) {
          progressEl.hidden = false;
          progressEl.style.setProperty("--p", "100%");
        }
        break;
      case "running":
        statusEl.textContent = config.linux.autoBash
          ? "Buildroot + GNU bash · serial ttyS0 · hier tippen"
          : "Buildroot ash · tippe bash · serial ttyS0";
        if (progressEl) progressEl.hidden = true;
        break;
      case "stopped":
        statusEl.textContent = "VM pausiert.";
        break;
      case "error":
        statusEl.textContent = status.message;
        if (progressEl) progressEl.hidden = true;
        break;
    }
  }

  function assetConfig(): LinuxVmAssetConfig {
    const base = import.meta.env.BASE_URL as string;
    const p = config.linux.paths;
    return {
      libUrl: publicAsset(base, p.lib),
      wasmUrl: publicAsset(base, p.wasm),
      biosUrl: publicAsset(base, p.bios),
      vgaBiosUrl: publicAsset(base, p.vgaBios),
      bzImageUrl: publicAsset(base, p.bzImage),
      initrdUrl: p.initrd ? publicAsset(base, p.initrd) : undefined,
      memoryMb: config.linux.memoryMb,
      cmdline: config.linux.cmdline,
      autoBash: config.linux.autoBash,
    };
  }

  async function ensureBoot() {
    if (!config.linux.enabled) {
      renderStatus({
        phase: "error",
        message: "Linux-VM ist in der Config deaktiviert.",
      });
      return;
    }
    if (booting) return;
    if (vm?.isRunning()) {
      setMode("linux");
      return;
    }

    booting = true;
    btnBoot && (btnBoot.disabled = true);
    try {
      if (!vm) {
        vm = new LinuxVm(assetConfig());
        vm.onStatus(renderStatus);
        vm.onOutput((chunk) => {
          // Stream raw serial into the pre
          serialEl!.textContent = (serialEl!.textContent ?? "") + chunk;
          // Cap DOM size
          const t = serialEl!.textContent ?? "";
          if (t.length > 180_000) {
            serialEl!.textContent = t.slice(-160_000);
          }
          scrollSerial();
        });
      }
      setMode("linux");
      if (!(serialEl!.textContent ?? "").trim()) {
        serialEl!.textContent =
          "v86 · lade Buildroot bzImage (einmalig ~5 MB)…\n";
      }
      await vm.boot();
      vm.attachInput(serialEl!);
    } catch {
      // status already set
    } finally {
      booting = false;
      btnBoot && (btnBoot.disabled = false);
    }
  }

  function resetVm() {
    vm?.destroy();
    vm = null;
    serialEl!.textContent = "";
    renderStatus({ phase: "idle" });
    if (progressEl) progressEl.hidden = true;
  }

  btnPortfolio?.addEventListener("click", () => setMode("portfolio"));
  btnLinux?.addEventListener("click", () => {
    void ensureBoot();
  });
  btnBoot?.addEventListener("click", () => {
    void ensureBoot();
  });
  btnReset?.addEventListener("click", () => {
    resetVm();
    void ensureBoot();
  });

  // Portfolio shell command: linux / v86 / kernel
  root.addEventListener("term:linux", () => {
    void ensureBoot();
  });

  // Click serial area to focus for typing
  serialEl.addEventListener("click", () => {
    if (mode === "linux") serialEl.focus({ preventScroll: true });
  });

  // Desktop menu / icons can request linux mode
  document.addEventListener("desktop:boot-linux", () => {
    void ensureBoot();
  });

  setMode("portfolio");
  renderStatus({ phase: "idle" });
}
