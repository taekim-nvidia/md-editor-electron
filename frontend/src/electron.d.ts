interface ElectronFileEntry {
  name: string
  isDir: boolean
  path: string
}

interface ElectronAPI {
  runGit: (args: string[], cwd: string) => Promise<{ ok: boolean; stdout: string; stderr: string }>
  runGh: (args: string[]) => Promise<{ ok: boolean; stdout: string; stderr: string }>
  ghClone: (nameWithOwner: string) => Promise<{
    ok: boolean
    path?: string
    action?: string
    output?: string
    error?: string
  }>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  readDir: (path: string) => Promise<ElectronFileEntry[]>
  showOpenDialog: () => Promise<string | null>
  showSaveDialog: (defaultPath: string) => Promise<string | null>
  fetchUrl: (url: string) => Promise<{
    ok: boolean
    content?: string
    url?: string
    error?: string
  }>
}

declare interface Window {
  electronAPI?: ElectronAPI
}
