# BM Compiler — Local / Windows Setup

## Requirements

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | bundled with Node.js |
| Git | any | https://git-scm.com |

Language runtimes (install only what you need):

| Language | Runtime |
|----------|---------|
| Python | https://python.org |
| Java | https://adoptium.net (JDK 21+) |
| PHP | https://windows.php.net (add to PATH) |
| Ruby | https://rubyinstaller.org |
| Go | https://go.dev |
| Rust | `rustup-init.exe` → https://rustup.rs |
| Dart | https://dart.dev/get-dart |
| Node.js (JS/TS) | already required above |
| Bash (Windows) | Git Bash or WSL2 |
| SQLite (SQL) | bundled in Git Bash / WSL2 |

---

## Quick Start (Windows)

```bat
git clone https://github.com/YOUR_USERNAME/bm-compiler.git
cd bm-compiler
npm install
npm run dev
```

Then open http://localhost:5000 in your browser.

> **No Linux compiler binary needed on Windows.**
> The server automatically detects that `bmcc` (the Flex+Bison binary) is not present
> and falls back to calling each language's runtime directly.
> Make sure the runtimes you want to use are installed and on your PATH.

---

## Environment Variables (optional)

Copy the example file and fill in your values:

```bat
copy .env.example .env
```

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default `5000`) |
| `VITE_FIREBASE_API_KEY` | Firebase auth (optional — app works without it) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project |
| `VITE_FIREBASE_APP_ID` | Firebase app |

---

## Running on Linux / Mac

The `bmcc` Flex+Bison binary is used automatically when present.
To build it from source:

```bash
cd compiler
make
cd ..
npm run dev
```

---

## Production Build

```bash
npm run build
npm start
```

The compiled output is in `dist/`.
