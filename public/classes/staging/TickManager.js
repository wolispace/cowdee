import { MessageManager } from './MessageManager.js';
import { CommandManager } from './CommandManager.js';
import { ObjectManager } from './ObjectManager.js';
import { LookManager } from './LookManager.js';
import { FileManager } from './FileManager.js';
import { PlayerManager } from './PlayerManager.js';
import { Utilities } from '../Utils.js';

const IDLE_SAVE_MS = 5_000;

export class TickManager {
  interval = 5_000;
  playerInfo = {};
  saveTimeout = null;
  #isProcessing = false;
  anyDirty = false; // set by pools to true the moment one pool is dirty, clear after save


  constructor(testing = false) {
    this.testing = testing;
    this.utils = new Utilities();
    this.commandManager = new CommandManager(this);
    this.messageManager = new MessageManager(this);
    this.fileManager = new FileManager(this);
    this.objectManager = new ObjectManager(this);
    this.lookManager = new LookManager(this);
    this.playerManager = new PlayerManager(this);
    
    if (testing) return;
    setInterval(() => this.doNext(), this.interval);
  }

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
}
