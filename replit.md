# MiniLang Compiler - Multi-Target Code Generation IDE

## Overview
A web-based interactive compiler IDE for the MiniLang programming language. The compiler is implemented entirely in TypeScript and generates code for 4 target languages: C, C++, Java, and Python.

## Architecture

### Frontend (client/)
- React + TypeScript SPA
- Split-panel IDE layout using `react-resizable-panels`
- Code editor with line numbers
- Tabbed output: Generated Code, IR (Three-Address Code), Errors
- Dark/light mode toggle
- Example programs dropdown

### Backend (server/)
- Express.js API server
- `POST /api/compile` - Compiles MiniLang source to target language
- `GET /api/examples` - Returns example programs

### Compiler Pipeline (server/compiler/)
The compiler follows a classic multi-phase architecture:

1. **Lexer** (`lexer.ts`) - Tokenizes source code, tracks line/col
2. **Parser** (`parser.ts`) - Recursive descent parser, builds AST with operator precedence
3. **Semantic Analyzer** (`sema.ts`) - Type checking, scope management, variable resolution
4. **IR Generator** (`ir.ts`) - Generates Three-Address Code (TAC)
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
- `server/compiler/` - Complete compiler implementation
- `client/src/pages/home.tsx` - Main IDE page
- `client/src/App.tsx` - App routing

## Tech Stack
- React 18, TypeScript, TailwindCSS
- Express.js backend
- Shadcn UI components
- TanStack Query for data fetching
- react-resizable-panels for split layout
- No database needed (stateless compiler tool)
