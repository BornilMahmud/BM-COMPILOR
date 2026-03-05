import { useState, useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
import { useToast } from "@/hooks/use-toast";
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
  ChevronRight,
  ChevronDown,
  File,
  FolderOpen,
  X,
  PanelBottom,
  Maximize2,
  Minimize2,
  Search,
  GitBranch,
  Bug,
  Blocks,
  CircleDot,
  TriangleAlert,
  Info,
  Cpu,
  Layers,
} from "lucide-react";
import type { TargetLanguage, CompileResult, Example } from "@shared/schema";
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

const lightTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    fontSize: "13px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "none",
    color: "hsl(var(--muted-foreground))",
    opacity: "0.4",
    minWidth: "3rem",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "hsl(var(--foreground))",
    opacity: "1",
  },
  ".cm-activeLine": {
    backgroundColor: "hsl(var(--muted) / 0.4)",
  },
  ".cm-cursor": {
    borderLeftColor: "hsl(var(--foreground))",
  },
  ".cm-selectionBackground": {
    backgroundColor: "hsl(var(--primary) / 0.15) !important",
  },
  ".cm-line": {
    padding: "0 0 0 4px",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    padding: "8px 0",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "hsl(var(--primary) / 0.2) !important",
  },
});

const darkThemeOverride = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    fontSize: "13px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "none",
    minWidth: "3rem",
  },
  ".cm-line": {
    padding: "0 0 0 4px",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    padding: "8px 0",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
  },
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
          <div
            key={i}
            className="flex items-start gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/50 cursor-default transition-colors"
            data-testid={`error-item-${i}`}
          >
            {err.phase === 'semantic' ? (
              <TriangleAlert className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-xs text-foreground">{err.message}</span>
              <span className="text-[10px] text-muted-foreground ml-2 font-mono">
                [{err.phase} Ln {err.line}, Col {err.column}]
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

type SidebarView = "explorer" | "search" | "none";
type BottomTab = "output" | "ir" | "problems";

export default function Home() {
  const [source, setSource] = useState(`int a = 10;
int b = 20;
print(a + b);`);
  const [target, setTarget] = useState<TargetLanguage>("c");
  const [result, setResult] = useState<CompileResult | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>("output");
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [activeFile, setActiveFile] = useState("main.ml");
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<"editor" | "output">("editor");
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return true;
  });
  const { toast } = useToast();

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

  const { data: examples } = useQuery<Example[]>({
    queryKey: ["/api/examples"],
  });

  const compileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/compile", {
        source,
        target,
        emitIr: true,
      });
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
      toast({
        title: "Compilation failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleCompile = useCallback(() => {
    compileMutation.mutate();
  }, [compileMutation]);

  const loadExample = useCallback((example: Example) => {
    setSource(example.source);
    setResult(null);
    setActiveFile(example.filename);
    if (isMobile) setMobileTab("editor");
  }, [isMobile]);

  const errorCount = result?.errors?.length ?? 0;
  const warningCount = result?.errors?.filter(e => e.phase === 'semantic').length ?? 0;
  const errorOnlyCount = errorCount - warningCount;

  const editorExtensions = useMemo(() => {
    const exts = [
      javascript(),
      EditorView.lineWrapping,
      darkMode ? darkThemeOverride : lightTheme,
    ];
    return exts;
  }, [darkMode]);

  const fileTree = useMemo(() => {
    const files = [
      { name: "main.ml", isExample: false },
      ...(examples?.map(e => ({ name: e.filename, isExample: true })) ?? []),
    ];
    return files;
  }, [examples]);

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
                ${sidebarView === item.id
                  ? "text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
                }`}
              data-testid={`activity-${item.id}`}
            >
              {sidebarView === item.id && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-foreground rounded-r" />
              )}
              <item.icon className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      ))}
      <div className="flex-1" />
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
        <TooltipContent side="right" className="text-xs">
          Toggle Theme
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="w-12 h-11 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors mb-1"
            data-testid="activity-settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          Settings
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
                <span>MiniLang</span>
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
                      ${activeFile === file.name
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                      }`}
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
                    onClick={() => {
                      setShowBottomPanel(true);
                      setBottomTab("output");
                    }}
                    className="w-full flex items-center gap-1.5 pl-7 pr-2 py-[3px] text-[12px] text-sidebar-foreground/70 hover:bg-sidebar-accent/50 rounded-sm transition-colors"
                    data-testid="file-output"
                  >
                    <File className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
                    <span className="truncate">out{TARGET_CONFIG[target].ext}</span>
                  </button>
                )}
              </div>
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
            <AlertCircle className="w-3 h-3" />
            <span>{errorOnlyCount}</span>
            <TriangleAlert className="w-3 h-3 ml-1" />
            <span>{warningCount}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>0</span>
            <TriangleAlert className="w-3 h-3 ml-1" />
            <span>0</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono">Ln {source.split("\n").length}, Col 1</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span className="font-medium">MiniLang</span>
      </div>
    </div>
  );

  const EditorTabs = () => (
    <div className="h-9 bg-muted/30 border-b flex items-end shrink-0 overflow-x-auto">
      <div
        className="group flex items-center gap-1.5 h-[35px] px-3 text-xs border-r bg-background text-foreground relative cursor-default"
        data-testid="editor-tab-active"
      >
        <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="truncate">{activeFile}</span>
        <button
          className="ml-1 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
          data-testid="button-close-tab"
        >
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
              {compileMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Run
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            Compile & Run (Ctrl+Enter)
          </TooltipContent>
        </Tooltip>

        <Select
          value={target}
          onValueChange={(val) => setTarget(val as TargetLanguage)}
        >
          <SelectTrigger
            className="h-6 w-auto gap-1 px-2 text-[11px] border-none bg-transparent hover:bg-muted/50"
            data-testid="select-target"
          >
            <Cpu className="w-3 h-3 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TARGET_CONFIG) as TargetLanguage[]).map((t) => (
              <SelectItem key={t} value={t} data-testid={`target-${t}`}>
                <span className="flex items-center gap-1.5">
                  <span className={`font-mono text-xs font-bold ${TARGET_CONFIG[t].color}`}>
                    {TARGET_CONFIG[t].label}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Select
          value="none"
          onValueChange={(val) => {
            if (val !== "none" && examples) {
              const ex = examples.find((e) => e.filename === val);
              if (ex) loadExample(ex);
            }
          }}
        >
          <SelectTrigger
            className="h-6 w-auto gap-1 px-2 text-[11px] border-none bg-transparent hover:bg-muted/50"
            data-testid="select-example"
          >
            <Blocks className="w-3 h-3 shrink-0" />
            <span>Examples</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled>Load Example</SelectItem>
            {examples?.map((ex) => (
              <SelectItem
                key={ex.filename}
                value={ex.filename}
                data-testid={`example-${ex.filename}`}
              >
                {ex.name}
              </SelectItem>
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
                {(["problems", "output", "ir"] as BottomTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setBottomTab(tab)}
                    className={`px-3 h-9 text-[11px] uppercase tracking-wider font-medium border-b-2 transition-colors flex items-center gap-1.5
                      ${bottomTab === tab
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    data-testid={`tab-${tab}`}
                  >
                    {tab === "problems" && <AlertCircle className="w-3 h-3" />}
                    {tab === "output" && <Terminal className="w-3 h-3" />}
                    {tab === "ir" && <Layers className="w-3 h-3" />}
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === "problems" && errorCount > 0 && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0 min-w-[16px] h-4">
                        {errorCount}
                      </Badge>
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
              {bottomTab === "output" && (
                <CodeOutput
                  code={result?.generatedCode ?? ""}
                  language={result?.target ?? "c"}
                />
              )}
              {bottomTab === "ir" && (
                <CodeOutput code={result?.ir ?? ""} language="ir" />
              )}
              {bottomTab === "problems" && (
                <ErrorPanel errors={result?.errors ?? []} />
              )}
            </div>
          </div>
        </ResizablePanel>
      </>
    );
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background" data-testid="home-page">
        <header className="flex items-center justify-between px-3 h-11 border-b bg-card/50 shrink-0">
          <div className="flex items-center gap-2">
            <Braces className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold" data-testid="text-app-title">MiniLang</span>
          </div>
          <div className="flex items-center gap-1">
            <Select value={target} onValueChange={(val) => setTarget(val as TargetLanguage)}>
              <SelectTrigger className="h-7 w-auto gap-1 px-2 text-[11px]" data-testid="select-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TARGET_CONFIG) as TargetLanguage[]).map((t) => (
                  <SelectItem key={t} value={t} data-testid={`target-${t}`}>
                    <span className={`font-mono text-xs font-bold ${TARGET_CONFIG[t].color}`}>
                      {TARGET_CONFIG[t].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleCompile}
              disabled={compileMutation.isPending || !source.trim()}
              size="sm"
              className="h-7 px-2 text-[11px] gap-1"
              data-testid="button-compile"
            >
              {compileMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Run
            </Button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 text-muted-foreground"
              data-testid="button-theme-toggle"
            >
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
            {errorCount > 0 && (
              <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1 absolute -top-0.5">
                {errorCount}
              </Badge>
            )}
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
                  <Blocks className="w-3 h-3 shrink-0" />
                  <span>Examples</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Load Example</SelectItem>
                  {examples?.map((ex) => (
                    <SelectItem key={ex.filename} value={ex.filename} data-testid={`example-${ex.filename}`}>
                      {ex.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 px-2 text-[10px] text-muted-foreground ml-auto">
                <FileCode className="w-3 h-3" />
                {activeFile}
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
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightActiveLine: true,
                  foldGutter: false,
                  dropCursor: true,
                  allowMultipleSelections: false,
                  indentOnInput: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: false,
                  rectangularSelection: false,
                  crosshairCursor: false,
                  highlightSelectionMatches: true,
                  tabSize: 2,
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleCompile();
                  }
                }}
                data-testid="input-source-code"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex border-b bg-muted/20 shrink-0">
              {(["output", "ir", "problems"] as BottomTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  className={`flex-1 px-2 py-2 text-[11px] uppercase tracking-wider font-medium border-b-2 transition-colors flex items-center justify-center gap-1
                    ${bottomTab === tab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground"
                    }`}
                  data-testid={`tab-${tab}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === "problems" && errorCount > 0 && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0">
                      {errorCount}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {bottomTab === "output" && (
                <CodeOutput code={result?.generatedCode ?? ""} language={result?.target ?? "c"} />
              )}
              {bottomTab === "ir" && (
                <CodeOutput code={result?.ir ?? ""} language="ir" />
              )}
              {bottomTab === "problems" && (
                <ErrorPanel errors={result?.errors ?? []} />
              )}
            </div>
          </div>
        )}

        <div className="h-6 bg-primary flex items-center justify-between px-3 text-primary-foreground text-[10px] shrink-0">
          <div className="flex items-center gap-2">
            {errorCount > 0 ? (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errorCount}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            )}
          </div>
          <span className="font-mono">MiniLang</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="home-page">
      <div className="h-8 bg-sidebar border-b border-sidebar-border flex items-center px-3 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Braces className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-sidebar-foreground" data-testid="text-app-title">
            MiniLang Compiler
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-[11px] text-sidebar-foreground/60">
          {compileMutation.isPending && (
            <div className="flex items-center gap-1 mr-2 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Compiling...</span>
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
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightActiveLine: true,
                    foldGutter: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: false,
                    rectangularSelection: true,
                    crosshairCursor: false,
                    highlightSelectionMatches: true,
                    tabSize: 2,
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleCompile();
                    }
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
    </div>
  );
}
