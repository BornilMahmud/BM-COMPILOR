import { execFile } from "child_process";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { TargetLanguage, ExecutionResult } from "@shared/schema.js";

const TIMEOUT_MS = 5000;
const MAX_CODE_SIZE = 50000;
const MAX_OUTPUT_SIZE = 512 * 1024;

let activeRuns = 0;
const MAX_CONCURRENT_RUNS = 3;

async function execWithTimeout(
  cmd: string,
  args: string[],
  timeoutMs: number = TIMEOUT_MS
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = execFile(cmd, args, { timeout: timeoutMs, maxBuffer: MAX_OUTPUT_SIZE }, (error, stdout, stderr) => {
      resolve({
        stdout: (stdout || "").slice(0, 10000),
        stderr: (stderr || "").slice(0, 5000),
        exitCode: error ? (error as any).code ?? 1 : 0,
      });
    });
  });
}

export async function runCode(code: string, target: TargetLanguage): Promise<ExecutionResult> {
  if (code.length > MAX_CODE_SIZE) {
    return { stdout: "", stderr: "Code exceeds maximum size limit", exitCode: 1 };
  }
  if (activeRuns >= MAX_CONCURRENT_RUNS) {
    return { stdout: "", stderr: "Too many concurrent executions. Please wait.", exitCode: 1 };
  }

  activeRuns++;
  const id = randomUUID().slice(0, 8);
  const workDir = join(tmpdir(), `bm-compiler-${id}`);
  await mkdir(workDir, { recursive: true });

  const cleanup: string[] = [];

  try {
    switch (target) {
      case "c": {
        const srcFile = join(workDir, "main.c");
        const outFile = join(workDir, "main");
        await writeFile(srcFile, code);
        cleanup.push(srcFile, outFile);

        const compile = await execWithTimeout("gcc", [srcFile, "-o", outFile, "-lm"]);
        if (compile.exitCode !== 0) {
          return { stdout: "", stderr: compile.stderr, exitCode: compile.exitCode, error: "Compilation failed" };
        }
        return await execWithTimeout(outFile, []);
      }

      case "cpp": {
        const srcFile = join(workDir, "main.cpp");
        const outFile = join(workDir, "main");
        await writeFile(srcFile, code);
        cleanup.push(srcFile, outFile);

        const compile = await execWithTimeout("g++", [srcFile, "-o", outFile]);
        if (compile.exitCode !== 0) {
          return { stdout: "", stderr: compile.stderr, exitCode: compile.exitCode, error: "Compilation failed" };
        }
        return await execWithTimeout(outFile, []);
      }

      case "java": {
        const srcFile = join(workDir, "Main.java");
        await writeFile(srcFile, code);
        cleanup.push(srcFile);

        const compile = await execWithTimeout("javac", [srcFile]);
        if (compile.exitCode !== 0) {
          return { stdout: "", stderr: compile.stderr, exitCode: compile.exitCode, error: "Compilation failed" };
        }
        const result = await execWithTimeout("java", ["-cp", workDir, "Main"]);
        cleanup.push(join(workDir, "Main.class"));
        return result;
      }

      case "py": {
        const srcFile = join(workDir, "main.py");
        await writeFile(srcFile, code);
        cleanup.push(srcFile);
        return await execWithTimeout("python3", [srcFile]);
      }

      default:
        return { stdout: "", stderr: `Unsupported target: ${target}`, exitCode: 1 };
    }
  } catch (err: any) {
    return { stdout: "", stderr: err.message || "Execution error", exitCode: 1 };
  } finally {
    activeRuns--;
    for (const f of cleanup) {
      try { await unlink(f); } catch {}
    }
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(workDir);
    } catch {}
  }
}
