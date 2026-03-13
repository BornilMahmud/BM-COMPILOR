import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Save, FolderGit2, LogOut, ChevronDown, ChevronUp, Terminal, User } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import type { TargetLanguage, GithubRepo, RunResult } from "@shared/schema";
import { defaultFilenames, targetLabels, languageGroups } from "@shared/schema";

const defaultCode: Record<TargetLanguage, string> = {
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
  py: `print("Hello, World!")\n`,
  js: `console.log("Hello, World!");\n\nconst nums = [1, 2, 3, 4, 5];\nconst sum = nums.reduce((a, b) => a + b, 0);\nconsole.log("Sum:", sum);\n`,
  ts: `const greet = (name: string): string => {\n  return \`Hello, \${name}!\`;\n};\n\nconsole.log(greet("World"));\n\nconst nums: number[] = [1, 2, 3, 4, 5];\nconst sum: number = nums.reduce((a, b) => a + b, 0);\nconsole.log("Sum:", sum);\n`,
  php: `<?php\n\necho "Hello, World!\\n";\n\n$nums = [1, 2, 3, 4, 5];\n$sum = array_sum($nums);\necho "Sum: $sum\\n";\n`,
  rb: `puts "Hello, World!"\n\nnums = [1, 2, 3, 4, 5]\nsum = nums.sum\nputs "Sum: #{sum}"\n`,
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n\n    nums := []int{1, 2, 3, 4, 5}\n    sum := 0\n    for _, n := range nums {\n        sum += n\n    }\n    fmt.Println("Sum:", sum)\n}\n`,
  rs: `fn main() {\n    println!("Hello, World!");\n\n    let nums = vec![1, 2, 3, 4, 5];\n    let sum: i32 = nums.iter().sum();\n    println!("Sum: {}", sum);\n}\n`,
  dart: `void main() {\n  print("Hello, World!");\n\n  List<int> nums = [1, 2, 3, 4, 5];\n  int sum = nums.reduce((a, b) => a + b);\n  print("Sum: \$sum");\n}\n`,
  html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <p>Welcome to BM Compiler — HTML Runner.</p>\n  <ul>\n    <li>Item One</li>\n    <li>Item Two</li>\n    <li>Item Three</li>\n  </ul>\n</body>\n</html>\n`,
  css: `/* BM Compiler — CSS Runner */\nbody {\n  margin: 0;\n  font-family: sans-serif;\n  background: #1e1e1e;\n  color: #fff;\n}\n\nh1 {\n  color: #4ec9b0;\n  font-size: 2rem;\n}\n\n.container {\n  max-width: 800px;\n  margin: 0 auto;\n  padding: 1rem;\n}\n\n.button {\n  background: #0078d4;\n  color: #fff;\n  border: none;\n  padding: 0.5rem 1rem;\n  border-radius: 4px;\n  cursor: pointer;\n}\n`,
  sql: `-- BM Compiler — SQL Runner (SQLite engine)\nCREATE TABLE users (\n  id   INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  age  INTEGER\n);\n\nINSERT INTO users (name, age) VALUES ('Alice', 30);\nINSERT INTO users (name, age) VALUES ('Bob', 25);\nINSERT INTO users (name, age) VALUES ('Carol', 35);\n\nSELECT * FROM users;\nSELECT name FROM users WHERE age > 28 ORDER BY age;\n`,
  mysql: `-- BM Compiler — MySQL-compatible SQL (SQLite engine)\nCREATE TABLE products (\n  id    INTEGER PRIMARY KEY AUTOINCREMENT,\n  name  TEXT NOT NULL,\n  price REAL\n);\n\nINSERT INTO products (name, price) VALUES ('Apple', 1.20);\nINSERT INTO products (name, price) VALUES ('Banana', 0.50);\nINSERT INTO products (name, price) VALUES ('Cherry', 3.00);\n\nSELECT * FROM products;\nSELECT name, price FROM products WHERE price > 1.00 ORDER BY price DESC;\n`,
  ora: `-- BM Compiler — OracleSQL-compatible (SQLite engine)\nCREATE TABLE employees (\n  emp_id   INTEGER PRIMARY KEY,\n  emp_name TEXT NOT NULL,\n  salary   REAL,\n  dept     TEXT\n);\n\nINSERT INTO employees VALUES (1, 'Alice',  75000, 'Engineering');\nINSERT INTO employees VALUES (2, 'Bob',    60000, 'Marketing');\nINSERT INTO employees VALUES (3, 'Carol',  85000, 'Engineering');\n\nSELECT emp_name, salary FROM employees WHERE dept = 'Engineering' ORDER BY salary DESC;\nSELECT dept, AVG(salary) AS avg_salary FROM employees GROUP BY dept;\n`,
  sh: `#!/bin/bash\n\necho "Hello, World!"\n\n# Loop example\nfor i in 1 2 3 4 5; do\n  echo "Number: $i"\ndone\n\n# Arithmetic\nSUM=$((3 + 7))\necho "3 + 7 = $SUM"\n`,
};

