import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useEditorDispatch, useEditorSelector, useEditorStore } from '../store/editor-store'
import { importAssetFile } from '../utils/asset-file-api'
import { dirName } from '../utils/project'
import { openProjectScript } from '../utils/open-project-script'
import {
  isSpritesheetStudioEnterTarget,
  openSpritesheetStudio,
} from '../panels/spritesheet-studio/openSpritesheetStudio'
import type { AudioAsset, FontAsset, ImageAsset } from '../types'
import type { ImageAssetUsage } from '../types'
import { spriteAssignedFromAsset } from '../utils/sprite-pivot-resolve'
import { assetOrchestrator, releaseTilesetAsset } from '../utils/asset-orchestrator'
import { buildTilesetFromImageFile } from '../utils/tileset-import'
import {
  isBackspaceKey,
  isInsidePanel,
  keyboardFocusElement,
  shouldIgnoreEditorShortcut,
} from '../utils/keyboard'

import type { InspectorAssetSelection } from '../types/inspector-selection'

export type AssetExplorerSelection = InspectorAssetSelection

const ASSET_PANEL_SELECTOR = '[data-panel="project-explorer"], [data-panel="assets"]'

export type ImageImportTarget = Readonly<{
  usage: ImageAssetUsage
  folderId?: string
  openStudioAfterImport?: boolean
}>

export type AssetImportFolderTarget = Readonly<{
  folderId?: string
}>

type FolderImportAssetType = 'audio' | 'font' | 'tileset'

