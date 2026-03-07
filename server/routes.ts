import type { Express } from "express";
import { type Server } from "http";
import { execFile } from "child_process";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import path from "path";
import { runRequestSchema, createRepoSchema, commitFileSchema } from "@shared/schema.js";

const BMCC_PATH =
  process.platform === "win32"
    ? path.resolve("compiler/bmcc.exe")
    : path.resolve("compiler/bmcc");

function getGithubToken(req: any): string | null {
  return req.headers["x-github-token"] as string || null;
}

function runBmcc(
  lang: string,
  filePath: string,
  stdinText?: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = ["--lang", lang, "--file", filePath, "--run", "--json"];
    if (stdinText) {
      args.push("--stdin-text", stdinText);
    }
    const child = execFile(BMCC_PATH, args, {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      try {
        const output = stdout.trim();
        if (output) {
          const result = JSON.parse(output);
          resolve(result);
        } else {
          resolve({
            ok: false,
            exit_code: 1,
            stdout: "",
            stderr: stderr || (error?.message ?? "bmcc execution failed"),
            phase: "setup",
          });
        }
      } catch (e) {
        resolve({
          ok: false,
          exit_code: 1,
          stdout: "",
          stderr: `bmcc output parse error: ${stdout || stderr}`,
          phase: "setup",
        });
      }
    });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", compiler: "bmcc (C + Flex + Bison)" });
  });

  app.post("/api/run", async (req, res) => {
    try {
      const parsed = runRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          exit_code: 1,
          stdout: "",
          stderr: parsed.error.message,
          phase: "setup",
        });
      }

      const { language, filename, code, stdin } = parsed.data;

      if (code.length > 50000) {
        return res.status(400).json({
          ok: false,
          exit_code: 1,
          stdout: "",
          stderr: "Code exceeds maximum size limit (50KB)",
          phase: "setup",
        });
      }

      const id = randomUUID().slice(0, 8);
      const workDir = join(tmpdir(), `bmcompiler_${id}`);
      await mkdir(workDir, { recursive: true });

      const filePath = join(workDir, filename);
      await writeFile(filePath, code);

      try {
        const result = await runBmcc(language, filePath, stdin || undefined);
        return res.json(result);
      } finally {
        try {
          await rm(workDir, { recursive: true, force: true });
        } catch {}
      }
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        exit_code: 1,
        stdout: "",
        stderr: err.message || "Execution error",
        phase: "setup",
      });
    }
  });

  app.get("/api/github/repos", async (req, res) => {
    try {
      const token = getGithubToken(req);
      if (!token) return res.status(401).json({ error: "No GitHub token" });

      const response = await fetch(
        "https://api.github.com/user/repos?sort=updated&per_page=100",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      if (!response.ok)
        return res
          .status(response.status)
          .json({ error: "GitHub API error" });
      const repos = await response.json();
      return res.json(
        repos.map((r: any) => ({
          name: r.name,
          full_name: r.full_name,
          html_url: r.html_url,
          description: r.description,
          private: r.private,
        }))
      );
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/github/createRepo", async (req, res) => {
    try {
      const token = getGithubToken(req);
      if (!token) return res.status(401).json({ error: "No GitHub token" });

      const parsed = createRepoSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: parsed.error.message });

      const response = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: parsed.data.name,
          description:
            parsed.data.description || "Created by BM Compiler",
          private: parsed.data.isPrivate,
          auto_init: true,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        return res
          .status(response.status)
          .json({
            error: err.message || "Failed to create repo",
          });
      }
      const repo = await response.json();
      return res.json({
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        description: repo.description,
        private: repo.private,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/github/commit", async (req, res) => {
    try {
      const token = getGithubToken(req);
      if (!token) return res.status(401).json({ error: "No GitHub token" });

      const parsed = commitFileSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: parsed.error.message });

      const { repo, path: filePath, content, message } = parsed.data;

      const existingRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${filePath}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      let sha: string | undefined;
      if (existingRes.ok) {
        const existing = await existingRes.json();
        sha = existing.sha;
      }

      const response = await fetch(
        `https://api.github.com/repos/${repo}/contents/${filePath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            content: Buffer.from(content).toString("base64"),
            ...(sha ? { sha } : {}),
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        return res
          .status(response.status)
          .json({
            error: err.message || "Failed to commit file",
          });
      }
      const result = await response.json();
      return res.json({
        success: true,
        html_url: result.content?.html_url,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
