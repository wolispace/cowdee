/**
 * A generic queue you can add and get the next from
 */
export class Queue {

  queue = [];

  /**
   * Adds onto the end of the queue
   * @param {any} data 
   */
  add(data) {
    this.queue.push(data);
  }

  /**
   * Returns the first one off the top of the queue
   * @returns {any}
   */
  get() {
    return this.queue.shift();
  }

  /**
   * How many pending items in the queue
   * @returns {int}
   */
  pending() {
    return this.queue.length;
  }

}