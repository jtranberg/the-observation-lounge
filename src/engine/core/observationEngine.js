import eventBus from "./eventBus";

import { createObservationEvent } from "../services/eventFactory";
import {
  EVENT_SEVERITY,
  EVENT_SOURCES,
  EVENT_TYPES,
} from "../types/eventTypes";

/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Observation Engine
 * ------------------------------------------------------------------
 *
 * Central coordinator for the operational intelligence platform.
 *
 * Responsibilities:
 * - Start and stop the engine
 * - Register event processors
 * - Publish normalized events
 * - Protect the engine from processor failures
 * - Expose engine statistics and current state
 *
 * The engine contains no React or dashboard logic.
 * React will consume the state produced by processors later.
 * ------------------------------------------------------------------
 */

class ObservationEngine {
  constructor() {
    /**
     * Whether the engine is currently running.
     */
    this.started = false;

    /**
     * Time the engine was most recently started.
     */
    this.startedAt = null;

    /**
     * Registered processors.
     *
     * Each processor should provide:
     *
     * {
     *   name: "historyProcessor",
     *   start: ({ eventBus, engine }) => unsubscribeFunction,
     *   stop?: () => void,
     *   getState?: () => object
     * }
     */
    this.processors = new Map();

    /**
     * Unsubscribe functions returned by active processors.
     */
    this.processorSubscriptions = new Map();

    /**
     * Engine-level counters.
     */
    this.statistics = {
      eventsPublished: 0,
      processorErrors: 0,
      startedCount: 0,
    };
  }

  /**
   * Registers a processor with the engine.
   *
   * Registration does not start the processor automatically unless
   * the engine is already running.
   *
   * @param {object} processor
   * @returns {ObservationEngine}
   */
  registerProcessor(processor) {
    if (!processor || typeof processor !== "object") {
      throw new Error("Observation processor must be an object.");
    }

    if (!processor.name) {
      throw new Error("Observation processor requires a name.");
    }

    if (typeof processor.start !== "function") {
      throw new Error(
        `Observation processor "${processor.name}" requires a start function.`,
      );
    }

    if (this.processors.has(processor.name)) {
      throw new Error(
        `Observation processor "${processor.name}" is already registered.`,
      );
    }

    this.processors.set(processor.name, processor);

    /**
     * A processor registered after engine startup should become active
     * immediately.
     */
    if (this.started) {
      this.startProcessor(processor);
    }

    return this;
  }

  /**
   * Removes a processor from the engine.
   *
   * @param {string} processorName
   * @returns {boolean}
   */
  unregisterProcessor(processorName) {
    if (!this.processors.has(processorName)) {
      return false;
    }

    this.stopProcessor(processorName);
    this.processors.delete(processorName);

    return true;
  }

  /**
   * Starts one registered processor.
   *
   * @param {object} processor
   */
  startProcessor(processor) {
    if (this.processorSubscriptions.has(processor.name)) {
      return;
    }

    try {
      const unsubscribe = processor.start({
        eventBus,
        engine: this,
      });

      /**
       * Processors may return an unsubscribe function.
       * Store a safe no-op when one is not returned.
       */
      this.processorSubscriptions.set(
        processor.name,
        typeof unsubscribe === "function" ? unsubscribe : () => {},
      );
    } catch (error) {
      this.statistics.processorErrors += 1;

      console.error(
        `Observation processor "${processor.name}" failed to start:`,
        error,
      );
    }
  }

  /**
   * Stops one active processor.
   *
   * @param {string} processorName
   */
  stopProcessor(processorName) {
    const unsubscribe =
      this.processorSubscriptions.get(processorName);

    const processor = this.processors.get(processorName);

    try {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }

      if (typeof processor?.stop === "function") {
        processor.stop();
      }
    } catch (error) {
      this.statistics.processorErrors += 1;

      console.error(
        `Observation processor "${processorName}" failed to stop:`,
        error,
      );
    } finally {
      this.processorSubscriptions.delete(processorName);
    }
  }

  /**
   * Starts the complete Observation Engine.
   *
   * Starting an already-running engine has no effect.
   */
  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.startedAt = new Date();
    this.statistics.startedCount += 1;

    this.processors.forEach((processor) => {
      this.startProcessor(processor);
    });

    this.publish({
      type: EVENT_TYPES.SYSTEM_INFO,
      application: "Observation Lounge",
      source: EVENT_SOURCES.OBSERVATION_ENGINE,
      severity: EVENT_SEVERITY.INFO,
      message: "Observation Engine started.",
      payload: {
        processorCount: this.processors.size,
      },
    });
  }

  /**
   * Stops the complete Observation Engine.
   */
  stop() {
    if (!this.started) {
      return;
    }

    /**
     * Publish before stopping so active processors can record it.
     */
    this.publish({
      type: EVENT_TYPES.SYSTEM_INFO,
      application: "Observation Lounge",
      source: EVENT_SOURCES.OBSERVATION_ENGINE,
      severity: EVENT_SEVERITY.INFO,
      message: "Observation Engine stopped.",
    });

    this.processorSubscriptions.forEach(
      (_, processorName) => {
        this.stopProcessor(processorName);
      },
    );

    this.started = false;
  }

  /**
   * Creates and publishes a normalized operational event.
   *
   * This should become the primary entry point for application events.
   *
   * @param {object} input
   * @returns {object}
   */
  publish(input) {
    if (!this.started) {
      throw new Error(
        "Observation Engine must be started before publishing events.",
      );
    }

    const event = createObservationEvent(input);

    this.statistics.eventsPublished += 1;

    eventBus.publish(event);

    return event;
  }

  /**
   * Returns the current state of each registered processor.
   *
   * Processors without getState return null.
   *
   * @returns {object}
   */
  getProcessorStates() {
    const states = {};

    this.processors.forEach((processor, processorName) => {
      try {
        states[processorName] =
          typeof processor.getState === "function"
            ? processor.getState()
            : null;
      } catch (error) {
        this.statistics.processorErrors += 1;

        states[processorName] = {
          error:
            error.message ||
            "Unable to retrieve processor state.",
        };
      }
    });

    return states;
  }

  /**
   * Returns engine and Event Bus statistics.
   *
   * @returns {object}
   */
  getStatistics() {
    return {
      running: this.started,
      startedAt: this.startedAt,
      uptimeSeconds:
        this.started && this.startedAt
          ? Math.floor(
              (Date.now() - this.startedAt.getTime()) / 1000,
            )
          : 0,
      registeredProcessors: this.processors.size,
      activeProcessors: this.processorSubscriptions.size,
      ...this.statistics,
      eventBus: eventBus.getStatistics(),
    };
  }
}

/**
 * Singleton engine instance.
 *
 * The Observation Lounge should operate one shared engine instance
 * throughout the browser application.
 */
const observationEngine = new ObservationEngine();

export default observationEngine;