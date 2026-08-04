
import { Utils } from './classes/Utils.js';
import { SSE } from './classes/SSE.js';
import { IO } from './classes/IO.js';
import { UI } from './classes/UI.js';

class App {
  constructor() {
    this.utils = new Utils(this);
    this.sse = new SSE(this);
    this.io = new IO(this);
    this.ui = new UI(this);
  }

  start() {
    console.log('started');
    // this.ui.showDialog(' Hi ', () => {alert('hmm')});

    // universal form submit we pass to the handler for forms
    document.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form));
      this.handleForm(data);
    });
  }

  wakePlayer() {
    console.log('wake player');
  }

  async sendCommand(data) {
    const result = this.io.fetchJson('command', data);
    console.log('sendCommand', result);
  }

  handleForm(data) {
    if (data.type == 'login') {
      const result = this.io.fetchJson('player', data);
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

