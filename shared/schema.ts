import { z } from "zod";

export const targetLanguages = ['c', 'cpp', 'java', 'py'] as const;
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

export const defaultFilenames: Record<TargetLanguage, string> = {
  c: 'main.c',
  cpp: 'main.cpp',
  java: 'Main.java',
  py: 'main.py',
};
