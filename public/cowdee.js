
import { Utils } from './classes/Utils.js';
import { SSE } from './classes/SSE.js';
import { IO } from './classes/IO.js';
import { UI } from './classes/UI.js';
import { DB } from './classes/DB.js';
import { ID } from './classes/ID.js';
import { PlayerManager} from './classes/PlayerManager.js';
import { LookManager} from './classes/LookManager.js';
import { Context} from './classes/Context.js';

const LAST_CONTEXT_KEY = 'lastContext'; // how we local store the last see context key

class App {

  playerInfo = {id: 'wol', loc: '2'};
  #isProcessing = false;
  lastContext = '0'; // last seen context.key

  constructor(testing) {
    this.utils = new Utils(this); // random utils
    this.sse = new SSE(this); // server site events
    this.io = new IO(this); // disk IO - read and write to server
    this.ui = new UI(this); // user interface
    this.db = new DB(this); // database - read and write objects
    this.id = new ID(this); // generate unique sequential ids
    this.playerManager = new PlayerManager(this);
    this.lookManager = new LookManager(this);

    if (testing) return;
    this.playerManager.loadPlayerInfo();
  }

  start() {
    this.lastContext = localStorage.getItem(LAST_CONTEXT_KEY);
    // console.log(`started last=${this.lastContext}`);
    // this.ui.showDialog(' Hi ', () => {alert('hmm')});

    // universal form submit we pass to the handler for forms
    document.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form));
      // DEBUG: set essential values
      data.actor = this.playerInfo.id;
      data.loc = this.playerInfo.loc;
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
    data.last = this.lastContext;
    data.counter = this.id.counter;
    const result = await this.io.fetchJson('server', data);
    //console.log(`sendCommand last=${data.last}`, result);
    if (result.contexts) {
      const contexts = JSON.parse(result.contexts);
      for ( const rawContext of contexts) {
        rawContext.app = this; // stuff the app into the context object
        const context = new Context(rawContext);
        await context.process();
      }
    }
  }

  async handleForm(data) {
    if (data.type == 'login') {
      const result = await this.io.fetchJson('server', data);
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
};


// ----- It all starts here -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});

