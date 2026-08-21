import fs from "fs";
import path from "path";
import { Utils } from '../public/classes/Utils.js';
import { DB } from '../public/classes/DB.js';
import { ID } from '../public/classes/ID.js';
import { IO } from '../public/classes/IO.js';
import { Player } from '../public/classes/Player.js';
import { LookManager } from '../public/classes/LookManager.js';
import { Context } from '../public/classes/Context.js';
import { Tester } from './Tester.js';

/**
 * In-memory Storage mock for isolated client storage in Node.js
 */
class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

/**
 * Headless UI mock to record client output without DOM
 */
class HeadlessUI {
  constructor(app) {
    this.app = app;
    this.messages = [];
    this.topView = '';
  }

  async addMessage(context) {
    // Spatial check: only show if in same location or broadcast
    if (context.loc && this.app.player.info.loc && context.loc !== this.app.player.info.loc) {
      return;
    }

    if (context?.target) {
      this.app.player.info.lastt = context.target;
    }

    context.playerId = this.app.player.info.id;
    const textMsg = await this.expand(context, 'text');
    if (textMsg) {
      this.messages.push({
        text: textMsg,
        raw: context.msg,
        trigger: context.trigger,
        loc: context.loc,
        actor: context.actor,
        top: context.top || false
      });
      if (context.top) {
        this.topView = textMsg;
      }
    }
    return textMsg;
  }

  async expand(context, format = 'text') {
    let msg = context.msg;
    if (!msg) return '';

    // Simple template expansions
    msg = msg.replaceAll('$actor', context.actor || '');
    msg = msg.replaceAll('$target', context.target || '');
    msg = msg.replaceAll('$second', context.second || '');
    msg = msg.replaceAll('$loc', context.loc || '');
    msg = msg.replaceAll('$prefix', context.prefix || '');
    msg = msg.replaceAll('$text', context.text || '');

    // Replace [id] with object name/class if available
    const matches = msg.match(/\[(.*?)\]/g);
    if (matches) {
      for (const match of matches) {
        const id = match.slice(1, -1);
        const obj = await this.app.db.getById(id);
        if (obj) {
          const label = obj.name || obj.class || id;
          msg = msg.replaceAll(match, label);
        }
      }
    }
    return msg;
  }

  showDialog() {}
  closeDialog() {}
}

/**
 * Shared Context Bus simulating the SSE / server broadcast hub
 */
export class ContextHub {
  constructor() {
    this.clients = [];
    this.history = [];
    this.globalCounter = 1;
  }

  register(client) {
    this.clients.push(client);
    client.hub = this;
  }

  async broadcast(rawContext) {
    if (!rawContext.ts) rawContext.ts = Date.now();
    if (!rawContext.counter) rawContext.counter = this.globalCounter;
    if (rawContext.counter > this.globalCounter) {
      this.globalCounter = rawContext.counter;
    }

    this.history.push(rawContext);

    // Dispatch sequentially or concurrently to all connected clients
    for (const client of this.clients) {
      await client.receiveContext(rawContext);
    }
  }
}

/**
 * Simulated client application instance for a player
 */
export class SimulatedClient {
  constructor(name, playerId, startLoc = '2', hub = null) {
    this.name = name;
    this.debug = true;
    this.lastContext = '0';
    this.storage = new MemoryStorage();

    // Wire up app components
    this.utils = new Utils(this);
    this.io = new IO(this);
    this.db = new DB(this);
    this.id = new ID(this);
    this.ui = new HeadlessUI(this);
    this.player = new Player(this);
    this.lookManager = new LookManager(this);

    // Initial player info
    this.player.info = { id: playerId, name: name, loc: startLoc };

    if (hub) {
      hub.register(this);
    }
  }

  seen(key) {
    if (this.lastContext >= key) {
      return true;
    }
    this.lastContext = key;
    return false;
  }

  async sendCommand(cmdText) {
    console.log(`\n▶ [${this.name} (${this.player.info.id}) @ Loc ${this.player.info.loc}] runs: "${cmdText}"`);
    const rawContext = {
      ts: Date.now(),
      actor: this.player.info.id,
      loc: this.player.info.loc,
      cmd: cmdText,
      counter: this.id.counter
    };

    if (this.hub) {
      await this.hub.broadcast(rawContext);
    } else {
      await this.receiveContext(rawContext);
    }
  }

