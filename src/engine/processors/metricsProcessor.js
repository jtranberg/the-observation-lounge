import { EVENT_TYPES } from "../types/eventTypes";

/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Metrics Processor
 * ------------------------------------------------------------------
 *
 * Converts operational events into measurable system statistics.
 *
 * Responsibilities:
 * - Count health checks
 * - Track response times
 * - Calculate averages
 * - Record fastest and slowest responses
 * - Count healthy, degraded, and offline checks
 * - Maintain per-application metrics
 *
 * This first version stores metrics in browser memory.
 * ------------------------------------------------------------------
 */

class MetricsProcessor {
  constructor() {
    this.name = "metricsProcessor";

    /**
     * Global health-check metrics.
     */
    this.healthMetrics = {
      totalChecks: 0,
      healthyChecks: 0,
      degradedChecks: 0,
      offlineChecks: 0,
      totalResponseTime: 0,
      measuredResponses: 0,
      averageResponseTime: null,
      fastestResponseTime: null,
      slowestResponseTime: null,
      lastResponseTime: null,
      lastCheckedAt: null,
    };

    /**
     * Per-application metrics.
     *
     * Example:
     *
     * {
     *   Prospector: {
     *     totalChecks: 12,
     *     averageResponseTime: 5,
     *     currentStatus: "Healthy"
     *   }
     * }
     */
    this.applicationMetrics = new Map();

    /**
     * React and external state subscribers.
     */
    this.listeners = new Set();

    this.unsubscribe = null;
  }

  /**
   * Begin listening for health-check events.
   *
   * @param {object} context
   * @param {object} context.eventBus
   * @returns {Function}
   */
  start({ eventBus }) {
    this.unsubscribe = eventBus.subscribe(
      EVENT_TYPES.HEALTH_CHECK,
      (event) => this.process(event),
    );

    return () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    };
  }

  /**
   * Process one health-check event.
   *
   * @param {object} event
   */
  process(event) {
    const application = event?.application;
    const status = event?.payload?.status;
    const responseTime = event?.payload?.responseTime;
    const checkedAt =
      event?.timestamp ||
      event?.payload?.checkedAt ||
      new Date();

    if (!application || !status) {
      console.warn(
        "Metrics Processor received an invalid health event:",
        event,
      );

      return;
    }

    this.updateGlobalMetrics({
      status,
      responseTime,
      checkedAt,
    });

    this.updateApplicationMetrics({
      application,
      status,
      responseTime,
      checkedAt,
    });

    this.notify();
  }

  /**
   * Update global health metrics.
   *
   * @param {object} input
   * @param {string} input.status
   * @param {number|null|undefined} input.responseTime
   * @param {Date|string} input.checkedAt
   */
  updateGlobalMetrics({
    status,
    responseTime,
    checkedAt,
  }) {
    const current = this.healthMetrics;

    const next = {
      ...current,
      totalChecks: current.totalChecks + 1,
      lastCheckedAt: checkedAt,
    };

    if (status === "Healthy") {
      next.healthyChecks += 1;
    }

    if (status === "Degraded") {
      next.degradedChecks += 1;
    }

    if (status === "Offline") {
      next.offlineChecks += 1;
    }

    if (
      responseTime != null &&
      Number.isFinite(responseTime) &&
      responseTime >= 0
    ) {
      next.totalResponseTime += responseTime;
      next.measuredResponses += 1;
      next.lastResponseTime = responseTime;

      next.averageResponseTime = Math.round(
        next.totalResponseTime /
          next.measuredResponses,
      );

      next.fastestResponseTime =
        next.fastestResponseTime == null
          ? responseTime
          : Math.min(
              next.fastestResponseTime,
              responseTime,
            );

      next.slowestResponseTime =
        next.slowestResponseTime == null
          ? responseTime
          : Math.max(
              next.slowestResponseTime,
              responseTime,
            );
    }

    this.healthMetrics = next;
  }

  /**
   * Update metrics for one application.
   *
   * @param {object} input
   * @param {string} input.application
   * @param {string} input.status
   * @param {number|null|undefined} input.responseTime
   * @param {Date|string} input.checkedAt
   */
  updateApplicationMetrics({
    application,
    status,
    responseTime,
    checkedAt,
  }) {
    const current =
      this.applicationMetrics.get(application) || {
        application,
        totalChecks: 0,
        healthyChecks: 0,
        degradedChecks: 0,
        offlineChecks: 0,
        totalResponseTime: 0,
        measuredResponses: 0,
        averageResponseTime: null,
        fastestResponseTime: null,
        slowestResponseTime: null,
        lastResponseTime: null,
        currentStatus: "Unknown",
        lastCheckedAt: null,
      };

    const next = {
      ...current,
      totalChecks: current.totalChecks + 1,
      currentStatus: status,
      lastCheckedAt: checkedAt,
    };

    if (status === "Healthy") {
      next.healthyChecks += 1;
    }

    if (status === "Degraded") {
      next.degradedChecks += 1;
    }

    if (status === "Offline") {
      next.offlineChecks += 1;
    }

    if (
      responseTime != null &&
      Number.isFinite(responseTime) &&
      responseTime >= 0
    ) {
      next.totalResponseTime += responseTime;
      next.measuredResponses += 1;
      next.lastResponseTime = responseTime;

      next.averageResponseTime = Math.round(
        next.totalResponseTime /
          next.measuredResponses,
      );

      next.fastestResponseTime =
        next.fastestResponseTime == null
          ? responseTime
          : Math.min(
              next.fastestResponseTime,
              responseTime,
            );

      next.slowestResponseTime =
        next.slowestResponseTime == null
          ? responseTime
          : Math.max(
              next.slowestResponseTime,
              responseTime,
            );
    }

    this.applicationMetrics.set(
      application,
      next,
    );
  }

  /**
   * Subscribe to metrics-state changes.
   *
   * @param {Function} listener
   * @returns {Function}
   */
  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new Error(
        "Metrics Processor listener must be a function.",
      );
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify every metrics subscriber.
   */
  notify() {
    const state = this.getState();

    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error(
          "Metrics Processor listener failed:",
          error,
        );
      }
    });
  }

  /**
   * Reset all session metrics.
   */
  clear() {
    this.healthMetrics = {
      totalChecks: 0,
      healthyChecks: 0,
      degradedChecks: 0,
      offlineChecks: 0,
      totalResponseTime: 0,
      measuredResponses: 0,
      averageResponseTime: null,
      fastestResponseTime: null,
      slowestResponseTime: null,
      lastResponseTime: null,
      lastCheckedAt: null,
    };

    this.applicationMetrics.clear();

    this.notify();
  }

  /**
   * Return current metrics state.
   *
   * @returns {object}
   */
  getState() {
    return {
      health: {
        ...this.healthMetrics,
      },

      applications: Array.from(
        this.applicationMetrics.values(),
      ).map((metrics) => ({
        ...metrics,
      })),
    };
  }

  /**
   * Stop listening for events.
   */
  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

const metricsProcessor =
  new MetricsProcessor();

export default metricsProcessor;