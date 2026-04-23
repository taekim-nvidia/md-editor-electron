import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  runGit: (args: string[], cwd: string) =>
    ipcRenderer.invoke('git:run', args, cwd),

  runGh: (args: string[]) =>
    ipcRenderer.invoke('gh:run', args),

  ghClone: (nameWithOwner: string) =>
    ipcRenderer.invoke('gh:clone', nameWithOwner),

  readFile: (filePath: string) =>
    ipcRenderer.invoke('file:read', filePath),

  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('file:write', filePath, content),

  readDir: (dirPath: string) =>
    ipcRenderer.invoke('fs:readdir', dirPath),

  showOpenDialog: () =>
    ipcRenderer.invoke('dialog:open'),

  showSaveDialog: (defaultPath: string) =>
    ipcRenderer.invoke('dialog:save', defaultPath),

  fetchUrl: (url: string) =>
    ipcRenderer.invoke('fetch:url', url),
})
