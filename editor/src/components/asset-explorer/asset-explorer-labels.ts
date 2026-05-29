import type { AssetExplorerSelection } from '../../hooks/useAssetExplorerActions'

export function assetRemoveTitle(sel: AssetExplorerSelection | null): string {
  if (!sel) return 'Select an asset to remove'
  switch (sel.type) {
    case 'image':
      return 'Remove image (Delete)'
    case 'audio':
      return 'Remove audio (Delete)'
    case 'font':
      return 'Remove font (Delete)'
    case 'tileset':
      return 'Remove tileset (Delete)'
  }
}
