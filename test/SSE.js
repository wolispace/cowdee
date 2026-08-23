import { App } from '../public/classes/App.js';

const app = new App();

console.log('-------------- START ----------------');

await testSSE();

console.log('-------------- END ----------------');
process.exit(0);

async function testSSE() {
  // start an sse session
      
}