  async receiveContext(rawContext) {
    const contextCopy = { ...rawContext, app: this };
    const context = new Context(this, contextCopy);
    await context.process();
  }

  lastMessage() {
    return this.ui.messages.length > 0 ? this.ui.messages[this.ui.messages.length - 1].text : null;
  }

  dumpMessages() {
    console.log(`--- Messages for ${this.name} ---`);
    for (const m of this.ui.messages) {
      console.log(`  • ${m.text}`);
    }
  }
}

// ------------------- RUN TEST SUITE -------------------

async function runMultiUserSimulation() {
  console.log('=====================================================');
  console.log('       COWDEE MULTI-USER LOCAL SIMULATION TEST       ');
  console.log('=====================================================\n');

  // 1. Initialise the database test fixtures
  const initApp = {
    debug: true,
    seen: () => false,
    settings: { generate: true, max: 5 }
  };
  initApp.utils = new Utils(initApp);
  initApp.io = new IO(initApp);
  initApp.db = new DB(initApp);
  initApp.id = new ID(initApp);
  initApp.ui = new HeadlessUI(initApp);
  initApp.player = new Player(initApp);
  initApp.lookManager = new LookManager(initApp);
  initApp.tester = new Tester(initApp);

  initApp.tester.deleteTestFiles();
  await initApp.tester.initObjects();
  await initApp.tester.initPlayers();
  await initApp.tester.initCommands();
  await initApp.db.savePoolsToDisk();
  console.log('✔ Initialized test database and command fixtures.\n');

  // 2. Set up shared Hub and 2 Simulated Clients
  const hub = new ContextHub();
  const wolis = new SimulatedClient('Wolis', 'wol', '2', hub);
  const bob = new SimulatedClient('Bob', 'bob', '2', hub);

  console.log('👥 Clients connected:');
  console.log(`   - Wolis (id: 'wol', location: '2' [House])`);
  console.log(`   - Bob   (id: 'bob', location: '2' [House])\n`);

  // 3. Test 1: Bob creates a white cup
  console.log('-----------------------------------------------------');
  console.log('TEST 1: Bob creates a white cup in Room 2');
  console.log('-----------------------------------------------------');
  await bob.sendCommand('create a white cup');

  console.log('\n🔍 Verifying Bob\'s client:');
  console.log('   Last message seen by Bob:', bob.lastMessage());
  
  console.log('\n🔍 Verifying Wolis\'s client (replicated via Context stream):');
  console.log('   Last message seen by Wolis:', wolis.lastMessage());

  // Search Wolis's local memory DB for the cup created by Bob
  const cupInWolisDB = await wolis.db.findByNameInLoc('cup', '2');
  console.log('   Did Wolis\'s local DB replicate the cup in Loc 2?', cupInWolisDB ? `YES (ID: ${cupInWolisDB})` : 'NO');

  if (!cupInWolisDB) {
    throw new Error('FAILED: Wolis did not replicate the created cup in local DB!');
  }

  // 4. Test 2: Bob speaks to Wolis
  console.log('\n-----------------------------------------------------');
  console.log('TEST 2: Bob says something in Room 2');
  console.log('-----------------------------------------------------');
  await bob.sendCommand('say hello there Wolis');
  console.log('   Bob last message:', bob.lastMessage());
  console.log('   Wolis last message:', wolis.lastMessage());

  // 5. Test 3: Spatial Filtering with 3rd client in another room
  console.log('\n-----------------------------------------------------');
  console.log('TEST 3: Spatial filtering - Jane in Room 3 (Library)');
  console.log('-----------------------------------------------------');
  const jane = new SimulatedClient('Jane', 'jan', '3', hub);
  const janeMsgCountBefore = jane.ui.messages.length;

  await bob.sendCommand('say secret conversation only in house');

  const janeMsgCountAfter = jane.ui.messages.length;
  console.log(`   Jane message count change: ${janeMsgCountAfter - janeMsgCountBefore} (Expected: 0)`);
  console.log('   Wolis heard:', wolis.lastMessage());

  if (janeMsgCountAfter !== janeMsgCountBefore) {
    throw new Error('FAILED: Jane received a message from a different location!');
  }

  console.log('\n=====================================================');
  console.log('           ALL MULTI-USER TESTS PASSED!              ');
  console.log('=====================================================\n');
  process.exit(0);
}

runMultiUserSimulation().catch(err => {
  console.error('Error during simulation:', err);
  process.exit(1);
});
