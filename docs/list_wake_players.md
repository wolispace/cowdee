every request to the server send the current users pid.. which is id-loc eg: '_2-_g5'

The server saves this in _players as _2-g5.txt

Each response returns players: ['_2-g5', ...] all of the current pids

While gathering them it deletes any older than 20 seconds

When recieing players, we split into app.activePlayers and app.activeLocations

At any point we can list current players and only run ticks within all of the active locations

To list players, we can pre-load all payer ids and all locations to build a list of players showing where they currently are.

