import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export interface XTermHandle {
  writeOutput: (text: string, isError?: boolean) => void;
  writeCommand: (cmd: string) => void;
  clear: () => void;
  focus: () => void;
}

interface Props {
  className?: string;
  noShell?: boolean;
  onReady?: () => void;
}

const XTermTerminal = forwardRef<XTermHandle, Props>(({ className = "", noShell = false, onReady }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const sendResize = useCallback((term: Terminal, ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    }
  }, []);

  const connect = useCallback((term: Terminal, fit: FitAddon) => {
    if (!mountedRef.current) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      fit.fit();
      sendResize(term, ws);
      onReady?.();
    };

    ws.onmessage = (ev) => {
      try {
        const { type, data } = JSON.parse(ev.data);
        if (type === "output") term.write(data);
        if (type === "exit") term.write("\r\n\x1b[90m[shell exited]\x1b[0m\r\n");
      } catch {}
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      term.write("\r\n\x1b[90m[disconnected — reconnecting...]\x1b[0m\r\n");
      reconnectRef.current = setTimeout(() => connect(term, fit), 3000);
    };

    ws.onerror = () => { try { ws.close(); } catch {} };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });
  }, [onReady, sendResize]);

  useImperativeHandle(ref, () => ({
    writeOutput: (text: string, isError = false) => {
      if (!termRef.current) return;
      const color = isError ? "\x1b[31m" : "\x1b[0m";
      const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      termRef.current.write("\r\n");
      for (const line of lines) {
        termRef.current.write(`${color}${line}\x1b[0m\r\n`);
      }
    },
    writeCommand: (cmd: string) => {
      if (!termRef.current) return;
      termRef.current.write(`\r\n\x1b[90m$ ${cmd}\x1b[0m\r\n`);
    },
    clear: () => { termRef.current?.clear(); },
    focus: () => { termRef.current?.focus(); },
  }));

  useEffect(() => {
    mountedRef.current = true;
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: 0,
      scrollback: 5000,
      allowProposedApi: true,
      theme: {
        background: "#0d0d0d",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        cursorAccent: "#0d0d0d",
        black: "#1e1e1e",
        brightBlack: "#808080",
        red: "#f14c4c",
        brightRed: "#f1897f",
        green: "#23d18b",
        brightGreen: "#23d18b",
        yellow: "#f5f543",
        brightYellow: "#f5f543",
        blue: "#3b8eea",
        brightBlue: "#3b8eea",
        magenta: "#d670d6",
        brightMagenta: "#d670d6",
        cyan: "#29b8db",
        brightCyan: "#29b8db",
        white: "#e5e5e5",
        brightWhite: "#ffffff",
        selectionBackground: "#264f78",
        selectionForeground: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    const linksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(linksAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    setTimeout(() => { try { fitAddon.fit(); } catch {} }, 50);

    if (noShell) {
      setTimeout(() => {
        term.write("\x1b[90mBM Compiler — Output\x1b[0m\r\n");
        term.write("\x1b[90mPress \x1b[0m\x1b[32mRun\x1b[90m (or Ctrl+Enter) to execute your code.\x1b[0m\r\n\r\n");
        onReady?.();
      }, 80);
    } else {
      connect(term, fitAddon);
    }

    const ro = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (wsRef.current) sendResize(term, wsRef.current);
      } catch {}
    });
    ro.observe(containerRef.current);

    return () => {
      mountedRef.current = false;
      ro.disconnect();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      try { wsRef.current?.close(); } catch {}
      try { term.dispose(); } catch {}
    };
  }, [connect, sendResize]);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full overflow-hidden ${className}`}
      style={{ padding: "4px 0 4px 4px" }}
      onClick={() => termRef.current?.focus()}
    />
  );
});

XTermTerminal.displayName = "XTermTerminal";
export default XTermTerminal;
