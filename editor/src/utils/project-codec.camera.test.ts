import { describe, it, expect } from 'vitest'
import { createBlankProject, parseProjectDoc, serializeProjectDoc } from './project'

describe('project codec — scene cameraStart', () => {
  it('round-trips a cameraStart through serialize → parse', () => {
    const project = createBlankProject('Cam')
    project.scenes.scene_main.cameraStart = { x: 256, y: 128 }

    const after = parseProjectDoc(serializeProjectDoc(project))
    expect(after).not.toBeNull()
    expect(after!.scenes.scene_main.cameraStart).toEqual({ x: 256, y: 128 })
  })

  it('omits cameraStart for scenes that never moved the camera', () => {
    const project = createBlankProject('NoCam')
    const json = JSON.parse(serializeProjectDoc(project))
    expect(json.scenes.scene_main.cameraStart).toBeUndefined()

    const after = parseProjectDoc(serializeProjectDoc(project))
    expect(after!.scenes.scene_main.cameraStart).toBeUndefined()
  })
})
