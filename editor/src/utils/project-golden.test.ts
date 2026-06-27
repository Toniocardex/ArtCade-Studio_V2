import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadProjectDocument } from './project-document'
import { validateProjectBeforeSave } from './logic-board/validate-project'
import { parseProjectDoc, serializeProjectDoc } from './project-codec'
import { createPlatformerProject } from './project-templates'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const goldenDir = join(repoRoot, 'examples/platformer-basic')
const goldenPath = join(goldenDir, 'project.json')

function platformerGoldenJson(): string {
  const project = createPlatformerProject('Platformer Basic')
  project.projectId = 'golden-platformer-basic'
  return serializeProjectDoc(project)
}

if (process.env.UPDATE_GOLDEN === '1') {
  mkdirSync(goldenDir, { recursive: true })
  writeFileSync(goldenPath, `${platformerGoldenJson()}\n`, 'utf8')
}

describe('platformer-basic golden project', () => {
  it('loads, validates, and round-trips the platformer template', () => {
    const json = platformerGoldenJson()
    const loaded = loadProjectDocument(json)
    expect(loaded.project.objectTypes?.Player).toBeDefined()
    expect(loaded.project.objectTypes?.Ground).toBeDefined()
    expect(loaded.project.entities[1]?.platformerController).toBeDefined()
    expect(() => validateProjectBeforeSave(loaded.project)).not.toThrow()

    const again = parseProjectDoc(serializeProjectDoc(loaded.project))
    expect(again?.objectTypes?.Player?.platformerController).toBeDefined()
    expect(again?.entities[1]?.platformerController?.maxSpeed).toBe(300)
  })

  it('matches the committed examples/platformer-basic/project.json fixture', () => {
    const onDisk = readFileSync(goldenPath, 'utf8')
    const fromTemplate = platformerGoldenJson()
    expect(JSON.parse(onDisk)).toEqual(JSON.parse(fromTemplate))
  })
})
