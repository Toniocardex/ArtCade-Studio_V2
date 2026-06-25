export interface CompilerPreludeFeatures {
  random: boolean
  bagUnsub: boolean
  composeKey: boolean
  spawnRegistration: boolean
  destroyRegistration: boolean
  animationRegistration: boolean
  animStartRegistration: boolean
  animFrameRegistration: boolean
  animLoopRegistration: boolean
  animChangeRegistration: boolean
  inputPressedRegistration: boolean
  inputReleasedRegistration: boolean
  messageRegistration: boolean
  timerEveryRegistration: boolean
  timerAfterRegistration: boolean
  tickTimers: boolean
  mouseButtons: boolean
  healthDepletedEdge: boolean
  damagedEdge: boolean
  leaveScreenEdge: boolean
  textToString: boolean
  textFormat: boolean
  frameMovement: boolean
}

function linesUse(lines: string[], needle: string): boolean {
  return lines.some((line) => line.includes(needle))
}

export function derivePreludeFeatures(
  initBlocks: string[],
  tickBlocks: string[],
): CompilerPreludeFeatures {
  const lines = [...initBlocks, ...tickBlocks]
  // Matches every animation helper: _logic_reg_anim_end/start/frame/loop/change.
  const usesAnyAnim = linesUse(lines, '_logic_reg_anim_')
  const bagUnsub =
    linesUse(lines, '_logic_reg_spawn(') ||
    linesUse(lines, '_logic_reg_destroy(') ||
    usesAnyAnim ||
    linesUse(lines, '_logic_reg_input_pressed(') ||
    linesUse(lines, '_logic_reg_input_released(')

  return {
    random: linesUse(lines, '_logic_random_'),
    bagUnsub,
    composeKey:
      usesAnyAnim,
    spawnRegistration: linesUse(lines, '_logic_reg_spawn('),
    destroyRegistration: linesUse(lines, '_logic_reg_destroy('),
    animationRegistration: linesUse(lines, '_logic_reg_anim_end('),
    animStartRegistration: linesUse(lines, '_logic_reg_anim_start('),
    animFrameRegistration: linesUse(lines, '_logic_reg_anim_frame('),
    animLoopRegistration: linesUse(lines, '_logic_reg_anim_loop('),
    animChangeRegistration: linesUse(lines, '_logic_reg_anim_change('),
    inputPressedRegistration: linesUse(lines, '_logic_reg_input_pressed('),
    inputReleasedRegistration: linesUse(lines, '_logic_reg_input_released('),
    messageRegistration: linesUse(lines, '_logic_reg_message('),
    timerEveryRegistration: linesUse(lines, '_logic_reg_timer_every('),
    timerAfterRegistration: linesUse(lines, '_logic_reg_timer_after('),
    tickTimers: linesUse(lines, '_logic_timers['),
    mouseButtons: linesUse(lines, '_mb['),
    healthDepletedEdge: linesUse(lines, '_hpd_fired['),
    damagedEdge: linesUse(lines, '_dmg_prev['),
    leaveScreenEdge: linesUse(lines, '_ls_prev['),
    textToString: linesUse(lines, '_logic_tostr('),
    textFormat: linesUse(lines, '_logic_fmt('),
    frameMovement: linesUse(lines, '_logic_add_movement('),
  }
}

export function usesUnsubTracking(features: CompilerPreludeFeatures): boolean {
  return (
    features.bagUnsub ||
    features.messageRegistration ||
    features.timerEveryRegistration
  )
}
