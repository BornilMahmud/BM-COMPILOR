# BM Compiler - Multi-Target Code Generation IDE

## Overview
A web-based interactive compiler IDE for the MiniLang programming language, styled like VS Code. Named "BM Compiler". The compiler backend is implemented in **C using Flex (lexer) and Bison (parser)** — a real compiler pipeline. It generates code for 4 target languages: C, C++, Java, and Python. Generated code can be executed directly in the built-in terminal.

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
- `POST /api/compile` - Spawns the C compiler binary (`compiler/bmc`) via `execFile`, pipes source via stdin, reads JSON output
- `POST /api/run` - Executes generated code (C/C++/Java/Python) with gcc/g++/javac/python3
- `GET /api/examples` - Returns example programs
- `POST /api/github/repos` - List user's GitHub repositories
- `POST /api/github/create-repo` - Create a new GitHub repository
- `POST /api/github/save-file` - Save/update a file in a GitHub repository

### C/Flex/Bison Compiler Pipeline (compiler/)
The compiler is a native C binary built with Flex and Bison:
1. **Lexer** (`lexer.l`) - Flex specification: tokenizes MiniLang source, tracks line/column positions
2. **Parser** (`parser.y`) - Bison grammar: builds AST with full operator precedence, error recovery
3. **AST** (`ast.h`, `ast.c`) - AST node types, constructors, memory management
4. **Semantic Analyzer** (`sema.h`, `sema.c`) - Type checking, scope management, variable resolution, int-to-float promotion
5. **IR Generator** (`ir.h`, `ir.c`) - Generates Three-Address Code (TAC) with labels for control flow
6. **Code Generator** (`codegen.h`, `codegen.c`) - AST-based code generation for C, C++, Java, Python
7. **Main** (`main.c`) - Entry point: reads from stdin, outputs JSON to stdout
8. **Makefile** - Builds the `bmc` binary: `flex → lex.yy.c`, `bison → parser.tab.c/h`, then `gcc`

Build: `cd compiler && make` produces `compiler/bmc`
Usage: `echo 'int x = 42; print(x);' | ./compiler/bmc --target c --ir`
Output: JSON with `{success, generatedCode, ir, errors, target}`

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
- Expressions: arithmetic (+, -, *, /), comparison (==, !=, <, <=, >, >=), logical (&&, ||)
- Comments: `//` line, `/* */` block
- Block scoping, implicit int-to-float promotion, string concatenation with +

## Key Files
- `compiler/` - C/Flex/Bison compiler (lexer.l, parser.y, ast.c/h, sema.c/h, codegen.c/h, ir.c/h, main.c, Makefile)
- `compiler/bmc` - Compiled binary (built from Makefile)
- `shared/schema.ts` - Shared types and Zod schemas
- `server/runner.ts` - Code execution service
- `server/routes.ts` - API endpoints (spawns compiler/bmc)
- `client/src/pages/home.tsx` - Main VS Code-like IDE page
- `client/src/lib/firebase.ts` - Firebase configuration
- `client/src/hooks/use-auth.tsx` - Auth context and hook

## Dependencies
- CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`)
- Firebase (auth with GitHub provider)
- react-resizable-panels, Shadcn UI, TanStack Query, Wouter
- System: flex, bison, gcc, g++, javac (JDK 21), python3
