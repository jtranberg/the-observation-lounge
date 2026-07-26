/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * History Processor
 * ------------------------------------------------------------------
 *
 * Records operational events published through the Event Bus.
 *
 * This first version stores history in browser memory. A future
 * backend service will persist events in an operations database.
 * ------------------------------------------------------------------
 */

const DEFAULT_HISTORY_LIMIT = 100;

class HistoryProcessor {
  constructor({ limit = DEFAULT_HISTORY_LIMIT } = {}) {
    this.name = "historyProcessor";
    this.limit = limit;
    this.events = [];
    this.listeners = new Set();
    this.unsubscribe = null;
  }

  /**
   * Begins listening for every registered event type.
   *
   * The current Event Bus subscribes by event type, so the processor
   * subscribes to each registered type supplied by the engine setup.
   *
   * @param {object} context
   * @param {object} context.eventBus
   * @returns {Function}
   */
  start({ eventBus }) {
    /**
     * Subscribe through a wildcard channel.
     *
     * We will add wildcard support to eventBus.js immediately below.
     */
    this.unsubscribe = eventBus.subscribe("*", (event) => {
      this.process(event);
    });

    return () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    };
  }

  /**
   * Stores one event and notifies state subscribers.
   *
   * @param {object} event
   */
  process(event) {
    this.events = [event, ...this.events].slice(0, this.limit);

    this.notify();
  }

  /**
   * Allows React or another consumer to subscribe to history changes.
   *
   * @param {Function} listener
   * @returns {Function}
   */
  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new Error(
        "History processor listener must be a function.",
      );
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifies every state listener.
   */
  notify() {
    const state = this.getState();

    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error(
          "History processor state listener failed:",
          error,
        );
      }
    });
  }

  /**
   * Clears session history.
   */
  clear() {
    this.events = [];
    this.notify();
  }

  /**
   * Returns a safe copy of the current history state.
   *
   * @returns {object}
   */
  getState() {
    return {
      events: [...this.events],
      count: this.events.length,
      limit: this.limit,
    };
  }

  /**
   * Stops the processor.
   */
  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

const historyProcessor = new HistoryProcessor();

export default historyProcessor;