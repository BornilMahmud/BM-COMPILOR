# BM Compiler - Online Compiler & Code Runner

## Overview
A web-based online compiler and code runner with GitHub integration. The compiler core (`bmcc`) is built in **C using Flex (lexer) and Bison (parser)**. Supports 17 languages across systems, scripting, web, mobile, and database categories.

## Architecture

### Frontend (client/)
- React + TypeScript SPA with 3 pages:
  - **Login** (`/`) - Firebase GitHub OAuth sign-in OR "Continue as Guest"
  - **Repo Setup** (`/repo-setup`) - Create or select GitHub repository (authenticated users only)
  - **IDE** (`/ide`) - Code editor, language selector (17 langs), filename input, Run/Save buttons, integrated terminal with stdin input
- **Guest mode**: Users can access IDE without logging in; GitHub features hidden for guests
- Uses CodeMirror 6 for code editing
- Dark theme UI styled with Tailwind CSS
- Auth via Firebase GitHub provider (optional — app works without Firebase)

### Backend (server/)
- Express.js API server
- Routes:
  - `GET /api/health` - Health check
  - `POST /api/run` - Executes code via `bmcc` binary
  - `GET /api/github/repos` - List user repos
  - `POST /api/github/createRepo` - Create new repo
  - `POST /api/github/commit` - Save/update file in repo

### Compiler Core (compiler/) — Built with Flex + Bison
Binary: `compiler/bmcc`

**Supported Languages (17 total)**:
| Code    | Language      | Runtime          |
|---------|---------------|------------------|
| c       | C             | gcc              |
| cpp     | C++           | g++              |
| java    | Java          | javac + java     |
| py      | Python        | python3          |
| js      | JavaScript    | node             |
| ts      | TypeScript    | npx tsx          |
| php     | PHP           | php              |
| rb      | Ruby          | ruby             |
| go      | Go            | go run           |
| rs      | Rust          | rustc            |
| dart    | Dart          | dart run         |
| html    | HTML          | node (analysis)  |
| css     | CSS           | node (analysis)  |
| sql     | SQL           | sqlite3          |
| mysql   | MySQL         | sqlite3          |
| ora     | OracleSQL     | sqlite3          |
| sh      | Bash          | bash             |

**Architecture** (2 source files):
- `bm_script_lexer.l` (Flex) — tokenizer
- `bm_script_parser.y` (Bison) — grammar + runner + main + utilities

**BM Script DSL** (parsed by Flex+Bison):
```
LANG js;
FILE "main.js";
STDIN "optional input";
RUN;
```

**Build**: `cd compiler && make` → produces `compiler/bmcc`

### Authentication
- Firebase with GitHub OAuth provider (`client/src/lib/firebase.ts`)
- Firebase is optional — app loads gracefully without credentials
- Secrets needed for GitHub login: VITE_FIREBASE_API_KEY, VITE_FIREBASE_APP_ID, VITE_FIREBASE_PROJECT_ID

## Deployment

### Replit (Dev)
- Workflow: `npm run dev` on port 5000
- Server binds to 0.0.0.0:5000, Vite in middleware mode with allowedHosts: true

### Render (Production)
- Uses `render.yaml` + `Dockerfile`
- Docker image installs all language runtimes (gcc, java, python3, php, ruby, go, rustc, dart, sqlite3)
- Builds: `cd compiler && make` + `npm run build`
- Runs: `npm run start` (NODE_ENV=production, port 10000)
- Health check: `GET /api/health`

## Dependencies
- CodeMirror 6 (editor with syntax highlighting)
- Firebase (optional auth with GitHub provider)
- Shadcn UI, TanStack Query, Wouter
- System: flex, bison, gcc, g++, javac, python3, php, ruby, go, rustc, dart, sqlite3, bash, node
