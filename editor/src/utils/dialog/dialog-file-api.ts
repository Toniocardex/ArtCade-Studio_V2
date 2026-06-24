/**
 * Load / save dialogs/{dialogId}.json beside project.json (Tauri).
 */

import { isTauri } from '@tauri-apps/api/core'
import { exists, readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { joinPath } from '../file-paths'
import { invokeDeleteProjectFile, invokeWriteFile } from '../project-file-api'
import { projectRootFromProjectPath } from '../project-paths'
import {
  compileDialogScript,
  emptyDialogScript,
  parseDialogGraph,
  type DialogScript,
} from './dialog-script'
import type { DialogGraphJson } from './import-dialog-csv'
import { dialogGraphToJson } from './import-dialog-csv'

function notAvailable(name: string): void {
  console.warn(`[dialog-file-api] ${name}: Tauri not available in browser mode`)
}

export function starterInnkeeperScript(): DialogScript {
  return {
    dialogId: 'innkeeper',
    commands: [
      { type: 'showText', character: 'Innkeeper', text: 'Welcome, traveler!' },
      { type: 'showText', character: 'Innkeeper', text: 'What do you need?' },
      {
        type: 'showChoices',
        options: [
          {
            text: 'A room',
            commands: [
              {
                type: 'setVariable',
                variable: 'quest.met_innkeeper',
                operation: '=',
                value: 1,
              },
              { type: 'emitMessage', event: 'QuestAccepted' },
              { type: 'end' },
            ],
          },
          {
            text: 'No thanks',
            commands: [
              {
                type: 'showText',
                character: 'Innkeeper',
                text: 'Come back anytime.',
              },
              { type: 'end' },
            ],
          },
        ],
      },
    ],
  }
}

export async function loadDialogsFromProject(
  projectJsonPath: string,
): Promise<Record<string, DialogScript>> {
  if (!isTauri() || !projectJsonPath) {
    notAvailable('loadDialogsFromProject')
    return {}
  }

  const root = projectRootFromProjectPath(projectJsonPath)
  const dir = joinPath(root, 'dialogs')
  if (!(await exists(dir))) return {}

  const out: Record<string, DialogScript> = {}
  try {
    const entries = await readDir(dir)
    for (const entry of entries) {
      const name = entry.name ?? ''
      if (!name.endsWith('.json')) continue
      const path = joinPath(dir, name)
      const content = await readTextFile(path)
      const graph = JSON.parse(content) as DialogGraphJson
      const { script, parseWarning } = parseDialogGraph(graph)
      out[script.dialogId] = parseWarning ? { ...script, parseWarning } : script
    }
  } catch (err) {
    console.error('[dialog-file-api] loadDialogsFromProject failed:', err)
  }
  return out
}

export async function saveDialogsToProject(
  projectJsonPath: string,
  dialogs: Record<string, DialogScript>,
): Promise<void> {
  if (!isTauri() || !projectJsonPath) {
    notAvailable('saveDialogsToProject')
    return
  }

  const root = projectRootFromProjectPath(projectJsonPath)
  const dir = joinPath(root, 'dialogs')
  if (await exists(dir)) {
    const expected = new Set(
      Object.values(dialogs).map((script) => `${script.dialogId}.json`),
    )
    for (const entry of await readDir(dir)) {
      const name = entry.name ?? ''
      if (!entry.isFile || !name.endsWith('.json') || expected.has(name)) continue
      await invokeDeleteProjectFile(joinPath(dir, name), root)
    }
  }

  for (const script of Object.values(dialogs)) {
    const graph = compileDialogScript(script)
    const path = joinPath(root, 'dialogs', `${script.dialogId}.json`)
    await invokeWriteFile(path, dialogGraphToJson(graph), root)
  }
}

export async function scaffoldStarterDialogs(projectJsonPath: string): Promise<void> {
  if (!isTauri() || !projectJsonPath) return
  const root = projectRootFromProjectPath(projectJsonPath)
  const graph = compileDialogScript(starterInnkeeperScript())
  const path = joinPath(root, 'dialogs', 'innkeeper.json')
  await invokeWriteFile(path, dialogGraphToJson(graph), root)
}

export function ensureDialogInLibrary(
  dialogs: Record<string, DialogScript>,
  dialogId: string,
): Record<string, DialogScript> {
  if (!dialogId.trim()) return dialogs
  if (dialogs[dialogId]) return dialogs
  return { ...dialogs, [dialogId]: emptyDialogScript(dialogId) }
}
