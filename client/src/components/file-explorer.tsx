import { useState, useRef, useEffect } from "react";
import {
  ChevronRight, ChevronDown, FilePlus, FolderPlus,
  Trash2, Pencil, FileCode, Folder, FolderOpen, Upload, RotateCcw,
} from "lucide-react";
import type { FileNode } from "@/hooks/use-file-tree";
import { collectFiles, getNodePath } from "@/hooks/use-file-tree";

interface Props {
  tree: FileNode[];
  activeFileId: string | null;
  onOpenFile: (node: FileNode) => void;
  onCreate: (type: "file" | "folder", parentId: string | null, name: string) => FileNode;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onToggle: (id: string) => void;
  onPushFolder: (nodes: FileNode[], folderPath: string) => void;
  onPushAll: () => void;
  onClearAll: () => void;
  onDropFiles?: (files: { path: string; content: string }[]) => void;
  onMoveNode?: (nodeId: string, targetFolderId: string | null) => void;
  loading?: boolean;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const colors: Record<string, string> = {
    c: "text-blue-400", cpp: "text-blue-400", cc: "text-blue-400", cxx: "text-blue-400",
    h: "text-purple-300", hpp: "text-purple-300",
    java: "text-orange-400",
    py: "text-yellow-400",
    js: "text-yellow-300", mjs: "text-yellow-300",
    ts: "text-blue-300", tsx: "text-blue-300",
    php: "text-purple-400", rb: "text-red-400",
    go: "text-cyan-400", rs: "text-orange-300",
    dart: "text-sky-400",
    sql: "text-green-400", mysql: "text-green-400", ora: "text-orange-400",
    sh: "text-gray-300", bash: "text-gray-300",
    l: "text-emerald-400",
    y: "text-amber-400",
    out: "text-lime-400", exe: "text-lime-400",
    md: "text-blue-200", json: "text-yellow-200",
    html: "text-orange-300", htm: "text-orange-300",
    css: "text-sky-300",
  };
  return <FileCode className={`h-3.5 w-3.5 flex-shrink-0 ${colors[ext] ?? "text-gray-400"}`} />;
}

async function readEntryAsFiles(
  entry: FileSystemEntry,
  prefix: string,
  results: { path: string; content: string }[]
): Promise<void> {
  const p = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.isFile) {
    const fe = entry as FileSystemFileEntry;
    await new Promise<void>((res) =>
      fe.file((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => { results.push({ path: p, content: (ev.target?.result as string) || "" }); res(); };
        reader.onerror = () => res();
        reader.readAsText(file);
      })
    );
  } else if (entry.isDirectory) {
    const de = entry as FileSystemDirectoryEntry;
    const reader = de.createReader();
    await new Promise<void>((res) => {
      reader.readEntries(async (entries) => {
        for (const child of entries) await readEntryAsFiles(child, p, results);
        res();
      });
    });
  }
}

interface NameInputProps {
  placeholder: string;
  initial?: string;
  depth?: number;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}

function NameInput({ placeholder, initial = "", depth = 0, onConfirm, onCancel }: NameInputProps) {
  const [val, setVal] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <div className="flex items-center py-[2px]" style={{ paddingLeft: `${8 + depth * 12 + 16}px` }}>
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        className="w-full px-1 py-0.5 text-xs bg-[#3c3c3c] border border-[#569cd6] rounded text-white outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim()) onConfirm(val.trim());
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => { if (val.trim()) onConfirm(val.trim()); else onCancel(); }}
      />
    </div>
  );
}

type Editing =
  | { kind: "create-file"; parentId: string | null; depth: number }
  | { kind: "create-folder"; parentId: string | null; depth: number }
  | { kind: "rename"; id: string; current: string; depth: number };

interface NodeRowProps {
  node: FileNode;
  depth: number;
  activeFileId: string | null;
  tree: FileNode[];
  editing: Editing | null;
  setEditing: (e: Editing | null) => void;
  onOpenFile: (n: FileNode) => void;
  onConfirmCreate: (type: "file" | "folder", parentId: string | null, name: string) => void;
  onConfirmRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onPushFolder: (nodes: FileNode[], folderPath: string) => void;
  dragNodeId: React.MutableRefObject<string | null>;
  onMoveNode?: (nodeId: string, targetFolderId: string | null) => void;
}

