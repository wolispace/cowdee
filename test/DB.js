import fs from "fs";
import path from "path";
import { Utils } from '../public/classes/Utils.js';
import { DB } from '../public/classes/DB.js';
import { ID } from '../public/classes/ID.js';
import { IO } from '../public/classes/IO.js';
import { Context} from '../public/classes/Context.js';

const app = {anyDirty: false};
app.utils = new Utils(app);
app.io = new IO(app);
app.db = new DB(app);
app.id = new ID(app);


const generate = true;
const max = 10;

console.log('-------------- START ----------------');
app.io.flush();
deleteTestFiles();

if (generate) {
  let counter = 0;
  while (counter++ < max) {
    const obj = {
      id: app.id.new(),
      class: randomName(),
      qty: 1,
      loc: app.id.encodeInt(app.utils.random(max)),
      color: randomColor()
    };
    //  obj.info = `It's a pretty ordinary ${obj.class}`;
    await app.db.save(obj);
    if (counter % 100 === 0) {
      process.stdout.write(":");
    }
  }
}


console.log('-------------- END ----------------');

function deleteTestFiles() {
  const dir = "./_db";
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith(".json")) {
      fs.rmSync(path.join(dir, file), { force: true });
    }
  }
}

function randomName() {
  const names = ['mouse', 'hat', 'card', 'book', 'pen', 'frog', 'table', 'chair', 'basket']
  return names[app.utils.random(names.length)];
}

function randomColor() {
  const names = ['wheat', 'seagreen', 'teal', 'tomato', 'dodgerblue', 'slategrey', 'plum', 'brick']
  return names[app.utils.random(names.length)];
}