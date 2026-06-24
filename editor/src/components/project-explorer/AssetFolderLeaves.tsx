import type { Dispatch, SetStateAction } from 'react'
import { FileText, Music, Pencil, Trash2, Type } from 'lucide-react'
import type { ProjectDoc } from '../../types'
import type { useEditorDispatch } from '../../store/editor-store'
import type { buildProjectExplorerData } from '../../utils/project-explorer-tree'
import type { useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import type { useAssetTreeMultiSelect } from '../../hooks/useAssetTreeMultiSelect'
import { buildAssetFolderMenuItems } from './asset-folder-context-menus'
import { explorerAssetDragProps } from './explorer-asset-drag'
import { assetHiddenByVirtualFolder } from './VirtualFoldersBlock'
import { TreeLeaf } from './TreeNode'
import { ExplorerRowAction } from './explorer-cta'
import { TilesetTreeThumbnail } from '../asset-explorer/TilesetTreeThumbnail'
import {
  openExplorerContextMenu,
  type ExplorerContextMenuState,
} from './explorer-context-menu'
import type { useAssetFolderMenus } from './useAssetFolderMenus'

type AssetFolder = ReturnType<typeof buildProjectExplorerData>['assetFolders'][number]

export type AssetFolderLeavesProps = Readonly<{
  folder: AssetFolder
  project: ProjectDoc
  projectPath: string | null
  assets: ReturnType<typeof useAssetExplorerActions>
  assetMulti: ReturnType<typeof useAssetTreeMultiSelect>
  dispatch: ReturnType<typeof useEditorDispatch>
  setContextMenu: Dispatch<SetStateAction<ExplorerContextMenuState | null>>
  makeAssetFolderMenuHandlers: ReturnType<typeof useAssetFolderMenus>['makeAssetFolderMenuHandlers']
}>

/**
 * Audio / font / script / tileset leaf rows for an asset folder (images are
 * handled by AssetImageTree). Extracted from AssetsTreeSection.
 */
export function AssetFolderLeaves({
  folder,
  project,
  projectPath,
  assets,
  assetMulti,
  setContextMenu,
  makeAssetFolderMenuHandlers,
}: AssetFolderLeavesProps) {
  return (
    <>
      {folder.audio
        .filter(
          (a) => !assetHiddenByVirtualFolder(project, 'audio', 'audio', a.id),
        )
        .map((a) => (
        <TreeLeaf
          key={a.id}
          label={a.name}
          depth={2}
          selected={assetMulti.isSelected('audio', a.id)}
          {...explorerAssetDragProps(
            assetMulti.dragRefsFor('audio', 'audio', a.id),
          )}
          onClick={(e) =>
            assetMulti.handleAssetClick(e, 'audio', 'audio', a.id, () =>
              assets.setSelection({ type: 'audio', id: a.id }),
            )
          }
          onContextMenu={(ev) =>
            openExplorerContextMenu(
              ev,
              buildAssetFolderMenuItems(
                project,
                'audio',
                'audio',
                a.id,
                makeAssetFolderMenuHandlers('audio', 'audio', a.id),
                [
                  {
                    id: 'remove',
                    label: 'Remove audio',
                    danger: true,
                    onSelect: () => void assets.removeAsset({ type: 'audio', id: a.id }),
                  },
                ],
                assetMulti.batchRefsInCategory('audio'),
              ),
              setContextMenu,
            )
          }
          icon={<Music size={11} className="flex-shrink-0 text-[var(--muted)]" />}
          title={a.path}
          actions={
            <ExplorerRowAction
              title="Remove audio"
              tone={assetMulti.isSelected('audio', a.id) ? 'onSelected' : 'danger'}
              onClick={(ev) => {
                ev.stopPropagation()
                void assets.removeAsset({ type: 'audio', id: a.id })
              }}
            >
              <Trash2 size={12} />
            </ExplorerRowAction>
          }
        />
      ))}
      {folder.fonts
        .filter(
          (f) => !assetHiddenByVirtualFolder(project, 'fonts', 'font', f.id),
        )
        .map((f) => (
        <TreeLeaf
          key={f.id}
          label={f.name}
          depth={2}
          selected={assetMulti.isSelected('font', f.id)}
          {...explorerAssetDragProps(
            assetMulti.dragRefsFor('fonts', 'font', f.id),
          )}
          onClick={(e) =>
            assetMulti.handleAssetClick(e, 'fonts', 'font', f.id, () =>
              assets.setSelection({ type: 'font', id: f.id }),
            )
          }
          onContextMenu={(ev) =>
            openExplorerContextMenu(
              ev,
              buildAssetFolderMenuItems(
                project,
                'fonts',
                'font',
                f.id,
                makeAssetFolderMenuHandlers('fonts', 'font', f.id),
                [
                  {
                    id: 'remove',
                    label: 'Remove font',
                    danger: true,
                    onSelect: () => void assets.removeAsset({ type: 'font', id: f.id }),
                  },
                ],
                assetMulti.batchRefsInCategory('fonts'),
              ),
              setContextMenu,
            )
          }
          icon={<Type size={11} className="flex-shrink-0 text-[var(--warn)]" />}
          title={f.path}
          actions={
            <ExplorerRowAction
              title="Remove font"
              tone={assetMulti.isSelected('font', f.id) ? 'onSelected' : 'danger'}
              onClick={(ev) => {
                ev.stopPropagation()
                void assets.removeAsset({ type: 'font', id: f.id })
              }}
            >
              <Trash2 size={12} />
            </ExplorerRowAction>
          }
        />
      ))}
      {folder.scripts.map((s) => (
        <TreeLeaf
          key={s.path}
          label={s.label}
          depth={2}
          onClick={() => assets.openScript(s.path)}
          onContextMenu={(ev) =>
            openExplorerContextMenu(
              ev,
              [
                {
                  id: 'open',
                  label: 'Open in script editor',
                  onSelect: () => assets.openScript(s.path),
                },
              ],
              setContextMenu,
            )
          }
          icon={<FileText size={11} className="flex-shrink-0 text-[var(--muted)]" />}
          title={s.path}
          actions={
            <ExplorerRowAction
              title="Open in script editor"
              onClick={(ev) => {
                ev.stopPropagation()
                assets.openScript(s.path)
              }}
            >
              <FileText size={12} />
            </ExplorerRowAction>
          }
        />
      ))}
      {folder.tilesets
        .filter(
          (t) =>
            !assetHiddenByVirtualFolder(
              project,
              'tilesets',
              'tileset',
              t.assetId,
            ),
        )
        .map((t) => (
        <TreeLeaf
          key={t.assetId}
          label={t.name}
          depth={2}
          selected={assetMulti.isSelected('tileset', t.assetId)}
          {...explorerAssetDragProps(
            assetMulti.dragRefsFor('tilesets', 'tileset', t.assetId),
          )}
          onClick={(e) =>
            assetMulti.handleAssetClick(
              e,
              'tilesets',
              'tileset',
              t.assetId,
              () => assets.openTilesetEditor(t.assetId),
            )
          }
          onContextMenu={(ev) =>
            openExplorerContextMenu(
              ev,
              buildAssetFolderMenuItems(
                project,
                'tilesets',
                'tileset',
                t.assetId,
                makeAssetFolderMenuHandlers('tilesets', 'tileset', t.assetId),
                [
                  {
                    id: 'edit',
                    label: 'Open Tileset Editor',
                    onSelect: () => assets.openTilesetEditor(t.assetId),
                  },
                  {
                    id: 'remove',
                    label: 'Remove tileset',
                    danger: true,
                    onSelect: () => void assets.removeAsset({ type: 'tileset', id: t.assetId }),
                  },
                ],
                assetMulti.batchRefsInCategory('tilesets'),
              ),
              setContextMenu,
            )
          }
          icon={
            <TilesetTreeThumbnail
              tileset={project.tilesets?.[t.assetId]}
              projectPath={projectPath}
              onOpenEditor={() => assets.openTilesetEditor(t.assetId)}
            />
          }
          title="Click to open Tileset Editor"
          actions={
            <>
              <ExplorerRowAction
                title="Open Tileset Editor"
                tone={assetMulti.isSelected('tileset', t.assetId) ? 'onSelected' : 'default'}
                onClick={(ev) => {
                  ev.stopPropagation()
                  assets.openTilesetEditor(t.assetId)
                }}
              >
                <Pencil size={12} />
              </ExplorerRowAction>
              <ExplorerRowAction
                title="Remove tileset"
                tone={assetMulti.isSelected('tileset', t.assetId) ? 'onSelected' : 'danger'}
                onClick={(ev) => {
                  ev.stopPropagation()
                  void assets.removeAsset({ type: 'tileset', id: t.assetId })
                }}
              >
                <Trash2 size={12} />
              </ExplorerRowAction>
            </>
          }
        />
      ))}
    </>
  )
}
