import { describe, expect, it } from 'vitest'
import {
  createAssetDragPayloadV1,
  readAssetDragPayload,
  readAssetDragRefs,
  writeAssetDragPayload,
  ARTCADE_ASSET_DND_MIME,
} from './asset-explorer-dnd'

describe('asset-explorer-dnd', () => {
  it('round-trips V1 payload through DataTransfer', () => {
    const dt = {
      _store: '' as string,
      effectAllowed: '',
      setData(mime: string, value: string) {
        if (mime === ARTCADE_ASSET_DND_MIME) this._store = value
      },
      getData(mime: string) {
        return mime === ARTCADE_ASSET_DND_MIME ? this._store : ''
      },
    } as DataTransfer

    const payload = createAssetDragPayloadV1(
      [
        { type: 'image', id: 'img1' },
        { type: 'tileset', id: 'ts1' },
      ],
      'folder_1',
    )
    writeAssetDragPayload(dt, payload)
    expect(readAssetDragPayload(dt)).toEqual(payload)
    expect(readAssetDragRefs(dt)).toEqual(payload.refs)
  })

  it('returns null for invalid payload', () => {
    const dt = {
      getData: () => 'not-json',
    } as DataTransfer
    expect(readAssetDragPayload(dt)).toBeNull()
    expect(readAssetDragRefs(dt)).toEqual([])
  })

  it('reads text/plain fallback when custom MIME is empty', () => {
    const payload = createAssetDragPayloadV1([{ type: 'image', id: 'img1' }], null)
    const dt = {
      getData: (mime: string) => (mime === 'text/plain' ? JSON.stringify(payload) : ''),
    } as DataTransfer
    expect(readAssetDragPayload(dt)).toEqual(payload)
  })

  it('accepts legacy bare ref array payloads', () => {
    const legacy = JSON.stringify([{ type: 'image', id: 'img1' }])
    const dt = {
      getData: () => legacy,
    } as DataTransfer
    expect(readAssetDragRefs(dt)).toEqual([{ type: 'image', id: 'img1' }])
  })
})
