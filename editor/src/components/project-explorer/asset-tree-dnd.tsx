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



/** Folder row marker for delegated asset-tree drag-and-drop. */

export const ASSET_FOLDER_ID_ATTR = 'data-asset-folder-id'



export type AssetDropZone =

  | Readonly<{ kind: 'virtual-folder'; folderId: string }>

  | Readonly<{ kind: 'library-category'; category: AssetVirtualFolderCategory }>



/** Virtual folder id placed on the folder header button. */

export function virtualAssetFolderId(folderId: string): string {

  return folderId

}



/** Library category row id (unassign drop target). */

export function libraryCategoryFolderId(category: AssetVirtualFolderCategory): string {

  return `lib:${category}`

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

}: AssetTreeDnDRootProps) {
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)



  const contextValue = useMemo(() => ({ hoveredFolderId }), [hoveredFolderId])



  const handleDragOverCapture = useCallback((event: DragEvent<HTMLDivElement>) => {

    const folderId = resolveFolderIdFromTarget(event.target)

    if (!folderId || !containsAssetPayload(event.dataTransfer)) return

    event.preventDefault()

    event.dataTransfer.dropEffect = 'move'

    setHoveredFolderId((prev) => (prev === folderId ? prev : folderId))

  }, [])



  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return

    setHoveredFolderId(null)

  }, [])



  const handleDropCapture = useCallback((event: DragEvent<HTMLDivElement>) => {

    const folderId = resolveFolderIdFromTarget(event.target)

    if (!folderId || !containsAssetPayload(event.dataTransfer)) return

    event.preventDefault()

  }, [])



  const handleDrop = useCallback(

    (event: DragEvent<HTMLDivElement>) => {

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



      onUnassignRefs(payload.refs, zone.category, { source: 'drag-and-drop' })

    },

    [onMoveRefsToFolder, onUnassignRefs],

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


