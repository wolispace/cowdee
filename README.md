# Distributed cow - cowdee

No dependances, no database.
All command processing happens in the browser.
The server simply shuttles commands and files around.

- Each user command is bumdled into a context, which sent to the server
- The server gives each a timestamp combines with player ID so they are sorted cronologically and unique
- All new contexts, each browser has not seent, is sent to them and processed in order.
- Psudo random numbers are derived from the timestamp and used for constsent randomness in each browser
- A counter used to keep track to the next id to generate ia also included in the contexts so each new object gets a conststent ID
- Browsers send data back to server for new users to catch up 

https://wolispace.com/cowdee

Current functional code = 200kB 
Initial test DB = 30kB

