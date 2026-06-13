import type {
  LogicComponentValueProperty,
  LogicExpressionOperator,
} from '../../types/logic-board'

export const VALUE_SOURCE_OPTIONS = [
  { value: 'literal', label: 'Literal' },
  { value: 'global', label: 'Global variable' },
  { value: 'local', label: 'Object variable' },
  { value: 'entity', label: 'Object property' },
  { value: 'component', label: 'Component property' },
  { value: 'message', label: 'Message field' },
  { value: 'random', label: 'Random integer' },
  { value: 'expression', label: 'Expression' },
]

export const ENTITY_PROPERTY_OPTIONS = [
  { value: 'positionX', label: 'Position X' },
  { value: 'positionY', label: 'Position Y' },
  { value: 'velocityX', label: 'Velocity X' },
  { value: 'velocityY', label: 'Velocity Y' },
  { value: 'speed', label: 'Speed' },
  { value: 'healthCurrent', label: 'Current health' },
  { value: 'healthMax', label: 'Maximum health' },
]

export const COMPONENT_PROPERTY_OPTIONS: Array<{
  value: LogicComponentValueProperty
  label: string
}> = [
  { value: 'platformer.maxSpeed', label: 'Platformer / Max speed' },
  { value: 'platformer.jumpForce', label: 'Platformer / Jump force' },
  { value: 'platformer.customGravity', label: 'Platformer / Gravity' },
  { value: 'platformer.coyoteTime', label: 'Platformer / Coyote time' },
  { value: 'platformer.jumpBuffer', label: 'Platformer / Jump buffer' },
  { value: 'platformer.grounded', label: 'Platformer / Grounded' },
  { value: 'topDown.maxSpeed', label: 'Top-down / Max speed' },
  { value: 'topDown.acceleration', label: 'Top-down / Acceleration' },
  { value: 'topDown.friction', label: 'Top-down / Friction' },
  { value: 'topDown.fourDirections', label: 'Top-down / Four directions' },
  { value: 'linearMover.directionX', label: 'Linear mover / Direction X' },
  { value: 'linearMover.directionY', label: 'Linear mover / Direction Y' },
  { value: 'linearMover.speed', label: 'Linear mover / Speed' },
  { value: 'linearMover.paused', label: 'Linear mover / Paused' },
  { value: 'cameraTarget.offsetX', label: 'Camera target / Offset X' },
  { value: 'cameraTarget.offsetY', label: 'Camera target / Offset Y' },
  { value: 'cameraTarget.followSpeed', label: 'Camera target / Follow speed' },
  { value: 'magnet.enabled', label: 'Magnet / Enabled' },
  { value: 'magnet.attractTag', label: 'Magnet / Attract tag' },
  { value: 'magnet.radius', label: 'Magnet / Radius' },
  { value: 'magnet.pullSpeed', label: 'Magnet / Pull speed' },
  { value: 'horde.targetClass', label: 'Horde / Target class' },
  { value: 'horde.maxSpeed', label: 'Horde / Max speed' },
  { value: 'horde.separationRadius', label: 'Horde / Separation radius' },
  { value: 'horde.separationWeight', label: 'Horde / Separation weight' },
  { value: 'horde.chaseWeight', label: 'Horde / Chase weight' },
  { value: 'autoDestroy.lifespan', label: 'Auto destroy / Lifespan' },
  { value: 'autoDestroy.elapsed', label: 'Auto destroy / Elapsed' },
  { value: 'autoDestroy.remaining', label: 'Auto destroy / Remaining' },
  { value: 'sensor.targetTag', label: 'Sensor / Target tag' },
  { value: 'solid.groundClass', label: 'Platform surface / Ground class' },
  { value: 'solid.surfaceKind', label: 'Platform surface / Surface kind' },
  { value: 'text.text', label: 'Text / Content' },
  { value: 'text.size', label: 'Text / Size' },
  { value: 'text.align', label: 'Text / Align' },
]

export const EXPRESSION_OPERATOR_OPTIONS: Array<{
  value: LogicExpressionOperator
  label: string
}> = [
  { value: 'add', label: '+ Add' },
  { value: 'subtract', label: '- Subtract' },
  { value: 'multiply', label: 'x Multiply' },
  { value: 'divide', label: '/ Divide' },
  { value: 'modulo', label: '% Modulo' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'power', label: 'Power' },
]
