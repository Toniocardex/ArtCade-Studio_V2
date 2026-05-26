import { describe, expect, it } from 'vitest'
import { createBlankProject, parseProjectDoc, serializeProjectDoc } from './project'

describe('project world.physicsMode', () => {
  it('round-trips physicsMode in world settings', () => {
    const doc = createBlankProject('T')
    doc.world = {
      gravity: 9.81,
      pixelsPerMeter: 100,
      timeScale: 1,
      physicsMode: 'off',
    }
    const json = JSON.stringify(serializeProjectDoc(doc))
    const roundTrip = parseProjectDoc(JSON.parse(json))
    expect(roundTrip).not.toBeNull()
    expect(roundTrip!.world?.physicsMode).toBe('off')
  })

  it('defaults physicsMode to auto when omitted', () => {
    const doc = createBlankProject('T')
    doc.world = { gravity: 10, pixelsPerMeter: 50, timeScale: 1 }
    const json = JSON.stringify(serializeProjectDoc(doc))
    const roundTrip = parseProjectDoc(JSON.parse(json))
    expect(roundTrip!.world?.physicsMode).toBe('auto')
  })
})
