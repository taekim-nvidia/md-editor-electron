# markdown-editor

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

## Linux: Electron Sandbox Fix

On Linux, Electron requires a SUID sandbox binary. If you see:
```
FATAL: setuid_sandbox_host.cc — chrome-sandbox is not configured correctly
```

Run:
```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

Or `npm install` will attempt this automatically via the postinstall script.

---

## Verify Installation

Run these — all should print a version number:

```bash
node --version     # 18 or higher
npm --version      # 9 or higher
git --version
gh --version
gh auth status     # should say: Logged in to github.com
```

---

## Run the App

```bash
git clone https://github.com/NVIDIA-dev/markdown-editor.git
cd markdown-editor
npm install
npm run dev
```

The app opens as a native window.

**Debug mode** (enables DevTools):
```bash
npm run dev -- --devtools
```

---

## Feature Guide

### Writing Markdown

The app opens with a split view: **source editor on the left**, **live preview on the right**.

- Type markdown in the left pane — the right pane updates as you type
- The right pane is fully editable in WYSIWYG mode (see below)
- Use toolbar buttons or keyboard shortcuts to format text

---

### Layout Modes

Use the layout buttons on the right side of the toolbar:

| Button | Layout |
|---|---|
| 50/50 | Editor left, preview right (default) |
| Top/Bot | Editor top, preview bottom |
| Edit | Full-screen source editor |
| View | Full-screen preview |
| WYSIWYG | Full-screen rich text editor |

---

### WYSIWYG Mode

Click the **WYSIWYG** button in the toolbar to switch to rich text editing.

- Click anywhere in the document and type
- Select text and use toolbar buttons (Bold, Italic, H1, H2, Code) to format
- The markdown source stays in sync automatically
- Switch back to split view any time — all changes are preserved

---

### Opening Files

**Local file:**
1. Click **Open** in the toolbar (or Ctrl+O)
2. Select a `.md` or `.txt` file from the dialog

**From URL:**
1. Click **URL** in the toolbar
2. Paste any URL — including GitHub repo URLs like `https://github.com/owner/repo`
3. GitHub URLs are automatically redirected to the raw file content

**Multiple files:**
- Each file opens in a new tab
- Click tabs to switch between files
- Click **×** on a tab to close it
- Click **+** to open a new empty tab

---

### Saving Files

- **Ctrl+S** — save current file
- First save on a new file opens a Save dialog to choose location
- The app auto-saves before every git commit

---

### Find & Replace

1. Press **Ctrl+F** or click the **Find** toolbar button
2. Type in the Find field — match count updates as you type
3. Press **Enter** or click **↓** for next match, **↑** for previous
4. Fill in the Replace field and click **Replace** (one) or **All** (all occurrences)
5. Press **Escape** or click **X** to close

---

### Font Size

- **Ctrl+=** — increase font size
- **Ctrl+-** — decrease font size
- **Ctrl+0** — reset to default (14px)

---

### Dark / Light Theme

Click the **Theme** button in the toolbar to toggle between dark and light mode.

---

### HTML Export

Click **HTML** in the toolbar to export the current file as a self-contained `.html` file with GitHub-style CSS.

---

### Git Panel

Click the **Git** button in the toolbar to open the Git panel.

**Setup:**
- The Working directory field auto-fills from the open file's location
- If empty, type the path to your git repo manually

**Workflow:**
1. Edit your file
2. Open the Git panel
3. Enter a commit message
4. Check **git add -A** if you want to stage all changes (default: on)
5. Click **Commit** — the file is saved automatically before committing
6. Click **Push** to push to remote

**Pull:** Click **Pull** to fetch and merge the latest changes from remote.

---

### GitHub Browser

Requires `gh auth login` to be done first.

Click the **GH** button in the toolbar.

**Workflow:**
1. Your repos load automatically
2. Click a repo to browse its file tree
3. Navigate into folders by clicking them
4. Click any text file to open it for editing — it's cloned to a local temp folder
5. Edit the file in the editor
6. In the GitHub Browser panel, enter a commit message and click **Commit & Push**
   - The file is saved automatically before committing

---

### PR Panel

Requires `gh auth login` to be done first.

Click the **PR** button in the toolbar.

**Browse PRs:**
1. Enter a repo name (e.g. `owner/repo`) in the repo field
2. Toggle between Open / Closed / All PRs
3. Click a PR to open its detail view

**PR Detail:**
- Title, description, and all comments are rendered as markdown
- Reply to comments using the reply box at the bottom
- Review buttons: **Approve**, **Request Changes**, **Comment**
- Click **Open diff in editor** to load the unified diff as a new tab

**Create PR:**
1. Click the **Create PR** tab
2. Fill in title, base branch, and description
3. Click **Create** — creates a PR from your current branch

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
