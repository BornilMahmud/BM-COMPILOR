import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Play,
  Code2,
  FileCode,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Braces,
  Sun,
  Moon,
  Files,
  Settings,
  ChevronDown,
  File,
  FolderOpen,
  X,
  Search,
  GitBranch,
  TriangleAlert,
  Cpu,
  Layers,
  Blocks,
  LogIn,
  LogOut,
  Github,
  Save,
  FolderPlus,
  User,
  ChevronRight,
} from "lucide-react";
import type { TargetLanguage, CompileResult, Example, ExecutionResult, GithubRepo } from "@shared/schema";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";

const TARGET_CONFIG: Record<TargetLanguage, { label: string; ext: string; color: string; bgColor: string }> = {
  c: { label: "C", ext: ".c", color: "text-sky-400", bgColor: "bg-sky-500/10" },
  cpp: { label: "C++", ext: ".cpp", color: "text-violet-400", bgColor: "bg-violet-500/10" },
  java: { label: "Java", ext: ".java", color: "text-orange-400", bgColor: "bg-orange-500/10" },
  py: { label: "Python", ext: ".py", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
};

type ShellType = "powershell" | "bash";

interface TerminalLine {
  type: "command" | "stdout" | "stderr" | "info" | "success" | "error";
  text: string;
  timestamp: Date;
}

const lightTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "13px" },
  ".cm-gutters": { backgroundColor: "transparent", borderRight: "none", color: "hsl(var(--muted-foreground))", opacity: "0.4", minWidth: "3rem" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "hsl(var(--foreground))", opacity: "1" },
  ".cm-activeLine": { backgroundColor: "hsl(var(--muted) / 0.4)" },
  ".cm-cursor": { borderLeftColor: "hsl(var(--foreground))" },
  ".cm-selectionBackground": { backgroundColor: "hsl(var(--primary) / 0.15) !important" },
  ".cm-line": { padding: "0 0 0 4px" },
  ".cm-content": { fontFamily: "var(--font-mono)", padding: "8px 0" },
  ".cm-scroller": { fontFamily: "var(--font-mono)" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "hsl(var(--primary) / 0.2) !important" },
});

const darkThemeOverride = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "13px" },
  ".cm-gutters": { backgroundColor: "transparent", borderRight: "none", minWidth: "3rem" },
  ".cm-line": { padding: "0 0 0 4px" },
  ".cm-content": { fontFamily: "var(--font-mono)", padding: "8px 0" },
  ".cm-scroller": { fontFamily: "var(--font-mono)" },
});

function CodeOutput({ code, language }: { code: string; language: string }) {
  if (!code) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/40">
        <div className="text-center space-y-3">
          <Code2 className="w-8 h-8 mx-auto" />
          <p className="text-xs">Run compiler to see output</p>
        </div>
      </div>
    );
  }
  return (
    <ScrollArea className="h-full">
      <pre className="font-mono text-xs p-4 whitespace-pre overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </ScrollArea>
  );
}

