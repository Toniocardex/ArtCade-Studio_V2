import type { ObjectCreateAction } from '../../utils/object-create'

export type AddSceneCommand = Readonly<{
  type: 'scene.addEmpty'
  sourceSceneId?: string
}>

export type RenameSceneCommand = Readonly<{
  type: 'scene.rename'
  sceneId: string
  name: string
}>

export type SetStartSceneCommand = Readonly<{
  type: 'scene.setStart'
  sceneId: string
}>

export type DeleteSceneCommand = Readonly<{
  type: 'scene.delete'
  sceneId: string
}>

export type DuplicateSceneCommand = Readonly<{
  type: 'scene.duplicate'
  sceneId: string
}>

export type CreateObjectCommand = Readonly<{
  type: 'object.create'
  action: ObjectCreateAction
}>

export type AddInstanceFromTypeCommand = Readonly<{
  type: 'scene.instance.addFromType'
  sceneId: string
  objectTypeId: string
}>

export type DuplicateInstanceCommand = Readonly<{
  type: 'scene.instance.duplicate'
  sceneId: string
  instanceId: number
}>

export type DeleteInstanceCommand = Readonly<{
  type: 'scene.instance.delete'
  entityId: number
}>

export type SetInstanceVisibleCommand = Readonly<{
  type: 'scene.instance.setVisible'
  entityId: number
  visible: boolean
}>

export type RenameInstanceCommand = Readonly<{
  type: 'scene.instance.rename'
  entityId: number
  name: string
}>

export type RenameObjectTypeCommand = Readonly<{
  type: 'objectType.rename'
  objectTypeId: string
  displayName: string
}>

export type DeleteObjectTypeCommand = Readonly<{
  type: 'objectType.delete'
  objectTypeId: string
}>

export type SceneAuthoringCommand =
  | AddSceneCommand
  | RenameSceneCommand
  | SetStartSceneCommand
  | DeleteSceneCommand
  | DuplicateSceneCommand
  | CreateObjectCommand
  | AddInstanceFromTypeCommand
  | DuplicateInstanceCommand
  | DeleteInstanceCommand
  | SetInstanceVisibleCommand
  | RenameInstanceCommand
  | RenameObjectTypeCommand
  | DeleteObjectTypeCommand
