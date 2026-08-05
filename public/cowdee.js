
import { Utils } from './classes/Utils.js';
import { SSE } from './classes/SSE.js';
import { IO } from './classes/IO.js';
import { UI } from './classes/UI.js';
import { DB } from './classes/DB.js';
import { ID } from './classes/ID.js';
import { MessageManager} from './classes/MessageManager.js';
import { CommandManager} from './classes/CommandManager.js';
import { PlayerManager} from './classes/PlayerManager.js';
import { LookManager} from './classes/LookManager.js';

class App {

  interval = 5_000;
  playerInfo = {};
  saveTimeout = null;
  #isProcessing = false;
  anyDirty = false; // set by pools to true the moment one pool is dirty, clear after save

  constructor(testing) {
    this.utils = new Utils(this); // random utils
    this.sse = new SSE(this); // server site events
    this.io = new IO(this); // disk IO - read and write to server
    this.ui = new UI(this); // user interface
    this.db = new DB(this); // database - read and write objects
    this.id = new ID(this); // generate unique sequential ids
    this.messageManager = new MessageManager(this);
    this.commandManager = new CommandManager(this);
    this.playerManager = new PlayerManager(this);
    this.lookManager = new LookManager(this);
    
    if (testing) return;
    setInterval(() => this.doNext(), this.interval);
  }

  start() {
    console.log('started');
    // this.ui.showDialog(' Hi ', () => {alert('hmm')});

    // universal form submit we pass to the handler for forms
    document.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form));
      // DEBUG: set essential values
      data.actor = 'wol';
      data.loc = '2';
      this.handleForm(data);
    });
  }

  wakePlayer() {
    console.log('wake player');
  }

  async sendCommand(data) {
    const result = await this.io.fetchJson('command', data);
    console.log('sendCommand', result);
  }

  async handleForm(data) {
    if (data.type == 'login') {
      const result = await this.io.fetchJson('player', data);
      if (result.id) {
        localStorage.setItem(PLAYER_KEY, result.id);
        playerInfo.id = result.id;
        playerInfo.loc = result.loc;
        this.wakePlayer();
        this.closeDialog();
      } else {
        alert('Invalid player or password');
      }
    } else {
      this.sendCommand(data);
    }
  }

  // ----- was TickManager ---

  doNext() {
    if (this.#isProcessing) return;
    this.#isProcessing = true;
    this.#process();
  }

  #process() {
    if (this.testing) {
      while (this.commandManager.pending() || this.messageManager.pending()) {
        if (this.commandManager.pending()) {
          this.commandManager.doNext();
        } else if (this.messageManager.pending()) {
          const payload = this.messageManager.get();
          this.messageManager.send(payload);
        }
      }
      this.#isProcessing = false;
      this.objectManager.savePoolsToDisk();
      return;
    }

    // Process one command if available
    if (this.commandManager.pending()) {
      this.commandManager.doNext();
      setImmediate(() => this.#process());
      return;
    }

    // Process one message if available
    if (this.messageManager.pending()) {
      const payload = this.messageManager.get();
      this.messageManager.send(payload);
      setImmediate(() => this.#process());
      return;
    }

    // Nothing left to do
    this.#isProcessing = false;
    if (this.anyDirty) {
      this.debounceSave();
    }
  }

  debounceSave() {
    // Clear any existing timer
    if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
    }

    // Set a new 5-second timer
    this.saveTimeout = setTimeout(() => {
        this.objectManager.savePoolsToDisk();
        this.saveTimeout = null; // optional: helps debugging
        this.anyDirty = false;
    }, this.interval);
  }

};


// ----- It all starts here -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});

