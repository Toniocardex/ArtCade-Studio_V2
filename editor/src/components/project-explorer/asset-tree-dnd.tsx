import {

  createContext,

  useCallback,

  useContext,

  useMemo,

  useState,

  type DragEvent,

  type ReactNode,

} from 'react'

import {

  ARTCADE_ASSET_DND_MIME,

  readAssetDragPayload,

  type AssetDragRef,

  type AssetMoveSource,

} from '../../utils/asset-explorer-dnd'

import type { AssetVirtualFolderCategory } from '../../utils/asset-virtual-folders'
import type { ImageAssetUsage } from '../../types'



/** Folder row marker for delegated asset-tree drag-and-drop. */

export const ASSET_FOLDER_ID_ATTR = 'data-asset-folder-id'



export type AssetDropZone =

  | Readonly<{ kind: 'virtual-folder'; folderId: string }>

  | Readonly<{ kind: 'library-category'; category: AssetVirtualFolderCategory }>

  | Readonly<{ kind: 'image-usage'; usage: ImageAssetUsage }>



/** Virtual folder id placed on the folder header button. */

export function virtualAssetFolderId(folderId: string): string {

  return folderId

}



/** Library category row id (unassign drop target). */

export function libraryCategoryFolderId(category: AssetVirtualFolderCategory): string {

  return `lib:${category}`

}

export function imageUsageFolderId(usage: ImageAssetUsage): string {

  return `img-usage:${usage}`

}



/**

 * Deepest folder row under the pointer (`closest` on the header button).

 * Virtual folders nested under a library category win over the parent row.

 */

export function resolveFolderIdFromTarget(target: EventTarget | null): string | null {

  if (!(target instanceof HTMLElement)) return null

  const element = target.closest<HTMLElement>(`[${ASSET_FOLDER_ID_ATTR}]`)

  const folderId = element?.dataset.assetFolderId

  return folderId && folderId.length > 0 ? folderId : null

}



export function parseFolderDropTarget(folderId: string): AssetDropZone | null {

  if (folderId.startsWith('img-usage:')) {

    const usage = folderId.slice('img-usage:'.length) as ImageAssetUsage

    if (usage === 'sprite' || usage === 'background' || usage === 'parallax' || usage === 'ui') {

      return { kind: 'image-usage', usage }

    }

    return null

  }

  if (folderId.startsWith('lib:')) {

    const category = folderId.slice(4) as AssetVirtualFolderCategory

    if (

      category === 'images'

      || category === 'audio'

      || category === 'fonts'

      || category === 'tilesets'

    ) {

      return { kind: 'library-category', category }

    }

    return null

  }

  return { kind: 'virtual-folder', folderId }

}



/** During dragover only inspect MIME types — never call getData before drop. */

export function containsAssetPayload(dataTransfer: DataTransfer): boolean {

  const types = Array.from(dataTransfer.types)

  return types.includes(ARTCADE_ASSET_DND_MIME) || types.includes('text/plain')

}



type AssetTreeDnDContextValue = Readonly<{

  hoveredFolderId: string | null

}>



const AssetTreeDnDContext = createContext<AssetTreeDnDContextValue>({

  hoveredFolderId: null,

})



/** Whether a folder header should show drop highlight during an active drag. */

export function useAssetTreeDropHighlight(assetFolderId: string | undefined): boolean {

  const { hoveredFolderId } = useContext(AssetTreeDnDContext)

  return assetFolderId != null && hoveredFolderId === assetFolderId

}



type AssetTreeDnDRootProps = Readonly<{

  children: ReactNode

  onMoveRefsToFolder: (

    folderId: string,

    refs: readonly AssetDragRef[],

    options: { source: AssetMoveSource },

  ) => void

  onUnassignRefs: (

    refs: readonly AssetDragRef[],

    category: AssetVirtualFolderCategory,

    options: { source: AssetMoveSource },

  ) => void

  onMoveRefsToImageUsage: (

    usage: ImageAssetUsage,

    refs: readonly AssetDragRef[],

    options: { source: AssetMoveSource },

  ) => void

  /** OS file drop onto a folder row (or empty space → null zone). */

  onDropFiles?: (zone: AssetDropZone | null, files: readonly File[]) => void

}>



/**

 * Event-delegation root for asset explorer drag-and-drop.

 * Capture: enable drop on WebView2 buttons (preventDefault only).

 * Bubble: parse payload and dispatch move/unassign once.

 */

export function AssetTreeDnDRoot({

  children,

  onMoveRefsToFolder,

  onUnassignRefs,

  onMoveRefsToImageUsage,

  onDropFiles,

}: AssetTreeDnDRootProps) {
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)



  const contextValue = useMemo(() => ({ hoveredFolderId }), [hoveredFolderId])



  const handleDragOverCapture = useCallback((event: DragEvent<HTMLDivElement>) => {

    const folderId = resolveFolderIdFromTarget(event.target)

    if (onDropFiles && event.dataTransfer.types.includes('Files')) {

      event.preventDefault()

      event.dataTransfer.dropEffect = 'copy'

      setHoveredFolderId((prev) => (prev === folderId ? prev : folderId))

      return

    }

    if (!folderId || !containsAssetPayload(event.dataTransfer)) return

    event.preventDefault()

    event.dataTransfer.dropEffect = 'move'

    setHoveredFolderId((prev) => (prev === folderId ? prev : folderId))

  }, [onDropFiles])



  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return

    setHoveredFolderId(null)

  }, [])



  const handleDropCapture = useCallback((event: DragEvent<HTMLDivElement>) => {

    if (onDropFiles && event.dataTransfer.types.includes('Files')) {

      event.preventDefault()

      return

    }

    const folderId = resolveFolderIdFromTarget(event.target)

    if (!folderId || !containsAssetPayload(event.dataTransfer)) return

    event.preventDefault()

  }, [onDropFiles])



  const handleDrop = useCallback(

    (event: DragEvent<HTMLDivElement>) => {

      if (onDropFiles && event.dataTransfer.files && event.dataTransfer.files.length > 0) {

        event.preventDefault()

        setHoveredFolderId(null)

        const droppedFolderId = resolveFolderIdFromTarget(event.target)

        const droppedZone = droppedFolderId ? parseFolderDropTarget(droppedFolderId) : null

        onDropFiles(droppedZone, Array.from(event.dataTransfer.files))

        return

      }



      const folderId = resolveFolderIdFromTarget(event.target)

      if (!folderId) return



      event.preventDefault()

      setHoveredFolderId(null)



      const zone = parseFolderDropTarget(folderId)

      const payload = readAssetDragPayload(event.dataTransfer)

      if (!zone || !payload) return



      if (zone.kind === 'virtual-folder') {

        onMoveRefsToFolder(zone.folderId, payload.refs, { source: 'drag-and-drop' })

        return

      }

      if (zone.kind === 'image-usage') {

        onMoveRefsToImageUsage(zone.usage, payload.refs, { source: 'drag-and-drop' })

        return

      }



      onUnassignRefs(payload.refs, zone.category, { source: 'drag-and-drop' })

    },

    [onMoveRefsToFolder, onMoveRefsToImageUsage, onUnassignRefs, onDropFiles],

  )



  return (

    <AssetTreeDnDContext.Provider value={contextValue}>

      <div

        className="asset-tree-dnd-root"

        onDragOverCapture={handleDragOverCapture}

        onDragLeave={handleDragLeave}

        onDropCapture={handleDropCapture}

        onDrop={handleDrop}

      >

        {children}

      </div>

    </AssetTreeDnDContext.Provider>

  )

}


