-- =============================================================================
-- ArtCade Phase 13 — Integration Demo
-- Controls: WASD / Arrow keys to move   ESC shown in log
-- Goal: exercise entity, input, pool, collision, state, debug APIs together
-- =============================================================================

print("[Demo] ArtCade Phase 13 Demo loaded!")

-- ---------------------------------------------------------------------------
-- Constants
-- ---------------------------------------------------------------------------
local SPEED        = 220      -- px / second
local PLAYER_SIZE  = 28       -- half-extent for rect draw
local ENEMY_SIZE   = 22
local COIN_SIZE    = 14
local COIN_RANGE   = 30       -- pick-up radius
local ENEMY_RANGE  = 50       -- "danger" radius
local SCREEN_W     = 1280
local SCREEN_H     = 720
local LOG_INTERVAL = 2        -- seconds between heartbeat log lines

-- ---------------------------------------------------------------------------
-- Runtime state (tracked in Lua — state.get() returns nil in this build)
-- ---------------------------------------------------------------------------
local t            = 0
local frameCount   = 0
local lastLog      = 0
local score        = 0
local alive        = true     -- false when player touches enemy

local playerId     = nil
local enemyIds     = {}
local coinIds      = {}

-- Enemy patrol data
local enemyData    = {}       -- keyed by entityId, {ox,oy,dir,speed}

-- ---------------------------------------------------------------------------
-- Helper: simple distance
-- ---------------------------------------------------------------------------
local function dist(ax, ay, bx, by)
    local dx = ax - bx
    local dy = ay - by
    return math.sqrt(dx*dx + dy*dy)
end

-- ---------------------------------------------------------------------------
-- Helper: clamp
-- ---------------------------------------------------------------------------
local function clamp(v, lo, hi)
    return math.max(lo, math.min(hi, v))
end

