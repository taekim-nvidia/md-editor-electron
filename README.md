# md-editor-web

A full-featured web-based Markdown editor built with React + Vite + TypeScript.

## Features

- **Split pane** — editor left, live preview right (resizable divider)
- **Multi-tab** — open multiple files with close buttons
- **Toolbar** — New, Open, Save, Bold, Italic, Code, H1, H2, Code Block, HTML Export, Load URL, Find/Replace toggle
- **CodeMirror 6** — syntax-highlighted Markdown editor
- **marked + highlight.js** — rich Markdown preview with code highlighting
- **Find & Replace** panel with Ctrl+F toggle
- **Scroll sync** between editor and preview
- **Dark / light theme** toggle
- **Font size** controls
- **GitHub URL loader** — paste a github.com URL, fetches raw content
- **Status bar** — filename, word count, line count, modified indicator
- **Git panel** — status, pull, push, commit via local backend
- **GitHub browser** — browse repos via `gh` CLI, clone, open files, commit+push
- **Keyboard shortcuts**: Ctrl+S save, Ctrl+Z undo, Ctrl+F find, Ctrl+B bold, Ctrl+I italic

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + TypeScript |
| Editor | CodeMirror 6 (markdown mode) |
| Preview | marked + highlight.js |
| Styling | Tailwind CSS |
| Backend | Express.js (Node/TypeScript) |

## Getting Started

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3001

## Requirements

- Node 18+
- `git` in PATH (for Git panel)
- `gh` CLI in PATH (for GitHub browser panel)

## Project Structure

```
md-editor-web/
├── frontend/          # React + Vite app
│   └── src/
│       ├── components/
│       ├── hooks/
│       └── types/
├── backend/           # Express.js server
│   └── src/
└── package.json       # Workspace root
```
