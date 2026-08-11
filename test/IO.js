import { IO } from "../public/classes/IO.js";

const io = new IO();

//io.flush();

const json = await io.loadJson('id_0');

console.log(json);



