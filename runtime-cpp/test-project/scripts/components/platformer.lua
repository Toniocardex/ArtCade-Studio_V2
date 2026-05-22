-- =============================================================================
-- PlatformerController — Logic Component
-- Horizontal movement + jump for physics-based platform characters.
-- Requires entity to have a Box2D dynamic body (physics.createBody).
--
-- Usage:
--   local ctrl = Platformer.new(entityId, {
--       speed       = 200,
--       jumpForce   = 450,
--       groundClass = "Ground",
--       coyoteTime  = 0.1,    -- seconds after leaving ground where jump still works
--       jumpBuffer  = 0.1,    -- seconds before landing where jump input is buffered
--   })
--   ctrl:update(dt)     -- call every tick for physics integration
--   ctrl:isGrounded()   -- bool
--   ctrl:setEnabled(bool)
-- =============================================================================

Platformer = {}
Platformer.__index = Platformer

function Platformer.new(entityId, cfg)
    cfg = cfg or {}
    local self = setmetatable({}, Platformer)
    self.id          = entityId
    self.speed       = cfg.speed       or 200
    self.jumpForce   = cfg.jumpForce   or 450
    self.groundClass = cfg.groundClass or "Ground"
    self.coyoteTime  = cfg.coyoteTime  or 0.10
    self.jumpBuffer  = cfg.jumpBuffer  or 0.10

    self._grounded        = false
    self._coyoteTimer     = 0
    self._jumpBufferTimer = 0
    self._enabled         = true
    self._jumpRequested   = false
    self._moveKeys        = {}

    local jumpCodes = { "Space", "KeyW", "ArrowUp" }
    for _, code in ipairs(jumpCodes) do
        input.onPressed(code, function()
            self._jumpRequested = true
            platformer.requestJump(self.id)
        end)
    end

    local moveCodes = { "KeyA", "ArrowLeft", "KeyD", "ArrowRight" }
    for _, code in ipairs(moveCodes) do
        self._moveKeys[code] = input.isKeyDown(code)
        input.onPressed(code, function() self._moveKeys[code] = true end)
        input.onReleased(code, function() self._moveKeys[code] = false end)
    end

    return self
end

function Platformer:update(dt)
    if not self._enabled then return end

    -- ---- Ground detection ----
    self._grounded = collision.touchingClass(self.id, self.groundClass)

    if self._grounded then
        self._coyoteTimer = self.coyoteTime
    else
        self._coyoteTimer = math.max(0, self._coyoteTimer - dt)
    end

    -- ---- Jump input buffering ----
    local jumpPressed = self._jumpRequested
    self._jumpRequested = false
    if jumpPressed then
        self._jumpBufferTimer = self.jumpBuffer
    else
        self._jumpBufferTimer = math.max(0, self._jumpBufferTimer - dt)
    end

    -- ---- Read current velocity ----
    local vx, vy = entity.velocity(self.id)

    -- ---- Horizontal ----
    local dx = 0
    if self._moveKeys["KeyA"] or self._moveKeys["ArrowLeft"]  then dx = dx - 1 end
    if self._moveKeys["KeyD"] or self._moveKeys["ArrowRight"] then dx = dx + 1 end
    vx = dx * self.speed
    movement.setIntent(self.id, dx, 0)

    -- ---- Jump ----
    if self._jumpBufferTimer > 0 and self._coyoteTimer > 0 then
        vy = -self.jumpForce
        self._coyoteTimer     = 0
        self._jumpBufferTimer = 0
        if event and event.emit then
            event.emit("platformer.jump", { id = self.id })
        end
    end

    entity.setVelocity(self.id, vx, vy)
end

-- Returns true if on the ground (or within coyote window).
function Platformer:isGrounded()
    return self._grounded
end

-- Enable / disable the controller without destroying it.
function Platformer:setEnabled(flag)
    self._enabled = flag
    if not flag then
        entity.setVelocity(self.id, 0, 0)
        movement.clearIntent(self.id)
    end
end
