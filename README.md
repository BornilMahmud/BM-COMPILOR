# BM Compiler

A web-based online code compiler and runner with GitHub integration. Write, run, and save code directly from your browser — no installation required.

**Live demo:** https://bmcompilor.tech

---

## Features

- **17 Languages** — C, C++, Java, Python, JavaScript, TypeScript, PHP, Ruby, Go, Rust, Dart, HTML, CSS, SQL, MySQL, OracleSQL, Bash
- **Custom compiler core** (`bmcc`) built with Flex + Bison — fast lexer/parser pipeline
- **GitHub integration** — save files directly to any repo, including into subfolders (`src/main.py`, `lib/utils.js`, etc.)
- **Windows/localhost support** — falls back to direct language runtimes when the `bmcc` binary is unavailable
- **Firebase authentication** — sign in with Google to link your GitHub repos
- **Guest mode** — run code without signing in
- **stdin support** — pass input values to your program

---

## Supported Languages

| Language | Code | Extension |
|----------|------|-----------|
| C | `c` | `.c` |
| C++ | `cpp` | `.cpp` |
| Java | `java` | `.java` |
| Python | `py` | `.py` |
| JavaScript | `js` | `.js` |
| TypeScript | `ts` | `.ts` |
| PHP | `php` | `.php` |
| Ruby | `rb` | `.rb` |
| Go | `go` | `.go` |
| Rust | `rs` | `.rs` |
| Dart | `dart` | `.dart` |
| HTML | `html` | `.html` |
| CSS | `css` | `.css` |
| SQL | `sql` | `.sql` |
| MySQL | `mysql` | `.sql` |
| OracleSQL | `ora` | `.sql` |
| Bash | `sh` | `.sh` |

---

## Local Setup

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for full Windows and Linux/Mac instructions.

**Quick start (any OS with Node.js 18+):**

```bash
git clone https://github.com/BornilMahmud/BM-COMPILOR.git
cd BM-COMPILOR
npm install
npm run dev
```

Open http://localhost:5000

---

## Project Structure

```
BM-COMPILOR/
├── client/          # React + Vite frontend
│   └── src/
│       ├── pages/   # ide.tsx, repo-setup.tsx, home.tsx
│       └── lib/     # firebase.ts, auth hooks
├── compiler/        # bmcc — Flex + Bison compiler core
│   ├── src/         # bm_script_lexer.l, bm_script_parser.y
│   └── bmcc         # compiled binary (Linux/Mac)
├── server/          # Express backend
│   ├── index.ts
│   └── routes.ts    # /api/run, /api/github/*
├── shared/          # Zod schemas, language definitions
├── Dockerfile       # Production container
├── render.yaml      # Render deployment config
├── LOCAL_SETUP.md   # Windows/local setup guide
└── .env.example     # Environment variable template
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `5000`) |
| `VITE_FIREBASE_API_KEY` | Firebase API key (optional) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID (optional) |
| `VITE_FIREBASE_APP_ID` | Firebase app ID (optional) |

Firebase is optional — the app runs in guest mode without it.

---

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)

Use the included `render.yaml` for one-click deployment.

---

## Author

**Bornil Mahmud** — [github.com/BornilMahmud](https://github.com/BornilMahmud)