export function moveImportedAssetToFolderAction(
  target: AssetImportFolderTarget,
  assetType: FolderImportAssetType,
  assetId: string,
) {
  if (!target.folderId) return null
  return {
    type: 'ASSET_MOVE_TO_FOLDER' as const,
    folderId: target.folderId,
    assetType,
    assetId,
  }
}

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
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const selection = useEditorSelector((s) => s.inspectorAsset)
  const project = useEditorSelector((s) => s.project)
  const selectionEntityId = useEditorSelector((s) => s.selection.entityId)
  const setSelection = useCallback(
    (next: AssetExplorerSelection | null) => {
      dispatch({ type: 'SELECT_INSPECTOR_ASSET', asset: next })
    },
    [dispatch],
  )
  const [flash, setFlash] = useState<string | null>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const imageImportTargetRef = useRef<ImageImportTarget>({ usage: 'sprite' })
  const audioRef = useRef<HTMLInputElement>(null)
  const audioImportTargetRef = useRef<AssetImportFolderTarget>({})
  const fontRef = useRef<HTMLInputElement>(null)
  const fontImportTargetRef = useRef<AssetImportFolderTarget>({})
  const tilesetRef = useRef<HTMLInputElement>(null)
  const tilesetImportTargetRef = useRef<AssetImportFolderTarget>({})

  const selEntity =
    project && selectionEntityId != null
      ? project.entities[selectionEntityId]
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
      const target = imageImportTargetRef.current
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const dataUrl = fileReaderDataUrl(reader.result)
          const bytes = new Uint8Array(await file.arrayBuffer())
          const projectPath = store.getState().projectPath
          const imported = await importAssetFile({
            kind: 'image',
            fileName: file.name,
            bytes,
            projectRoot: projectPath ? dirName(projectPath) : null,
          })
          const asset: ImageAsset = {
            id: imported.id,
            name: file.name,
            path: imported.path,
            usage: target.usage,
            dataUrl,
          }
          dispatch({ type: 'ASSET_ADD', asset })
          if (target.folderId) {
            dispatch({
              type: 'ASSET_MOVE_TO_FOLDER',
              folderId: target.folderId,
              assetType: 'image',
              assetId: asset.id,
            })
          }
          dispatch({ type: 'SELECT_INSPECTOR_ASSET', asset: { type: 'image', id: asset.id } })
          if (target.openStudioAfterImport) {
            dispatch({ type: 'SPRITESHEET_STUDIO_OPEN', imageAssetId: asset.id })
          }
          showFlash(imported.persisted
            ? target.openStudioAfterImport
              ? `Imported ${file.name} in Sprite Studio`
              : `Imported ${file.name}`
            : target.openStudioAfterImport
              ? `${file.name} in Sprite Studio (save to persist)`
              : `${file.name} (save to persist)`)
        } catch (err) {
          console.error('[Asset] Image import failed:', err)
          showFlash(`Import failed: ${file.name}`)
        }
      }
      reader.readAsDataURL(file)
      e.target.value = ''
      imageImportTargetRef.current = { usage: 'sprite' }
    },
    [project, store, dispatch, showFlash],
  )

  const onPickAudio = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !project) return
      const target = audioImportTargetRef.current
      void (async () => {
        try {
          const projectPath = store.getState().projectPath
          const imported = await importAssetFile({
            kind: 'audio',
            fileName: file.name,
            bytes: new Uint8Array(await file.arrayBuffer()),
            projectRoot: projectPath ? dirName(projectPath) : null,
          })
          const asset: AudioAsset = {
            id: imported.id,
            name: file.name,
            path: imported.path,
            category: 'sfx',
          }
          dispatch({ type: 'AUDIO_ASSET_ADD', asset })
          const moveAction = moveImportedAssetToFolderAction(target, 'audio', asset.id)
          if (moveAction) dispatch(moveAction)
          showFlash(imported.persisted
            ? `Imported ${file.name}`
            : `${file.name} (save to persist)`)
        } catch (err) {
          console.error('[Asset] Audio import failed:', err)
          showFlash(`Import failed: ${file.name}`)
        }
      })()
      e.target.value = ''
      audioImportTargetRef.current = {}
    },
    [project, store, dispatch, showFlash],
  )

  const onPickFont = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !project) return
      const target = fontImportTargetRef.current
      void (async () => {
        try {
          const projectPath = store.getState().projectPath
          const imported = await importAssetFile({
            kind: 'font',
            fileName: file.name,
            bytes: new Uint8Array(await file.arrayBuffer()),
            projectRoot: projectPath ? dirName(projectPath) : null,
          })
          const asset: FontAsset = {
            id: imported.id,
            name: file.name,
            path: imported.path,
            defaultSize: 32,
          }
          dispatch({ type: 'FONT_ASSET_ADD', asset })
          const moveAction = moveImportedAssetToFolderAction(target, 'font', asset.id)
          if (moveAction) dispatch(moveAction)
          showFlash(imported.persisted
            ? `Imported ${file.name}`
            : `${file.name} (save to persist)`)
        } catch (err) {
          console.error('[Asset] Font import failed:', err)
          showFlash(`Import failed: ${file.name}`)
        }
      })()
      e.target.value = ''
      fontImportTargetRef.current = {}
    },
    [project, store, dispatch, showFlash],
  )

  const assignSprite = useCallback(
    (asset: ImageAsset) => {
      if (asset.usage !== 'sprite') {
        showFlash('Only sprite images can be assigned to objects')
        return
      }
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
      case 'tileset': {
        const tileset = project.tilesets?.[selection.id]
        if (tileset) releaseTilesetAsset(tileset)
        dispatch({ type: 'TILESET_ASSET_REMOVE', assetId: selection.id })
        break
      }
    }
    dispatch({ type: 'SELECT_INSPECTOR_ASSET', asset: null })
    showFlash('Asset removed')
  }, [project, selection, dispatch, showFlash])

  const openTilesetEditor = useCallback(
    (tilesetId: string) => {
      setSelection({ type: 'tileset', id: tilesetId })
      dispatch({ type: 'TILESET_PAINT_BEGIN', tilesetId })
    },
    [dispatch, setSelection],
  )

  const openImageStudio = useCallback(
    (imageId: string) => {
      if (!project) return
      const asset = project.assets?.[imageId]
      if (asset?.usage !== 'sprite') {
        setSelection({ type: 'image', id: imageId })
        showFlash('Sprite Studio is available for sprite images')
        return
      }
      setSelection({ type: 'image', id: imageId })
      openSpritesheetStudio(dispatch, project, imageId)
    },
    [dispatch, project, setSelection, showFlash],
  )

  const openScript = useCallback(
    (path: string) => {
      const { projectPath, openScripts } = store.getState()
      void openProjectScript(dispatch, {
        projectPath,
        openScripts,
      }, path)
    },
    [dispatch, store],
  )

  const onPickTileset = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !project) return
      const target = tilesetImportTargetRef.current
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = fileReaderDataUrl(reader.result)
        if (!dataUrl) return
        const img = new Image()
        img.onload = async () => {
          try {
            const bytes = new Uint8Array(await file.arrayBuffer())
            const projectPath = store.getState().projectPath
            const root = projectPath ? dirName(projectPath) : null
            const { tileset, imported } = await buildTilesetFromImageFile({
              file,
              bytes,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              previewDataUrl: dataUrl,
              projectRoot: root,
            })
            dispatch({ type: 'TILESET_ASSET_ADD', asset: tileset })
            const moveAction = moveImportedAssetToFolderAction(
              target,
              'tileset',
              tileset.assetId,
            )
            if (moveAction) dispatch(moveAction)
            dispatch({ type: 'TILESET_PAINT_BEGIN', tilesetId: tileset.assetId })
            await assetOrchestrator.ensureTilesetImageRegistered(project, tileset, root ?? '')
            showFlash(imported.persisted
              ? `Tileset "${tileset.name}" imported`
              : `${file.name} (save to persist)`)
          } catch (err) {
            console.error('[Asset] Tileset import failed:', err)
            showFlash(`Import failed: ${file.name}`)
          }
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
      e.target.value = ''
      tilesetImportTargetRef.current = {}
    },
    [project, store, dispatch, showFlash],
  )

  const triggerImportImage = useCallback((target?: ImageImportTarget) => {
    imageImportTargetRef.current = target ?? { usage: 'sprite' }
    imageRef.current?.click()
  }, [])
  const triggerCreateAnimatedSprite = useCallback(() => {
    imageImportTargetRef.current = { usage: 'sprite', openStudioAfterImport: true }
    imageRef.current?.click()
  }, [])
  const triggerImportAudio = useCallback((target?: AssetImportFolderTarget) => {
    audioImportTargetRef.current = target ?? {}
    audioRef.current?.click()
  }, [])
  const triggerImportFont = useCallback((target?: AssetImportFolderTarget) => {
    fontImportTargetRef.current = target ?? {}
    fontRef.current?.click()
  }, [])
  const triggerImportTileset = useCallback((target?: AssetImportFolderTarget) => {
    tilesetImportTargetRef.current = target ?? {}
    tilesetRef.current?.click()
  }, [])

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
        openImageStudio(selection.id)
        return
      }

      if (e.key !== 'Delete' && !isBackspaceKey(e)) return
      e.preventDefault()
      removeSelection()
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [selection, project, removeSelection, dispatch, openImageStudio])

  return {
    project,
    selection,
    setSelection,
    flash,
    clearFlash,
    imageRef,
    audioRef,
    fontRef,
    tilesetRef,
    onPickImage,
    onPickAudio,
    onPickFont,
    onPickTileset,
    assignSprite,
    removeSelection,
    openTilesetEditor,
    openImageStudio,
    triggerImportImage,
    triggerCreateAnimatedSprite,
    triggerImportAudio,
    triggerImportFont,
    triggerImportTileset,
    openScript,
    canRemove: Boolean(selection && project),
  }
}
