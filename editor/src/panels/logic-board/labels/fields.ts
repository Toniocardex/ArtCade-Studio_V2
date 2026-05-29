import type { ComponentKind } from '../../../utils/logic-board/schema-registry'

const FIELD_LABELS: Record<string, string> = {
  'trigger:onCollision:withClass': 'Touching class',
  'trigger:onTriggerEnter:withClass': 'Zone tag',
  'trigger:onTriggerExit:withClass': 'Zone tag',
  'trigger:onAnimationEnd:clipName': 'Animation name',
  'trigger:onInput:keyCode': 'Key',
  'trigger:onInput:eventType': 'When',
  'trigger:onMouseInput:button': 'Button',
  'trigger:onMouseInput:eventType': 'When',
  'trigger:onObjectClick:button': 'Button',
  'trigger:onObjectClick:radius': 'Hit radius',
  'trigger:onObjectHoverEnter:radius': 'Hit radius',
  'trigger:onObjectHoverExit:radius': 'Hit radius',
  'trigger:onMessage:messageName': 'Message name',
  'trigger:onTimer:seconds': 'Every (seconds)',
  'trigger:onTimer:repeat': 'Repeat',
  'action:spawnEntity:className': 'What to create',
  'action:spawnEntity:x': 'Horizontal position',
  'action:spawnEntity:y': 'Vertical position',
  'action:spawnEntity:inheritFlip': 'Match facing direction',
  'action:spawnEntity:imagePoint': 'Spawn at attachment point',
  'action:spawnEntityAtPointer:className': 'What to create',
  'condition:compareClass:className': 'Object type',
  'condition:raycastHit:className': 'Object type (optional)',
  'action:moveInDirection:direction': 'Direction',
  'action:moveInDirection:speed': 'Speed',
  'action:controllerMovement:direction': 'Direction',
  'action:moveController:direction': 'Direction',
  'action:damageEntity:amount': 'Damage',
  'action:healEntity:amount': 'Heal',
  'action:setEntityHealth:currentHp': 'Current HP',
  'action:setEntityHealth:maxHp': 'Max HP',
  'action:setLinearMoverDirection:directionX': 'Direction X',
  'action:setLinearMoverDirection:directionY': 'Direction Y',
  'action:setLinearMoverSpeed:speed': 'Speed',
  'action:setMagnetEnabled:enabled': 'Enabled',
  'action:setMagnetTargetTag:tag': 'Attract tag',
  'action:setHordeTargetClass:className': 'Chase class',
  'action:setHordeWeights:chaseWeight': 'Chase weight',
  'action:setHordeWeights:separationWeight': 'Separation weight',
  'action:setAutoDestroyLifespan:lifespan': 'Lifespan (s)',
  'action:loadScene:sceneName': 'Level name',
  'action:loadScene:fadeSeconds': 'Fade (seconds)',
  'condition:isSpaceFree:x': 'X',
  'condition:isSpaceFree:y': 'Y',
  'condition:isSpaceFree:w': 'Width',
  'condition:isSpaceFree:h': 'Height',
  'action:playAnimation:clipName': 'Clip name',
  'action:cameraShake:trauma': 'Intensity (0–1)',
  'action:cameraShake:durationSeconds': 'Duration (seconds)',
  'action:setFlip:flipX': 'Flip horizontal',
  'action:setFlip:flipY': 'Flip vertical',
  'condition:compareHealth:field': 'Health value',
}

export function fieldDisplayLabel(
  kind: ComponentKind,
  type: string,
  fieldName: string,
): string | undefined {
  return FIELD_LABELS[`${kind}:${type}:${fieldName}`]
}

export function enumDisplayLabel(context: string, value: string): string {
  const isDirection =
    context.includes('direction') || context.includes('moveInDirection')
  const isInputEvent =
    context.includes('eventType') || context.includes('onInput') || context.includes('onMouseInput')
  const isMouseButton = context.includes('button')

  if (isDirection) {
    const dir: Record<string, string> = {
      forward: 'Forward (facing)',
      backward: 'Backward',
      up: 'Up',
      down: 'Down',
      left: 'Left',
      right: 'Right',
    }
    if (dir[value]) return dir[value]
  }

  if (context.includes('compareHealth') && value === 'current') return 'Current HP'
  if (context.includes('compareHealth') && value === 'max') return 'Max HP'

  if (isInputEvent && !isMouseButton) {
    const input: Record<string, string> = {
      pressed: 'Just pressed',
      down: 'Held down',
      released: 'Just released',
    }
    if (input[value]) return input[value]
  }

  if (isMouseButton) {
    if (value === 'left') return 'Left mouse'
    if (value === 'right') return 'Right mouse'
  }

  const map: Record<string, string> = {
    none: 'None',
    outline: 'Outline',
    hit_flash: 'Hit flash',
    crt: 'Retro scanlines',
    scanlines: 'Scanlines',
    wave: 'Wave',
    palette_swap: 'Palette swap',
  }
  return map[value] ?? value.replace(/_/g, ' ')
}
