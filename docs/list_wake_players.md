I have a distributed browsr game where each browser keeps its won copt of the DB up to daye.

As each user logs in we send a wake command.. so we can add 'wake' players into a list of currently active players.

But we dont know when they sleep (log off) as they could have their browser in the background or have closed their browser or PC crashed etc..

Every browser calculates the 20second tick and sends that. so every 20 seconds we can determin who is logged in.

We need a global list of active platers in App.js
Each tick (20 seconds) the user sendCommands() to the server so we can pass the players ID to the server.

If we dont get a msg from one or more browsers after 21 seconds we assume they have logged off and remove them from our active player list.

This means the returning msg from sendCommands() needs to have a list of active player Ids.
