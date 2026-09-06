call prep
where node
node --version
node --inspect --localstorage-file=_storage/local.sqlite test/%1.js

