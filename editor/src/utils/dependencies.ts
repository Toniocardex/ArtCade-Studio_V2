export interface ToolStatus {
  ok: boolean
  path: string | null
  detail: string
  can_install: boolean
}

export interface DependencyReport {
  python: ToolStatus
  runtime_sdk: ToolStatus
  cmake: ToolStatus
  ninja: ToolStatus
  msvc: ToolStatus
  emscripten: ToolStatus
  workspace_root: string | null
  sdk_root: string
  ready_for_native_build: boolean
  ready_for_wasm_build: boolean
  ready_for_pack: boolean
}

export type DependencyMode = 'pack' | 'native' | 'wasm'

export function missingDependencyLabels(
  report: DependencyReport,
  mode: DependencyMode,
): string[] {
  const missing: string[] = []
  const need = (ok: boolean, label: string) => { if (!ok) missing.push(label) }

  if (mode === 'pack') {
    need(report.ready_for_pack, 'Python + pack script')
    if (!report.python.ok) need(false, 'Python')
  } else if (mode === 'native') {
    need(report.runtime_sdk.ok, 'Runtime SDK')
    need(report.cmake.ok, 'CMake')
    need(report.ninja.ok, 'Ninja')
    need(report.msvc.ok, 'Visual Studio Build Tools (MSVC)')
    need(report.python.ok, 'Python')
  } else {
    need(report.runtime_sdk.ok, 'Runtime SDK')
    need(report.emscripten.ok, 'Emscripten SDK')
  }

  return [...new Set(missing)]
}

export function formatDependencyReport(report: DependencyReport): string {
  const rows = [
    ['Python', report.python],
    ['Runtime SDK', report.runtime_sdk],
    ['CMake', report.cmake],
    ['Ninja', report.ninja],
    ['MSVC', report.msvc],
    ['Emscripten', report.emscripten],
  ] as const
  return rows
    .map(([name, s]) => `${s.ok ? '✓' : '✗'} ${name}: ${s.detail}`)
    .join('\n')
}
