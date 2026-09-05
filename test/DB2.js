import { App } from '../public/classes/App.js';
import { Tester } from './Tester2.js';

const app = new App({ settings: { name: 'initApp', generate: true, max: 5 } });

app.tester = new Tester(app);

console.log('-------------- START ----------------');

app.db.memory = testData();
console.log('name basket', await app.db.get('name', 'basket'));
console.log('id B2', await app.db.get('id', 'B2'));
console.log('id bob', await app.db.get('id', 'bob'));

await app.db.add({id:'X', name:'basket', loc: '3', code: 'do nothing', info: 'This is basic'});
console.log('name basket', await app.db.get('name', 'basket'));
console.log('loc 3', await app.db.get('loc', '3'));
console.log('code X', await app.db.get('code', 'X'));
console.log('info X', await app.db.get('info', 'X'));

//console.log('memory', app.db.toString());

console.log('-------------- END ----------------');
process.exit(0);

function testData() {
  return {
    name: {
      H: { house: ["2"] },
      L: { library: ["3"] },
      B: { basket: ["2a", "B2"], bob: ["bob"], build: ["Dw"] },
      J: { jane: ["jan"] },
    },
    id: {
      "2": { "2": { id: "2", name: "house", loc: "0" }, 
             "2a": { id: "2a", name: "basket", loc: "2" } },
      "3": { "3": { id: "3", name: "library", loc: "0" } },
      "D": { Dw: { id: "Dw", name: "build", loc: "3" } },
      "J": { jan: { id: "jan", name: "jane", loc: "3" } },
      "B": { bob: { id: "bob", name: "bob", loc: "2" }, 
             B2: { id: "B2", name: "basket", loc: "3" } },
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

