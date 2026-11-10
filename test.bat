call prep
where node
node --version
:: node --inspect ... for vscode debugging
node -r ./test/lz-node.cjs --localstorage-file=_storage/local.sqlite test/%1.js

start "" http://localhost

