import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadProjectDocument } from './project-document'
import { prepareSerializedProjectDocument } from './project-persist'
import { parseProjectDoc, serializeProjectDoc } from './project-codec'
import { BLANK_MAIN_LUA } from './project-factory'
import { createPlatformerProject } from './project-templates'
import { runtimeProjectFingerprint } from './runtime-fingerprint'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const goldenDir = join(repoRoot, 'examples/platformer-basic')
const goldenPath = join(goldenDir, 'project.json')
const goldenMainLuaPath = join(goldenDir, 'scripts/main.lua')

function platformerGoldenJson(): string {
  const project = createPlatformerProject('Platformer Basic')
  project.projectId = 'golden-platformer-basic'
  return serializeProjectDoc(project)
}

if (process.env.UPDATE_GOLDEN === '1') {
  mkdirSync(join(goldenDir, 'scripts'), { recursive: true })
  writeFileSync(goldenPath, `${platformerGoldenJson()}\n`, 'utf8')
  writeFileSync(goldenMainLuaPath, BLANK_MAIN_LUA, 'utf8')
}

describe('platformer-basic golden project', () => {
  it('loads, validates, and round-trips the platformer template', () => {
    const json = platformerGoldenJson()
    const loaded = loadProjectDocument(json)
    expect(loaded.project.objectTypes?.Player).toBeDefined()
    expect(loaded.project.objectTypes?.Ground).toBeDefined()
    expect(loaded.project.entities[1]?.platformerController).toBeDefined()
    prepareSerializedProjectDocument(loaded.project)

    const again = parseProjectDoc(serializeProjectDoc(loaded.project))
    expect(again?.entities[1]?.platformerController?.maxSpeed).toBe(300)
    expect(runtimeProjectFingerprint(loaded.project, 'scene_main')).toBeTruthy()
  })

  it('ships scripts/main.lua beside project.json', () => {
    const onDisk = readFileSync(goldenMainLuaPath, 'utf8').replace(/\r\n/g, '\n')
    expect(onDisk).toBe(BLANK_MAIN_LUA)
  })

  it('matches the committed examples/platformer-basic/project.json fixture', () => {
    const onDisk = readFileSync(goldenPath, 'utf8')
    const fromTemplate = platformerGoldenJson()
    expect(JSON.parse(onDisk)).toEqual(JSON.parse(fromTemplate))
  })
})
