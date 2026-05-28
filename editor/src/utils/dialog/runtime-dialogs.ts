import { compileDialogScript, type DialogScript } from './dialog-script'

/** JSON array of runtime graph objects for `editor_load_dialogs`. */
export function dialogsJsonForRuntime(
  dialogs: Record<string, DialogScript>,
): string {
  const graphs = Object.values(dialogs).map((script) => compileDialogScript(script))
  return JSON.stringify(graphs)
}
