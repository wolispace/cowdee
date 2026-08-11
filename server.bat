:: this will all be one port and one webserver on the host, this is just for dev to use php -S
:: SSE needs to hold the session open so the other requests dont get a lookin

:: Webs server for json and html etc..
set PORT=8880
start "" http://localhost:%PORT%/public/
start "Website" "W:\My Drive\Apps\php\php_859\php.exe" -S localhost:%PORT%

:: SSE server - multiple workers so concurrent connections don't block each other
set PORT=8881
:: start "SSE" "W:\My Drive\Apps\php\php_859\php.exe" -S localhost:%PORT%