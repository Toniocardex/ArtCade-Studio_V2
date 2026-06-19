import { INDENT } from './lua-helpers'

export function unsubTrackingLines(): string[] {
  return [
    '',
    `${INDENT}local function _logic_track(unsub)`,
    `${INDENT}if type(unsub) == "function" then`,
    `${INDENT}${INDENT}module._unsubs[#module._unsubs + 1] = unsub`,
    `${INDENT}end`,
    'end',
  ]
}

export const RANDOM_LINES = [
  '',
  '-- Deterministic board-local PRNG. The same event sequence yields the same values',
  '-- in native and WASM builds; malformed/reversed ranges are normalized here.',
  'local _logic_random_state = 1831565813',
  'local function _logic_random_unit()',
  `${INDENT}_logic_random_state = (_logic_random_state * 1664525 + 1013904223) % 4294967296`,
  `${INDENT}return _logic_random_state / 4294967296`,
  'end',
  'local function _logic_random_int(minimum, maximum)',
  `${INDENT}local low = math.ceil(tonumber(minimum) or 0)`,
  `${INDENT}local high = math.floor(tonumber(maximum) or 0)`,
  `${INDENT}if low > high then low, high = high, low end`,
  `${INDENT}return low + math.floor(_logic_random_unit() * (high - low + 1))`,
  'end',
  'local function _logic_random_chance(percent)',
  `${INDENT}local chance = math.max(0, math.min(100, tonumber(percent) or 0))`,
  `${INDENT}return _logic_random_unit() * 100 < chance`,
  'end',
]

export const BAG_UNSUB_LINES = [
  '',
  '-- Remove a specific closure from a {key = {fn, fn, ...}} bag.',
  'local function _logic_bag_unsub(bag, key, fn)',
  `${INDENT}return function()`,
  `${INDENT}${INDENT}if type(bag) ~= "table" then return end`,
  `${INDENT}${INDENT}local list = bag[key]`,
  `${INDENT}${INDENT}if type(list) ~= "table" then return end`,
  `${INDENT}${INDENT}for i = #list, 1, -1 do`,
  `${INDENT}${INDENT}${INDENT}if list[i] == fn then table.remove(list, i); return end`,
  `${INDENT}${INDENT}end`,
  `${INDENT}end`,
  'end',
]

export const COMPOSE_KEY_LINES = [
  '',
  '-- Sensor/animation bags key by source + "\\31" + target. Mirror the runtime.',
  'local function _logic_compose_key(source, target)',
  `${INDENT}return tostring(source or "*") .. "\\31" .. tostring(target or "*")`,
  'end',
]

export const SPAWN_REGISTRATION_LINES = [
  '',
  '-- lifecycle.onSpawn only fires for entities constructed after registration.',
  '-- Replay existing scene instances so edit-time entities run the rule too.',
  'local function _logic_reg_spawn(cls, fn)',
  `${INDENT}lifecycle.onSpawn(cls, fn)`,
  `${INDENT}_logic_track(_logic_bag_unsub(lifecycle._onSpawn, cls, fn))`,
  `${INDENT}for _, eid in ipairs(pool.getAll(cls)) do`,
  `${INDENT}${INDENT}local ok, err = pcall(fn, eid, {})`,
  `${INDENT}${INDENT}if not ok then`,
  `${INDENT}${INDENT}${INDENT}debug.log("[logic] onSpawn replay error: " .. tostring(err))`,
  `${INDENT}${INDENT}end`,
  `${INDENT}end`,
  'end',
]

export const DESTROY_REGISTRATION_LINES = [
  '',
  'local function _logic_reg_destroy(cls, fn)',
  `${INDENT}lifecycle.onDestroy(cls, fn)`,
  `${INDENT}_logic_track(_logic_bag_unsub(lifecycle._onDestroy, cls, fn))`,
  'end',
]

/**
 * Build the prelude helper that registers one animation event kind and tracks
 * its unsubscribe. `helper` is the generated Lua-local name, `method` the
 * runtime `animation.<method>` registrant, `bag` its handler table — the three
 * must stay aligned with animation-api.cpp.
 */
