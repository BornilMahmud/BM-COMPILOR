import type { Express } from "express";
import { type Server } from "http";
import { execFile, spawn } from "child_process";
import { writeFile, mkdir, rm, access } from "fs/promises";
import { join, dirname, basename } from "path";
import { tmpdir, platform } from "os";
import { randomUUID } from "crypto";
import path from "path";
import { createWriteStream, existsSync } from "fs";
import { runRequestSchema, createRepoSchema, commitFileSchema } from "@shared/schema.js";

const IS_WIN = process.platform === "win32";

const BMCC_PATH = IS_WIN
  ? path.resolve("compiler/bmcc.exe")
  : path.resolve("compiler/bmcc");

const BMCC_AVAILABLE = existsSync(BMCC_PATH);

if (!BMCC_AVAILABLE) {
  console.warn(`[warn] bmcc binary not found at ${BMCC_PATH} — using direct interpreter fallback (Windows/local mode)`);
}

function getGithubToken(req: any): string | null {
  return (req.headers["x-github-token"] as string) || null;
}

/* ── Direct interpreter execution (Windows / local fallback) ── */

function spawnDirect(
  cmd: string,
  args: string[],
  stdinText: string | undefined,
  timeout = 15000
): Promise<any> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: IS_WIN,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeout);

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    if (stdinText) {
      child.stdin.write(stdinText);
    }
    child.stdin.end();

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ ok: false, exit_code: 124, stdout, stderr: stderr + "\nProcess killed: timeout exceeded\n", phase: "run" });
      } else {
        resolve({ ok: code === 0, exit_code: code ?? 1, stdout, stderr, phase: "run" });
      }
    });

    child.on("error", (err: any) => {
      clearTimeout(timer);
      const msg = err.code === "ENOENT"
        ? `Runtime not found: '${cmd}'. Please install it and make sure it is in your PATH.`
        : err.message;
      resolve({ ok: false, exit_code: 1, stdout: "", stderr: msg, phase: "setup" });
    });
  });
}

