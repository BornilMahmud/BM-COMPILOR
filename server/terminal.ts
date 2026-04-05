import { WebSocketServer } from "ws";
import type { Server } from "http";
import * as pty from "node-pty";
import { mkdirSync, writeFileSync } from "fs";
import { log } from "./index";
import { SHELL_WORKSPACE } from "./routes";

try { mkdirSync(SHELL_WORKSPACE, { recursive: true }); } catch {}

const BM_BASHRC = "/tmp/.bm_bashrc";

/* ── Write the shell init file once at server startup ── */
writeFileSync(BM_BASHRC, `
# ── BM Compiler shell init ──────────────────────────────
# Source system rc files if present (gives colour ls, etc.)
[ -f /etc/bash/bashrc ] && source /etc/bash/bashrc 2>/dev/null
[ -f ~/.bashrc ] && source ~/.bashrc 2>/dev/null

# Workspace: ensure a package.json exists so npm commands work
[ -f package.json ] || printf '{\\n  "name": "bm-workspace",\\n  "version": "1.0.0",\\n  "private": true\\n}\\n' > package.json

# pip3 alias — only pip (not pip3) is on PATH in this environment
alias pip3='pip'

# Suppress pip "new version" upgrade nag
export PIP_DISABLE_PIP_VERSION_CHECK=1

# Clean prompt
PS1='\\[\\033[1;32m\\]bm-workspace\\[\\033[0m\\]:\\[\\033[1;34m\\]\\W\\[\\033[0m\\]$ '

# ── Ready banner ─────────────────────────────────────────
_npm_v=$(npm -v 2>/dev/null)
_node_v=$(node -v 2>/dev/null)
_pip_v=$(pip --version 2>/dev/null | awk '{print $2}')
_py_v=$(python3 --version 2>/dev/null | awk '{print $2}')

printf '\\033[1;36m'
printf '\\r\\n  ┌─────────────────────────────────────────┐\\r\\n'
printf '  │      BM Compiler Shell  —  Ready        │\\r\\n'
printf '  ├─────────────────────────────────────────┤\\r\\n'
printf "  │  \\033[1;32m✓ npm %-8s  ✓ node %-10s\\033[1;36m │\\r\\n" "$_npm_v" "$_node_v"
printf "  │  \\033[1;33m✓ pip %-8s  ✓ python3 %-7s\\033[1;36m │\\r\\n" "$_pip_v" "$_py_v"
printf '  └─────────────────────────────────────────┘\\r\\n'
printf '\\033[0m\\r\\n'

unset _npm_v _node_v _pip_v _py_v
# ─────────────────────────────────────────────────────────
`.trimStart());

export function setupTerminalWS(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/terminal" });

  wss.on("connection", (ws) => {
    const shell = process.platform === "win32" ? "powershell.exe" : "bash";
    const cwd = SHELL_WORKSPACE;

    let ptyProcess: ReturnType<typeof pty.spawn> | null = null;
    try {
      ptyProcess = pty.spawn(
        shell,
        process.platform === "win32" ? [] : ["--init-file", BM_BASHRC],
        {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd,
          env: {
            ...process.env,
            TERM: "xterm-256color",
            COLORTERM: "truecolor",
          } as Record<string, string>,
        }
      );
    } catch (err) {
      ws.send(JSON.stringify({ type: "output", data: "\r\n\x1b[31mFailed to start shell\x1b[0m\r\n" }));
      ws.close();
      return;
    }

    log("Terminal session started", "ws");

    ptyProcess.onData((data) => {
      try { ws.send(JSON.stringify({ type: "output", data })); } catch {}
    });

    ptyProcess.onExit(() => {
      try { ws.send(JSON.stringify({ type: "exit" })); } catch {}
      try { ws.close(); } catch {}
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!ptyProcess) return;
        if (msg.type === "input") {
          ptyProcess.write(msg.data);
        } else if (msg.type === "resize") {
          const cols = Math.max(1, Math.min(500, msg.cols));
          const rows = Math.max(1, Math.min(200, msg.rows));
          ptyProcess.resize(cols, rows);
        }
      } catch {}
    });

    ws.on("close", () => {
      log("Terminal session closed", "ws");
      try { ptyProcess?.kill(); } catch {}
    });

    ws.on("error", () => {
      try { ptyProcess?.kill(); } catch {}
    });
  });

  return wss;
}
