import { StreamLanguage } from '@codemirror/language'
import { lua } from '@codemirror/legacy-modes/mode/lua'

export const luaLanguage = StreamLanguage.define(lua)