async function runDirect(
  lang: string,
  filePath: string,
  stdinText?: string
): Promise<any> {
  const dir = dirname(filePath);

  /* C */
  if (lang === "c") {
    const out = join(dir, IS_WIN ? "a.exe" : "a.out");
    const compile = await spawnDirect("gcc", [filePath, "-o", out, "-lm"], undefined, 30000);
    if (!compile.ok) return { ...compile, phase: "compile" };
    const run = await spawnDirect(out, [], stdinText, 15000);
    try { await rm(out, { force: true }); } catch {}
    return { ...run, phase: "run" };
  }

  /* C++ */
  if (lang === "cpp") {
    const out = join(dir, IS_WIN ? "a.exe" : "a.out");
    const compile = await spawnDirect("g++", [filePath, "-o", out], undefined, 30000);
    if (!compile.ok) return { ...compile, phase: "compile" };
    const run = await spawnDirect(out, [], stdinText, 15000);
    try { await rm(out, { force: true }); } catch {}
    return { ...run, phase: "run" };
  }

  /* Java */
  if (lang === "java") {
    const compile = await spawnDirect("javac", [filePath], undefined, 30000);
    if (!compile.ok) return { ...compile, phase: "compile" };
    const className = basename(filePath, ".java");
    const run = await spawnDirect("java", ["-cp", dir, className], stdinText, 15000);
    try { await rm(join(dir, `${className}.class`), { force: true }); } catch {}
    return { ...run, phase: "run" };
  }

  /* Python */
  if (lang === "py") {
    const cmd = IS_WIN ? "python" : "python3";
    return { ...(await spawnDirect(cmd, [filePath], stdinText)), phase: "run" };
  }

  /* JavaScript */
  if (lang === "js") {
    return { ...(await spawnDirect("node", [filePath], stdinText)), phase: "run" };
  }

  /* TypeScript */
  if (lang === "ts") {
    const cmd = IS_WIN ? "npx.cmd" : "npx";
    return { ...(await spawnDirect(cmd, ["tsx", filePath], stdinText)), phase: "run" };
  }

  /* PHP */
  if (lang === "php") {
    return { ...(await spawnDirect("php", [filePath], stdinText)), phase: "run" };
  }

  /* Ruby */
  if (lang === "rb") {
    return { ...(await spawnDirect("ruby", [filePath], stdinText)), phase: "run" };
  }

  /* Go */
  if (lang === "go") {
    return { ...(await spawnDirect("go", ["run", filePath], stdinText)), phase: "run" };
  }

  /* Rust */
  if (lang === "rs") {
    const out = join(dir, IS_WIN ? "rust_out.exe" : "rust_out");
    const compile = await spawnDirect("rustc", [filePath, "-o", out], undefined, 60000);
    if (!compile.ok) return { ...compile, phase: "compile" };
    const run = await spawnDirect(out, [], stdinText, 15000);
    try { await rm(out, { force: true }); } catch {}
    return { ...run, phase: "run" };
  }

  /* Dart */
  if (lang === "dart") {
    return { ...(await spawnDirect("dart", ["run", filePath], stdinText)), phase: "run" };
  }

  /* HTML */
  if (lang === "html") {
    const script = `
const fs=require('fs'),file=process.argv[2],html=fs.readFileSync(file,'utf8');
const lines=html.split('\\n').length,tags=(html.match(/<[a-zA-Z][^>]*>/g)||[]).length;
const text=html.replace(/<style[\\s\\S]*?<\\/style>/gi,'').replace(/<script[\\s\\S]*?<\\/script>/gi,'')
  .replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
  .replace(/\\s+/g,' ').trim();
console.log('=== BM Compiler: HTML Runner ===');
console.log('File   : '+file);console.log('Lines  : '+lines);console.log('Tags   : '+tags);console.log('---');
if(text) console.log('Text content:\\n'+text); else console.log('(no visible text content)');
console.log('\\n[Open in a web browser to see the rendered page]');
`;
    const scriptPath = join(dir, "_html_runner.js");
    await writeFile(scriptPath, script);
    const result = await spawnDirect("node", [scriptPath, filePath], undefined);
    try { await rm(scriptPath, { force: true }); } catch {}
    return { ...result, phase: "run" };
  }

  /* CSS */
  if (lang === "css") {
    const script = `
const fs=require('fs'),file=process.argv[2],css=fs.readFileSync(file,'utf8');
const rules=(css.match(/[^{}]+\\{[^}]*\\}/g)||[]).length,props=(css.match(/[a-z-]+\\s*:/g)||[]).length;
const sels=(css.match(/[^{}]+(?=\\{)/g)||[]).map(s=>s.trim()).filter(Boolean);
console.log('=== BM Compiler: CSS Runner ===');
console.log('File      : '+file);console.log('Rules     : '+rules);console.log('Properties: '+props);
console.log('Selectors : '+sels.slice(0,10).join(', ')+(sels.length>10?'...':''));
console.log('---');console.log('CSS Source:');console.log(css);
console.log('[Link this CSS file in an HTML file to apply styles]');
`;
    const scriptPath = join(dir, "_css_runner.js");
    await writeFile(scriptPath, script);
    const result = await spawnDirect("node", [scriptPath, filePath], undefined);
    try { await rm(scriptPath, { force: true }); } catch {}
    return { ...result, phase: "run" };
  }

  /* SQL / MySQL / OracleSQL */
  if (lang === "sql" || lang === "mysql" || lang === "ora") {
    const { readFileSync } = await import("fs");
    const sql = readFileSync(filePath, "utf8");
    const cmd = IS_WIN ? "sqlite3.exe" : "sqlite3";
    return { ...(await spawnDirect(cmd, [":memory:"], sql)), phase: "run" };
  }

  /* Bash */
  if (lang === "sh" || lang === "bash") {
    const cmd = IS_WIN ? "bash.exe" : "bash";
    return { ...(await spawnDirect(cmd, [filePath], stdinText)), phase: "run" };
  }

  return {
    ok: false, exit_code: 1, stdout: "", phase: "setup",
    stderr: `Unsupported language: '${lang}'. Supported: c, cpp, java, py, js, ts, php, rb, go, rs, dart, html, css, sql, mysql, ora, sh`,
  };
}

