# MiniLang Compiler - Multi-Target Code Generation IDE

## Overview
A web-based interactive compiler IDE for the MiniLang programming language, styled like VS Code. The compiler is implemented entirely in TypeScript and generates code for 4 target languages: C, C++, Java, and Python.

## Architecture

### Frontend (client/)
- React + TypeScript SPA with VS Code-like layout
- CodeMirror 6 code editor with syntax highlighting and dark/light themes
- Activity bar, file explorer sidebar, editor tabs, toolbar
- Resizable bottom panel: Output, IR, Problems tabs
- Full mobile responsive layout with tab-based navigation
- Dark/light mode with localStorage persistence

### Backend (server/)
- Express.js API server
- `POST /api/compile` - Compiles MiniLang source to target language
- `GET /api/examples` - Returns example programs

### Compiler Pipeline (server/compiler/)
The compiler follows a classic multi-phase architecture:

1. **Lexer** (`lexer.ts`) - Tokenizes source code, tracks line/col
2. **Parser** (`parser.ts`) - Recursive descent parser, builds AST with operator precedence
3. **Semantic Analyzer** (`sema.ts`) - Type checking, scope management, variable resolution
4. **IR Generator** (`ir.ts`) - Generates Three-Address Code (TAC) for visualization
5. **Code Generator** (`codegen.ts`) - AST-based code generation for C, C++, Java, Python

### MiniLang Language
- Types: `int`, `float`, `bool`, `string`
- Statements: declarations, assignments, print, if/else, while
- Expressions: arithmetic (+, -, *, /), comparison (==, !=, <, <=, >, >=)
- Comments: `//` line, `/* */` block
- Block scoping with `{ }`
- Implicit int-to-float promotion
- String concatenation with `+`

## Key Files
- `shared/schema.ts` - Shared types (CompileRequest, CompileResult, etc.)
- `server/compiler/` - Complete compiler implementation (ast, lexer, parser, sema, ir, codegen, index)
- `client/src/pages/home.tsx` - Main VS Code-like IDE page
- `client/src/App.tsx` - App routing

## Dependencies
- CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`)
- react-resizable-panels for split layout
- Shadcn UI components
- TanStack Query for data fetching
- No database needed (stateless compiler tool)

## Tech Stack
- React 18, TypeScript, TailwindCSS
- Express.js backend
- Wouter for routing