function getEditorLang(target: TargetLanguage) {
  switch (target) {
    case "c":
    case "cpp":
      return cpp();
    case "java":
      return java();
    case "py":
      return python();
    case "js":
    case "ts":
    case "html":
    case "css":
    case "sql":
    case "mysql":
    case "ora":
    case "sh":
      return javascript();
    default:
      return javascript();
  }
}

export default function IDE() {
  const { user, loading, githubToken, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const stdinRef = useRef<HTMLTextAreaElement>(null);

  const [language, setLanguage] = useState<TargetLanguage>("c");
  const [filename, setFilename] = useState(defaultFilenames.c);
  const [folderPath, setFolderPath] = useState("");
  const [code, setCode] = useState(defaultCode.c);
  const [stdinInput, setStdinInput] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [terminalLines, setTerminalLines] = useState<Array<{ type: "system" | "stdout" | "stderr" | "stdin" | "info"; text: string }>>([
    { type: "system", text: "BM Compiler Terminal — Ready" },
    { type: "info", text: "Select a language, write code, and press Run (or Ctrl+Enter)." },
  ]);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [repo, setRepo] = useState<GithubRepo | null>(null);

  const isGuest = !user;

  useEffect(() => {
    const saved = localStorage.getItem("bm_selected_repo");
    if (saved) {
      try { setRepo(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLines]);

  const handleLanguageChange = useCallback((lang: TargetLanguage) => {
    setLanguage(lang);
    setFilename(defaultFilenames[lang]);
    setCode(defaultCode[lang]);
    setTerminalLines([
      { type: "system", text: `Switched to ${targetLabels[lang]}` },
      { type: "info", text: "Press Run (or Ctrl+Enter) to execute." },
    ]);
  }, []);

  const handleRun = async () => {
    setRunning(true);
    setTerminalOpen(true);

    const newLines: typeof terminalLines = [
      { type: "system", text: `$ bmcc --lang ${language} --file "${filename}" --run` },
    ];
    if (stdinInput.trim()) {
      newLines.push({ type: "stdin", text: `[stdin] ${stdinInput}` });
    }
    newLines.push({ type: "info", text: "Running..." });
    setTerminalLines(newLines);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(githubToken ? { "X-GitHub-Token": githubToken } : {}),
        },
        body: JSON.stringify({ language, filename, code, stdin: stdinInput || undefined }),
      });
      const result: RunResult = await res.json();
      const outputLines: typeof terminalLines = [...newLines.slice(0, -1)];

      if (result.stdout) {
        result.stdout.split("\n").forEach((line) => {
          if (line !== "") outputLines.push({ type: "stdout", text: line });
        });
      }
      if (result.stderr) {
        result.stderr.split("\n").forEach((line) => {
          if (line !== "") outputLines.push({ type: "stderr", text: line });
        });
      }
      outputLines.push({
        type: result.ok ? "system" : "stderr",
        text: `\nProcess exited with code ${result.exit_code} (${result.phase})`,
      });
      setTerminalLines(outputLines);
    } catch (err: any) {
      setTerminalLines([
        ...newLines.slice(0, -1),
        { type: "stderr", text: err.message || "Request failed" },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const getCommitPath = () => {
    const folder = folderPath.trim().replace(/^\/+|\/+$/g, "");
    return folder ? `${folder}/${filename}` : filename;
  };

  const handleSave = async () => {
    if (!githubToken || !repo) {
      toast({ title: "Cannot save", description: repo ? "No GitHub token" : "No repository selected", variant: "destructive" });
      return;
    }
    setSaving(true);
    const commitPath = getCommitPath();
    try {
      const res = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-GitHub-Token": githubToken },
        body: JSON.stringify({ repo: repo.full_name, path: commitPath, content: code, message: `Update ${commitPath} via BM Compiler` }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "File saved", description: `${commitPath} committed to ${repo.name}` });
      } else {
        throw new Error(data.error || "Failed to save");
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("bm_selected_repo");
    await logout();
    navigate("/");
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (!isGuest) handleSave(); }
    },
    [code, language, filename, githubToken, repo, stdinInput, isGuest]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1e1e]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-white" data-testid="ide-page">
      <header className="flex items-center justify-between px-4 h-12 bg-[#252526] border-b border-[#3c3c3c] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 flex items-center justify-center">
            <img src="/bm-logo.png" alt="BM Compiler Logo" className="w-7 h-7 object-contain" />
          </div>
          <span className="font-semibold text-sm hidden md:inline" data-testid="text-header-title">BM Compiler</span>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-center max-w-3xl mx-4">
          <Select value={language} onValueChange={(v) => handleLanguageChange(v as TargetLanguage)}>
            <SelectTrigger className="w-36 h-8 bg-[#3c3c3c] border-[#555] text-white text-sm" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#252526] border-[#555] text-white max-h-80">
              {languageGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                    {group.label}
                  </div>
                  {group.langs.map((lang) => (
                    <SelectItem key={lang} value={lang} className="text-white hover:bg-[#3c3c3c] focus:bg-[#3c3c3c]">
                      {targetLabels[lang]}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-0.5">
            <div className="relative flex items-center">
              <Input
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                className="w-28 h-8 bg-[#3c3c3c] border-[#555] border-r-0 rounded-r-none text-white text-sm pr-2"
                placeholder="folder/"
                title="Folder path in GitHub repo (e.g. src)"
                data-testid="input-folder-path"
              />
              <span className="h-8 flex items-center text-gray-400 bg-[#3c3c3c] border border-[#555] border-l-0 border-r-0 px-0.5 select-none">/</span>
            </div>
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-32 h-8 bg-[#3c3c3c] border-[#555] border-l-0 rounded-l-none text-white text-sm"
              data-testid="input-filename"
            />
          </div>

          <Button
            onClick={handleRun}
            disabled={running || !code.trim()}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white h-8 px-4"
            data-testid="button-run"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            Run
          </Button>

          {!isGuest && (
            <Button
              onClick={handleSave}
              disabled={saving || !code.trim() || !repo}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4"
              data-testid="button-save"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isGuest && repo && (
            <button
              onClick={() => navigate("/repo-setup")}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              data-testid="button-change-repo"
              title={`Saves to: ${repo.full_name}/${getCommitPath()}`}
            >
              <FolderGit2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{repo.name}/{getCommitPath()}</span>
            </button>
          )}
          {isGuest ? (
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}
              className="text-gray-400 hover:text-white h-8 text-xs gap-1" data-testid="button-sign-in">
              <User className="h-4 w-4" />
              <span className="hidden md:inline">Sign in</span>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleLogout}
              className="text-gray-400 hover:text-white h-8" data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`${terminalOpen ? "flex-1" : "flex-[3]"} overflow-hidden`}>
          <CodeMirror
            value={code}
            onChange={setCode}
            extensions={[getEditorLang(language)]}
            theme={oneDark}
            height="100%"
            className="h-full text-sm"
            data-testid="code-editor"
          />
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={() => setTerminalOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-1.5 bg-[#252526] border-t border-[#3c3c3c] text-xs text-gray-400 hover:text-white"
            data-testid="button-toggle-terminal"
          >
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5" />
              <span className="font-medium">Terminal</span>
              <span className="text-[10px] text-gray-600">— {targetLabels[language]}</span>
            </div>
            {terminalOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>

        {terminalOpen && (
          <div className="h-72 bg-[#0d0d0d] border-t border-[#3c3c3c] flex flex-col flex-shrink-0" data-testid="terminal-panel">
            <div className="flex-1 overflow-auto p-3 font-mono text-xs">
              {terminalLines.map((line, i) => (
                <div key={i} className={`leading-5 whitespace-pre-wrap ${
                  line.type === "stdout" ? "text-[#4ec9b0]" :
                  line.type === "stderr" ? "text-[#f44747]" :
                  line.type === "stdin"  ? "text-[#dcdcaa]" :
                  line.type === "system" ? "text-[#569cd6]" :
                  "text-[#808080]"
                }`} data-testid={`terminal-line-${i}`}>
                  {line.type === "system" && <span className="text-[#808080] mr-1">{">"}</span>}
                  {line.text}
                </div>
              ))}
              {running && (
                <div className="flex items-center gap-2 text-[#808080] leading-5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Running...</span>
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>

            <div className="border-t border-[#2d2d30] bg-[#1a1a1a] px-3 py-1.5 flex-shrink-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#dcdcaa] text-xs font-mono select-none" data-testid="stdin-label">
                  stdin {">"} <span className="text-[#555]">program input (one value per line)</span>
                </span>
                <Button onClick={handleRun} disabled={running || !code.trim()} size="sm" variant="ghost"
                  className="h-6 px-2 text-green-500" data-testid="button-run-terminal">
                  <Play className="h-3 w-3 mr-1" />
                  <span className="text-xs">Run</span>
                </Button>
              </div>
              <textarea
                ref={stdinRef}
                value={stdinInput}
                onChange={(e) => setStdinInput(e.target.value)}
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleRun(); } }}
                placeholder="Type input values here (e.g. 5.0), one per line. Press Ctrl+Enter to run."
                rows={2}
                className="w-full bg-[#0d0d0d] border border-[#2d2d30] rounded text-white text-xs font-mono placeholder:text-[#555] p-2 resize-none focus:outline-none focus:border-[#569cd6]"
                data-testid="input-stdin"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
