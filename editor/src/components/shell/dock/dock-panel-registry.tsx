import type { ReactNode } from 'react'
import ConsolePanel from '../../../panels/ConsolePanel'
import { AnimationTimelineTab } from './AnimationTimelineTab'
import { EventDebuggerTab } from './EventDebuggerTab'
import type { DockPanelId } from '../../../constants/dock-panels'

export type DockPanelDef = Readonly<{
  id: DockPanelId
  title: string
  render: () => ReactNode
}>

export const DOCK_PANEL_REGISTRY: readonly DockPanelDef[] = [
  {
    id: 'console',
    title: 'Debug Console',
    render: () => <ConsolePanel compact />,
  },
  {
    id: 'timeline',
    title: 'Animation Timeline',
    render: () => <AnimationTimelineTab />,
  },
  {
    id: 'events',
    title: 'Event Debugger',
    render: () => <EventDebuggerTab />,
  },
] as const
