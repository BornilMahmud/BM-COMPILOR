import { z } from "zod";

export const targetLanguages = [
  'c', 'cpp', 'java', 'py',
  'js', 'ts', 'php', 'rb', 'go', 'rs', 'dart',
  'html', 'css', 'sql', 'mysql', 'ora', 'sh',
] as const;

export type TargetLanguage = typeof targetLanguages[number];

export const runRequestSchema = z.object({
  language: z.enum(targetLanguages),
  filename: z.string().min(1),
  code: z.string().min(1),
  stdin: z.string().optional().default(""),
});

export type RunRequest = z.infer<typeof runRequestSchema>;

export interface RunResult {
  ok: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  phase: string;
}

export interface GithubRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
}

export const createRepoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isPrivate: z.boolean().optional().default(false),
});

export const commitFileSchema = z.object({
  repo: z.string().min(1),
  path: z.string().min(1),
  content: z.string(),
  message: z.string().optional().default("Update from BM Compiler"),
});

export const targetLabels: Record<TargetLanguage, string> = {
  c:     'C',
  cpp:   'C++',
  java:  'Java',
  py:    'Python',
  js:    'JavaScript',
  ts:    'TypeScript',
  php:   'PHP',
  rb:    'Ruby',
  go:    'Go',
  rs:    'Rust',
  dart:  'Dart',
  html:  'HTML',
  css:   'CSS',
  sql:   'SQL',
  mysql: 'MySQL',
  ora:   'OracleSQL',
  sh:    'Bash',
};

export const targetFileExtensions: Record<TargetLanguage, string> = {
  c:     '.c',
  cpp:   '.cpp',
  java:  '.java',
  py:    '.py',
  js:    '.js',
  ts:    '.ts',
  php:   '.php',
  rb:    '.rb',
  go:    '.go',
  rs:    '.rs',
  dart:  '.dart',
  html:  '.html',
  css:   '.css',
  sql:   '.sql',
  mysql: '.sql',
  ora:   '.sql',
  sh:    '.sh',
};

export const defaultFilenames: Record<TargetLanguage, string> = {
  c:     'main.c',
  cpp:   'main.cpp',
  java:  'Main.java',
  py:    'main.py',
  js:    'main.js',
  ts:    'main.ts',
  php:   'main.php',
  rb:    'main.rb',
  go:    'main.go',
  rs:    'main.rs',
  dart:  'main.dart',
  html:  'index.html',
  css:   'style.css',
  sql:   'query.sql',
  mysql: 'query.sql',
  ora:   'query.sql',
  sh:    'script.sh',
};

export const languageGroups: { label: string; langs: TargetLanguage[] }[] = [
  { label: 'Systems',    langs: ['c', 'cpp', 'rs'] },
  { label: 'JVM',        langs: ['java'] },
  { label: 'Scripting',  langs: ['py', 'rb', 'php', 'sh'] },
  { label: 'Web',        langs: ['js', 'ts', 'html', 'css'] },
  { label: 'Mobile/Other', langs: ['dart', 'go'] },
  { label: 'Database',   langs: ['sql', 'mysql', 'ora'] },
];
