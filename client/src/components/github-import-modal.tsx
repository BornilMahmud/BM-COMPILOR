import { useState, useEffect, useRef } from "react";
import { X, Github, FolderOpen, File, Search, Download, Clock, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImportFile {
  path: string;
  size: number;
}

interface RecentImport {
  url: string;
  owner: string;
  repo: string;
  branch: string;
  subPath?: string;
  label: string;
  importedAt: number;
}

interface Props {
  githubToken: string | null;
  onImport: (files: { path: string; content: string }[]) => void;
  onClose: () => void;
}

const RECENT_KEY = "bm_recent_imports";
const SUPPORTED_EXTS = new Set(["c","cpp","cc","java","py","js","ts","jsx","tsx","php","rb","go","rs","dart","sql","sh","bash","txt","json","yaml","yml","toml","md","html","css"]);

function parseGitHubUrl(raw: string): { owner: string; repo: string; branch?: string; subPath?: string } | null {
  try {
    const url = new URL(raw.trim().replace(/\.git$/, ""));
    if (!url.hostname.includes("github.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    if (parts.length >= 4 && parts[2] === "tree") {
      const branch = parts[3];
      const subPath = parts.slice(4).join("/") || undefined;
      return { owner, repo, branch, subPath };
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

function getExt(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function isSupported(path: string) {
  return SUPPORTED_EXTS.has(getExt(path));
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function loadRecent(): RecentImport[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}

function saveRecent(item: RecentImport) {
  const list = loadRecent().filter((r) => r.url !== item.url).slice(0, 7);
  list.unshift(item);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

export default function GitHubImportModal({ githubToken, onImport, onClose }: Props) {
  const [url, setUrl] = useState("");
  const [recent, setRecent] = useState<RecentImport[]>(loadRecent);
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [parsed, setParsed] = useState<{ owner: string; repo: string; branch: string; subPath?: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [onlySupported, setOnlySupported] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const visibleFiles = files.filter((f) => {
    if (onlySupported && !isSupported(f.path)) return false;
    if (filter && !f.path.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const allSelected = visibleFiles.length > 0 && visibleFiles.every((f) => selected.has(f.path));

  const handleFetch = async (info?: RecentImport) => {
    const rawUrl = info ? info.url : url.trim();
    const p = parseGitHubUrl(rawUrl);
    if (!p) { setError("Invalid GitHub URL. Example: https://github.com/user/repo"); return; }
    setError("");
    setFetching(true);
    setFiles([]);
    setSelected(new Set());
    try {
      const params = new URLSearchParams({ owner: p.owner, repo: p.repo });
      if (p.branch) params.set("branch", p.branch);
      if (p.subPath) params.set("subPath", p.subPath);
      const headers: Record<string, string> = {};
      if (githubToken) headers["X-GitHub-Token"] = githubToken;
      const res = await fetch(`/api/github/repo-tree?${params}`, { headers });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || "Failed to load repo"); return; }
      const resolvedBranch = data.branch as string;
      const allFiles: ImportFile[] = data.files;
      setParsed({ ...p, branch: resolvedBranch });
      setFiles(allFiles);
      const defaultSelected = new Set(allFiles.filter((f) => isSupported(f.path)).map((f) => f.path));
      setSelected(defaultSelected);
      if (!info) {
        const item: RecentImport = {
          url: rawUrl, owner: p.owner, repo: p.repo,
          branch: resolvedBranch, subPath: p.subPath,
          label: p.subPath ? `${p.owner}/${p.repo}/${p.subPath}` : `${p.owner}/${p.repo}`,
          importedAt: Date.now(),
        };
        saveRecent(item);
        setRecent(loadRecent());
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setFetching(false);
    }
  };

  const toggleFile = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => { const next = new Set(prev); visibleFiles.forEach((f) => next.delete(f.path)); return next; });
    } else {
      setSelected((prev) => { const next = new Set(prev); visibleFiles.forEach((f) => next.add(f.path)); return next; });
    }
  };

  const handleImport = async () => {
    if (!parsed || selected.size === 0) return;
    setImporting(true);
    setError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (githubToken) headers["X-GitHub-Token"] = githubToken;
      const res = await fetch("/api/github/import-files", {
        method: "POST",
        headers,
        body: JSON.stringify({
          owner: parsed.owner, repo: parsed.repo, branch: parsed.branch,
          subPath: parsed.subPath, paths: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || "Import failed"); return; }
      onImport(data.files as { path: string; content: string }[]);
      onClose();
    } catch (err: any) {
      setError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#252526] border-b border-[#3c3c3c] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-gray-400" />
            <span className="font-semibold text-sm text-white">Import from GitHub</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#3c3c3c] text-gray-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleFetch(); }}
                placeholder="https://github.com/user/repo  or  paste a folder URL"
                className="flex-1 bg-[#2d2d2d] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#569cd6]"
              />
              <Button
                onClick={() => handleFetch()}
                disabled={fetching || !url.trim()}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 flex-shrink-0"
              >
                {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                <span className="ml-1 hidden sm:inline">Fetch</span>
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {recent.length > 0 && files.length === 0 && !fetching && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Recent
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((r) => (
                    <button
                      key={r.url}
                      onClick={() => { setUrl(r.url); handleFetch(r); }}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2d2d2d] hover:bg-[#3c3c3c] border border-[#3c3c3c] rounded text-xs text-gray-300 hover:text-white transition-colors"
                    >
                      <Github className="h-3 w-3 text-gray-500" />
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {files.length > 0 && parsed && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400">
                    <span className="text-white font-medium">{parsed.owner}/{parsed.repo}</span>
                    <span className="text-gray-600 ml-1">@ {parsed.branch}</span>
                    {parsed.subPath && <span className="text-gray-600 ml-1">/ {parsed.subPath}</span>}
                    <span className="ml-2 text-gray-600">{files.length} files</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none">
                    <input type="checkbox" checked={onlySupported} onChange={(e) => setOnlySupported(e.target.checked)} className="w-3 h-3" />
                    Code only
                  </label>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter files..."
                    className="flex-1 bg-[#2d2d2d] border border-[#3c3c3c] rounded px-2.5 py-1 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#569cd6]"
                  />
                  <button
                    onClick={toggleAll}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex-shrink-0 px-2 py-1 rounded hover:bg-[#3c3c3c]"
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                </div>

                <div className="bg-[#0d0d0d] rounded border border-[#2d2d2d] overflow-y-auto" style={{ maxHeight: 300 }}>
                  {visibleFiles.length === 0 && (
                    <p className="text-center text-gray-600 text-xs py-8">No files match</p>
                  )}
                  {visibleFiles.map((f) => {
                    const isChecked = selected.has(f.path);
                    const parts = f.path.split("/");
                    const name = parts.pop()!;
                    const dir = parts.join("/");
                    return (
                      <label
                        key={f.path}
                        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[#1e1e1e] border-b border-[#1a1a1a] last:border-0 ${isChecked ? "bg-[#1a2a3a]/40" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFile(f.path)}
                          className="w-3.5 h-3.5 accent-blue-500 flex-shrink-0"
                        />
                        {isChecked
                          ? <Check className="h-3 w-3 text-blue-400 flex-shrink-0" />
                          : <File className="h-3 w-3 text-gray-600 flex-shrink-0" />}
                        <span className="flex-1 text-xs truncate">
                          {dir && <span className="text-gray-600">{dir}/</span>}
                          <span className={isChecked ? "text-white" : "text-gray-400"}>{name}</span>
                        </span>
                        <span className="text-[10px] text-gray-600 flex-shrink-0">{formatSize(f.size)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {files.length > 0 && (
          <div className="px-4 py-3 bg-[#252526] border-t border-[#3c3c3c] flex items-center justify-between flex-shrink-0 gap-3">
            <span className="text-xs text-gray-400">
              {selected.size} file{selected.size !== 1 ? "s" : ""} selected
              {selected.size > 40 && <span className="text-yellow-500 ml-1">(max 40 at once)</span>}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 h-8 text-xs">Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={importing || selected.size === 0}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
              >
                {importing
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Importing...</>
                  : <><Download className="h-3.5 w-3.5 mr-1" />Import {Math.min(selected.size, 40)} files</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
