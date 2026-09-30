
Author: Anita Crimp

The server generates a timestamp, send within each context as:
{"ts":1790759883307, ...}

classes/SSE.js picks up the contexts from the server so this is probably the best/first place to check the timestamp in work out if we have tick timers set.

When we read the first context, we need to use the timestamp to initialise 3 timers:
- every 20 seconds at :00, :20, :40 (tick)
- every hour at 00:05 (5 mins into the hour, tickhour)
- every day at 00:10 (10 mins after midnight, tickday)

All browsers read this timestamp from the first read context and align the timers to run at the exact same synchronized times relative to context.ts.

Backward compatibility:
- Any object code containing `##tickloc:` is automatically treated as `##tick:`.
- All browsers run all ticks to keep state synchronized across clients.
- Location-based message visibility is handled automatically by the UI layer (UI.js only shows messages if the player is in that location).

When each interval fires, it runs app.runTick(type), where type is: tick, tickhour, or tickday.
