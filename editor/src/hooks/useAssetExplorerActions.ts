import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useEditor } from '../store/editor-store'
import { importImageIntoProject } from '../utils/api'
import {
  importAudioIntoProject,
  importFontIntoProject,
} from '../utils/asset-file-api'
import { dirName } from '../utils/project'
import { openProjectScript } from '../utils/open-project-script'
import {
  isSpritesheetStudioEnterTarget,
  openSpritesheetStudio,
} from '../panels/spritesheet-studio/openSpritesheetStudio'
import type { AudioAsset, FontAsset, ImageAsset } from '../types'
import { spriteAssignedFromAsset } from '../utils/sprite-pivot-resolve'
import {
  isBackspaceKey,
  isInsidePanel,
  keyboardFocusElement,
  shouldIgnoreEditorShortcut,
} from '../utils/keyboard'

export type AssetExplorerSelection =
  | { type: 'image'; id: string }
  | { type: 'audio'; id: string }
  | { type: 'font'; id: string }
  | { type: 'tileset'; id: string }

const ASSET_PANEL_SELECTOR = '[data-panel="project-explorer"], [data-panel="assets"]'

export function shouldOpenSpritesheetStudioOnExplorerEnter(
  e: Pick<KeyboardEvent, 'key' | 'target'>,
  selection: AssetExplorerSelection | null,
): selection is { type: 'image'; id: string } {
  return (
    e.key === 'Enter' &&
    selection?.type === 'image' &&
    isSpritesheetStudioEnterTarget(e.target)
  )
}

function fileReaderDataUrl(result: string | ArrayBuffer | null): string {
  return typeof result === 'string' ? result : ''
}

export function useAssetExplorerActions() {
  const { state, dispatch } = useEditor()
  const [selection, setSelection] = useState<AssetExplorerSelection | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const fontRef = useRef<HTMLInputElement>(null)

  const project = state.project
  const selEntity =
    project && state.selection.entityId != null
      ? project.entities[state.selection.entityId]
      : null

  const showFlash = useCallback((text: string) => {
    setFlash(text)
  }, [])

  const clearFlash = useCallback(() => {
    setFlash(null)
  }, [])

  const onPickImage = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !project) return
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = fileReaderDataUrl(reader.result)
        const buf = await file.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let relPath: string | null = null
        if (state.projectPath) {
          relPath = await importImageIntoProject(
            dirName(state.projectPath),
            file.name,
            bytes,
          )
        }
        const path = relPath ?? `assets/images/${file.name}`
        const asset: ImageAsset = {
          id: `img_${Date.now().toString(36)}`,
          name: file.name,
          path,
          dataUrl,
        }
        dispatch({ type: 'ASSET_ADD', asset })
        showFlash(relPath ? `Imported ${file.name}` : `${file.name} (save to persist)`)
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [project, state.projectPath, dispatch, showFlash],
  )

  const onPickAudio = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !project) return
      void (async () => {
        const bytes = new Uint8Array(await file.arrayBuffer())
        let relPath: string | null = null
        if (state.projectPath) {
          relPath = await importAudioIntoProject(dirName(state.projectPath), file.name, bytes)
        }
        const path = relPath ?? `assets/audio/${file.name}`
        const asset: AudioAsset = {
          id: `aud_${Date.now().toString(36)}`,
          name: file.name,
          path,
          category: 'sfx',
        }
        dispatch({ type: 'AUDIO_ASSET_ADD', asset })
        showFlash(relPath ? `Imported ${file.name}` : `${file.name} (save to persist)`)
      })()
      e.target.value = ''
    },
    [project, state.projectPath, dispatch, showFlash],
  )

  const onPickFont = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !project) return
      void (async () => {
        const bytes = new Uint8Array(await file.arrayBuffer())
        let relPath: string | null = null
        if (state.projectPath) {
          relPath = await importFontIntoProject(dirName(state.projectPath), file.name, bytes)
        }
        const path = relPath ?? `assets/fonts/${file.name}`
        const asset: FontAsset = {
          id: `font_${Date.now().toString(36)}`,
          name: file.name,
          path,
          defaultSize: 32,
        }
        dispatch({ type: 'FONT_ASSET_ADD', asset })
        showFlash(relPath ? `Imported ${file.name}` : `${file.name} (save to persist)`)
      })()
      e.target.value = ''
    },
    [project, state.projectPath, dispatch, showFlash],
  )

  const assignSprite = useCallback(
    (asset: ImageAsset) => {
      if (!selEntity) {
        showFlash('Select an entity first, then double-click an image')
        return
      }
      dispatch({
        type: 'ENTITY_SET_SPRITE',
        entityId: selEntity.id,
        sprite: spriteAssignedFromAsset(selEntity.sprite, asset, project),
      })
      showFlash(`Sprite "${asset.name}" → ${selEntity.name}`)
    },
    [selEntity, dispatch, showFlash],
  )

  const removeSelection = useCallback(() => {
    if (!project || !selection) return
    switch (selection.type) {
      case 'image':
        dispatch({ type: 'ASSET_REMOVE', assetId: selection.id })
        break
      case 'audio':
        dispatch({ type: 'AUDIO_ASSET_REMOVE', assetId: selection.id })
        break
      case 'font':
        dispatch({ type: 'FONT_ASSET_REMOVE', assetId: selection.id })
        break
      case 'tileset':
        dispatch({ type: 'TILESET_ASSET_REMOVE', assetId: selection.id })
        break
    }
    setSelection(null)
    showFlash('Asset removed')
  }, [project, selection, dispatch, showFlash])

  const openTilesetEditor = useCallback(
    (tilesetId: string) => {
      dispatch({ type: 'TILESET_EDIT_OPEN', tilesetId })
    },
    [dispatch],
  )

  const openScript = useCallback(
    (path: string) => {
      void openProjectScript(dispatch, {
        projectPath: state.projectPath,
        openScripts: state.openScripts,
      }, path)
    },
    [dispatch, state.projectPath, state.openScripts],
  )

  const triggerImportImage = useCallback(() => imageRef.current?.click(), [])
  const triggerImportAudio = useCallback(() => audioRef.current?.click(), [])
  const triggerImportFont = useCallback(() => fontRef.current?.click(), [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selection || !project) return
      const focus = keyboardFocusElement(e)
      const el = focus ?? (e.target instanceof HTMLElement ? e.target : null)
      const inPanel =
        (el && (isInsidePanel(el, 'project-explorer') || isInsidePanel(el, 'assets')))
        || (e.target instanceof HTMLElement && Boolean(e.target.closest(ASSET_PANEL_SELECTOR)))
      if (!inPanel) return
      if (shouldIgnoreEditorShortcut(e)) return

      if (shouldOpenSpritesheetStudioOnExplorerEnter(e, selection)) {
        e.preventDefault()
        openSpritesheetStudio(dispatch, project, selection.id)
        return
      }

      if (e.key !== 'Delete' && !isBackspaceKey(e)) return
      e.preventDefault()
      removeSelection()
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [selection, project, removeSelection, dispatch])

  return {
    project,
    selection,
    setSelection,
    flash,
    clearFlash,
    imageRef,
    audioRef,
    fontRef,
    onPickImage,
    onPickAudio,
    onPickFont,
    assignSprite,
    removeSelection,
    openTilesetEditor,
    triggerImportImage,
    triggerImportAudio,
    triggerImportFont,
    openScript,
    canRemove: Boolean(selection && project),
  }
}
