import type { ConsoleEntry } from '../../types'

let _logId = 100

export function makeConsoleEntry(message: string, level: ConsoleEntry['level']): ConsoleEntry {
  const now = new Date()
  return {
    id: ++_logId,
    time: now.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    message,
    level,
  }
}
