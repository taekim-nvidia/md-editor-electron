# md-editor-electron

A full-featured Markdown editor built with Electron + React + TypeScript.
Runs as a native desktop app — no browser needed. Works on Windows, Mac, and Linux.

---

## Installation Guide

### Windows

**1. Node.js (includes npm)**
- Download from https://nodejs.org → click **LTS** (green button)
- Run the `.msi` installer, keep all defaults
- Open a **new** PowerShell and verify:
```powershell
node --version
npm --version
```

**2. Git**
- Download from https://git-scm.com/download/win
- Run installer, keep all defaults
- Verify: `git --version`

**3. gh CLI** (for GitHub Browser and PR panel)
- Download from https://cli.github.com → Download for Windows → run `.msi`
- Or if you have winget: `winget install GitHub.cli`
- Open a new PowerShell and authenticate:
```powershell
gh auth login
```
Choose: GitHub.com → HTTPS → Login with a web browser

---

### macOS

**1. Homebrew** (if not installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**2. Node.js, Git, gh CLI**
```bash
brew install node git gh
gh auth login
```

Or install Node.js manually from https://nodejs.org → macOS installer.

---

### Linux (Ubuntu / Debian)

**1. Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**2. Git**
```bash
sudo apt install git
```

**3. gh CLI**
```bash
(type -p wget >/dev/null || (sudo apt update && sudo apt-get install wget -y)) \
&& sudo mkdir -p -m 755 /etc/apt/keyrings \
&& wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
&& sudo apt update && sudo apt install gh -y

gh auth login
```

---

## Run the App

```bash
git clone https://github.com/taekim-nvidia/md-editor-electron.git
cd md-editor-electron
npm install
npm run dev
```

The app opens as a native window.

---

## Features

- **WYSIWYG editor** — edit rendered markdown directly (Tiptap)
- **Source editor** — CodeMirror 6 with syntax highlighting
- **Split pane** — editor and preview side by side, resizable
- **Multi-tab** — open multiple files
- **Find & Replace** — Ctrl+F
- **Git panel** — status, pull, push, commit
- **GitHub Browser** — browse repos, clone, edit, commit, push
- **PR panel** — view, comment, review, create PRs
- **Dark / light theme** — toggle
- **Font size** — Ctrl+= to increase, Ctrl+- to decrease, Ctrl+0 to reset
- **Auto-save on commit** — file is saved before every git commit
- **Git identity auto-configured** from gh CLI on startup

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

## Tech Stack

| Layer | Tech |
|---|---|
| Shell | Electron 30 |
| Frontend | React 18 + Vite + TypeScript |
| Source editor | CodeMirror 6 |
| WYSIWYG editor | Tiptap |
| Preview | marked + highlight.js |
| Styling | Tailwind CSS |
| Git/gh | Electron IPC → child_process |
