
import { Utils } from './classes/Utils.js';
import { SSE } from './classes/SSE.js';
import { IO } from './classes/IO.js';
import { UI } from './classes/UI.js';
import { DB } from './classes/DB.js';
import { ID } from './classes/ID.js';
import { Player} from './classes/Player.js';
import { LookManager} from './classes/LookManager.js';
import { Context} from './classes/Context.js';

const LAST_CONTEXT_KEY = 'lastContext'; // how we local store the last see context key

class App {

  #isProcessing = false;
  lastContext = '0'; // last seen context.key

  constructor(testing) {
    this.utils = new Utils(this); // random utils
    
    this.io = new IO(this); // disk IO - read and write to server
    this.ui = new UI(this); // user interface
    this.db = new DB(this); // database - read and write objects
    this.id = new ID(this); // generate unique sequential ids
    this.player = new Player(this);
    this.lookManager = new LookManager(this);

  }
  
  async start() {
    await this.player.load();
    this.lastContext = localStorage.getItem(LAST_CONTEXT_KEY);
    // start the SSE now we know the last context seen
    this.sse = new SSE(this); // server site events
    await this.sse.connect();

    // universal form submit we pass to the handler for forms
    document.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form));
      // DEBUG: set essential values
      data.actor = this.player.info.id;
      data.loc = this.player.info.loc;
      this.handleForm(data);
      const cmdInput = document.getElementById('cmd');
      cmdInput.value = '';
    });
  }

  wakePlayer() {
    console.log('wake player');
  }

  /**
   * Have we already see/processed this context (save in localStorage if we havent)
   * Load lastContext from local storage on start() 
   * @param {string} key 
   * @returns {boolean}
   */
  seen(key) {
    if (this.lastContext >= key) {
      return true;
    }; 
    //console.log(`setting lastContext to ${key}`);
    this.lastContext = key; 
    localStorage.setItem(LAST_CONTEXT_KEY, this.lastContext);
    return false;
  }


  async sendCommand(data) {
    data.lastContext = this.lastContext;
    data.counter = this.id.counter;
    const result = await this.io.fetchJson('server', data);
    if (result.contexts) {
      const contexts = JSON.parse(result.contexts);
      for ( const rawContext of contexts) {
        rawContext.app = this; // stuff the app into the context object
        const context = new Context(this, rawContext);
        await context.process();
      }
    }
  }

  // forms dont need to fetch anymore, as the data is in memory (or fetch to fill memory)
  async handleForm(data) {
    if (data.type == 'login') {
      await this.player.handleLogon(data);
    } else {
      this.sendCommand(data);
    }
  }
};


// ----- It all starts here -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  const app = new App();
  await app.start();
});

