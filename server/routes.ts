import type { Express } from "express";
import { createServer, type Server } from "http";
import { execFile } from "child_process";
import path from "path";
import { compileRequestSchema, runRequestSchema, createRepoSchema, saveFileSchema } from "@shared/schema.js";
import { runCode } from "./runner.js";

const BMC_PATH = path.resolve("compiler/bmc");

const EXAMPLES = [
  {
    name: 'Hello World',
    filename: 'hello.ml',
    description: 'Simple arithmetic with print',
    source: `int a = 10;\nint b = 20;\nprint(a + b);`,
  },
  {
    name: 'While Loop',
    filename: 'loop.ml',
    description: 'Countdown loop with print',
    source: `int x = 3;\nwhile (x > 0) {\n  print(x);\n  x = x - 1;\n}`,
  },
  {
    name: 'Conditionals',
    filename: 'cond.ml',
    description: 'If/else with float comparison',
    source: `float f = 2.5;\nif (f >= 2.0) {\n  print("ok");\n} else {\n  print("no");\n}`,
  },
  {
    name: 'Type Mixing',
    filename: 'types.ml',
    description: 'Int to float promotion',
    source: `int x = 5;\nfloat y = 3.14;\nfloat result = x + y;\nprint(result);`,
  },
  {
    name: 'Boolean Logic',
    filename: 'boolean.ml',
    description: 'Boolean variables and conditions',
    source: `int a = 10;\nint b = 20;\nbool isGreater = a > b;\nif (isGreater) {\n  print("a is greater");\n} else {\n  print("b is greater");\n}`,
  },
  {
    name: 'Nested Blocks',
    filename: 'nested.ml',
    description: 'Nested control flow',
    source: `int i = 5;\nwhile (i > 0) {\n  if (i == 3) {\n    print("three!");\n  } else {\n    print(i);\n  }\n  i = i - 1;\n}`,
  },
  {
    name: 'String Output',
    filename: 'strings.ml',
    description: 'String variables and printing',
    source: `string greeting = "Hello, MiniLang!";\nprint(greeting);\nstring name = "World";\nprint(name);\nint answer = 42;\nprint(answer);`,
  },
];

function runCompiler(source: string, target: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = execFile(BMC_PATH, ['--target', target, '--ir'], {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error && !stdout) {
        reject(new Error(stderr || error.message));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (e) {
        reject(new Error(`Compiler output parse error: ${stdout}`));
      }
    });
    child.stdin?.write(source);
    child.stdin?.end();
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/compile", async (req, res) => {
    try {
      const parsed = compileRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: [{ line: 0, column: 0, message: parsed.error.message, phase: 'parser' as const }],
          generatedCode: '',
          ir: '',
          target: 'c',
        });
      }
      const result = await runCompiler(parsed.data.source, parsed.data.target);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        errors: [{ line: 0, column: 0, message: err.message || 'Internal compiler error', phase: 'parser' as const }],
        generatedCode: '',
        ir: '',
        target: 'c',
      });
    }
  });

  app.post("/api/run", async (req, res) => {
    try {
      const parsed = runRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ stdout: "", stderr: parsed.error.message, exitCode: 1 });
      }
      const result = await runCode(parsed.data.code, parsed.data.target);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ stdout: "", stderr: err.message || "Execution error", exitCode: 1 });
    }
  });

  app.get("/api/examples", (_req, res) => {
    res.json(EXAMPLES);
  });

  app.post("/api/github/repos", async (req, res) => {
    try {
      const { githubToken } = req.body;
      if (!githubToken) return res.status(401).json({ error: "No GitHub token" });

      const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
        headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github.v3+json" },
      });
      if (!response.ok) return res.status(response.status).json({ error: "GitHub API error" });
      const repos = await response.json();
      return res.json(repos.map((r: any) => ({
        name: r.name,
        full_name: r.full_name,
        html_url: r.html_url,
        description: r.description,
        private: r.private,
      })));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/github/create-repo", async (req, res) => {
    try {
      const parsed = createRepoSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const response = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${parsed.data.githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: parsed.data.name,
          description: parsed.data.description || "Created by BM Compiler",
          private: parsed.data.isPrivate,
          auto_init: true,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        return res.status(response.status).json({ error: err.message || "Failed to create repo" });
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

  app.post("/api/github/save-file", async (req, res) => {
    try {
      const parsed = saveFileSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const { repo, path, content, message, githubToken } = parsed.data;

      const existingRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github.v3+json" },
      });
      let sha: string | undefined;
      if (existingRes.ok) {
        const existing = await existingRes.json();
        sha = existing.sha;
      }

      const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          content: Buffer.from(content).toString("base64"),
          ...(sha ? { sha } : {}),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        return res.status(response.status).json({ error: err.message || "Failed to save file" });
      }
      const result = await response.json();
      return res.json({ success: true, html_url: result.content?.html_url });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
