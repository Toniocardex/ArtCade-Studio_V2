export type CatalogText = Readonly<{
  title: string
  subtitle: string
  searchPlaceholder: string
}>

export function actionCatalogText(
  mode: 'add' | 'change',
  forElse: boolean | undefined,
): CatalogText {
  const branch = forElse ? 'Else action' : 'action'
  return {
    title:
      mode === 'add'
        ? `Add ${branch}${forElse ? '' : ' - choose what happens'}`
        : `Change ${branch}${forElse ? '' : ' - choose what happens'}`,
    subtitle: forElse
      ? 'Runs when the Also require checks fail.'
      : 'Runs when this rule fires and its checks pass.',
    searchPlaceholder: 'Search actions... (move, sound, spawn)',
  }
}

export function conditionCatalogText(mode: 'add' | 'change'): CatalogText {
  return {
    title: `${mode === 'add' ? 'Add' : 'Change'} check - extra requirement`,
    subtitle: 'The rule only fires when every check passes.',
    searchPlaceholder: 'Search checks... (variable, key, distance)',
  }
}
