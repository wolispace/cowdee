
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
    this.ui.showDialog(' Hi ', () => {alert('hmm')});

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

  sendCommand() {
    console.log('send command');
  }

  handleForm(data) {
    console.log('handleForm', data);
  }
};

// ----- It all starts here -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});

