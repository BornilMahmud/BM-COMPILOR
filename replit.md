# BM Compiler - Online Compiler & Code Runner

## Overview
A web-based online compiler and code runner with GitHub integration. The compiler core (`bmcc`) is built in **C using Flex (lexer) and Bison (parser)** to satisfy compiler design course requirements. It uses a BM Script DSL internally to drive compilation/execution tasks. Supports C, C++, Java, and Python code execution.

## Architecture

### Frontend (client/)
- React + TypeScript SPA with 3 pages:
  - **Login** (`/`) - Firebase GitHub OAuth sign-in OR "Continue as Guest"
  - **Repo Setup** (`/repo-setup`) - Create or select GitHub repository (authenticated users only)
  - **IDE** (`/ide`) - Code editor, language selector, filename input, Run/Save buttons, integrated terminal with stdin input
- **Guest mode**: Users can access IDE without logging in; GitHub features (Save, repo) hidden for guests
- Uses CodeMirror 6 for code editing (C/C++/Java/Python syntax)
- Dark theme UI styled with Tailwind CSS
- Terminal panel includes integrated stdin input area (multi-line) for programs that read user input
- Auth via Firebase GitHub provider (existing setup)
- GitHub token passed in `X-GitHub-Token` header

### Backend (server/)
- Express.js API server
- Routes:
  - `GET /api/health` - Health check
  - `POST /api/run` - Executes code via `bmcc` binary: `{language, filename, code, stdin?}` → `{ok, exit_code, stdout, stderr, phase}`
  - `GET /api/github/repos` - List user repos (requires X-GitHub-Token)
  - `POST /api/github/createRepo` - Create new repo
  - `POST /api/github/commit` - Save/update file in repo via GitHub API commit

### Compiler Core (compiler/) — Built with ONLY Flex + Bison
Binary: `compiler/bmcc` — entire compiler built using **only** Flex (.l) and Bison (.y) files.

**BM Script DSL** (parsed by Flex+Bison):
```
LANG c;
FILE "main.c";
STDIN "optional input";
RUN;
```

**Architecture** (only 2 source files):
- `bm_script_lexer.l` (Flex) — tokenizer: LANG, FILE, RUN, STDIN, STRING, IDENT, SEMI
- `bm_script_parser.y` (Bison) — contains everything:
  - Grammar rules (parse BM Script into BMJob struct)
  - Runner logic (fork/execvp with pipes for C/C++/Java/Python)
  - JSON output, utility functions
  - `main()` function (CLI args → BM Script → parse → execute)

**Supported languages**: C (gcc), C++ (g++), Java (javac+java), Python (python3)
**Safety**: fork/execvp (no system()), alarm() timeout (5s), pipe-based I/O capture
**Build**: `cd compiler && make` → produces `compiler/bmcc`

### Source Files
```
compiler/
  Makefile
  src/
    bm_script_lexer.l    # Flex lexer — tokenization only
    bm_script_parser.y   # Bison parser — grammar + runner + main + utilities
```

### Authentication
- Firebase with GitHub OAuth provider (`client/src/lib/firebase.ts`)
- Auth context (`client/src/hooks/use-auth.tsx`)
- GitHub token stored in localStorage, sent as `X-GitHub-Token` header
- Secrets: VITE_FIREBASE_API_KEY, VITE_FIREBASE_APP_ID, VITE_FIREBASE_PROJECT_ID

### Key Frontend Files
- `client/src/pages/login.tsx` - Login page
- `client/src/pages/repo-setup.tsx` - Repo selection/creation
- `client/src/pages/ide.tsx` - Main IDE with editor & terminal
- `client/src/App.tsx` - Router (/, /repo-setup, /ide)

## Dependencies
- CodeMirror 6 (@uiw/react-codemirror, lang-cpp, lang-java, lang-python)
- Firebase (auth with GitHub provider)
- react-icons (GitHub logo)
- Shadcn UI, TanStack Query, Wouter
- System: flex, bison, gcc, g++, javac (JDK), python3
