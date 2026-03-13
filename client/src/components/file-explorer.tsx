import { useState, useRef, useEffect } from "react";
import {
  ChevronRight, ChevronDown, FilePlus, FolderPlus,
  Trash2, Pencil, FileCode, Folder, FolderOpen, Upload,
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
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const colors: Record<string, string> = {
    c: "text-blue-400", cpp: "text-blue-400", java: "text-orange-400",
    py: "text-yellow-400", js: "text-yellow-300", ts: "text-blue-300",
    php: "text-purple-400", rb: "text-red-400", go: "text-cyan-400",
    rs: "text-orange-300", dart: "text-sky-400", sql: "text-green-400",
    sh: "text-gray-300",
  };
  return <FileCode className={`h-3.5 w-3.5 flex-shrink-0 ${colors[ext] ?? "text-gray-400"}`} />;
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
}

function NodeRow({
  node, depth, activeFileId, tree, editing, setEditing,
  onOpenFile, onConfirmCreate, onConfirmRename, onDelete, onToggle, onPushFolder,
}: NodeRowProps) {
  const [hover, setHover] = useState(false);
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
          className={`flex items-center gap-1 px-1 py-[3px] cursor-pointer rounded-sm
            ${isActive ? "bg-[#37373d]" : hover ? "bg-[#2a2d2e]" : ""}`}
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

          <span className={`text-xs truncate flex-1 ${isActive ? "text-white" : "text-gray-300"}`}>
            {node.name}
          </span>

          {(hover || isActive) && (
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
            />
          ))}
        </>
      )}
    </div>
  );
}

export default function FileExplorer({
  tree, activeFileId, onOpenFile, onCreate,
  onDelete, onRename, onToggle, onPushFolder, onPushAll,
}: Props) {
  const [editing, setEditing] = useState<Editing | null>(null);

  const handleConfirmCreate = (type: "file" | "folder", parentId: string | null, name: string) => {
    const node = onCreate(type, parentId, name);
    if (type === "file") onOpenFile(node);
  };

  const allFileCount = collectFiles(tree).length;

  return (
    <div className="flex flex-col h-full bg-[#252526] border-r border-[#3c3c3c]" style={{ width: 220, minWidth: 220 }}>
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
        </div>
      </div>

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
