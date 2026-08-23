import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

const app = new App({
  debug: true,
  headless: true,
  settings: {
    generate: true,
    max: 5,
  }
});

app.tester = new Tester(app);

console.log('-------------- START ----------------');

if (app.settings.generate) {
  app.io.flush();
  app.tester.deleteTestFiles();
  await app.tester.initObjects();
  await app.tester.initPlayers();
  await app.tester.initCommands();
  await app.db.savePoolsToDisk();
}

console.log('-------------- END ----------------');
process.exit(0);
