import { describe, expect, it } from 'vitest'
import { readAssetDragPayload, writeAssetDragPayload, ASSET_REF_DRAG_MIME } from './asset-explorer-dnd'

describe('asset-explorer-dnd', () => {
  it('round-trips drag refs through DataTransfer', () => {
    const dt = {
      _store: '' as string,
      effectAllowed: '',
      setData(mime: string, value: string) {
        if (mime === ASSET_REF_DRAG_MIME) this._store = value
      },
      getData(mime: string) {
        return mime === ASSET_REF_DRAG_MIME ? this._store : ''
      },
    } as DataTransfer

    writeAssetDragPayload(dt, [
      { type: 'image', id: 'img1' },
      { type: 'tileset', id: 'ts1' },
    ])
    expect(readAssetDragPayload(dt)).toEqual([
      { type: 'image', id: 'img1' },
      { type: 'tileset', id: 'ts1' },
    ])
  })

  it('returns empty array for invalid payload', () => {
    const dt = {
      getData: () => 'not-json',
    } as DataTransfer
    expect(readAssetDragPayload(dt)).toEqual([])
  })

  it('reads text/plain fallback when custom MIME is empty', () => {
    const json = JSON.stringify([{ type: 'image', id: 'img1' }])
    const dt = {
      getData: (mime: string) => (mime === 'text/plain' ? json : ''),
    } as DataTransfer
    expect(readAssetDragPayload(dt)).toEqual([{ type: 'image', id: 'img1' }])
  })
})