function animRegistrationLines(helper: string, method: string, bag: string): string[] {
  return [
    '',
    `local function ${helper}(source, clip, fn)`,
    `${INDENT}animation.${method}(source, clip, fn)`,
    `${INDENT}_logic_track(_logic_bag_unsub(animation.${bag}, _logic_compose_key(source, clip), fn))`,
    'end',
  ]
}

export const ANIMATION_REGISTRATION_LINES = animRegistrationLines(
  '_logic_reg_anim_end', 'onFinished', '_onFinished')
export const ANIM_START_REGISTRATION_LINES = animRegistrationLines(
  '_logic_reg_anim_start', 'onStart', '_onStart')
export const ANIM_FRAME_REGISTRATION_LINES = animRegistrationLines(
  '_logic_reg_anim_frame', 'onFrame', '_onFrame')
export const ANIM_LOOP_REGISTRATION_LINES = animRegistrationLines(
  '_logic_reg_anim_loop', 'onLoop', '_onLoop')
export const ANIM_CHANGE_REGISTRATION_LINES = animRegistrationLines(
  '_logic_reg_anim_change', 'onChanged', '_onChanged')

export const INPUT_PRESSED_REGISTRATION_LINES = [
  '',
  'local function _logic_reg_input_pressed(code, fn)',
  `${INDENT}input.onPressed(code, fn)`,
  `${INDENT}_logic_track(_logic_bag_unsub(input._onPressed, code, fn))`,
  'end',
]

export const INPUT_RELEASED_REGISTRATION_LINES = [
  '',
  'local function _logic_reg_input_released(code, fn)',
  `${INDENT}input.onReleased(code, fn)`,
  `${INDENT}_logic_track(_logic_bag_unsub(input._onReleased, code, fn))`,
  'end',
]

export const SENSOR_ENTER_REGISTRATION_LINES = [
  '',
  'local function _logic_reg_sensor_enter(source, target, fn)',
  `${INDENT}sensor.onEnter(source, target, fn)`,
  `${INDENT}_logic_track(_logic_bag_unsub(sensor._onEnter, _logic_compose_key(source, target), fn))`,
  'end',
]

export const SENSOR_EXIT_REGISTRATION_LINES = [
  '',
  'local function _logic_reg_sensor_exit(source, target, fn)',
  `${INDENT}sensor.onExit(source, target, fn)`,
  `${INDENT}_logic_track(_logic_bag_unsub(sensor._onExit, _logic_compose_key(source, target), fn))`,
  'end',
]

export const MESSAGE_REGISTRATION_LINES = [
  '',
  'local function _logic_reg_message(name, fn)',
  `${INDENT}_logic_track(event.on(name, fn))`,
  'end',
]

export const TIMER_EVERY_REGISTRATION_LINES = [
  '',
  'local function _logic_reg_timer_every(seconds, fn)',
  `${INDENT}_logic_track(time.every(seconds, fn))`,
  'end',
]

export const TIMER_AFTER_REGISTRATION_LINES = [
  '',
  '-- time.after / time.delay are one-shot and self-clean on fire; guard',
  '-- hot-reload double-fire with a per-compile gate token.',
  'local function _logic_reg_timer_after(seconds, fn)',
  `${INDENT}local gate = module._unsubs`,
  `${INDENT}time.after(seconds, function()`,
  `${INDENT}${INDENT}if module._unsubs ~= gate then return end`,
  `${INDENT}${INDENT}fn()`,
  `${INDENT}end)`,
  'end',
]

export const COLLISION_EDGE_STATE_LINES = [
  '-- Per (entity, otherClass) "was touching last frame" memory for',
  '-- onCollisionEnter / onCollisionExit edges.',
  'local _collision_was_touching = {}',
]

export const TEXT_TO_STRING_LINES = [
  '-- Number to string for Set Text: integral floats print as integers.',
  'local function _logic_tostr(v)',
  `${INDENT}if type(v) == "number" then return tostring(math.tointeger(v) or v) end`,
  `${INDENT}return tostring(v)`,
  'end',
]

