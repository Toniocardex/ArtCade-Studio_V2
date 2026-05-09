-- main.lua — ArtCade test project
-- Prints hello on start, logs dt each tick.

print("[Lua] main.lua loaded — ArtCade V2 engine running!")

local t = 0

function tick(dt)
    t = t + dt
    -- Every 2 seconds print a heartbeat
    if math.floor(t) ~= math.floor(t - dt) then
        print(string.format("[Lua] tick  t=%.1f", t))
    end
end
