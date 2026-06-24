import { Film, Music, Pencil, Trash2, Type } from 'lucide-react'
import type { ProjectDoc } from '../../types'
import type { useEditorDispatch } from '../../store/editor-store'
import type { buildProjectExplorerData } from '../../utils/project-explorer-tree'
import type { useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import type { useAssetTreeMultiSelect } from '../../hooks/useAssetTreeMultiSelect'
import {
  virtualFolderContainingAsset,
  type AssetVirtualFolderCategory,
  type VirtualAssetRefType,
} from '../../utils/asset-virtual-folders'
import { explorerAssetDragProps } from './explorer-asset-drag'
import { ImageTreeThumbnail } from '../asset-explorer/ImageTreeThumbnail'
import { TilesetTreeThumbnail } from '../asset-explorer/TilesetTreeThumbnail'
import type { VirtualFolderLeafRow } from './VirtualFoldersBlock'
import { ExplorerRowAction } from './explorer-cta'

type AssetFolder = ReturnType<typeof buildProjectExplorerData>['assetFolders'][number]

export type ResolveAssetLeafCtx = Readonly<{
  folder: AssetFolder
  project: ProjectDoc
  projectPath: string | null
  libraryCategory: AssetVirtualFolderCategory
  assets: ReturnType<typeof useAssetExplorerActions>
  assetMulti: ReturnType<typeof useAssetTreeMultiSelect>
  selectedEntityId: number | null
  dispatch: ReturnType<typeof useEditorDispatch>
}>

/**
 * Builds the VirtualFoldersBlock leaf descriptor for an asset ref. Pulled out of
 * AssetsTreeSection: pure data assembly (icon, drag props, context-menu items)
 * for image / audio / font / tileset rows inside a virtual folder.
 */
export function resolveAssetLeaf(
  type: VirtualAssetRefType,
  id: string,
  ctx: ResolveAssetLeafCtx,
): VirtualFolderLeafRow | null {
  const { folder, project, projectPath, libraryCategory, assets, assetMulti, selectedEntityId } = ctx
  if (type === 'image') {
    const imgRow = folder.images.find((i) => i.id === id)
    if (!imgRow) return null
    const asset = project.assets?.[imgRow.id]
    return {
      assetType: 'image',
      assetId: imgRow.id,
      label: imgRow.name,
      selected: assetMulti.isSelected('image', imgRow.id),
      onClick: (e) =>
        assetMulti.handleAssetClick(
          e,
          'images',
          'image',
          imgRow.id,
          () => assets.setSelection({ type: 'image', id: imgRow.id }),
        ),
      onDoubleClick: asset
        ? () => assets.openImageStudio(imgRow.id)
        : undefined,
      ...explorerAssetDragProps(
        assetMulti.dragRefsFor('images', 'image', imgRow.id),
        virtualFolderContainingAsset(project, libraryCategory, 'image', imgRow.id)?.id ?? null,
      ),
      title: asset
        ? 'Double-click to open Sprite Studio'
        : imgRow.path,
      icon: (
        <ImageTreeThumbnail
          asset={asset}
          projectPath={projectPath}
          onOpenStudio={() => assets.openImageStudio(imgRow.id)}
        />
      ),
      spritesheetStudioTrigger: Boolean(asset),
      extraMenuItems: asset
        ? [
            {
              id: 'spritesheet-studio',
              label: 'Open Sprite Studio',
              onSelect: () => assets.openImageStudio(imgRow.id),
            },
            {
              id: 'assign',
              label: 'Assign to selected entity',
              disabled: selectedEntityId == null,
              onSelect: () => assets.assignSprite(asset),
            },
            {
              id: 'remove',
              label: 'Remove image',
              danger: true,
              onSelect: () => void assets.removeAsset({ type: 'image', id: imgRow.id }),
            },
          ]
        : [],
      actions: asset ? (
        <>
          <ExplorerRowAction
            title="Open in Sprite Studio"
            tone={assetMulti.isSelected('image', imgRow.id) ? 'onSelected' : 'default'}
            onClick={(ev) => {
              ev.stopPropagation()
              assets.openImageStudio(imgRow.id)
            }}
          >
            <Film size={12} />
          </ExplorerRowAction>
          <ExplorerRowAction
            title="Remove image"
            tone={assetMulti.isSelected('image', imgRow.id) ? 'onSelected' : 'danger'}
            onClick={(ev) => {
              ev.stopPropagation()
              void assets.removeAsset({ type: 'image', id: imgRow.id })
            }}
          >
            <Trash2 size={12} />
          </ExplorerRowAction>
        </>
      ) : undefined,
    }
  }
  if (type === 'audio') {
    const row = folder.audio.find((a) => a.id === id)
    if (!row) return null
    return {
      assetType: 'audio',
      assetId: row.id,
      label: row.name,
      selected: assetMulti.isSelected('audio', row.id),
      onClick: (e) =>
        assetMulti.handleAssetClick(e, 'audio', 'audio', row.id, () =>
          assets.setSelection({ type: 'audio', id: row.id }),
        ),
      ...explorerAssetDragProps(
        assetMulti.dragRefsFor('audio', 'audio', row.id),
        virtualFolderContainingAsset(project, libraryCategory, 'audio', row.id)?.id ?? null,
      ),
      icon: (
        <Music size={11} className="flex-shrink-0 text-[var(--muted)]" />
      ),
      title: row.path,
      extraMenuItems: [
        {
          id: 'remove',
          label: 'Remove audio',
          danger: true,
          onSelect: () => void assets.removeAsset({ type: 'audio', id: row.id }),
        },
      ],
      actions: (
        <ExplorerRowAction
          title="Remove audio"
          tone={assetMulti.isSelected('audio', row.id) ? 'onSelected' : 'danger'}
          onClick={(ev) => {
            ev.stopPropagation()
            void assets.removeAsset({ type: 'audio', id: row.id })
          }}
        >
          <Trash2 size={12} />
        </ExplorerRowAction>
      ),
    }
  }
  if (type === 'font') {
    const row = folder.fonts.find((f) => f.id === id)
    if (!row) return null
    return {
      assetType: 'font',
      assetId: row.id,
      label: row.name,
      selected: assetMulti.isSelected('font', row.id),
      onClick: (e) =>
        assetMulti.handleAssetClick(e, 'fonts', 'font', row.id, () =>
          assets.setSelection({ type: 'font', id: row.id }),
        ),
      ...explorerAssetDragProps(
        assetMulti.dragRefsFor('fonts', 'font', row.id),
        virtualFolderContainingAsset(project, libraryCategory, 'font', row.id)?.id ?? null,
      ),
      icon: <Type size={11} className="flex-shrink-0 text-[var(--warn)]" />,
      title: row.path,
      extraMenuItems: [
        {
          id: 'remove',
          label: 'Remove font',
          danger: true,
          onSelect: () => void assets.removeAsset({ type: 'font', id: row.id }),
        },
      ],
      actions: (
        <ExplorerRowAction
          title="Remove font"
          tone={assetMulti.isSelected('font', row.id) ? 'onSelected' : 'danger'}
          onClick={(ev) => {
            ev.stopPropagation()
            void assets.removeAsset({ type: 'font', id: row.id })
          }}
        >
          <Trash2 size={12} />
        </ExplorerRowAction>
      ),
    }
  }
  const row = folder.tilesets.find((t) => t.assetId === id)
  if (!row) return null
  const tilesetAsset = project.tilesets?.[row.assetId]
  return {
    assetType: 'tileset',
    assetId: row.assetId,
    label: row.name,
    selected: assetMulti.isSelected('tileset', row.assetId),
    onClick: (e) =>
      assetMulti.handleAssetClick(
        e,
        'tilesets',
        'tileset',
        row.assetId,
        () => assets.openTilesetEditor(row.assetId),
      ),
    ...explorerAssetDragProps(
      assetMulti.dragRefsFor('tilesets', 'tileset', row.assetId),
      virtualFolderContainingAsset(project, libraryCategory, 'tileset', row.assetId)?.id ?? null,
    ),
    icon: (
      <TilesetTreeThumbnail
        tileset={tilesetAsset}
        projectPath={projectPath}
        onOpenEditor={() => assets.openTilesetEditor(row.assetId)}
      />
    ),
    title: 'Click to open Tileset Editor',
    extraMenuItems: [
      {
        id: 'edit',
        label: 'Open Tileset Editor',
        onSelect: () => assets.openTilesetEditor(row.assetId),
      },
      {
        id: 'remove',
        label: 'Remove tileset',
        danger: true,
        onSelect: () => void assets.removeAsset({ type: 'tileset', id: row.assetId }),
      },
    ],
    actions: (
      <>
        <ExplorerRowAction
          title="Open Tileset Editor"
          tone={assetMulti.isSelected('tileset', row.assetId) ? 'onSelected' : 'default'}
          onClick={(ev) => {
            ev.stopPropagation()
            assets.openTilesetEditor(row.assetId)
          }}
        >
          <Pencil size={12} />
        </ExplorerRowAction>
        <ExplorerRowAction
          title="Remove tileset"
          tone={assetMulti.isSelected('tileset', row.assetId) ? 'onSelected' : 'danger'}
          onClick={(ev) => {
            ev.stopPropagation()
            void assets.removeAsset({ type: 'tileset', id: row.assetId })
          }}
        >
          <Trash2 size={12} />
        </ExplorerRowAction>
      </>
    ),
  }
}
