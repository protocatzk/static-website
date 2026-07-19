import type { ClientConfig } from "../config/site";

type OutputLine = string | { html: string };

const BAR = "█";
const EMPTY = "░";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function link(url: string, label?: string): string {
  const text = escapeHtml(label ?? url);
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
}

function skillBar(level: number, width = 20): string {
  const filled = Math.round((level / 100) * width);
  return BAR.repeat(filled) + EMPTY.repeat(width - filled);
}

function pad(text: string, len: number): string {
  return text.length >= len ? text.slice(0, len) : text + " ".repeat(len - text.length);
}

export function initTerminal(root: HTMLElement, config: ClientConfig): void {
  const outputEl = root.querySelector<HTMLElement>("[data-term-output]");
  const form = root.querySelector<HTMLFormElement>("[data-term-form]");
  const input = root.querySelector<HTMLInputElement>("[data-term-input]");
  const scrollEl = root.querySelector<HTMLElement>("[data-term-scroll]");

  if (!outputEl || !form || !input || !scrollEl) return;

  const history: string[] = [];
  let historyIndex = -1;
  let draft = "";
  let busy = false;

  const { username, hostname, path } = config.identity;

  function scrollToBottom() {
    scrollEl!.scrollTop = scrollEl!.scrollHeight;
  }

  function appendBlock(html: string) {
    const block = document.createElement("div");
    block.className = "term-block";
    block.innerHTML = html;
    outputEl!.appendChild(block);
    scrollToBottom();
  }

  function renderLines(lines: OutputLine[]): string {
    return lines
      .map((line) => {
        if (typeof line === "string") {
          return `<div class="term-line">${escapeHtml(line) || "&nbsp;"}</div>`;
        }
        return `<div class="term-line">${line.html}</div>`;
      })
      .join("");
  }

  function promptHtml(cmd = ""): string {
    return (
      `<span class="prompt">` +
      `<span class="prompt-user">${escapeHtml(username)}</span>` +
      `<span class="prompt-at">@</span>` +
      `<span class="prompt-host">${escapeHtml(hostname)}</span>` +
      `<span class="prompt-colon">:</span>` +
      `<span class="prompt-path">${escapeHtml(path)}</span>` +
      `<span class="prompt-dollar">$</span>` +
      `</span>` +
      (cmd ? ` <span class="cmd-echo">${escapeHtml(cmd)}</span>` : "")
    );
  }

  function echoCommand(cmd: string) {
    appendBlock(`<div class="term-line input-line">${promptHtml(cmd)}</div>`);
  }

  function print(lines: OutputLine[]) {
    if (lines.length === 0) return;
    appendBlock(renderLines(lines));
  }

  function builtInHelp(): OutputLine[] {
    const rows: [string, string][] = [
      ["help", "Diese Hilfe anzeigen"],
      ["clear / cls", "Bildschirm leeren"],
      ["whoami", "Aktuellen User anzeigen"],
      ["about", "Kurzbio"],
      ["skills", "Tech-Stack mit Bars"],
      ["projects", "Projekte auflisten"],
      ["social", "Social Links"],
      ["contact", "Kontakt"],
      ["neofetch", "System-Info im ASCII-Style"],
      ["ls", "Dateien im Home-Verzeichnis"],
      ["cat <file>", "Datei ausgeben (about, skills, …)"],
      ["echo <text>", "Text ausgeben"],
      ["date", "Aktuelles Datum"],
      ["history", "Befehlshistorie"],
      ["banner", "Willkommensbanner erneut"],
    ];

    for (const [name, cmd] of Object.entries(config.customCommands)) {
      rows.push([name, cmd.description]);
    }

    const max = Math.max(...rows.map(([n]) => n.length));
    return [
      "Verfügbare Befehle:",
      "",
      ...rows.map(
        ([name, desc]) => `  ${pad(name, max + 2)}${desc}`,
      ),
      "",
      "Tipp: Pfeiltasten ↑/↓ für History, Tab für Autocomplete.",
    ];
  }

  function cmdAbout(): OutputLine[] {
    return [...config.about];
  }

  function cmdSkills(): OutputLine[] {
    const maxName = Math.max(...config.skills.map((s) => s.name.length));
    return [
      "Skills:",
      "",
      ...config.skills.map((s) => {
        const name = pad(s.name, maxName + 1);
        return `  ${name} [${skillBar(s.level)}] ${s.level}%`;
      }),
      "",
    ];
  }

  function cmdProjects(): OutputLine[] {
    const lines: OutputLine[] = ["Projekte:", ""];
    for (const p of config.projects) {
      const status =
        p.status === "active"
          ? "● active"
          : p.status === "wip"
            ? "○ wip"
            : "◌ archived";
      lines.push({
        html: `  <span class="accent">${escapeHtml(p.name)}</span>  <span class="muted">${escapeHtml(status)}</span>`,
      });
      lines.push(`    ${p.description}`);
      lines.push(`    stack: ${p.stack.join(", ")}`);
      lines.push({
        html: `    url: ${link(p.url)}`,
      });
      lines.push("");
    }
    return lines;
  }

  function cmdSocial(): OutputLine[] {
    const lines: OutputLine[] = ["Social:", ""];
    for (const s of config.social) {
      lines.push({
        html: `  ${escapeHtml(pad(s.name, 14))} ${link(s.url, s.handle)}`,
      });
    }
    lines.push("");
    return lines;
  }

  function cmdContact(): OutputLine[] {
    return [
      "Kontakt:",
      "",
      {
        html: `  email  ${link(`mailto:${config.contact.email}`, config.contact.email)}`,
      },
      `  note   ${config.contact.note}`,
      "",
    ];
  }

  function cmdNeofetch(): OutputLine[] {
    const id = config.identity;
    const art = [
      "       .--.      ",
      "      |o_o |     ",
      "      |:_/ |     ",
      "     //   \\ \\    ",
      "    (|     | )   ",
      "   /'\\_   _/`\\   ",
      "   \\___)=(___/   ",
    ];
    const info = [
      `${id.username}@${id.hostname}`,
      "-----------------",
      `Name:     ${id.name}`,
      `Role:     ${id.role}`,
      `Location: ${id.location}`,
      `Shell:    term.sh`,
      `UI:       Astro (static)`,
      `Theme:    phosphor-green`,
      `Uptime:   ∞ (static site)`,
    ];

    const rows = Math.max(art.length, info.length);
    const lines: string[] = [""];
    for (let i = 0; i < rows; i++) {
      const left = pad(art[i] ?? "", 18);
      const right = info[i] ?? "";
      lines.push(`${left}${right}`);
    }
    lines.push("");
    return lines;
  }

  function cmdLs(): OutputLine[] {
    return [
      "about.txt  skills.txt  projects.txt  social.txt  contact.txt  README.md",
    ];
  }

  function cmdCat(args: string[]): OutputLine[] {
    const file = (args[0] ?? "").replace(/^\.\//, "").toLowerCase();
    const map: Record<string, () => OutputLine[]> = {
      "about.txt": cmdAbout,
      about: cmdAbout,
      "skills.txt": cmdSkills,
      skills: cmdSkills,
      "projects.txt": cmdProjects,
      projects: cmdProjects,
      "social.txt": cmdSocial,
      social: cmdSocial,
      "contact.txt": cmdContact,
      contact: cmdContact,
      "readme.md": () => [
        "# terminal-site",
        "",
        "Statisches Terminal-Portfolio mit Astro.",
        "Konfiguration: src/config/site.ts",
        "Tippe 'help' für Befehle.",
      ],
      readme: () => cmdCat(["readme.md"]),
    };

    if (!file) {
      return [{ html: `<span class="error">cat: fehlendes Argument</span>` }];
    }
    const handler = map[file];
    if (!handler) {
      return [
        {
          html: `<span class="error">cat: ${escapeHtml(file)}: Datei nicht gefunden</span>`,
        },
      ];
    }
    return handler();
  }

  function runCommand(raw: string): OutputLine[] | "clear" {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0]!.toLowerCase();
    const args = parts.slice(1);

    // Custom commands from config
    const custom = config.customCommands[cmd as keyof typeof config.customCommands];
    if (custom) {
      const out = custom.output;
      return Array.isArray(out) ? [...out] : [out];
    }

    switch (cmd) {
      case "help":
      case "?":
        return builtInHelp();
      case "clear":
      case "cls":
        return "clear";
      case "whoami":
        return [username];
      case "about":
        return cmdAbout();
      case "skills":
        return cmdSkills();
      case "projects":
      case "project":
        return cmdProjects();
      case "social":
        return cmdSocial();
      case "contact":
        return cmdContact();
      case "neofetch":
      case "fetch":
        return cmdNeofetch();
      case "ls":
        return cmdLs();
      case "cat":
        return cmdCat(args);
      case "echo":
        return [args.join(" ")];
      case "date":
        return [new Date().toString()];
      case "history":
        return history.length
          ? history.map((h, i) => `  ${String(i + 1).padStart(3)}  ${h}`)
          : ["(leer)"];
      case "banner":
        return [...config.welcome];
      case "pwd":
        return [`/home/${username}`];
      case "cd":
        return [
          {
            html: `<span class="muted">cd: dieses Dateisystem ist read-only (static).</span>`,
          },
        ];
      case "sudo":
        return [
          {
            html: `<span class="error">sudo: permission denied — nice try.</span>`,
          },
        ];
      case "exit":
      case "logout":
        return [
          {
            html: `<span class="muted">Session bleibt offen. Schließ den Tab, wenn du gehen willst :)</span>`,
          },
        ];
      default:
        return [
          {
            html: `<span class="error">command not found: ${escapeHtml(cmd)}</span> — tippe <span class="accent">help</span>`,
          },
        ];
    }
  }

  async function typeLines(lines: string[], delayMs = 18) {
    for (const line of lines) {
      print([line]);
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  async function boot() {
    busy = true;
    input.disabled = true;

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (config.boot.enabled && config.boot.lines.length) {
      await typeLines([...config.boot.lines], reduced ? 0 : 35);
    }

    print([...config.welcome]);
    busy = false;
    input.disabled = false;
    input.focus();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;

    const value = input.value;
    input.value = "";
    historyIndex = -1;
    draft = "";

    echoCommand(value);

    if (value.trim()) {
      history.push(value);
    }

    const result = runCommand(value);
    if (result === "clear") {
      outputEl.innerHTML = "";
      return;
    }
    print(result);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      if (historyIndex === -1) draft = input.value;
      historyIndex = Math.min(historyIndex + 1, history.length - 1);
      input.value = history[history.length - 1 - historyIndex] ?? "";
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex <= 0) {
        historyIndex = -1;
        input.value = draft;
        return;
      }
      historyIndex -= 1;
      input.value = history[history.length - 1 - historyIndex] ?? "";
    } else if (e.key === "Tab") {
      e.preventDefault();
      const partial = input.value.trim().toLowerCase();
      if (!partial || partial.includes(" ")) return;
      const names = [
        "help",
        "clear",
        "whoami",
        "about",
        "skills",
        "projects",
        "social",
        "contact",
        "neofetch",
        "ls",
        "cat",
        "echo",
        "date",
        "history",
        "banner",
        ...Object.keys(config.customCommands),
      ];
      const matches = names.filter((n) => n.startsWith(partial));
      if (matches.length === 1) {
        input.value = matches[0]! + " ";
      } else if (matches.length > 1) {
        echoCommand(input.value);
        print([matches.join("  ")]);
      }
    } else if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      echoCommand(input.value + "^C");
      input.value = "";
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      outputEl.innerHTML = "";
    }
  });

  // Focus input when clicking the terminal
  root.addEventListener("click", () => {
    if (!busy) input.focus();
  });

  void boot();
}
