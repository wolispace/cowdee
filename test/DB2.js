import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

const app = new App({ settings: { name: 'appDB2', generate: true, max: 5 } });

app.tester = new Tester(app);

console.log('-------------- START ----------------');

await fetch('http://localhost/_emptyDB.php');

app.db.memory = testData();
// HACK to mark all as dirty
for (const type of Object.keys(app.db.memory)) {
  for (const prefix of Object.keys(app.db.memory[type])) {
    app.db.markDirty(type, prefix);
  }
}
console.log('name basket', await app.db.get('name', 'basket'));
console.log('id B2', await app.db.get('id', 'B2'));
console.log('id bob', await app.db.get('id', 'bob'));
console.log('code Dw', await app.db.get('code', 'Dw'));
console.log('info B2', await app.db.get('info', 'B2'));

let obj = { id: 'X', class: 'basket', loc: '3', 
  code: 'do nothing', 
  info: 'This is basic' 
};
await app.db.save(obj);

obj = {id: 'wol', loc: '2', class: 'player', name: 'Wolis'};
await app.db.save(obj);

console.log('name basket', await app.db.get('name', 'basket'));
console.log('loc 3', await app.db.get('loc', '3'));
console.log('code X', await app.db.get('code', 'X'));
console.log('info X', await app.db.get('info', 'X'));

//console.log('memory', app.db.toString());
await app.db.saveToDisk();

console.log('-------------- END ----------------');
process.exit(0);

function testData() {
  return {
    name: {
      H: { house: ["2"] },
      L: { library: ["3"] },
      B: { basket: ["2a", "B2"], bob: ["bob"], build: ["Dw"] },
      J: { jane: ["jan"] },
      P: { player: ["bob", "jan"] }
    },
    id: {
      "2": {
        "2": { id: "2", class: "house", loc: "0" },
        "2a": { id: "2a", class: "basket", loc: "2" }
      },
      "3": { "3": { id: "3", class: "library", loc: "0" } },
      "D": { Dw: { id: "Dw", class: "build", loc: "3" } },
      "J": { jan: { id: "jan", class: "player", name: "jane", loc: "3" } },
      "B": {
        bob: { id: "bob", class: "player", name: "bob", loc: "2" },
        B2: { id: "B2", class: "basket", loc: "3" }
      },
    },
    loc: {
      "2": { "2": ["2a", "bob"] },
      "3": { "3": ["jan", "B2"] },
    },
    code: {
      D: {
        Dw: { loc: "3", code: "get $text\nnew $text;" }
      },
    },
    info: {
      D: { Dw: "Use this command to build new locations." },
      B: { B2: "Its a rather special basket" }
    }
  }
}

