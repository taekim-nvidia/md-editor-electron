export interface Tab {
  id: string
  filename: string
  content: string
  originalContent: string
  filePath?: string // absolute path on disk (if opened/saved)
  isNew: boolean
}

export type Theme = 'dark' | 'light'

export interface GitStatus {
  branch: string
  status: string
  log: string
}

export interface GhRepo {
  nameWithOwner: string
  description: string
  isPrivate: boolean
  updatedAt: string
}

export interface FileEntry {
  name: string
  isDir: boolean
  path: string
}

export interface EditorHandle {
  getView: () => import('@codemirror/view').EditorView | null
  focus: () => void
}
