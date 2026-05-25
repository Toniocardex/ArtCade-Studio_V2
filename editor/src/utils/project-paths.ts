/** Extract directory from an absolute file path (works for / and \ separators). */
export function dirName(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx >= 0 ? filePath.slice(0, idx) : filePath
}

/** Project root directory containing project.json. */
export function projectRootFromProjectPath(projectJsonPath: string): string {
  return dirName(projectJsonPath)
}

/** Final path segment of the on-disk project folder (e.g. Untitled, MyGame). */
export function projectFolderBaseName(projectJsonPath: string): string {
  const root = projectRootFromProjectPath(projectJsonPath)
  const idx = Math.max(root.lastIndexOf('/'), root.lastIndexOf('\\'))
  return idx >= 0 ? root.slice(idx + 1) : root
}

/** Filesystem-safe project/export folder name shared by Save As and builds. */
export function safeProjectFolderName(name: string, fallback = 'Untitled'): string {
  const safe = Array.from(name)
    .map((ch) => /[A-Za-z0-9 _-]/.test(ch) ? ch : '_')
    .join('')
    .trim()
  return safe || fallback
}
