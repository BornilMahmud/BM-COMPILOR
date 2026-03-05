import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Save, FolderGit2, LogOut, ChevronDown, ChevronUp } from "lucide-react";
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

  const [language, setLanguage] = useState<TargetLanguage>("c");
  const [filename, setFilename] = useState(defaultFilenames.c);
  const [code, setCode] = useState(defaultCode.c);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [output, setOutput] = useState<RunResult | null>(null);
  const [status, setStatus] = useState<string>("");
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [repo, setRepo] = useState<GithubRepo | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
      return;
    }
    const saved = localStorage.getItem("bm_selected_repo");
    if (saved) {
      try {
        setRepo(JSON.parse(saved));
      } catch {}
    }
  }, [user, loading, navigate]);

  const handleLanguageChange = useCallback((lang: TargetLanguage) => {
    setLanguage(lang);
    setFilename(defaultFilenames[lang]);
    setCode(defaultCode[lang]);
    setOutput(null);
    setStatus("");
  }, []);

  const handleRun = async () => {
    setRunning(true);
    setStatus("Running...");
    setOutput(null);
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
        }),
      });
      const result: RunResult = await res.json();
      setOutput(result);
      setStatus(result.ok ? "Run completed" : `Error (${result.phase})`);
      setTerminalOpen(true);
    } catch (err: any) {
      setOutput({
        ok: false,
        exit_code: 1,
        stdout: "",
        stderr: err.message || "Request failed",
        phase: "setup",
      });
      setStatus("Error");
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
    setStatus("Saving...");
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
        setStatus("Saved!");
        toast({
          title: "File saved",
          description: `${filename} committed to ${repo.name}`,
        });
      } else {
        throw new Error(data.error || "Failed to save");
      }
    } catch (err: any) {
      setStatus("Save failed");
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    },
    [code, language, filename, githubToken, repo]
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
        </div>

        <div className="flex items-center gap-2">
          {repo && (
            <button
              onClick={() => navigate("/repo-setup")}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              data-testid="button-change-repo"
            >
              <FolderGit2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{repo.name}</span>
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-400 hover:text-white h-8"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {status && (
        <div className={`px-4 py-1 text-xs flex-shrink-0 ${
          status.includes("Error") || status.includes("failed")
            ? "bg-red-900/50 text-red-300"
            : status === "Saved!"
            ? "bg-green-900/50 text-green-300"
            : "bg-blue-900/50 text-blue-300"
        }`} data-testid="text-status">
          {status}
        </div>
      )}

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
            <span className="font-medium">Terminal Output</span>
            {terminalOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>

        {terminalOpen && (
          <div className="h-64 bg-[#1a1a1a] border-t border-[#3c3c3c] overflow-auto flex-shrink-0" data-testid="terminal-panel">
            {output ? (
              <div className="p-3 font-mono text-xs space-y-2">
                {output.stdout && (
                  <div data-testid="terminal-stdout">
                    <span className="text-gray-500">stdout:</span>
                    <pre className="text-green-400 whitespace-pre-wrap mt-0.5">{output.stdout}</pre>
                  </div>
                )}
                {output.stderr && (
                  <div data-testid="terminal-stderr">
                    <span className="text-gray-500">stderr:</span>
                    <pre className="text-red-400 whitespace-pre-wrap mt-0.5">{output.stderr}</pre>
                  </div>
                )}
                <div className="text-gray-500 border-t border-[#3c3c3c] pt-1 mt-2" data-testid="terminal-exit-info">
                  Exit code: {output.exit_code} | Phase: {output.phase} | Status: {output.ok ? "OK" : "Error"}
                </div>
              </div>
            ) : (
              <div className="p-3 text-gray-500 text-xs font-mono" data-testid="terminal-placeholder">
                Press Run (or Ctrl+Enter) to execute your code...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