export const TEXT_FORMAT_LINES = [
  '-- Number formatting for Set Text / bound Text labels.',
  'local function _logic_fmt(v, fmt, digits)',
  `${INDENT}if fmt == nil or fmt == "text" then return _logic_tostr(v) end`,
  `${INDENT}local n = tonumber(v) or 0`,
  `${INDENT}if fmt == "integer" then`,
  `${INDENT}${INDENT}return string.format("%d", math.floor(n + 0.5))`,
  `${INDENT}elseif fmt == "padded" then`,
  `${INDENT}${INDENT}return string.format("%0" .. tostring(math.floor(digits or 0)) .. "d", math.floor(n + 0.5))`,
  `${INDENT}elseif fmt == "time" then`,
  `${INDENT}${INDENT}local s = math.floor(n + 0.5); if s < 0 then s = 0 end`,
  `${INDENT}${INDENT}return string.format("%d:%02d", math.floor(s / 60), s % 60)`,
  `${INDENT}elseif fmt == "percent" then`,
  `${INDENT}${INDENT}return string.format("%d", math.floor(n + 0.5)) .. "%"`,
  `${INDENT}elseif fmt == "decimals" then`,
  `${INDENT}${INDENT}return string.format("%." .. tostring(math.floor(digits or 0)) .. "f", n)`,
  `${INDENT}end`,
  `${INDENT}return _logic_tostr(v)`,
  'end',
]

export const COLLISION_EDGE_HELPER_LINES = [
  'local function _logic_collision_edge(eid, cls, want_enter)',
  `${INDENT}local key = tostring(eid) .. ":" .. cls`,
  `${INDENT}local cur = collision.touchingClass(eid, cls)`,
  `${INDENT}local prev = _collision_was_touching[key] or false`,
  `${INDENT}_collision_was_touching[key] = cur`,
  `${INDENT}if want_enter then return cur and not prev end`,
  `${INDENT}return prev and not cur`,
  'end',
]

export const MOVEMENT_LINES = [
  'local _logic_movement_known = {}',
  'local _logic_movement_frame = nil',
  '',
  'local function _logic_add_movement(entityId, x, y)',
  `${INDENT}if _logic_movement_frame == nil or entityId == nil then return end`,
  `${INDENT}local m = _logic_movement_frame[entityId]`,
  `${INDENT}if not m then`,
  `${INDENT}${INDENT}m = { x = 0, y = 0 }`,
  `${INDENT}${INDENT}_logic_movement_frame[entityId] = m`,
  `${INDENT}end`,
  `${INDENT}m.x = m.x + x`,
  `${INDENT}m.y = m.y + y`,
  'end',
  '',
  'local function _logic_flush_movement()',
  `${INDENT}if _logic_movement_frame == nil then return end`,
  `${INDENT}for entityId, m in pairs(_logic_movement_frame) do`,
  `${INDENT}${INDENT}if m.x ~= 0 or m.y ~= 0 then`,
  `${INDENT}${INDENT}${INDENT}movement.setIntent(entityId, m.x, m.y)`,
  `${INDENT}${INDENT}else`,
  `${INDENT}${INDENT}${INDENT}movement.clearIntent(entityId)`,
  `${INDENT}${INDENT}end`,
  `${INDENT}${INDENT}_logic_movement_known[entityId] = true`,
  `${INDENT}end`,
  `${INDENT}for entityId, _ in pairs(_logic_movement_known) do`,
  `${INDENT}${INDENT}if _logic_movement_frame[entityId] == nil then`,
  `${INDENT}${INDENT}${INDENT}movement.clearIntent(entityId)`,
  `${INDENT}${INDENT}${INDENT}_logic_movement_known[entityId] = nil`,
  `${INDENT}${INDENT}end`,
  `${INDENT}end`,
  `${INDENT}_logic_movement_frame = nil`,
  'end',
]
