import { dirName } from './project-paths'
import { invokeTauriOrNull } from './tauri-invoke'

/**
 * Registers the opened project folder with Tauri plugin-fs.
 * Required for projects outside Documents/Desktop/Downloads after $HOME scope removal.
 */
export async function registerProjectFsScope(projectJsonPath: string | null): Promise<void> {
  if (!projectJsonPath) return
  const projectRoot = dirName(projectJsonPath)
  if (!projectRoot) return
  await invokeTauriOrNull('register_project_fs_scope', { projectRoot })
}
