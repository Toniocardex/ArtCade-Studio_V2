/** Forward-slash join for paths passed through Tauri APIs. */
export function joinPath(...parts: string[]): string {
  return parts.map((part) => part.replace(/[\\/]+$/, '')).join('/')
}

export function baseName(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx >= 0 ? filePath.slice(idx + 1) : filePath
}
