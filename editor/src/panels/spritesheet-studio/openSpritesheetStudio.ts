import type { useEditor } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import { alertDialog } from '../../utils/native-dialog'

export function openSpritesheetStudio(
  dispatch: ReturnType<typeof useEditor>['dispatch'],
  project: ProjectDoc | null,
  imageAssetId: string,
): void {
  const id = imageAssetId.trim()
  if (!id || !project) return
  const asset = project.assets?.[id]
  if (!asset) {
    void alertDialog('Image asset not found.', { title: 'Spritesheet Studio', kind: 'warning' })
    return
  }
  if (!asset.dataUrl && !asset.path?.trim()) {
    void alertDialog(
      'Save the project or ensure the image file is on disk before editing animations.',
      { title: 'Spritesheet Studio', kind: 'warning' },
    )
    return
  }
  dispatch({ type: 'SPRITESHEET_STUDIO_OPEN', imageAssetId: id })
}
