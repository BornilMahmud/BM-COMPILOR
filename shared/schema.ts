import { z } from "zod";

export const targetLanguages = ['c', 'cpp', 'java', 'py'] as const;
export type TargetLanguage = typeof targetLanguages[number];

export const compileRequestSchema = z.object({
  source: z.string().min(1),
  target: z.enum(targetLanguages),
  emitIr: z.boolean().optional().default(false),
});

export type CompileRequest = z.infer<typeof compileRequestSchema>;

export interface CompilerError {
  line: number;
  column: number;
  message: string;
  phase: 'lexer' | 'parser' | 'semantic';
}

export interface CompileResult {
  success: boolean;
  generatedCode: string;
  ir: string;
  errors: CompilerError[];
  target: TargetLanguage;
  tokens?: { type: string; value: string; line: number; col: number }[];
}

export interface Example {
  name: string;
  filename: string;
  source: string;
  description: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

export const runRequestSchema = z.object({
  code: z.string().min(1),
  target: z.enum(targetLanguages),
});

export type RunRequest = z.infer<typeof runRequestSchema>;

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
  githubToken: z.string().min(1),
});

export const saveFileSchema = z.object({
  repo: z.string().min(1),
  path: z.string().min(1),
  content: z.string(),
  message: z.string().optional().default("Update from BM Compiler"),
  githubToken: z.string().min(1),
});

export const targetLabels: Record<TargetLanguage, string> = {
  c: 'C',
  cpp: 'C++',
  java: 'Java',
  py: 'Python',
};

export const targetFileExtensions: Record<TargetLanguage, string> = {
  c: '.c',
  cpp: '.cpp',
  java: '.java',
  py: '.py',
};
