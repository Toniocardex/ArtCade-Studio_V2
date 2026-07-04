import type { AssetAuthoringCommand } from './assets'
import type { ProjectAuthoringCommand } from './project'
import type { SceneAuthoringCommand } from './scenes'

export type AuthoringCommand =
  | ProjectAuthoringCommand
  | AssetAuthoringCommand
  | SceneAuthoringCommand
