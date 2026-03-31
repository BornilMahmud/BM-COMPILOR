import { WebSocketServer } from "ws";
import type { Server } from "http";
import * as pty from "node-pty";
import { mkdirSync } from "fs";
import { log } from "./index";
import { SHELL_WORKSPACE } from "./routes";

try { mkdirSync(SHELL_WORKSPACE, { recursive: true }); } catch {}

export function setupTerminalWS(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/terminal" });

  wss.on("connection", (ws) => {
    const shell = process.platform === "win32" ? "powershell.exe" : "bash";
    const cwd = SHELL_WORKSPACE;

    let ptyProcess: ReturnType<typeof pty.spawn> | null = null;
    try {
      ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          PS1: "\\[\\033[1;32m\\]bm-workspace\\[\\033[0m\\]:\\[\\033[1;34m\\]\\W\\[\\033[0m\\]$ ",
        } as Record<string, string>,
      });
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
