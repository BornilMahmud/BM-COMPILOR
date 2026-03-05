import { useState, useCallback, useRef, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Code2,
  FileCode,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Braces,
  Sun,
  Moon,
  Zap,
} from "lucide-react";
import type { TargetLanguage, CompileResult, Example } from "@shared/schema";

const TARGET_CONFIG: Record<TargetLanguage, { label: string; icon: string; color: string }> = {
  c: { label: "C", icon: "C", color: "text-blue-500" },
  cpp: { label: "C++", icon: "C++", color: "text-purple-500" },
  java: { label: "Java", icon: "Java", color: "text-orange-500" },
  py: { label: "Python", icon: "Py", color: "text-green-500" },
};

function LineNumbers({ code }: { code: string }) {
  const lineCount = code.split("\n").length;
  return (
    <div
      className="select-none text-right pr-3 pt-3 pb-3 text-muted-foreground/40 font-mono text-sm leading-[1.625rem] min-w-[3rem]"
      aria-hidden="true"
    >
      {Array.from({ length: lineCount }, (_, i) => (
        <div key={i + 1}>{i + 1}</div>
      ))}
    </div>
  );
}

function CodeOutput({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  if (!code) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/50">
        <div className="text-center space-y-2">
          <Code2 className="w-10 h-10 mx-auto opacity-30" />
          <p className="text-sm">Compile your code to see output</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex">
        <LineNumbers code={code} />
        <pre className="font-mono text-sm p-3 whitespace-pre overflow-x-auto flex-1 leading-[1.625rem]">
          <code>{code}</code>
        </pre>
      </div>
    </ScrollArea>
  );
}

function ErrorPanel({ errors }: { errors: CompileResult["errors"] }) {
  if (!errors || errors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/50">
        <div className="text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 mx-auto opacity-30" />
          <p className="text-sm">No errors</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        {errors.map((err, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-md bg-destructive/5 border border-destructive/20"
            data-testid={`error-item-${i}`}
          >
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs font-mono">
                  {err.phase}
                </Badge>
                {err.line > 0 && (
                  <span className="text-xs text-muted-foreground font-mono">
                    line {err.line}:{err.column}
                  </span>
                )}
              </div>
              <p className="text-sm mt-1 text-foreground">{err.message}</p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export default function Home() {
  const [source, setSource] = useState(`int a = 10;
int b = 20;
print(a + b);`);
  const [target, setTarget] = useState<TargetLanguage>("c");
  const [result, setResult] = useState<CompileResult | null>(null);
  const [activeTab, setActiveTab] = useState("code");
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDarkMode(true);
    }
  }, []);

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
        setActiveTab("code");
        toast({
          title: "Compilation successful",
          description: `Generated ${TARGET_CONFIG[target].label} code`,
        });
      } else {
        setActiveTab("errors");
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleCompile();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newValue = source.substring(0, start) + "  " + source.substring(end);
        setSource(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [handleCompile, source]
  );

  const loadExample = useCallback(
    (example: Example) => {
      setSource(example.source);
      setResult(null);
      setActiveTab("code");
    },
    []
  );

  const errorCount = result?.errors?.length ?? 0;

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="home-page">
      <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-none" data-testid="text-app-title">
                MiniLang
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                Multi-Target Compiler
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value="examples"
            onValueChange={(val) => {
              if (val !== "examples" && examples) {
                const ex = examples.find((e) => e.filename === val);
                if (ex) loadExample(ex);
              }
            }}
          >
            <SelectTrigger
              className="w-[160px] h-9 text-xs"
              data-testid="select-example"
            >
              <FileCode className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="Examples" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="examples" disabled>
                Load Example
              </SelectItem>
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

          <Select
            value={target}
            onValueChange={(val) => setTarget(val as TargetLanguage)}
          >
            <SelectTrigger
              className="w-[120px] h-9 text-xs"
              data-testid="select-target"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TARGET_CONFIG) as TargetLanguage[]).map((t) => (
                <SelectItem key={t} value={t} data-testid={`target-${t}`}>
                  <span className="flex items-center gap-1.5">
                    <span className={`font-mono text-xs font-bold ${TARGET_CONFIG[t].color}`}>
                      {TARGET_CONFIG[t].icon}
                    </span>
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
            data-testid="button-compile"
          >
            {compileMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5" />
            )}
            Compile
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDarkMode(!darkMode)}
            data-testid="button-theme-toggle"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Braces className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Editor
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {source.split("\n").length} lines
                </span>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 flex overflow-auto">
                  <LineNumbers code={source} />
                  <div className="relative flex-1">
                    <textarea
                      ref={textareaRef}
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="absolute inset-0 w-full h-full resize-none bg-transparent font-mono text-sm p-3 leading-[1.625rem] outline-none placeholder:text-muted-foreground/30 text-foreground"
                      placeholder="Write your MiniLang code here..."
                      spellCheck={false}
                      data-testid="input-source-code"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-1.5 border-t bg-muted/20 text-[10px] text-muted-foreground">
                <span className="font-mono">MiniLang</span>
                <span className="font-mono">
                  {compileMutation.isPending
                    ? "Compiling..."
                    : result?.success
                    ? "Ready"
                    : result
                    ? `${errorCount} error${errorCount !== 1 ? "s" : ""}`
                    : "Ready"}
                </span>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex flex-col h-full">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex flex-col h-full"
              >
                <div className="flex items-center px-2 border-b bg-muted/30">
                  <TabsList className="bg-transparent h-auto p-0 gap-0">
                    <TabsTrigger
                      value="code"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                      data-testid="tab-generated-code"
                    >
                      <Code2 className="w-3.5 h-3.5 mr-1.5" />
                      Generated Code
                      {result?.success && (
                        <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0">
                          {TARGET_CONFIG[result.target].label}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="ir"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                      data-testid="tab-ir"
                    >
                      <Terminal className="w-3.5 h-3.5 mr-1.5" />
                      IR
                    </TabsTrigger>
                    <TabsTrigger
                      value="errors"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
                      data-testid="tab-errors"
                    >
                      <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                      Errors
                      {errorCount > 0 && (
                        <Badge variant="destructive" className="ml-1.5 text-[9px] px-1.5 py-0">
                          {errorCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="code" className="flex-1 m-0 overflow-hidden">
                  <CodeOutput
                    code={result?.generatedCode ?? ""}
                    language={result?.target ?? "c"}
                  />
                </TabsContent>

                <TabsContent value="ir" className="flex-1 m-0 overflow-hidden">
                  <CodeOutput code={result?.ir ?? ""} language="ir" />
                </TabsContent>

                <TabsContent value="errors" className="flex-1 m-0 overflow-hidden">
                  <ErrorPanel errors={result?.errors ?? []} />
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
