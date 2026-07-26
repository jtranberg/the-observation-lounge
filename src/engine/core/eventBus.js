/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Event Bus
 * ------------------------------------------------------------------
 *
 * The Event Bus is the central communication hub for the Observation
 * Engine.
 *
 * Every application publishes operational events here.
 *
 * Every processor subscribes to the events it cares about.
 *
 * The publisher NEVER knows who receives the event.
 * The processors NEVER know who created the event.
 *
 * This loose coupling keeps the Observation Engine scalable.
 *
 *                publish()
 *                     │
 *                     ▼
 *               Observation Bus
 *             ┌────────┼────────┐
 *             ▼        ▼        ▼
 *        History   Metrics   Incident
 *        Processor Processor Processor
 *
 * ------------------------------------------------------------------
 */

class EventBus {
  constructor() {
    /**
     * Registered event listeners.
     *
     * Key:
     *      Event Type
     *
     * Value:
     *      Array of callback functions
     */
    this.listeners = new Map();

    /**
     * Total events published since startup.
     */
    this.totalEvents = 0;
  }

  /**
   * --------------------------------------------------------------
   * Subscribe
   *
   * Registers a listener for a specific event type.
   *
   * @param {string} eventType
   * @param {Function} callback
   *
   * @returns {Function}
   *          Unsubscribe function
   * --------------------------------------------------------------
   */
  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const listeners = this.listeners.get(eventType);

    listeners.push(callback);

    return () => {
      const remainingListeners = this.listeners
        .get(eventType)
        .filter((listener) => listener !== callback);

      this.listeners.set(eventType, remainingListeners);
    };
  }

  /**
   * --------------------------------------------------------------
   * Publish
   *
   * Sends an event to every registered listener.
   *
   * @param {Object} event
   * --------------------------------------------------------------
   */
  publish(event) {
    this.totalEvents++;

    /**
     * Type-specific listeners receive only matching events.
     */
    const typeListeners = this.listeners.get(event.type) || [];

    /**
     * Wildcard listeners receive every event.
     */
    const wildcardListeners = this.listeners.get("*") || [];

    const listeners = [...typeListeners, ...wildcardListeners];

    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Observation Bus listener failed:", error);
      }
    });
  }

  /**
   * --------------------------------------------------------------
   * Broadcast
   *
   * Sends an event to ALL listeners regardless of type.
   *
   * Reserved for future system-wide notifications.
   * --------------------------------------------------------------
   */
  broadcast(event) {
    this.listeners.forEach((listeners) => {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(error);
        }
      });
    });
  }

  /**
   * --------------------------------------------------------------
   * Returns statistics about the Event Bus.
   * --------------------------------------------------------------
   */
  getStatistics() {
    let totalListeners = 0;

    this.listeners.forEach((listeners) => {
      totalListeners += listeners.length;
    });

    return {
      registeredEventTypes: this.listeners.size,

      registeredListeners: totalListeners,

      totalEventsPublished: this.totalEvents,
    };
  }
}

/**
 * Singleton instance.
 *
 * The Observation Lounge should have ONE Event Bus.
 */
const eventBus = new EventBus();

export default eventBus;
