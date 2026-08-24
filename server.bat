:: start in the public folder. 
:: TODO: handle starting in a sub folder eg wolispace.com/cowdee

cd public

:: Webs server for json and html etc..
set PORT=8880
start "" http://localhost:%PORT%/
start "Website" "W:\My Drive\Apps\php\php_859\php.exe" -S localhost:%PORT%

:: SSE server - multiple workers so concurrent connections don't block each other
set PORT=8881
start "SSE" "W:\My Drive\Apps\php\php_859\php.exe" -S localhost:%PORT%

cd ..