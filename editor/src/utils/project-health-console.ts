import type { ConsoleEntry } from '../types'
import type { HealthIssue, ProjectHealth } from './project-health'

function healthIssueMessage(issue: HealthIssue): string {
  const details = [issue.source, issue.context].filter(Boolean).join(' | ')
  return details ? `[${details}] ${issue.message}` : `[${issue.source}] ${issue.message}`
}

/** Convert the complete project health suite into filterable console entries. */
export function projectHealthConsoleEntries(health: ProjectHealth): ConsoleEntry[] {
  const issues = [...health.errors, ...health.warnings]
  return issues.map((issue, index) => ({
    id: -(index + 1),
    time: 'VALIDATE',
    level: issue.severity,
    message: healthIssueMessage(issue),
  }))
}
