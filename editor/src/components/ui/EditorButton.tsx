import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { editorBtnDefault, editorBtnGhost } from './editor-ui-classes'

type Variant = 'default' | 'ghost'

export type EditorButtonProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant
    children: ReactNode
  }
>

export function EditorButton({
  variant = 'default',
  className = '',
  type = 'button',
  children,
  ...rest
}: EditorButtonProps) {
  const base = variant === 'ghost' ? editorBtnGhost : editorBtnDefault
  return (
    <button type={type} className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
