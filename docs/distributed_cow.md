# cowdee - distributed cow

## Aim
No centralised server that processes commands and performs logic.

This simplifies the server code to just a file manager, sharing and storing files.

Each browser that connects to the server processes commands in sequence keeping theor local set of data files up-to-date.

Periodically, any browser can send its copy of files back to the sever so new players can quickly catch up to the latest version of the data.

## terminology

Players send commands, each one is assigned, by the server, a unique incremental integer id (cid)

Ids of objects are stored in base62 eg {id:"Ag2", class="cup", loc:"d8", host:"eW"}

Data is stored in json format. It is split into types (id, name, loc etc..) and ids within those in base 62 form. eg index_name_A.json holds all names starting with 'A'

A data_cid.txt is stored on the server, along with the json data, that stores the highest know cid at the time the data was written to disk.

Messages are shown to the user as the result of running cowscript.

Cowscript is a series of cowmands (as compared to commands players type)

Player commands are parsed and the coresponding object holding the cowscript of that command is executed, to modify the data and generate messages.

Browsers connect to the server in two ways:
- Server side events (SSE) for comminicating what the latest player command send to the sever was.
- fetch to post commands and transfer json data files

## How
Every player browser holds the highest cid they know about, new players and new browser sessions cid=0.

When processing cowscript cowmands, each request for an object first interogates local memory for the data file. If not found it is fetched from the server and sotred in memory.

Each player command is fetch posted to the sever.

It adds it to a sequential file and increments the sid for it.

SSE sends this command and sid to all players.

Each player processes each command in sequence, updting their local memory, loading shared data as needed.

Each time a local data file is modified during a cowmand, its name is added to a list of dirty files.

During idle time, each browser fetches the server's cid for the data on disk and if < than the browsers cid then 
- a fetch is used to SSE inform other browsers a save is in progress
- all of dirty data files are sent back to the server
- the servers data cid is updated
- all commands with cids older than the data cid are removed from the list of commands
- another fetch is used to SSE inform other browsers a save is complete

All the while players are fetch posting commands, adding to the list of commands, increasing the cid.

## Issues
- If another browser has not recieved a SSE informing the save was complete after x minutes, it sends a detch to SSE the other broesers the save failed and it will take over the save, repleating the above steps.


