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
import { defaultFilenames, targetLabels } from "@shared/schema";

const defaultCode: Record<TargetLanguage, string> = {
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
  py: `print("Hello, World!")\n`,
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
    default:
      return javascript();
  }
}

export default function IDE() {
  const { user, loading, githubToken, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const stdinRef = useRef<HTMLInputElement>(null);

  const [language, setLanguage] = useState<TargetLanguage>("c");
  const [filename, setFilename] = useState(defaultFilenames.c);
  const [code, setCode] = useState(defaultCode.c);
  const [stdinInput, setStdinInput] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [terminalLines, setTerminalLines] = useState<Array<{ type: "system" | "stdout" | "stderr" | "stdin" | "info"; text: string }>>([
    { type: "system", text: "BM Compiler Terminal — Ready" },
    { type: "info", text: "Type your input below and press Run (or Ctrl+Enter) to execute." },
  ]);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [repo, setRepo] = useState<GithubRepo | null>(null);

  const isGuest = !user;

  useEffect(() => {
    const saved = localStorage.getItem("bm_selected_repo");
    if (saved) {
      try {
        setRepo(JSON.parse(saved));
      } catch {}
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
      { type: "info", text: "Type your input below and press Run (or Ctrl+Enter) to execute." },
    ]);
  }, []);

  const handleRun = async () => {
    setRunning(true);
    setTerminalOpen(true);

    const newLines: typeof terminalLines = [
      { type: "system", text: `$ bmcc --lang ${language} --file "${filename}" run` },
    ];
    if (stdinInput.trim()) {
      newLines.push({ type: "stdin", text: `[stdin] ${stdinInput}` });
    }
    newLines.push({ type: "info", text: "Compiling and running..." });
    setTerminalLines(newLines);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(githubToken ? { "X-GitHub-Token": githubToken } : {}),
        },
        body: JSON.stringify({
          language,
          filename,
          code,
          stdin: stdinInput || undefined,
        }),
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

  const handleSave = async () => {
    if (!githubToken || !repo) {
      toast({
        title: "Cannot save",
        description: repo ? "No GitHub token available" : "No repository selected",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/github/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitHub-Token": githubToken,
        },
        body: JSON.stringify({
          repo: repo.full_name,
          path: filename,
          content: code,
          message: `Update ${filename} via BM Compiler`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "File saved",
          description: `${filename} committed to ${repo.name}`,
        });
      } else {
        throw new Error(data.error || "Failed to save");
      }
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("bm_selected_repo");
    await logout();
    navigate("/");
  };

  const handleStdinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!isGuest) handleSave();
      }
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
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold text-white">BM</span>
          </div>
          <span className="font-semibold text-sm hidden md:inline" data-testid="text-header-title">BM Compiler</span>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-center max-w-2xl mx-4">
          <Select value={language} onValueChange={(v) => handleLanguageChange(v as TargetLanguage)}>
            <SelectTrigger className="w-28 h-8 bg-[#3c3c3c] border-[#555] text-white text-sm" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#3c3c3c] border-[#555] text-white">
              <SelectItem value="c" data-testid="option-c">C</SelectItem>
              <SelectItem value="cpp" data-testid="option-cpp">C++</SelectItem>
              <SelectItem value="java" data-testid="option-java">Java</SelectItem>
              <SelectItem value="py" data-testid="option-py">Python</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-36 h-8 bg-[#3c3c3c] border-[#555] text-white text-sm"
            data-testid="input-filename"
          />

          <Button
            onClick={handleRun}
            disabled={running || !code.trim()}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white h-8 px-4"
            data-testid="button-run"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
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
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
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
            >
              <FolderGit2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{repo.name}</span>
            </button>
          )}
          {isGuest ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-gray-400 hover:text-white h-8 text-xs gap-1"
              data-testid="button-sign-in"
            >
              <User className="h-4 w-4" />
              <span className="hidden md:inline">Sign in</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-400 hover:text-white h-8"
              data-testid="button-logout"
            >
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
            </div>
            {terminalOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>

        {terminalOpen && (
          <div className="h-72 bg-[#0d0d0d] border-t border-[#3c3c3c] flex flex-col flex-shrink-0" data-testid="terminal-panel">
            <div className="flex-1 overflow-auto p-3 font-mono text-xs">
              {terminalLines.map((line, i) => (
                <div key={i} className={`leading-5 ${
                  line.type === "stdout" ? "text-[#4ec9b0]" :
                  line.type === "stderr" ? "text-[#f44747]" :
                  line.type === "stdin" ? "text-[#dcdcaa]" :
                  line.type === "system" ? "text-[#569cd6]" :
                  "text-[#808080]"
                }`} data-testid={`terminal-line-${i}`}>
                  {line.type === "system" && <span className="text-[#808080] mr-1">{'>'}</span>}
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
                <span className="text-[#dcdcaa] text-xs font-mono select-none" data-testid="stdin-label">stdin {'>'} <span className="text-[#555]">input for your program (supports multiple lines)</span></span>
                <Button
                  onClick={handleRun}
                  disabled={running || !code.trim()}
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-green-500"
                  data-testid="button-run-terminal"
                >
                  <Play className="h-3 w-3 mr-1" />
                  <span className="text-xs">Run</span>
                </Button>
              </div>
              <textarea
                ref={stdinRef as any}
                value={stdinInput}
                onChange={(e) => setStdinInput(e.target.value)}
                onKeyDown={handleStdinKeyDown}
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