function ErrorPanel({ errors }: { errors: CompileResult["errors"] }) {
  if (!errors || errors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/40">
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-8 h-8 mx-auto" />
          <p className="text-xs">No problems detected</p>
        </div>
      </div>
    );
  }
  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-0.5">
        {errors.map((err, i) => (
          <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/50 cursor-default transition-colors" data-testid={`error-item-${i}`}>
            {err.phase === 'semantic' ? (
              <TriangleAlert className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-xs text-foreground">{err.message}</span>
              <span className="text-[10px] text-muted-foreground ml-2 font-mono">[{err.phase} Ln {err.line}, Col {err.column}]</span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function TerminalPanel({ lines, shellType, onShellChange, isRunning }: {
  lines: TerminalLine[];
  shellType: ShellType;
  onShellChange: (s: ShellType) => void;
  isRunning: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "command": return "text-yellow-400";
      case "stdout": return "text-foreground";
      case "stderr": return "text-red-400";
      case "info": return "text-blue-400";
      case "success": return "text-green-400";
      case "error": return "text-red-500";
      default: return "text-foreground";
    }
  };

  const prompt = shellType === "powershell" ? "PS>" : "$";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2 h-7 border-b bg-muted/10 shrink-0">
        <button
          onClick={() => onShellChange("powershell")}
          className={`px-2 py-0.5 text-[10px] rounded-sm transition-colors flex items-center gap-1 ${
            shellType === "powershell" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="shell-powershell"
        >
          <ChevronRight className="w-2.5 h-2.5" />
          PowerShell
        </button>
        <button
          onClick={() => onShellChange("bash")}
          className={`px-2 py-0.5 text-[10px] rounded-sm transition-colors flex items-center gap-1 ${
            shellType === "bash" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="shell-bash"
        >
          <Terminal className="w-2.5 h-2.5" />
          Bash
        </button>
        {isRunning && <Loader2 className="w-3 h-3 animate-spin text-primary ml-auto" />}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto bg-[#1e1e1e] dark:bg-[#0d1117] p-2 font-mono text-xs">
        {lines.length === 0 ? (
          <div className="text-muted-foreground/40">
            <p>{shellType === "powershell" ? "Windows PowerShell" : "GNU Bash"}</p>
            <p>BM Compiler Terminal - Ready</p>
            <p className="mt-1 text-muted-foreground/30">{prompt} _</p>
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={`${getLineColor(line.type)} leading-5 whitespace-pre-wrap break-all`}>
              {line.type === "command" && <span className="text-green-400 mr-1">{prompt}</span>}
              {line.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type SidebarView = "explorer" | "search" | "none";
type BottomTab = "output" | "ir" | "problems" | "terminal";

export default function Home() {
  const [source, setSource] = useState(`int a = 10;\nint b = 20;\nprint(a + b);`);
  const [target, setTarget] = useState<TargetLanguage>("c");
  const [result, setResult] = useState<CompileResult | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>("terminal");
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [activeFile, setActiveFile] = useState("main.ml");
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<"editor" | "output">("editor");
  const [shellType, setShellType] = useState<ShellType>("bash");
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [showRepoDialog, setShowRepoDialog] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return true;
  });
  const { toast } = useToast();
  const { user, loading: authLoading, githubToken, login, logout } = useAuth();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const { data: examples } = useQuery<Example[]>({ queryKey: ["/api/examples"] });

  const addTerminalLine = useCallback((type: TerminalLine["type"], text: string) => {
    setTerminalLines(prev => [...prev, { type, text, timestamp: new Date() }]);
  }, []);

  const compileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/compile", { source, target, emitIr: true });
      return (await res.json()) as CompileResult;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        setBottomTab("output");
        setShowBottomPanel(true);
        if (isMobile) setMobileTab("output");
      } else {
        setBottomTab("problems");
        setShowBottomPanel(true);
        if (isMobile) setMobileTab("output");
      }
    },
    onError: (err: Error) => {
      toast({ title: "Compilation failed", description: err.message, variant: "destructive" });
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!result?.success || !result.generatedCode) {
        throw new Error("No compiled code to run. Compile first.");
      }
      const targetLang = result.target;
      const ext = TARGET_CONFIG[targetLang].ext;
      const label = TARGET_CONFIG[targetLang].label;

      addTerminalLine("info", `--- Running ${label} code ---`);

      if (targetLang === "c" || targetLang === "cpp") {
        const compiler = targetLang === "c" ? "gcc" : "g++";
        addTerminalLine("command", `${compiler} main${ext} -o main && ./main`);
      } else if (targetLang === "java") {
        addTerminalLine("command", `javac Main.java && java Main`);
      } else {
        addTerminalLine("command", `python3 main.py`);
      }

      const res = await apiRequest("POST", "/api/run", { code: result.generatedCode, target: targetLang });
      return (await res.json()) as ExecutionResult;
    },
    onSuccess: (data) => {
      if (data.stdout) addTerminalLine("stdout", data.stdout.trimEnd());
      if (data.stderr) addTerminalLine("stderr", data.stderr.trimEnd());
      if (data.exitCode === 0) {
        addTerminalLine("success", `Process exited with code 0`);
      } else {
        addTerminalLine("error", `Process exited with code ${data.exitCode}`);
      }
      setBottomTab("terminal");
      setShowBottomPanel(true);
    },
    onError: (err: Error) => {
      addTerminalLine("error", err.message);
      setBottomTab("terminal");
      setShowBottomPanel(true);
    },
  });

  const handleCompileAndRun = useCallback(() => {
    compileMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.success) {
          setTimeout(() => runMutation.mutate(), 100);
        }
      },
    });
  }, [compileMutation, runMutation]);

  const handleCompile = useCallback(() => {
    compileMutation.mutate();
  }, [compileMutation]);

  const handleRun = useCallback(() => {
    if (result?.success) {
      runMutation.mutate();
    } else {
      handleCompileAndRun();
    }
  }, [result, runMutation, handleCompileAndRun]);

  const loadExample = useCallback((example: Example) => {
    setSource(example.source);
    setResult(null);
    setActiveFile(example.filename);
    if (isMobile) setMobileTab("editor");
  }, [isMobile]);

  const createRepoMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!githubToken) throw new Error("Not authenticated with GitHub");
      const res = await apiRequest("POST", "/api/github/create-repo", {
        name,
        description: "BM Compiler project",
        githubToken,
      });
      return (await res.json()) as GithubRepo;
    },
    onSuccess: (repo) => {
      setSelectedRepo(repo.full_name);
      setShowRepoDialog(false);
      setNewRepoName("");
      toast({ title: "Repository created", description: `${repo.full_name} is ready` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create repository", description: err.message, variant: "destructive" });
    },
  });

  const saveFileMutation = useMutation({
    mutationFn: async () => {
      if (!githubToken || !selectedRepo) throw new Error("Select a repository first");
      const ext = TARGET_CONFIG[target].ext;
      const filename = `${activeFile.replace('.ml', '')}${ext}`;
      const content = result?.generatedCode || source;
      const res = await apiRequest("POST", "/api/github/save-file", {
        repo: selectedRepo,
        path: filename,
        content,
        message: `Save ${filename} from BM Compiler`,
        githubToken,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({ title: "File saved to GitHub", description: data.html_url || "Saved successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save file", description: err.message, variant: "destructive" });
    },
  });

  const { data: repos } = useQuery<GithubRepo[]>({
    queryKey: ["/api/github/repos"],
    queryFn: async () => {
      if (!githubToken) return [];
      const res = await apiRequest("POST", "/api/github/repos", { githubToken });
      return await res.json();
    },
    enabled: !!githubToken,
  });

  const errorCount = result?.errors?.length ?? 0;
  const warningCount = result?.errors?.filter(e => e.phase === 'semantic').length ?? 0;
  const errorOnlyCount = errorCount - warningCount;

  const editorExtensions = useMemo(() => [
    javascript(),
    EditorView.lineWrapping,
    darkMode ? darkThemeOverride : lightTheme,
  ], [darkMode]);

  const fileTree = useMemo(() => [
    { name: "main.ml", isExample: false },
    ...(examples?.map(e => ({ name: e.filename, isExample: true })) ?? []),
  ], [examples]);

  const activityBarItems = [
    { id: "explorer" as SidebarView, icon: Files, label: "Explorer" },
    { id: "search" as SidebarView, icon: Search, label: "Search" },
  ];

  const ActivityBar = () => (
    <div className="w-12 bg-sidebar flex flex-col items-center py-1 border-r border-sidebar-border shrink-0">
      {activityBarItems.map((item) => (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setSidebarView(sidebarView === item.id ? "none" : item.id)}
              className={`w-12 h-11 flex items-center justify-center transition-colors relative
                ${sidebarView === item.id ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
              data-testid={`activity-${item.id}`}
            >
              {sidebarView === item.id && <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-foreground rounded-r" />}
              <item.icon className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
        </Tooltip>
      ))}
      <div className="flex-1" />

      {user && githubToken && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                if (!selectedRepo) {
                  setShowRepoDialog(true);
                } else {
                  saveFileMutation.mutate();
                }
              }}
              disabled={saveFileMutation.isPending}
              className="w-12 h-11 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              data-testid="button-save-github"
            >
              {saveFileMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {selectedRepo ? `Save to ${selectedRepo}` : "Save to GitHub"}
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-12 h-11 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            data-testid="button-theme-toggle"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">Toggle Theme</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          {user ? (
            <button
              onClick={logout}
              className="w-12 h-11 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors mb-1"
              data-testid="button-logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={login}
              disabled={authLoading}
              className="w-12 h-11 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors mb-1"
              data-testid="button-login"
            >
              {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {user ? `Logout (${user.displayName || user.email})` : "Login with GitHub"}
        </TooltipContent>
      </Tooltip>
    </div>
  );

  const SidePanel = () => {
    if (sidebarView === "none") return null;
    return (
      <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 h-9 shrink-0">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/70">
            {sidebarView === "explorer" ? "Explorer" : "Search"}
          </span>
        </div>

        {sidebarView === "explorer" && (
          <ScrollArea className="flex-1">
            <div className="px-1">
              <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/80">
                <ChevronDown className="w-3 h-3" />
                <span>BM Compiler</span>
              </div>

              <div className="ml-2">
                <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-sidebar-foreground/70 mt-1">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500/80" />
                  <span>src</span>
                </div>

                {fileTree.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => {
                      if (file.isExample && examples) {
                        const ex = examples.find(e => e.filename === file.name);
                        if (ex) loadExample(ex);
                      } else {
                        setActiveFile(file.name);
                      }
                    }}
                    className={`w-full flex items-center gap-1.5 pl-7 pr-2 py-[3px] text-[12px] rounded-sm transition-colors
                      ${activeFile === file.name ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"}`}
                    data-testid={`file-${file.name}`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-blue-400/70 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </button>
                ))}

                <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-sidebar-foreground/70 mt-2">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500/80" />
                  <span>output</span>
                </div>
                {result?.success && (
                  <button
                    onClick={() => { setShowBottomPanel(true); setBottomTab("output"); }}
                    className="w-full flex items-center gap-1.5 pl-7 pr-2 py-[3px] text-[12px] text-sidebar-foreground/70 hover:bg-sidebar-accent/50 rounded-sm transition-colors"
                    data-testid="file-output"
                  >
                    <File className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
                    <span className="truncate">out{TARGET_CONFIG[target].ext}</span>
                  </button>
                )}
              </div>

              {user && selectedRepo && (
                <div className="mt-3 px-2">
                  <div className="flex items-center gap-1 text-[10px] text-sidebar-foreground/50">
                    <Github className="w-3 h-3" />
                    <span className="truncate">{selectedRepo}</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {sidebarView === "search" && (
          <div className="px-3 pt-2">
            <div className="flex items-center gap-2 px-2 py-1.5 border rounded-sm bg-background text-xs">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Search files...</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const StatusBar = () => (
    <div className="h-6 bg-primary flex items-center justify-between px-3 text-primary-foreground text-[11px] shrink-0 select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <GitBranch className="w-3 h-3" />
          <span>main</span>
        </div>
        {errorCount > 0 ? (
          <button
            onClick={() => { setShowBottomPanel(true); setBottomTab("problems"); }}
            className="flex items-center gap-1 hover:bg-primary-foreground/10 px-1 rounded-sm transition-colors"
            data-testid="status-errors"
          >
            <AlertCircle className="w-3 h-3" /><span>{errorOnlyCount}</span>
            <TriangleAlert className="w-3 h-3 ml-1" /><span>{warningCount}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /><span>0</span>
            <TriangleAlert className="w-3 h-3 ml-1" /><span>0</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {user.displayName || user.email || "User"}
          </span>
        )}
        <span className="font-mono">Ln {source.split("\n").length}, Col 1</span>
        <span>UTF-8</span>
        <span className="font-medium">MiniLang</span>
      </div>
    </div>
  );

  const EditorTabs = () => (
    <div className="h-9 bg-muted/30 border-b flex items-end shrink-0 overflow-x-auto">
      <div className="group flex items-center gap-1.5 h-[35px] px-3 text-xs border-r bg-background text-foreground relative cursor-default" data-testid="editor-tab-active">
        <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="truncate">{activeFile}</span>
        <button className="ml-1 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-muted transition-all" data-testid="button-close-tab">
          <X className="w-3 h-3" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-background" />
      </div>
    </div>
  );

  const Toolbar = () => (
    <div className="h-8 flex items-center justify-between px-2 border-b bg-muted/20 shrink-0">
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleCompile}
              disabled={compileMutation.isPending || !source.trim()}
              size="sm"
              className="h-6 px-2 text-[11px] gap-1"
              data-testid="button-compile"
            >
              {compileMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Compile
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Compile (Ctrl+Enter)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleRun}
              disabled={runMutation.isPending || compileMutation.isPending || !source.trim()}
              size="sm"
              variant="secondary"
              className="h-6 px-2 text-[11px] gap-1"
              data-testid="button-run"
            >
              {runMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Terminal className="w-3 h-3" />}
              Run
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Compile & Execute</TooltipContent>
        </Tooltip>

        <Select value={target} onValueChange={(val) => setTarget(val as TargetLanguage)}>
          <SelectTrigger className="h-6 w-auto gap-1 px-2 text-[11px] border-none bg-transparent hover:bg-muted/50" data-testid="select-target">
            <Cpu className="w-3 h-3 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TARGET_CONFIG) as TargetLanguage[]).map((t) => (
              <SelectItem key={t} value={t} data-testid={`target-${t}`}>
                <span className="flex items-center gap-1.5">
                  <span className={`font-mono text-xs font-bold ${TARGET_CONFIG[t].color}`}>{TARGET_CONFIG[t].label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        {user && githubToken && selectedRepo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => saveFileMutation.mutate()}
                disabled={saveFileMutation.isPending}
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] gap-1"
                data-testid="button-save-toolbar"
              >
                {saveFileMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Save to {selectedRepo}</TooltipContent>
          </Tooltip>
        )}

        <Select
          value="none"
          onValueChange={(val) => {
            if (val !== "none" && examples) {
              const ex = examples.find((e) => e.filename === val);
              if (ex) loadExample(ex);
            }
          }}
        >
          <SelectTrigger className="h-6 w-auto gap-1 px-2 text-[11px] border-none bg-transparent hover:bg-muted/50" data-testid="select-example">
            <Blocks className="w-3 h-3 shrink-0" />
            <span>Examples</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled>Load Example</SelectItem>
            {examples?.map((ex) => (
              <SelectItem key={ex.filename} value={ex.filename} data-testid={`example-${ex.filename}`}>{ex.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const BottomPanel = () => {
    if (!showBottomPanel) return null;
    return (
      <>
        <ResizableHandle />
        <ResizablePanel id="bottom-panel" order={2} defaultSize={35} minSize={15} maxSize={60}>
          <div className="flex flex-col h-full">
            <div className="h-9 flex items-center justify-between px-2 border-b bg-muted/20 shrink-0">
              <div className="flex items-center gap-0">
                {(["problems", "output", "ir", "terminal"] as BottomTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setBottomTab(tab)}
                    className={`px-3 h-9 text-[11px] uppercase tracking-wider font-medium border-b-2 transition-colors flex items-center gap-1.5
                      ${bottomTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    data-testid={`tab-${tab}`}
                  >
                    {tab === "problems" && <AlertCircle className="w-3 h-3" />}
                    {tab === "output" && <Code2 className="w-3 h-3" />}
                    {tab === "ir" && <Layers className="w-3 h-3" />}
                    {tab === "terminal" && <Terminal className="w-3 h-3" />}
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === "problems" && errorCount > 0 && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0 min-w-[16px] h-4">{errorCount}</Badge>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowBottomPanel(false)}
                      className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      data-testid="button-close-panel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Close Panel</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {bottomTab === "output" && <CodeOutput code={result?.generatedCode ?? ""} language={result?.target ?? "c"} />}
              {bottomTab === "ir" && <CodeOutput code={result?.ir ?? ""} language="ir" />}
              {bottomTab === "problems" && <ErrorPanel errors={result?.errors ?? []} />}
              {bottomTab === "terminal" && (
                <TerminalPanel
                  lines={terminalLines}
                  shellType={shellType}
                  onShellChange={setShellType}
                  isRunning={runMutation.isPending}
                />
              )}
            </div>
          </div>
        </ResizablePanel>
      </>
    );
  };

  const RepoDialog = () => (
    <Dialog open={showRepoDialog} onOpenChange={setShowRepoDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            GitHub Repository
          </DialogTitle>
          <DialogDescription>
            Select an existing repository or create a new one to save your code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {repos && repos.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Existing Repositories</label>
              <Select value={selectedRepo || ""} onValueChange={(val) => { setSelectedRepo(val); setShowRepoDialog(false); }}>
                <SelectTrigger data-testid="select-repo">
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((repo) => (
                    <SelectItem key={repo.full_name} value={repo.full_name} data-testid={`repo-${repo.name}`}>
                      <span className="flex items-center gap-2">
                        <Github className="w-3 h-3" />
                        {repo.full_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="border-t pt-4">
            <label className="text-sm font-medium mb-2 block">Create New Repository</label>
            <div className="flex gap-2">
              <Input
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="my-bm-compiler-project"
                data-testid="input-repo-name"
              />
              <Button
                onClick={() => newRepoName && createRepoMutation.mutate(newRepoName)}
                disabled={!newRepoName || createRepoMutation.isPending}
                data-testid="button-create-repo"
              >
                {createRepoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowRepoDialog(false)} data-testid="button-cancel-repo">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background" data-testid="home-page">
        <header className="flex items-center justify-between px-3 h-11 border-b bg-card/50 shrink-0">
          <div className="flex items-center gap-2">
            <Braces className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold" data-testid="text-app-title">BM Compiler</span>
          </div>
          <div className="flex items-center gap-1">
            <Select value={target} onValueChange={(val) => setTarget(val as TargetLanguage)}>
              <SelectTrigger className="h-7 w-auto gap-1 px-2 text-[11px]" data-testid="select-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TARGET_CONFIG) as TargetLanguage[]).map((t) => (
                  <SelectItem key={t} value={t} data-testid={`target-${t}`}>
                    <span className={`font-mono text-xs font-bold ${TARGET_CONFIG[t].color}`}>{TARGET_CONFIG[t].label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCompile} disabled={compileMutation.isPending || !source.trim()} size="sm" className="h-7 px-2 text-[11px] gap-1" data-testid="button-compile">
              {compileMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Compile
            </Button>
            <Button onClick={handleRun} disabled={runMutation.isPending || compileMutation.isPending} size="sm" variant="secondary" className="h-7 px-2 text-[11px] gap-1" data-testid="button-run">
              {runMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Terminal className="w-3 h-3" />}
              Run
            </Button>
            {user ? (
              <button onClick={logout} className="p-1.5 text-muted-foreground" data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={login} className="p-1.5 text-muted-foreground" data-testid="button-login">
                <Github className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 text-muted-foreground" data-testid="button-theme-toggle">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <div className="flex border-b shrink-0">
          <button
            onClick={() => setMobileTab("editor")}
            className={`flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors ${
              mobileTab === "editor" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            }`}
            data-testid="mobile-tab-editor"
          >
            Editor
          </button>
          <button
            onClick={() => setMobileTab("output")}
            className={`flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors relative ${
              mobileTab === "output" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            }`}
            data-testid="mobile-tab-output"
          >
            Output
            {errorCount > 0 && <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1 absolute -top-0.5">{errorCount}</Badge>}
          </button>
        </div>

        {mobileTab === "editor" ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/20 overflow-x-auto shrink-0">
              <Select
                value="none"
                onValueChange={(val) => {
                  if (val !== "none" && examples) {
                    const ex = examples.find(e => e.filename === val);
                    if (ex) loadExample(ex);
                  }
                }}
              >
                <SelectTrigger className="h-6 w-auto gap-1 px-2 text-[11px] border-none bg-muted/50" data-testid="select-example">
                  <Blocks className="w-3 h-3 shrink-0" /><span>Examples</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Load Example</SelectItem>
                  {examples?.map((ex) => (
                    <SelectItem key={ex.filename} value={ex.filename} data-testid={`example-${ex.filename}`}>{ex.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 px-2 text-[10px] text-muted-foreground ml-auto">
                <FileCode className="w-3 h-3" />{activeFile}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <CodeMirror
                value={source}
                onChange={setSource}
                extensions={editorExtensions}
                theme={darkMode ? oneDark : undefined}
                className="h-full text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:!overflow-auto"
                basicSetup={{
                  lineNumbers: true, highlightActiveLineGutter: true, highlightActiveLine: true,
                  foldGutter: false, dropCursor: true, allowMultipleSelections: false,
                  indentOnInput: true, bracketMatching: true, closeBrackets: true,
                  autocompletion: false, rectangularSelection: false, crosshairCursor: false,
                  highlightSelectionMatches: true, tabSize: 2,
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleCompile(); }
                }}
                data-testid="input-source-code"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex border-b bg-muted/20 shrink-0">
              {(["terminal", "output", "ir", "problems"] as BottomTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  className={`flex-1 px-2 py-2 text-[11px] uppercase tracking-wider font-medium border-b-2 transition-colors flex items-center justify-center gap-1
                    ${bottomTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
                  data-testid={`tab-${tab}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === "problems" && errorCount > 0 && <Badge variant="destructive" className="text-[9px] px-1 py-0">{errorCount}</Badge>}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {bottomTab === "output" && <CodeOutput code={result?.generatedCode ?? ""} language={result?.target ?? "c"} />}
              {bottomTab === "ir" && <CodeOutput code={result?.ir ?? ""} language="ir" />}
              {bottomTab === "problems" && <ErrorPanel errors={result?.errors ?? []} />}
              {bottomTab === "terminal" && (
                <TerminalPanel lines={terminalLines} shellType={shellType} onShellChange={setShellType} isRunning={runMutation.isPending} />
              )}
            </div>
          </div>
        )}

        <div className="h-6 bg-primary flex items-center justify-between px-3 text-primary-foreground text-[10px] shrink-0">
          <div className="flex items-center gap-2">
            {errorCount > 0 ? (
              <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errorCount}</span>
            ) : (
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ready</span>
            )}
          </div>
          <span className="font-mono">BM Compiler</span>
        </div>

        <RepoDialog />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="home-page">
      <div className="h-8 bg-sidebar border-b border-sidebar-border flex items-center px-3 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Braces className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-sidebar-foreground" data-testid="text-app-title">
            BM Compiler
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground/60">
          {(compileMutation.isPending || runMutation.isPending) && (
            <div className="flex items-center gap-1 mr-2 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{runMutation.isPending ? "Running..." : "Compiling..."}</span>
            </div>
          )}
          {user && (
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-4 h-4 rounded-full" />
                ) : (
                  <User className="w-2.5 h-2.5 text-primary" />
                )}
              </div>
              <span>{user.displayName || user.email}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        <SidePanel />

        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorTabs />
          <Toolbar />

          <ResizablePanelGroup direction="vertical" className="flex-1">
            <ResizablePanel id="editor-panel" order={1} defaultSize={65} minSize={30}>
              <div className="h-full overflow-hidden">
                <CodeMirror
                  value={source}
                  onChange={setSource}
                  extensions={editorExtensions}
                  theme={darkMode ? oneDark : undefined}
                  className="h-full text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:!overflow-auto"
                  basicSetup={{
                    lineNumbers: true, highlightActiveLineGutter: true, highlightActiveLine: true,
                    foldGutter: true, dropCursor: true, allowMultipleSelections: true,
                    indentOnInput: true, bracketMatching: true, closeBrackets: true,
                    autocompletion: false, rectangularSelection: true, crosshairCursor: false,
                    highlightSelectionMatches: true, tabSize: 2,
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleCompile(); }
                  }}
                  data-testid="input-source-code"
                />
              </div>
            </ResizablePanel>
            <BottomPanel />
          </ResizablePanelGroup>
        </div>
      </div>

      <StatusBar />
      <RepoDialog />
    </div>
  );
}