-- ---------------------------------------------------------------------------
-- Initialise — called once on first tick
-- ---------------------------------------------------------------------------
local function init()
    -- Find player
    local players = pool.getAll("Player")
    if #players > 0 then
        playerId = players[1]
        debug.log("Player found  id=" .. tostring(playerId))
    else
        debug.log("WARNING: no Player entity found!")
    end

    -- Find enemies and set up patrol
    enemyIds = pool.getAll("Enemy")
    debug.log("Enemies found: " .. tostring(#enemyIds))
    for _, eid in ipairs(enemyIds) do
        local ex, ey = entity.position(eid)
        enemyData[eid] = {
            ox    = ex,
            oy    = ey,
            dir   = (eid % 2 == 0) and 1 or -1,
            speed = 60 + eid * 20,
            range = 180,
        }
    end

    -- Find coins
    coinIds = pool.getAll("Coin")
    debug.log("Coins found: " .. tostring(#coinIds))

    -- Initialise score in global state
    state.set("score", 0)
    state.set("alive", 1)

    debug.log("Init complete  WASD / Arrow keys to move")
end

-- ---------------------------------------------------------------------------
-- Update enemies (horizontal patrol)
-- ---------------------------------------------------------------------------
local function updateEnemies(dt)
    for _, eid in ipairs(enemyIds) do
        local d = enemyData[eid]
        if not d then goto continue end

        local ex, ey = entity.position(eid)
        ex = ex + d.dir * d.speed * dt

        -- Bounce on patrol range boundaries
        if ex > d.ox + d.range then
            ex  = d.ox + d.range
            d.dir = -1
        elseif ex < d.ox - d.range then
            ex  = d.ox - d.range
            d.dir = 1
        end

        entity.setPosition(eid, ex, ey)

        ::continue::
    end
end

-- ---------------------------------------------------------------------------
-- Check coin collection
-- ---------------------------------------------------------------------------
local function checkCoins(px, py)
    local toRemove = {}
    for i, cid in ipairs(coinIds) do
        local cx, cy = entity.position(cid)
        if dist(px, py, cx, cy) < COIN_RANGE then
            score = score + 10
            state.set("score", score)
            debug.log("Coin collected!  score=" .. tostring(score))
            entity.destroy(cid)
            table.insert(toRemove, i)
        end
    end
    -- Remove collected coins from local list (reverse to keep indices valid)
    for i = #toRemove, 1, -1 do
        table.remove(coinIds, toRemove[i])
    end
end

-- ---------------------------------------------------------------------------
-- Check enemy contact
-- ---------------------------------------------------------------------------
local function checkEnemies(px, py)
    for _, eid in ipairs(enemyIds) do
        local ex, ey = entity.position(eid)
        if dist(px, py, ex, ey) < ENEMY_RANGE then
            if alive then
                alive = false
                state.set("alive", 0)
                debug.log("=== PLAYER HIT by enemy " .. tostring(eid) .. " — score=" .. tostring(score) .. " ===")
            end
            return
        end
    end
    alive = true
end

-- ---------------------------------------------------------------------------
-- Draw helpers
-- ---------------------------------------------------------------------------
local function drawEntities()
    -- Player
    if playerId then
        local px, py = entity.position(playerId)
        local col = alive and "blue" or "magenta"
        debug.drawRect(px - PLAYER_SIZE, py - PLAYER_SIZE,
                       PLAYER_SIZE * 2,  PLAYER_SIZE * 2, col)
        -- Eyes (simple dots drawn as small rects)
        debug.drawRect(px - 8, py - 6, 5, 5, "white")
        debug.drawRect(px + 4, py - 6, 5, 5, "white")
    end

    -- Enemies
    for _, eid in ipairs(enemyIds) do
        local ex, ey = entity.position(eid)
        -- Draw body
        debug.drawRect(ex - ENEMY_SIZE, ey - ENEMY_SIZE,
                       ENEMY_SIZE * 2,  ENEMY_SIZE * 2, "red")
        -- Draw danger radius outline (4 corner lines)
        local r = ENEMY_RANGE
        debug.drawLine(ex - r, ey - r, ex + r, ey - r, "red")
        debug.drawLine(ex + r, ey - r, ex + r, ey + r, "red")
        debug.drawLine(ex + r, ey + r, ex - r, ey + r, "red")
        debug.drawLine(ex - r, ey + r, ex - r, ey - r, "red")
    end

    -- Coins
    for _, cid in ipairs(coinIds) do
        local cx, cy = entity.position(cid)
        debug.drawRect(cx - COIN_SIZE, cy - COIN_SIZE,
                       COIN_SIZE * 2,  COIN_SIZE * 2, "yellow")
    end
end

-- ---------------------------------------------------------------------------
-- Screen border (walls)
-- ---------------------------------------------------------------------------
local BORDER = 2
local function drawBorder()
    debug.drawLine(BORDER,          BORDER,           SCREEN_W - BORDER, BORDER,           "white")
    debug.drawLine(SCREEN_W-BORDER, BORDER,           SCREEN_W - BORDER, SCREEN_H - BORDER,"white")
    debug.drawLine(SCREEN_W-BORDER, SCREEN_H - BORDER,BORDER,            SCREEN_H - BORDER,"white")
    debug.drawLine(BORDER,          SCREEN_H - BORDER, BORDER,           BORDER,           "white")
end

-- ---------------------------------------------------------------------------
-- Main tick (called by engine at targetFPS)
-- ---------------------------------------------------------------------------
local initialized = false

function tick(dt)
    -- One-shot init
    if not initialized then
        init()
        initialized = true
    end

    t          = t + dt
    frameCount = frameCount + 1

    -- ---- Update enemies ----
    updateEnemies(dt)

    -- ---- Player input & movement ----
    if playerId and alive then
        local px, py = entity.position(playerId)
        local dx, dy = 0, 0

        if input.isKeyDown("KeyW") or input.isKeyDown("ArrowUp")    then dy = dy - 1 end
        if input.isKeyDown("KeyS") or input.isKeyDown("ArrowDown")  then dy = dy + 1 end
        if input.isKeyDown("KeyA") or input.isKeyDown("ArrowLeft")  then dx = dx - 1 end
        if input.isKeyDown("KeyD") or input.isKeyDown("ArrowRight") then dx = dx + 1 end

        -- Diagonal normalisation
        if dx ~= 0 and dy ~= 0 then
            dx = dx * 0.7071
            dy = dy * 0.7071
        end

        px = clamp(px + dx * SPEED * dt, PLAYER_SIZE, SCREEN_W - PLAYER_SIZE)
        py = clamp(py + dy * SPEED * dt, PLAYER_SIZE, SCREEN_H - PLAYER_SIZE)
        entity.setPosition(playerId, px, py)

        checkCoins(px, py)
        checkEnemies(px, py)
    end

    -- ---- Draw everything ----
    drawBorder()
    drawEntities()

    -- ---- Heartbeat log ----
    if t - lastLog >= LOG_INTERVAL then
        lastLog = t
        local px, py = 0, 0
        if playerId then px, py = entity.position(playerId) end
        debug.log(string.format(
            "t=%.0fs  score=%d  coins=%d  enemies=%d  pos=(%.0f,%.0f)  alive=%s  fps~%d",
            t, score, #coinIds, #enemyIds,
            px, py, tostring(alive), math.floor(frameCount / t + 0.5)
        ))
    end
end
