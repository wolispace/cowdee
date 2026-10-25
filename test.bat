call prep
where node
node --version
:: node --inspect ... for vscode debugging
node --localstorage-file=_storage/local.sqlite test/%1.js

start "" http://localhost

