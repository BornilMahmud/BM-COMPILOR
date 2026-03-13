import { useState, useCallback } from "react";
import type { TargetLanguage } from "@shared/schema";
import { langFromFilename, defaultCode } from "@/lib/defaults";

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  language?: TargetLanguage;
  content: string;
  children: FileNode[];
  expanded: boolean;
}

const STORAGE_KEY = "bm_file_tree";

function makeFile(name: string): FileNode {
  const lang = langFromFilename(name);
  return {
    id: crypto.randomUUID(),
    name,
    type: "file",
    language: lang,
    content: defaultCode[lang] ?? "",
    children: [],
    expanded: false,
  };
}

function makeFolder(name: string): FileNode {
  return {
    id: crypto.randomUUID(),
    name,
    type: "folder",
    content: "",
    children: [],
    expanded: true,
  };
}

function loadTree(): FileNode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [makeFile("main.c")];
}

function saveTree(tree: FileNode[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  } catch {}
}

function updateNodeInTree(tree: FileNode[], id: string, updater: (n: FileNode) => FileNode): FileNode[] {
  return tree.map((node) => {
    if (node.id === id) return updater(node);
    if (node.type === "folder") return { ...node, children: updateNodeInTree(node.children, id, updater) };
    return node;
  });
}

function deleteNodeFromTree(tree: FileNode[], id: string): FileNode[] {
  return tree
    .filter((n) => n.id !== id)
    .map((n) => (n.type === "folder" ? { ...n, children: deleteNodeFromTree(n.children, id) } : n));
}

function addChildToFolder(tree: FileNode[], parentId: string | null, child: FileNode): FileNode[] {
  if (parentId === null) return [...tree, child];
  return tree.map((n) => {
    if (n.id === parentId && n.type === "folder") return { ...n, children: [...n.children, child] };
    if (n.type === "folder") return { ...n, children: addChildToFolder(n.children, parentId, child) };
    return n;
  });
}

export function findNodeById(tree: FileNode[], id: string): FileNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.type === "folder") {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getNodePath(tree: FileNode[], id: string, prefix = ""): string {
  for (const node of tree) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.id === id) return fullPath;
    if (node.type === "folder") {
      const found = getNodePath(node.children, id, fullPath);
      if (found) return found;
    }
  }
  return "";
}

export function collectFiles(nodes: FileNode[], prefix = ""): { path: string; content: string; language: TargetLanguage }[] {
  const result: { path: string; content: string; language: TargetLanguage }[] = [];
  for (const node of nodes) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file" && node.language) {
      result.push({ path: fullPath, content: node.content, language: node.language });
    } else if (node.type === "folder") {
      result.push(...collectFiles(node.children, fullPath));
    }
  }
  return result;
}

export function useFileTree() {
  const [tree, setTree] = useState<FileNode[]>(loadTree);

  const persist = useCallback((next: FileNode[]) => {
    setTree(next);
    saveTree(next);
  }, []);

  const createFile = useCallback(
    (parentId: string | null, name: string) => {
      const node = makeFile(name);
      const next = addChildToFolder(tree, parentId, node);
      persist(next);
      return node;
    },
    [tree, persist]
  );

  const createFolder = useCallback(
    (parentId: string | null, name: string) => {
      const node = makeFolder(name);
      const next = addChildToFolder(tree, parentId, node);
      persist(next);
      return node;
    },
    [tree, persist]
  );

  const deleteNode = useCallback(
    (id: string) => {
      persist(deleteNodeFromTree(tree, id));
    },
    [tree, persist]
  );

  const renameNode = useCallback(
    (id: string, newName: string) => {
      const next = updateNodeInTree(tree, id, (n) => {
        if (n.type === "file") {
          const lang = langFromFilename(newName);
          return { ...n, name: newName, language: lang };
        }
        return { ...n, name: newName };
      });
      persist(next);
    },
    [tree, persist]
  );

  const updateContent = useCallback(
    (id: string, content: string) => {
      const next = updateNodeInTree(tree, id, (n) => ({ ...n, content }));
      persist(next);
    },
    [tree, persist]
  );

  const toggleFolder = useCallback(
    (id: string) => {
      const next = updateNodeInTree(tree, id, (n) => ({ ...n, expanded: !n.expanded }));
      persist(next);
    },
    [tree, persist]
  );

  return { tree, createFile, createFolder, deleteNode, renameNode, updateContent, toggleFolder };
}
