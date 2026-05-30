import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { editorTabActive, editorTabBase, editorTabInactive } from './editor-ui-classes'

export type EditorTabProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    active: boolean
    children: ReactNode
  }
>

export function EditorTab({ active, className = '', children, type = 'button', ...rest }: EditorTabProps) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={active}
      className={`${editorTabBase} ${active ? editorTabActive : editorTabInactive} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
