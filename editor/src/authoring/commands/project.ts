export type RenameProjectCommand = Readonly<{
  type: 'project.rename'
  name: string
}>

export type ProjectAuthoringCommand = RenameProjectCommand

