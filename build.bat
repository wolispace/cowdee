:: bundle all classes/ files into one, then run perser over it

:: first strip all 'export' eg 'export class IO ...' becomes 'class IO ...'
:: strip all imports

:: Name each class to combine, in order of how App.js sets them, App.js last. 

set INPUTPATH=public\classes
set OUTPUTPATH=_bundle

set ALLFILES=_classes.js
echo. > "%ALLFILES%"
type "%INPUTPATH%\Storage.js" >> "%ALLFILES%"
type "%INPUTPATH%\Utils.js" >> "%ALLFILES%"
type "%INPUTPATH%\IO.js" >> "%ALLFILES%"
type "%INPUTPATH%\UI.js" >> "%ALLFILES%"
type "%INPUTPATH%\DB.js" >> "%ALLFILES%"
type "%INPUTPATH%\ID.js" >> "%ALLFILES%"
type "%INPUTPATH%\Player.js" >> "%ALLFILES%"
type "%INPUTPATH%\LookManager.js" >> "%ALLFILES%"
type "%INPUTPATH%\Markdown.js" >> "%ALLFILES%"
type "%INPUTPATH%\SSE.js" >> "%ALLFILES%"
type "%INPUTPATH%\SetMap.js" >> "%ALLFILES%"
type "%INPUTPATH%\App.js" >> "%ALLFILES%"

terser "%ALLFILES%" --output _classes.min.js --compressed

