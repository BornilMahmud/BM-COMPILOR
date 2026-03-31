import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Play, Save, FolderGit2, LogOut, ChevronDown, ChevronUp,
  Terminal, User, X, Upload, Menu, Github, CloudDownload, SquareTerminal,
  RefreshCw, Download,
} from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import type { TargetLanguage, GithubRepo, RunResult } from "@shared/schema";
import { targetLabels, languageGroups } from "@shared/schema";
import { useFileTree, findNodeById, collectFiles, getNodePath } from "@/hooks/use-file-tree";
import type { FileNode } from "@/hooks/use-file-tree";
import FileExplorer from "@/components/file-explorer";
import GitHubImportModal from "@/components/github-import-modal";
import XTermTerminal from "@/components/xterm-terminal";
import type { XTermHandle } from "@/components/xterm-terminal";

function getEditorLang(target: TargetLanguage) {
  switch (target) {
    case "c": case "cpp": return cpp();
    case "java": return java();
    case "py": return python();
    case "js": case "ts": case "sql": case "mysql": case "ora": case "sh": return javascript();
    default: return javascript();
  }
}

export default function IDE() {
  const { user, loading, githubToken, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const tabsRef = useRef<HTMLDivElement>(null);
  const xtermOutputRef = useRef<XTermHandle>(null);
  const xtermShellRef = useRef<XTermHandle>(null);

  const { tree, createFile, createFolder, deleteNode, renameNode, updateContent, toggleFolder, importFiles, replaceWithFiles } = useFileTree();

  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    const saved = localStorage.getItem("bm_open_tabs");
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    return localStorage.getItem("bm_active_tab") ?? null;
  });

  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingShell, setSyncingShell] = useState(false);
  const [lastBuild, setLastBuild] = useState<{ binary: string; name: string } | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalTab, setTerminalTab] = useState<"output" | "shell">("output");
  const [stdinLines, setStdinLines] = useState<string[]>([]);
  const [stdinDraft, setStdinDraft] = useState("");
  const [repo, setRepo] = useState<GithubRepo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [loadingRepoFiles, setLoadingRepoFiles] = useState(false);
  const [needsAutoLoad, setNeedsAutoLoad] = useState(false);

  const isGuest = !user;

  const activeFile = activeTabId ? findNodeById(tree, activeTabId) : null;
  const language: TargetLanguage = (activeFile?.language ?? "js") as TargetLanguage;

  useEffect(() => {
    const saved = localStorage.getItem("bm_selected_repo");
    if (saved) {
      try {
        const savedRepo: GithubRepo = JSON.parse(saved);
        setRepo(savedRepo);
        const lastLoaded = localStorage.getItem("bm_loaded_repo");
        if (lastLoaded !== savedRepo.full_name) {
          setNeedsAutoLoad(true);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    const findFirst = (nodes: FileNode[]): FileNode | null => {
      for (const n of nodes) {
        if (n.type === "file") return n;
        if (n.type === "folder") { const f = findFirst(n.children); if (f) return f; }
      }
      return null;
    };
    setOpenTabs((prev) => {
      const filtered = prev.filter((id) => findNodeById(tree, id) !== null);
      if (filtered.length === 0) {
        const node = findFirst(tree);
        if (node) { setActiveTabId(node.id); return [node.id]; }
      }
      return filtered;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("bm_open_tabs", JSON.stringify(openTabs));
  }, [openTabs]);

  useEffect(() => {
    if (activeTabId) localStorage.setItem("bm_active_tab", activeTabId);
    else localStorage.removeItem("bm_active_tab");
  }, [activeTabId]);

  useEffect(() => {
    if (!loading && needsAutoLoad && repo) {
      setNeedsAutoLoad(false);
      loadRepoFiles(repo);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, needsAutoLoad, repo]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openFile = useCallback((node: FileNode) => {
    if (node.type !== "file") return;
    setOpenTabs((prev) => prev.includes(node.id) ? prev : [...prev, node.id]);
    setActiveTabId(node.id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const closeTab = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== id);
      if (activeTabId === id) {
        const idx = prev.indexOf(id);
        const nextActive = next[Math.min(idx, next.length - 1)] ?? null;
        setActiveTabId(nextActive);
      }
      return next;
    });
  }, [activeTabId]);

  const handleCodeChange = useCallback((value: string) => {
    if (activeTabId) updateContent(activeTabId, value);
  }, [activeTabId, updateContent]);

  const handleCreate = useCallback((type: "file" | "folder", parentId: string | null, name: string): FileNode => {
    if (type === "file") return createFile(parentId, name);
    return createFolder(parentId, name);
  }, [createFile, createFolder]);

  const handleDelete = useCallback((id: string) => {
    deleteNode(id);
    setOpenTabs((prev) => prev.filter((t) => t !== id));
    setActiveTabId((prev) => prev !== id ? prev : null);
  }, [deleteNode]);

  const handleImportFiles = useCallback((files: { path: string; content: string }[]) => {
    const newTree = importFiles(files);
    const findFirst = (nodes: FileNode[]): FileNode | null => {
      for (const n of nodes) {
        if (n.type === "file") return n;
        if (n.type === "folder") { const f = findFirst(n.children); if (f) return f; }
      }
      return null;
    };
    for (const { path } of files) {
      const name = path.split("/").pop() ?? path;
      const findByName = (nodes: FileNode[]): FileNode | null => {
        for (const n of nodes) {
          if (n.type === "file" && n.name === name) return n;
          if (n.type === "folder") { const f = findByName(n.children); if (f) return f; }
        }
        return null;
      };
      const node = findByName(newTree);
      if (node) {
        setOpenTabs((prev) => prev.includes(node.id) ? prev : [...prev, node.id]);
        setActiveTabId(node.id);
        break;
      }
    }
    toast({ title: "Imported", description: `${files.length} file(s) added to Explorer` });
  }, [importFiles, toast]);

  const isFlexBisonFile = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    return ext === "l" || ext === "y";
  };

  const handleRun = async () => {
    if (!activeFile) {
      toast({ title: "No file open", description: "Open or create a file first.", variant: "destructive" });
      return;
    }
    setRunning(true);
    setLastBuild(null);
    setTerminalOpen(true);
    setTerminalTab("output");
    const out = xtermOutputRef.current;

    if (isFlexBisonFile(activeFile.name)) {
      const COMPILE_EXTS = new Set(["l","y","c","h","cpp","cc","cxx","hpp","hh"]);
      const allFiles = collectFiles(tree)
        .filter((f) => COMPILE_EXTS.has(f.path.split(".").pop()?.toLowerCase() ?? ""))
        .map((f) => ({ path: f.path, content: f.content }));
      const lexCount = allFiles.filter((f) => f.path.endsWith(".l")).length;
      const bisonCount = allFiles.filter((f) => f.path.endsWith(".y")).length;
      out?.writeCommand(`flex-bison pipeline — ${lexCount} .l, ${bisonCount} .y, ${allFiles.length} source files`);
      const stdinStr = stdinLines.join("\n");
      if (stdinStr.trim()) out?.writeOutput(`[stdin] ${stdinStr}`);
      out?.writeOutput("\x1b[90mRunning flex → bison → gcc...\x1b[0m");
      try {
        const res = await fetch("/api/run-flex-bison", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: allFiles, stdin: stdinStr || undefined }),
        });
        const result = await res.json();
        if (result.generated?.length) {
          out?.writeOutput(`\x1b[90m[generated: ${result.generated.join(", ")}]\x1b[0m`);
        }
        if (result.stdout) out?.writeOutput(result.stdout);
        if (result.stderr) out?.writeOutput(result.stderr, true);
        const exitColor = result.ok ? "\x1b[32m" : "\x1b[31m";
        out?.writeOutput(`${exitColor}[exited: code ${result.exit_code} · ${result.phase}]\x1b[0m`);
        if (result.ok && result.binary) {
          const binName = "a.out";
          setLastBuild({ binary: result.binary, name: binName });
          out?.writeOutput(`\x1b[32m[binary ready — switch to Shell tab, then type: ./a.out]\x1b[0m`);
        }
      } catch (err: any) {
        out?.writeOutput(err.message || "Request failed", true);
      } finally {
        setRunning(false);
      }
      return;
    }

    const stdinStr = stdinLines.join("\n");
    out?.writeCommand(`bmcc --lang ${language} --file "${activeFile.name}" --run`);
    if (stdinStr.trim()) out?.writeOutput(`[stdin] ${stdinStr}`);
    out?.writeOutput("\x1b[90mRunning...\x1b[0m");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(githubToken ? { "X-GitHub-Token": githubToken } : {}),
        },
        body: JSON.stringify({ language, filename: activeFile.name, code: activeFile.content, stdin: stdinStr || undefined }),
      });
      const result: RunResult = await res.json();
      if (result.stdout) out?.writeOutput(result.stdout);
      if (result.stderr) out?.writeOutput(result.stderr, true);
      const exitColor = result.ok ? "\x1b[32m" : "\x1b[31m";
      out?.writeOutput(`${exitColor}[exited: code ${result.exit_code} · ${result.phase}]\x1b[0m`);
    } catch (err: any) {
      out?.writeOutput(err.message || "Request failed", true);
    } finally {
      setRunning(false);
    }
  };

  const handleSyncToShell = async () => {
    setSyncingShell(true);
    try {
      const SHELL_EXTS = new Set(["l","y","c","h","cpp","cc","cxx","hpp","hh","sh","bash","txt","py","rb","go","rs"]);
      const allFiles = collectFiles(tree)
        .filter((f) => SHELL_EXTS.has(f.path.split(".").pop()?.toLowerCase() ?? ""))
        .map((f) => ({ path: f.path, content: f.content }));
      const res = await fetch("/api/shell/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: allFiles }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Sync failed");
      setTerminalTab("shell");
      setTimeout(() => {
        xtermShellRef.current?.sendInput("ls\r");
        xtermShellRef.current?.focus();
      }, 120);
      toast({ title: "Synced to Shell", description: `${data.count} file(s) written to ${data.path}` });
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncingShell(false);
    }
  };

  const handleDownloadBinary = () => {
    if (!lastBuild) return;
    const bytes = Uint8Array.from(atob(lastBuild.binary), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = lastBuild.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunInShell = () => {
    setTerminalTab("shell");
    setTerminalOpen(true);
    setTimeout(() => {
      xtermShellRef.current?.sendInput("./a.out\r");
      xtermShellRef.current?.focus();
    }, 120);
  };

  const loadRepoFiles = async (targetRepo?: GithubRepo) => {
    const repoToLoad = targetRepo ?? repo;
    if (!repoToLoad) return;
    const token = githubToken;
    setLoadingRepoFiles(true);
    const [owner, repoName] = repoToLoad.full_name.split("/");
    try {
      const headers: Record<string, string> = {};
      if (token) headers["X-GitHub-Token"] = token;
      const treeRes = await fetch(`/api/github/repo-tree?owner=${owner}&repo=${repoName}`, { headers });
      if (!treeRes.ok) throw new Error("Failed to load repo tree");
      const treeData = await treeRes.json();
      const supportedExts = new Set(["c","cpp","cc","cxx","h","hpp","java","py","js","mjs","ts","jsx","tsx","php","rb","go","rs","dart","sql","mysql","ora","sh","bash","md","txt","json","yaml","yml","toml","xml","html","css","scss","l","y"]);
      const codePaths: string[] = (treeData.files as { path: string; size: number }[])
        .filter((f) => {
          const ext = f.path.split(".").pop()?.toLowerCase() ?? "";
          return supportedExts.has(ext) && f.size < 500000;
        })
        .slice(0, 300)
        .map((f) => f.path);
      if (codePaths.length === 0) {
        toast({ title: "No files found", description: "This repo has no supported code files.", variant: "destructive" });
        return;
      }
      const contentRes = await fetch("/api/github/import-files", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ owner, repo: repoName, branch: treeData.branch, paths: codePaths }),
      });
      if (!contentRes.ok) throw new Error("Failed to fetch file contents");
      const contentData = await contentRes.json();
      const newTree = replaceWithFiles(contentData.files as { path: string; content: string }[]);
      localStorage.setItem("bm_open_tabs", "[]");
      localStorage.removeItem("bm_active_tab");
      setOpenTabs([]);
      setActiveTabId(null);
      const findFirst = (nodes: FileNode[]): FileNode | null => {
        for (const n of nodes) {
          if (n.type === "file") return n;
          if (n.type === "folder") { const f = findFirst(n.children); if (f) return f; }
        }
        return null;
      };
      const firstNode = findFirst(newTree);
      if (firstNode) { setOpenTabs([firstNode.id]); setActiveTabId(firstNode.id); }
      localStorage.setItem("bm_loaded_repo", repoToLoad.full_name);
      toast({ title: `Loaded ${contentData.files.length} files`, description: `From ${repoToLoad.full_name}` });
    } catch (err: any) {
      toast({ title: "Failed to load repo files", description: err.message, variant: "destructive" });
    } finally {
      setLoadingRepoFiles(false);
    }
  };

  const handleSaveFile = async () => {
    if (!activeFile || !githubToken || !repo) {
      toast({ title: "Cannot save", description: repo ? "No GitHub token" : "No repository selected", variant: "destructive" });
      return;
    }
    setSaving(true);
    const filePath = activeTabId ? (getNodePath(tree, activeTabId) || activeFile.name) : activeFile.name;
    try {
      const res = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-GitHub-Token": githubToken },
        body: JSON.stringify({ repo: repo.full_name, path: filePath, content: activeFile.content, message: `Update ${filePath} via BM Compiler` }),
      });
      const data = await res.json();
      if (data.success) toast({ title: "Saved", description: `${filePath} pushed to ${repo.name}` });
      else throw new Error(data.error || "Failed");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePushFiles = async (files: { path: string; content: string }[], label: string, basePath?: string) => {
    if (!githubToken || !repo) {
      toast({ title: "Cannot push", description: repo ? "No GitHub token" : "No repository selected", variant: "destructive" });
      return;
    }
    if (files.length === 0) {
      toast({ title: "Nothing to push", description: "No files found.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/github/commit-tree", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-GitHub-Token": githubToken },
        body: JSON.stringify({ repo: repo.full_name, files, basePath, message: `Push ${label} via BM Compiler` }),
      });
      const data = await res.json();
      if (data.success) toast({ title: "Pushed to GitHub", description: `${data.count} file(s) committed to ${repo.name}` });
      else throw new Error(data.error || "Failed");
    } catch (err: any) {
      toast({ title: "Push failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePushAll = () => {
    const files = collectFiles(tree);
    handlePushFiles(files.map((f) => ({ path: f.path, content: f.content })), `${files.length} file(s)`);
  };

  const handlePushFolder = (nodes: FileNode[], folderPath: string) => {
    const files = collectFiles(nodes, "");
    handlePushFiles(files.map((f) => ({ path: f.path, content: f.content })), `folder "${folderPath}"`, folderPath);
  };

  const handleLogout = async () => {
    localStorage.removeItem("bm_selected_repo");
    localStorage.removeItem("bm_open_tabs");
    localStorage.removeItem("bm_active_tab");
    await logout();
    navigate("/");
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (!isGuest) handleSaveFile(); }
  }, [activeFile, language, githubToken, repo, stdinLines, isGuest]);

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
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-white overflow-hidden">
      <header className="flex items-center justify-between px-2 sm:px-3 h-11 bg-[#252526] border-b border-[#3c3c3c] flex-shrink-0 gap-1">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-1.5 rounded hover:bg-[#3c3c3c] text-gray-400 hover:text-white md:hidden"
            title="Toggle explorer"
          >
            <Menu className="h-4 w-4" />
          </button>
          <img src="/bm-logo.png" alt="BM" className="w-6 h-6 object-contain" />
          <span className="font-semibold text-sm hidden sm:inline text-gray-300">BM Compiler</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
          <Select
            value={language}
            onValueChange={() => {
              if (activeTabId) {
                const node = findNodeById(tree, activeTabId);
                if (node) updateContent(activeTabId, node.content);
              }
            }}
          >
            <SelectTrigger className="w-28 sm:w-36 h-7 bg-[#3c3c3c] border-[#555] text-white text-xs flex-shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#252526] border-[#555] text-white max-h-80">
              {languageGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{group.label}</div>
                  {group.langs.map((lang) => (
                    <SelectItem key={lang} value={lang} className="text-white hover:bg-[#3c3c3c] focus:bg-[#3c3c3c] text-xs">
                      {targetLabels[lang]}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>

          {activeFile && isFlexBisonFile(activeFile.name) && (
            <span className="hidden sm:inline text-[10px] text-amber-400 font-mono bg-amber-900/30 border border-amber-700/40 px-1.5 py-0.5 rounded flex-shrink-0">
              Flex/Bison
            </span>
          )}
          <Button
            onClick={handleRun}
            disabled={running || !activeFile}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white h-7 px-2 sm:px-3 text-xs flex-shrink-0"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline ml-1">Run</span>
          </Button>

          <Button
            onClick={() => setImportModalOpen(true)}
            size="sm"
            variant="outline"
            className="bg-transparent border-[#555] hover:bg-[#3c3c3c] text-gray-300 h-7 px-2 sm:px-3 text-xs flex-shrink-0"
            title="Import project from GitHub"
          >
            <Github className="h-3.5 w-3.5" />
            <span className="hidden sm:inline ml-1">Import</span>
          </Button>

          {!isGuest && (
            <Button
              onClick={handleSaveFile}
              disabled={saving || !activeFile || !repo}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-2 sm:px-3 text-xs flex-shrink-0"
              title="Save current file to GitHub (Ctrl+S)"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="hidden md:inline ml-1">Save</span>
            </Button>
          )}

          {!isGuest && (
            <Button
              onClick={handlePushAll}
              disabled={saving || !repo}
              size="sm"
              variant="outline"
              className="bg-transparent border-[#555] hover:bg-[#3c3c3c] text-gray-300 h-7 px-2 sm:px-3 text-xs hidden sm:flex flex-shrink-0"
              title="Push all files to GitHub"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              <span className="hidden md:inline ml-1">Push All</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {!isGuest && repo && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate("/repo-setup")}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                title={`Connected to ${repo.full_name}`}
              >
                <FolderGit2 className="h-3.5 w-3.5" />
                <span className="hidden lg:inline max-w-[80px] truncate">{repo.name}</span>
              </button>
              <button
                onClick={() => loadRepoFiles()}
                disabled={loadingRepoFiles}
                title={`Load files from ${repo.full_name}`}
                className="p-1 rounded hover:bg-[#3c3c3c] text-gray-400 hover:text-green-400 disabled:opacity-50"
              >
                {loadingRepoFiles
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <CloudDownload className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
          {isGuest ? (
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}
              className="text-gray-400 hover:text-white h-7 text-xs gap-1">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleLogout}
              className="text-gray-400 hover:text-white h-7">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {sidebarOpen && window.innerWidth < 768 && (
          <div
            className="absolute inset-0 bg-black/50 z-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={`
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static
          absolute z-30 h-full
          transition-transform duration-200
        `}>
          <FileExplorer
            tree={tree}
            activeFileId={activeTabId}
            onOpenFile={openFile}
            onCreate={handleCreate}
            onDelete={handleDelete}
            onRename={renameNode}
            onToggle={toggleFolder}
            onPushFolder={handlePushFolder}
            onPushAll={handlePushAll}
            onDropFiles={handleImportFiles}
            loading={loadingRepoFiles}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div
            ref={tabsRef}
            className="flex items-end bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto flex-shrink-0 scrollbar-none"
            style={{ minHeight: 35, maxHeight: 35 }}
          >
            {openTabs.map((tabId) => {
              const node = findNodeById(tree, tabId);
              if (!node) return null;
              const isActive = tabId === activeTabId;
              return (
                <button
                  key={tabId}
                  onClick={() => setActiveTabId(tabId)}
                  className={`flex items-center gap-1.5 px-3 h-[35px] text-xs border-r border-[#3c3c3c] flex-shrink-0 group
                    ${isActive ? "bg-[#1e1e1e] text-white border-t-2 border-t-blue-500" : "bg-[#2d2d2d] text-gray-400 hover:text-gray-200 hover:bg-[#383838]"}`}
                >
                  <span className="max-w-[100px] sm:max-w-[140px] truncate">{node.name}</span>
                  <span
                    onClick={(e) => closeTab(tabId, e)}
                    className={`ml-1 rounded p-0.5 hover:bg-[#505050] opacity-0 group-hover:opacity-100 ${isActive ? "opacity-100" : ""}`}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
            {openTabs.length === 0 && (
              <span className="px-4 py-2 text-xs text-gray-600">Open a file from the explorer</span>
            )}
          </div>

          {activeFile && activeTabId && (
            <div className="flex items-center px-3 py-0.5 bg-[#1e1e1e] border-b border-[#2d2d2d] flex-shrink-0 gap-1 overflow-hidden">
              {getNodePath(tree, activeTabId).split("/").map((part, i, arr) => (
                <span key={i} className="flex items-center gap-1 flex-shrink-0">
                  {i > 0 && <span className="text-gray-700 text-[10px]">/</span>}
                  <span className={`text-[10px] truncate ${i === arr.length - 1 ? "text-gray-400" : "text-gray-600"}`}>
                    {part}
                  </span>
                </span>
              ))}
              {repo && (
                <span className="ml-auto text-[10px] text-gray-700 flex-shrink-0 hidden sm:block">
                  saves to → <span className="text-gray-500">{repo.name}/{getNodePath(tree, activeTabId)}</span>
                </span>
              )}
            </div>
          )}

          <div className={`${terminalOpen ? "flex-1" : "flex-[3]"} overflow-hidden`}>
            {activeFile ? (
              <CodeMirror
                key={activeFile.id}
                value={activeFile.content}
                onChange={handleCodeChange}
                extensions={[getEditorLang(language)]}
                theme={oneDark}
                height="100%"
                className="h-full text-sm"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                <div className="text-center px-4">
                  <p>No file open</p>
                  <p className="text-xs mt-1 text-gray-700">Create or open a file from the Explorer</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 border-t border-[#3c3c3c]">
            <div className="flex items-center bg-[#252526]">
              <button
                onClick={() => setTerminalOpen((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                <Terminal className="h-3.5 w-3.5" />
                {terminalOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              </button>

              {terminalOpen && (
                <>
                  <button
                    onClick={() => setTerminalTab("output")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-b-2 transition-colors ${
                      terminalTab === "output"
                        ? "border-blue-500 text-white"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <Play className="h-3 w-3" />
                    Output
                  </button>
                  <button
                    onClick={() => { setTerminalTab("shell"); setTimeout(() => xtermShellRef.current?.focus(), 50); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-b-2 transition-colors ${
                      terminalTab === "shell"
                        ? "border-blue-500 text-white"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <SquareTerminal className="h-3 w-3" />
                    Shell
                  </button>
                </>
              )}

              <div className="flex-1" />

              {terminalOpen && (
                <button
                  onClick={handleSyncToShell}
                  disabled={syncingShell}
                  title="Write all IDE files to Shell workspace (/tmp/bm_workspace)"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-emerald-400 disabled:opacity-50 mr-1"
                >
                  {syncingShell ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  <span className="hidden sm:inline">Sync to Shell</span>
                </button>
              )}

              {terminalOpen && terminalTab === "output" && (
                <Button
                  onClick={handleRun}
                  disabled={running || !activeFile}
                  size="sm"
                  className="h-6 px-3 mr-1 bg-green-700 hover:bg-green-600 text-white text-xs"
                >
                  {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  <span className="ml-1">Run</span>
                </Button>
              )}
            </div>
          </div>

          {/* Terminal panel — always in DOM so shell PTY is never killed */}
          <div
            className="h-64 sm:h-72 md:h-80 bg-[#0d0d0d] border-t border-[#2d2d2d] flex flex-col flex-shrink-0 relative overflow-hidden"
            style={{ display: terminalOpen ? "flex" : "none" }}
          >

              {/* Output tab — conditionally rendered, flex-col with stdin at bottom */}
              {terminalTab === "output" && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <XTermTerminal ref={xtermOutputRef} noShell className="h-full" />
                  </div>

                  {lastBuild && (
                    <div className="flex-shrink-0 border-t border-[#2d2d2d] bg-[#0f1f12] px-3 py-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-emerald-400 font-mono font-semibold">binary</span>
                      <span className="text-[10px] text-gray-600 flex-1">{lastBuild.name} — compiled successfully</span>
                      <button
                        onClick={handleDownloadBinary}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[#1a3a1a] border border-emerald-800 text-emerald-400 rounded hover:bg-[#224422] transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                      <button
                        onClick={handleRunInShell}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[#1a2a3a] border border-blue-800 text-blue-400 rounded hover:bg-[#1e3a4a] transition-colors"
                      >
                        <Play className="h-3 w-3" />
                        Run in Shell
                      </button>
                    </div>
                  )}

                  <div className="flex-shrink-0 border-t border-[#2d2d2d] bg-[#141414]">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1e1e1e]">
                      <span className="text-[10px] text-[#569cd6] font-mono font-semibold tracking-wide">stdin</span>
                      <span className="text-[10px] text-gray-600">— type a value and press Enter to add</span>
                      {stdinLines.length > 0 && (
                        <button
                          onClick={() => setStdinLines([])}
                          className="ml-auto text-[10px] text-gray-500 hover:text-red-400 font-mono transition-colors"
                        >clear all</button>
                      )}
                    </div>
                    {stdinLines.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-3 py-1.5 border-b border-[#1e1e1e] max-h-16 overflow-y-auto">
                        {stdinLines.map((line, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-[#1e3a1e] text-[#4ec94e] text-[10px] font-mono px-1.5 py-0.5 rounded">
                            {line === "" ? <span className="italic text-gray-500">↵</span> : line}
                            <button onClick={() => setStdinLines((prev) => prev.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400 leading-none">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-[10px] text-gray-600 font-mono select-none">{stdinLines.length + 1}&gt;</span>
                      <input
                        type="text"
                        value={stdinDraft}
                        onChange={(e) => setStdinDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setStdinLines((prev) => [...prev, stdinDraft]);
                            setStdinDraft("");
                          }
                        }}
                        placeholder="type input value, press Enter to add…"
                        spellCheck={false}
                        className="flex-1 bg-transparent text-white text-xs font-mono placeholder:text-[#2e2e2e] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Shell xterm — always mounted to keep session alive, hidden behind Output */}
              <div className={terminalTab === "output"
                ? "absolute inset-0 opacity-0 pointer-events-none"
                : "absolute inset-0"
              }>
                <XTermTerminal
                  ref={xtermShellRef}
                  className="h-full"
                  onReady={() => { if (terminalTab === "shell") xtermShellRef.current?.focus(); }}
                />
              </div>

          </div>
        </div>
      </div>
      {importModalOpen && (
        <GitHubImportModal
          githubToken={githubToken}
          onImport={handleImportFiles}
          onClose={() => setImportModalOpen(false)}
        />
      )}
    </div>
  );
}
