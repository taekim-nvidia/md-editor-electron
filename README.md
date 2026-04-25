# markdown-editor

A full-featured Markdown editor built with Electron + React + TypeScript.
Runs as a native desktop app — no browser needed. Works on Windows, Mac, and Linux.

**Repo:** https://github.com/NVIDIA-dev/markdown-editor

---

## Quick Start

```bash
git clone https://github.com/NVIDIA-dev/markdown-editor.git
cd markdown-editor
npm install
npm run dev
```

The app opens as a native window in WYSIWYG mode — click anywhere and start typing.

---

## Installation Guide

### Prerequisites

| Tool | Required for | Install |
|---|---|---|
| Node.js 18+ | Running the app | https://nodejs.org (LTS) |
| Git | Git panel | https://git-scm.com |
| gh CLI | GitHub browser, PR panel, URL loading | https://cli.github.com |

---

### Windows

```powershell
# Install Node.js — download from https://nodejs.org → LTS → run .msi

# Install Git — download from https://git-scm.com/download/win → run .exe

# Install gh CLI
winget install GitHub.cli
# OR download .msi from https://cli.github.com

# Open a NEW PowerShell after installing, then authenticate:
gh auth login
# Choose: GitHub.com → HTTPS → Login with a web browser
```

---

### macOS

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install everything
brew install node git gh

# Authenticate gh
gh auth login
```

---

### Linux (Ubuntu / Debian)

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Git
sudo apt install git

# gh CLI
sudo apt install gh  # Ubuntu 22.04+
# Or follow: https://github.com/cli/cli/blob/trunk/docs/install_linux.md

# Authenticate
gh auth login
```

---

### Linux: Electron Sandbox

On Linux, if you see `FATAL: setuid_sandbox_host.cc — chrome-sandbox is not configured correctly`:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

`npm install` will attempt this automatically. If it fails, run the commands above manually.

---

## Verify Installation

```bash
node --version     # should be 18+
npm --version      # should be 9+
git --version
gh --version
gh auth status     # should say: Logged in to github.com
```

---

## Run

```bash
git clone https://github.com/NVIDIA-dev/markdown-editor.git
cd markdown-editor
npm install
npm run dev
```

**Debug mode** (opens DevTools):
```bash
npm run dev -- --devtools
```

---

## Feature Guide

> **Click the `?` button in the toolbar at any time to open this guide in your browser.**

### First Launch

The app opens in **WYSIWYG mode** — a rich text editor where you can click and type directly, just like Google Docs or Notion. No markdown syntax required.

---

### Layout Modes

Use the buttons on the right side of the toolbar to switch layouts:

| Button | What it does |
|---|---|
| **Source** | Split view — CodeMirror editor on left, live preview on right |
| **WYSIWYG** | Full-screen rich text editor (default) |
| Split H icon | Side-by-side (editor + preview) |
| Split V icon | Top/bottom (editor + preview) |
| Edit icon | Source editor only |
| View icon | Preview only |

---

### WYSIWYG Mode

Click anywhere and type. Use the toolbar to format:

- **B** / Ctrl+B — Bold
- **I** / Ctrl+I — Italic
- **H1**, **H2** — Headings
- **\`** — Inline code
- **{ }** — Code block

Changes sync to markdown source automatically.

---

### Source Mode

Click **Source** to see the split view with raw markdown on the left and rendered preview on the right. Full CodeMirror editor with syntax highlighting and line numbers.

---

### Opening Files

- **Open** button or `Ctrl+O` — open a local file
- **URL** button — paste any URL:
  - `https://github.com/owner/repo` → loads README
  - `https://github.com/owner/repo/blob/main/file.md` → loads that file
  - Also opens in the **GH browser** panel so you can commit changes
- **+** button or `Ctrl+N` — new empty tab

---

### Saving

- **Ctrl+S** — save
- New files: prompts for a location on first save
- Auto-saves before every git commit

---

### Find & Replace

**Ctrl+F** or click **Find** in toolbar:
- Type to search — match count shows live
- **↓ / ↑** — next/previous match
- Fill Replace field → **Replace** (one) or **All** (all occurrences)
- **Escape** to close

---

### Git Panel

Click **Git** in toolbar:

1. Working directory auto-fills from the open file's path
2. Type a commit message
3. **Commit** — saves the file first, then commits
4. **Push** — push to remote
5. **Pull** — fetch and merge latest

---

### GitHub Browser

Click **GH** in toolbar (requires `gh auth login`):

1. Your repos load automatically — filter by owner using the buttons at the top
2. Click a repo → browse file tree
3. Click a text file → clones to `/tmp/gh-workspace/` and opens in editor
4. Make changes, enter commit message → **Commit & Push**
5. Open PRs for the repo appear below the file list — click to open on GitHub

**Paste a GitHub URL in the URL dialog** → automatically opens the file and navigates the GH browser to that repo.

---

### PR Panel

Click **PR** in toolbar (requires `gh auth login`):

- Enter `owner/repo` → browse Open / Closed / All PRs
- Click a PR → view description and comments (rendered as markdown)
- Reply to comments, approve, request changes
- **Create PR** tab → create a PR from your current branch

---

### Help

Click **?** in the toolbar → opens this README on GitHub.

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Save | Ctrl+S |
| New tab | Ctrl+N |
| Find & Replace | Ctrl+F |
| Bold | Ctrl+B |
| Italic | Ctrl+I |
| Font larger | Ctrl+= |
| Font smaller | Ctrl+- |
| Font reset | Ctrl+0 |

---

## Tests

113 automated tests across two suites:

```bash
# Run all tests
npx playwright test tests/qa.spec.js tests/electron.spec.js
```

| Suite | Tests | What it covers |
|---|---|---|
| `qa.spec.js` | 88 | Frontend UI — buttons, modes, shortcuts, panels, find/replace, formatting |
| `electron.spec.js` | 25 | Real Electron — app launch, file I/O via IPC, git add+commit, gh API calls, app close |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Shell | Electron 30 |
| Frontend | React 18 + Vite + TypeScript |
| WYSIWYG editor | Tiptap |
| Source editor | CodeMirror 6 |
| Preview | marked + highlight.js |
| Styling | Tailwind CSS |
| Git/gh | Electron IPC → child_process |
