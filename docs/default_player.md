When /classes/App.js starts (and its in the browser) it prompts for a player name, finds that player, prompts for the password, checks its valid, the starts the game for that player.

The player's id is used to namespace the local storage so two browser tabs can be logged in as different users.

I a checkbox 'Remember me' on the initial dialog tha prompts for a player name.

If set we store the players ID in un-namespaced local storage. 

Next time the browser opens it checks for this id, if present simply logges in as that player without prompt for name or password.

Log out will clear this un-namespaced ID and present the playername login dialog as normal.

I think an incogneto tab is all that is needed to have two players loged in testing on the same PC at the same time.. in which case maybe we dont need the namespaced local storage.

The importat part of all this is not just an auto-login as the last user you logged in as but the restoring of history of your last commands.

If you find that local storage doesnt need to be namespaced (as I simply use incogneto mode to be any number of new/different concurrent players). That hopefully simplifies the local strorage.

One fineal tidy up.. we use this.app.player.info.loc and .info.history etc.. so we simply store whatever is in player.info into and outof local storage.

This seems a redundant extra lavel, so maybe we simplify how we get player details eg this.app.player.id and player.loc .. at the expence of a slitly more specific player.load() and .save() so we are not writing more than we need into local storage for retrieval next login.

Please review the code and let me know what you think about simplifying player, and remember last logged in player plus remembering previous history.