/* ── bmcc wrapper (Linux/Mac primary path) ── */

function runBmcc(lang: string, filePath: string, stdinText?: string): Promise<any> {
  return new Promise((resolve) => {
    const args = ["--lang", lang, "--file", filePath, "--run", "--json"];
    if (stdinText) args.push("--stdin-text", stdinText);

    execFile(BMCC_PATH, args, { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      try {
        const output = stdout.trim();
        if (output) {
          resolve(JSON.parse(output));
        } else {
          resolve({ ok: false, exit_code: 1, stdout: "", stderr: stderr || error?.message || "bmcc execution failed", phase: "setup" });
        }
      } catch {
        resolve({ ok: false, exit_code: 1, stdout: "", stderr: `bmcc output parse error: ${stdout || stderr}`, phase: "setup" });
      }
    });
  });
}

/* ── Route registration ── */

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      compiler: BMCC_AVAILABLE ? "bmcc (C + Flex + Bison)" : "direct-interpreter (Windows/local mode)",
      platform: process.platform,
    });
  });

  app.post("/api/run", async (req, res) => {
    try {
      const parsed = runRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, exit_code: 1, stdout: "", stderr: parsed.error.message, phase: "setup" });
      }

      const { language, filename, code, stdin } = parsed.data;

      if (code.length > 50000) {
        return res.status(400).json({ ok: false, exit_code: 1, stdout: "", stderr: "Code exceeds maximum size limit (50KB)", phase: "setup" });
      }

      const id = randomUUID().slice(0, 8);
      const workDir = join(tmpdir(), `bmcompiler_${id}`);
      await mkdir(workDir, { recursive: true });

      const filePath = join(workDir, filename);
      await writeFile(filePath, code);

      try {
        const result = BMCC_AVAILABLE
          ? await runBmcc(language, filePath, stdin || undefined)
          : await runDirect(language, filePath, stdin || undefined);
        return res.json(result);
      } finally {
        try { await rm(workDir, { recursive: true, force: true }); } catch {}
      }
    } catch (err: any) {
      return res.status(500).json({ ok: false, exit_code: 1, stdout: "", stderr: err.message || "Execution error", phase: "setup" });
    }
  });

  app.get("/api/github/repos", async (req, res) => {
    try {
      const token = getGithubToken(req);
      if (!token) return res.status(401).json({ error: "No GitHub token" });

      const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
      });
      if (!response.ok) return res.status(response.status).json({ error: "GitHub API error" });
      const repos = await response.json();
      return res.json(repos.map((r: any) => ({
        name: r.name, full_name: r.full_name, html_url: r.html_url, description: r.description, private: r.private,
      })));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/github/createRepo", async (req, res) => {
    try {
      const token = getGithubToken(req);
      if (!token) return res.status(401).json({ error: "No GitHub token" });

      const parsed = createRepoSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const response = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
        body: JSON.stringify({ name: parsed.data.name, description: parsed.data.description || "Created by BM Compiler", private: parsed.data.isPrivate, auto_init: true }),
      });
      if (!response.ok) {
        const err = await response.json();
        return res.status(response.status).json({ error: err.message || "Failed to create repo" });
      }
      const repo = await response.json();
      return res.json({ name: repo.name, full_name: repo.full_name, html_url: repo.html_url, description: repo.description, private: repo.private });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/github/commit", async (req, res) => {
    try {
      const token = getGithubToken(req);
      if (!token) return res.status(401).json({ error: "No GitHub token" });

      const parsed = commitFileSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const { repo, path: filePath, content, message } = parsed.data;

      const existingRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
      });
      let sha: string | undefined;
      if (existingRes.ok) {
        const existing = await existingRes.json();
        sha = existing.sha;
      }

      const response = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
        body: JSON.stringify({ message, content: Buffer.from(content).toString("base64"), ...(sha ? { sha } : {}) }),
      });
      if (!response.ok) {
        const err = await response.json();
        return res.status(response.status).json({ error: err.message || "Failed to commit file" });
      }
      const result = await response.json();
      return res.json({ success: true, html_url: result.content?.html_url });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