function NodeRow({
  node, depth, activeFileId, tree, editing, setEditing,
  onOpenFile, onConfirmCreate, onConfirmRename, onDelete, onToggle, onPushFolder,
  dragNodeId, onMoveNode,
}: NodeRowProps) {
  const [hover, setHover] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const isActive = node.id === activeFileId;
  const isRenaming = editing?.kind === "rename" && editing.id === node.id;

  return (
    <div>
      {isRenaming ? (
        <NameInput
          placeholder="new name"
          initial={(editing as any).current}
          depth={depth}
          onConfirm={(name) => { onConfirmRename(node.id, name); setEditing(null); }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div
          draggable
          onDragStart={(e) => {
            dragNodeId.current = node.id;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", node.id);
          }}
          onDragEnd={() => { dragNodeId.current = null; }}
          onDragOver={(e) => {
            if (node.type !== "folder") return;
            if (!dragNodeId.current || dragNodeId.current === node.id) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            setDragOver(false);
          }}
          onDrop={(e) => {
            if (node.type !== "folder") return;
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            const id = dragNodeId.current;
            if (id && id !== node.id && onMoveNode) {
              onMoveNode(id, node.id);
            }
            dragNodeId.current = null;
          }}
          className={`flex items-center gap-1 px-1 py-[3px] cursor-pointer rounded-sm select-none transition-colors
            ${dragOver ? "bg-[#1a3a5c] border border-dashed border-blue-500" : ""}
            ${!dragOver && isActive ? "bg-[#37373d]" : ""}
            ${!dragOver && !isActive && hover ? "bg-[#2a2d2e]" : ""}`}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => node.type === "folder" ? onToggle(node.id) : onOpenFile(node)}
        >
          {node.type === "folder" ? (
            <>
              {node.expanded
                ? <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-400" />
                : <ChevronRight className="h-3 w-3 flex-shrink-0 text-gray-400" />}
              {node.expanded
                ? <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-yellow-300" />
                : <Folder className="h-3.5 w-3.5 flex-shrink-0 text-yellow-300" />}
            </>
          ) : (
            <>
              <span className="w-3 flex-shrink-0" />
              <FileIcon name={node.name} />
            </>
          )}

          <span className={`text-xs truncate flex-1 ${dragOver ? "text-blue-300" : isActive ? "text-white" : "text-gray-300"}`}>
            {node.name}
          </span>

          {(hover || isActive) && !dragOver && (
            <span className="flex items-center gap-0.5 ml-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {node.type === "folder" && (
                <>
                  <button
                    title="New File here"
                    onClick={() => setEditing({ kind: "create-file", parentId: node.id, depth: depth + 1 })}
                    className="p-0.5 rounded hover:bg-[#505050] text-gray-400 hover:text-white"
                  ><FilePlus className="h-3 w-3" /></button>
                  <button
                    title="New Folder here"
                    onClick={() => setEditing({ kind: "create-folder", parentId: node.id, depth: depth + 1 })}
                    className="p-0.5 rounded hover:bg-[#505050] text-gray-400 hover:text-white"
                  ><FolderPlus className="h-3 w-3" /></button>
                  <button
                    title="Push folder to GitHub"
                    onClick={() => onPushFolder(node.children, getNodePath(tree, node.id))}
                    className="p-0.5 rounded hover:bg-[#505050] text-gray-400 hover:text-blue-400"
                  ><Upload className="h-3 w-3" /></button>
                </>
              )}
              <button
                title="Rename"
                onClick={() => setEditing({ kind: "rename", id: node.id, current: node.name, depth })}
                className="p-0.5 rounded hover:bg-[#505050] text-gray-400 hover:text-white"
              ><Pencil className="h-3 w-3" /></button>
              <button
                title="Delete"
                onClick={() => { if (confirm(`Delete "${node.name}"?`)) onDelete(node.id); }}
                className="p-0.5 rounded hover:bg-[#505050] text-gray-400 hover:text-red-400"
              ><Trash2 className="h-3 w-3" /></button>
            </span>
          )}
        </div>
      )}

      {node.type === "folder" && node.expanded && (
        <>
          {editing &&
            (editing.kind === "create-file" || editing.kind === "create-folder") &&
            editing.parentId === node.id && (
              <NameInput
                placeholder={editing.kind === "create-file" ? "filename.py" : "folder-name"}
                depth={depth + 1}
                onConfirm={(name) => {
                  onConfirmCreate(editing.kind === "create-file" ? "file" : "folder", node.id, name);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            )}
          {node.children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              tree={tree}
              editing={editing}
              setEditing={setEditing}
              onOpenFile={onOpenFile}
              onConfirmCreate={onConfirmCreate}
              onConfirmRename={onConfirmRename}
              onDelete={onDelete}
              onToggle={onToggle}
              onPushFolder={onPushFolder}
              dragNodeId={dragNodeId}
              onMoveNode={onMoveNode}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default function FileExplorer({
  tree, activeFileId, onOpenFile, onCreate,
  onDelete, onRename, onToggle, onPushFolder, onPushAll, onClearAll, onDropFiles, onMoveNode, loading = false,
}: Props) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [rootDragOver, setRootDragOver] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const dragNodeId = useRef<string | null>(null);

  const handleConfirmCreate = (type: "file" | "folder", parentId: string | null, name: string) => {
    const node = onCreate(type, parentId, name);
    if (type === "file") onOpenFile(node);
  };

  const allFileCount = collectFiles(tree).length;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragNodeId.current) {
      setRootDragOver(true);
    } else {
      setDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    setRootDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
    setRootDragOver(false);

    if (dragNodeId.current && onMoveNode) {
      onMoveNode(dragNodeId.current, null);
      dragNodeId.current = null;
      return;
    }

    if (!onDropFiles) return;
    const results: { path: string; content: string }[] = [];
    const items = Array.from(e.dataTransfer.items);
    for (const item of items) {
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          await readEntryAsFiles(entry, "", results);
        } else {
          const file = item.getAsFile();
          if (file) {
            await new Promise<void>((res) => {
              const reader = new FileReader();
              reader.onload = (ev) => { results.push({ path: file.name, content: (ev.target?.result as string) || "" }); res(); };
              reader.onerror = () => res();
              reader.readAsText(file);
            });
          }
        }
      }
    }
    if (results.length > 0) onDropFiles(results);
  };

  return (
    <div
      className={`flex flex-col h-full bg-[#252526] border-r border-[#3c3c3c] relative transition-colors
        ${draggingOver ? "bg-[#1a2a3a] border-blue-500" : ""}
        ${rootDragOver ? "bg-[#1a2a2a]" : ""}`}
      style={{ width: 220, minWidth: 220 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {loading && (
        <div className="absolute inset-0 z-20 bg-[#252526]/80 flex flex-col items-center justify-center gap-2">
          <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-[11px] text-gray-400">Loading files…</span>
        </div>
      )}
      {draggingOver && (
        <div className="absolute inset-0 z-30 border-2 border-dashed border-blue-400 rounded pointer-events-none flex flex-col items-center justify-center gap-1 bg-[#1a2a3a]/60">
          <Upload className="h-6 w-6 text-blue-400" />
          <span className="text-[11px] text-blue-300 font-medium">Drop files to add</span>
        </div>
      )}
      {rootDragOver && !draggingOver && (
        <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-blue-500 rounded pointer-events-none" />
      )}

      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0 border-b border-[#3c3c3c]">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Explorer</span>
        <div className="flex items-center gap-0.5">
          <button
            title="New File"
            onClick={() => setEditing({ kind: "create-file", parentId: null, depth: 0 })}
            className="p-0.5 rounded hover:bg-[#3c3c3c] text-gray-400 hover:text-white"
          ><FilePlus className="h-3.5 w-3.5" /></button>
          <button
            title="New Folder"
            onClick={() => setEditing({ kind: "create-folder", parentId: null, depth: 0 })}
            className="p-0.5 rounded hover:bg-[#3c3c3c] text-gray-400 hover:text-white"
          ><FolderPlus className="h-3.5 w-3.5" /></button>
          <button
            title={`Push all ${allFileCount} file(s) to GitHub`}
            onClick={onPushAll}
            className="p-0.5 rounded hover:bg-[#3c3c3c] text-gray-400 hover:text-blue-400"
          ><Upload className="h-3.5 w-3.5" /></button>
          <button
            title="Clear all files"
            onClick={() => setConfirmClear(true)}
            className="p-0.5 rounded hover:bg-[#3c3c3c] text-gray-400 hover:text-red-400"
          ><RotateCcw className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {confirmClear && (
        <div className="flex flex-col gap-1 px-3 py-2 bg-[#1e1e1e] border-b border-red-900/60 flex-shrink-0">
          <p className="text-[10px] text-red-400 font-medium">Clear all files?</p>
          <p className="text-[10px] text-gray-500 leading-4">Resets explorer to a blank main.c — this cannot be undone.</p>
          <div className="flex gap-1 mt-0.5">
            <button
              onClick={() => { onClearAll(); setConfirmClear(false); }}
              className="flex-1 py-0.5 text-[10px] bg-red-900/40 border border-red-700/60 text-red-300 rounded hover:bg-red-900/70 transition-colors"
            >Clear All</button>
            <button
              onClick={() => setConfirmClear(false)}
              className="flex-1 py-0.5 text-[10px] bg-[#2a2a2a] border border-[#444] text-gray-400 rounded hover:bg-[#333] transition-colors"
            >Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto py-1">
        {editing &&
          (editing.kind === "create-file" || editing.kind === "create-folder") &&
          editing.parentId === null && (
            <NameInput
              placeholder={editing.kind === "create-file" ? "filename.py" : "folder-name"}
              depth={0}
              onConfirm={(name) => { handleConfirmCreate(editing.kind === "create-file" ? "file" : "folder", null, name); setEditing(null); }}
              onCancel={() => setEditing(null)}
            />
          )}

        {tree.map((node) => (
          <NodeRow
            key={node.id}
            node={node}
            depth={0}
            activeFileId={activeFileId}
            tree={tree}
            editing={editing}
            setEditing={setEditing}
            onOpenFile={onOpenFile}
            onConfirmCreate={handleConfirmCreate}
            onConfirmRename={(id, name) => { onRename(id, name); setEditing(null); }}
            onDelete={onDelete}
            onToggle={onToggle}
            onPushFolder={onPushFolder}
            dragNodeId={dragNodeId}
            onMoveNode={onMoveNode}
          />
        ))}

        {tree.length === 0 && (
          <p className="text-[11px] text-gray-600 text-center mt-8 px-3 leading-5">
            No files yet.<br />Click <FilePlus className="inline h-3 w-3" /> to create one.
          </p>
        )}
      </div>
    </div>
  );
}
