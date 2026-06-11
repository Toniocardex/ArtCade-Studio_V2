import type { CSSProperties, RefObject } from 'react'

type MenuOption = Readonly<{
  value: string
  label: string
  title?: string
}>

type MenuGroup = Readonly<{
  label?: string
  items: readonly Readonly<{
    option: MenuOption
    index: number
  }>[]
}>

type EditorSelectMenuProps = Readonly<{
  menuRef: RefObject<HTMLDivElement | null>
  listId: string
  style: CSSProperties
  groups: readonly MenuGroup[]
  value: string
  activeIndex: number
  onActivate: (index: number) => void
  onSelect: (value: string) => void
}>

/** Renders the portaled option groups for EditorSelect. */
export function EditorSelectMenu({
  menuRef,
  listId,
  style,
  groups,
  value,
  activeIndex,
  onActivate,
  onSelect,
}: EditorSelectMenuProps) {
  return (
    <div
      ref={menuRef}
      className="editor-menu-dropdown editor-listbox"
      style={style}
    >
      <ul id={listId} role="listbox" className="editor-listbox__list">
        {groups.map((group, groupIndex) => (
          <li key={group.label ?? groupIndex} role="presentation">
            {group.label && (
              <div
                className="editor-listbox__heading"
              >
                {group.label}
              </div>
            )}
            <ul
              className="editor-listbox__group"
              role={group.label ? 'group' : undefined}
              aria-label={group.label}
            >
              {group.items.map(({ option, index }) => {
                const isSelected = option.value === value
                const isActive = index === activeIndex
                return (
                  // Index key: option values can collide (e.g. same clip name
                  // on two sprite sheets) and rows never reorder within an
                  // open menu.
                  <li key={index} role="presentation">
                    <button
                      id={`${listId}-option-${index}`}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={isSelected}
                      title={option.title}
                      className={`editor-listbox__option${
                        isSelected ? ' editor-listbox__option--selected' : ''
                      }${isActive ? ' editor-listbox__option--active' : ''}`}
                      onMouseEnter={() => onActivate(index)}
                      onClick={() => onSelect(option.value)}
                    >
                      {option.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
