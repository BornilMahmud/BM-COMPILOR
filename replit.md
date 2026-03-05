# BM Compiler - Multi-Target Code Generation IDE

## Overview
A web-based interactive compiler IDE for the MiniLang programming language, styled like VS Code. Named "BM Compiler". The compiler is implemented entirely in TypeScript and generates code for 4 target languages: C, C++, Java, and Python. Generated code can be executed directly in the built-in terminal.

## Architecture

### Frontend (client/)
- React + TypeScript SPA with VS Code-like layout
- CodeMirror 6 code editor with syntax highlighting and dark/light themes
- Activity bar, file explorer sidebar, editor tabs, toolbar
- Resizable bottom panel: Problems, Output, IR, Terminal tabs
- Terminal panel with PowerShell/Bash shell style options, shows code execution results
- Full mobile responsive layout with tab-based navigation
- Dark/light mode with localStorage persistence
- Firebase GitHub authentication (login/logout in activity bar)
- GitHub repository integration (create repos, save files to GitHub)

### Backend (server/)
- Express.js API server
- `POST /api/compile` - Compiles MiniLang source to target language
- `POST /api/run` - Executes generated code (C/C++/Java/Python) with gcc/g++/javac/python3
- `GET /api/examples` - Returns example programs
- `POST /api/github/repos` - List user's GitHub repositories
- `POST /api/github/create-repo` - Create a new GitHub repository
- `POST /api/github/save-file` - Save/update a file in a GitHub repository

### Compiler Pipeline (server/compiler/)
1. **Lexer** (`lexer.ts`) - Tokenizes source code, tracks line/col
2. **Parser** (`parser.ts`) - Recursive descent parser, builds AST with operator precedence
3. **Semantic Analyzer** (`sema.ts`) - Type checking, scope management, variable resolution
4. **IR Generator** (`ir.ts`) - Generates Three-Address Code (TAC) for visualization
5. **Code Generator** (`codegen.ts`) - AST-based code generation for C, C++, Java, Python

### Code Execution (server/runner.ts)
- Compiles and runs generated code in temp directories
- Supports C (gcc), C++ (g++), Java (javac/java), Python (python3)
- 5-second execution timeout, max 3 concurrent runs, output size limits
- Automatic cleanup of temp files

### Authentication
- Firebase with GitHub OAuth provider (`client/src/lib/firebase.ts`)
- Auth context/hook (`client/src/hooks/use-auth.tsx`)
- GitHub token stored in localStorage for repo operations
- Secrets: VITE_FIREBASE_API_KEY, VITE_FIREBASE_APP_ID, VITE_FIREBASE_PROJECT_ID

### MiniLang Language
- Types: `int`, `float`, `bool`, `string`
- Statements: declarations, assignments, print, if/else, while
- Expressions: arithmetic (+, -, *, /), comparison (==, !=, <, <=, >, >=)
- Comments: `//` line, `/* */` block
- Block scoping, implicit int-to-float promotion, string concatenation

## Key Files
- `shared/schema.ts` - Shared types and Zod schemas
- `server/compiler/` - Complete compiler implementation
- `server/runner.ts` - Code execution service
- `server/routes.ts` - API endpoints
- `client/src/pages/home.tsx` - Main VS Code-like IDE page
- `client/src/lib/firebase.ts` - Firebase configuration
- `client/src/hooks/use-auth.tsx` - Auth context and hook

## Dependencies
- CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`)
- Firebase (auth with GitHub provider)
- @octokit/rest (GitHub API)
- react-resizable-panels, Shadcn UI, TanStack Query, Wouter
- System: gcc, g++, javac (JDK 21), python3
