import { invokeTauriOrNull } from './tauri-invoke'

/**
 * Registers only the directory containing a selected project.json or .artcade.
 * The Rust command validates the selected file before extending plugin-fs scope.
 */
export async function registerProjectFsScope(projectJsonPath: string | null): Promise<void> {
  if (!projectJsonPath) return
  await invokeTauriOrNull('register_project_fs_scope', { projectPath: projectJsonPath })
}
