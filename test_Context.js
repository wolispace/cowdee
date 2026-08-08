import { Context } from "./public/classes/Context.js";
import fs from "fs";

const contexts = [];

const dir = 'public/_contexts';
  for (const filename of fs.readdirSync(dir)) {
    
    const content = JSON.parse(fs.readFileSync(`${dir}/${filename}`, `utf8`));
    const context = new Context(content);
    contexts.push(context);
  }

  for (const context of contexts) {
    console.log(context.seed, context.random(9), context.random(9), context.random(9));
    context.seed = 100;
    console.log(context.seed, context.random(9), context.random(9), context.random(9));
  }

  