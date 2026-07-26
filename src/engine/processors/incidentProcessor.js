import {
  EVENT_SEVERITY,
  EVENT_TYPES,
} from "../types/eventTypes";

/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Incident Processor
 * ------------------------------------------------------------------
 *
 * Detects operational incidents by watching application health events.
 *
 * React never decides what an incident is.
 * Applications publish events.
 * The Incident Processor opens and resolves incidents.
 * ------------------------------------------------------------------
 */

/**
 * Creates a unique identifier with a browser-compatible fallback.
 *
 * @returns {string}
 */
function createIncidentId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

class IncidentProcessor {
  constructor() {
    this.name = "incidentProcessor";

    /**
     * Latest known health status for each application.
     *
     * Example:
     * {
     *   Prospector: "Healthy",
     *   Fan7: "Offline"
     * }
     */
    this.applicationStates = new Map();

    /**
     * All incidents recorded during the current session.
     */
    this.incidents = [];

    /**
     * Dashboard and state subscribers.
     */
    this.listeners = new Set();

    this.unsubscribe = null;
    this.engine = null;
  }

  /**
   * Start listening for health-check events.
   *
   * @param {object} context
   * @param {object} context.eventBus
   * @param {object} context.engine
   * @returns {Function}
   */
  start({ eventBus, engine }) {
    this.engine = engine;

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
    const currentStatus = event?.payload?.status;

    /**
     * Ignore malformed events rather than crashing the engine.
     */
    if (!application || !currentStatus) {
      console.warn(
        "Incident Processor received an invalid health event:",
        event,
      );

      return;
    }

    const previousStatus =
      this.applicationStates.get(application);

    this.applicationStates.set(
      application,
      currentStatus,
    );

    /**
     * The first observation establishes the baseline.
     * It does not create an incident.
     */
    if (!previousStatus) {
      return;
    }

    /**
     * Healthy -> Offline or Degraded
     */
    if (
      previousStatus === "Healthy" &&
      (
        currentStatus === "Offline" ||
        currentStatus === "Degraded"
      )
    ) {
      this.openIncident(
        application,
        currentStatus,
        event,
      );

      return;
    }

    /**
     * Offline or Degraded -> Healthy
     */
    if (
      (
        previousStatus === "Offline" ||
        previousStatus === "Degraded"
      ) &&
      currentStatus === "Healthy"
    ) {
      this.resolveIncident(
        application,
        event,
      );
    }
  }

  /**
   * Open an incident for an application.
   *
   * @param {string} application
   * @param {string} status
   * @param {object} event
   */
  openIncident(application, status, event) {
    /**
     * Avoid creating multiple open incidents for the same application.
     */
    const existingOpenIncident =
      this.incidents.find(
        (incident) =>
          incident.application === application &&
          incident.status === "Open",
      );

    if (existingOpenIncident) {
      return;
    }

    const incident = {
      id: createIncidentId(),
      application,
      title:
        status === "Offline"
          ? `${application} API offline`
          : `${application} API degraded`,
      status: "Open",
      severity:
        status === "Offline"
          ? EVENT_SEVERITY.HIGH
          : EVENT_SEVERITY.MEDIUM,
      openedAt: event.timestamp || new Date(),
      resolvedAt: null,
      message:
        event.message ||
        `${application} health changed to ${status}.`,
      sourceEventId: event.id || null,
    };

    this.incidents = [
      incident,
      ...this.incidents,
    ];

    this.notify();

    this.engine?.publish({
      type: EVENT_TYPES.INCIDENT_OPENED,
      application,
      severity: incident.severity,
      message: incident.title,
      payload: incident,
    });
  }

  /**
   * Resolve the newest open incident for an application.
   *
   * @param {string} application
   * @param {object} event
   */
  resolveIncident(application, event) {
    let incidentResolved = false;
    let resolvedIncident = null;

    /**
     * Create a new array rather than mutating the incident in place.
     */
    this.incidents = this.incidents.map((incident) => {
      if (
        !incidentResolved &&
        incident.application === application &&
        incident.status === "Open"
      ) {
        incidentResolved = true;

        resolvedIncident = {
          ...incident,
          status: "Resolved",
          resolvedAt: event.timestamp || new Date(),
        };

        return resolvedIncident;
      }

      return incident;
    });

    if (!resolvedIncident) {
      return;
    }

    this.notify();

    this.engine?.publish({
      type: EVENT_TYPES.INCIDENT_RESOLVED,
      application,
      severity: EVENT_SEVERITY.INFO,
      message: `${application} recovered`,
      payload: resolvedIncident,
    });
  }

  /**
   * Subscribe to incident-state changes.
   *
   * @param {Function} listener
   * @returns {Function}
   */
  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new Error(
        "Incident Processor listener must be a function.",
      );
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all incident-state subscribers.
   */
  notify() {
    const state = this.getState();

    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error(
          "Incident Processor listener failed:",
          error,
        );
      }
    });
  }

  /**
   * Return the current incident state.
   *
   * @returns {object}
   */
  getState() {
    return {
      incidents: [...this.incidents],

      open: this.incidents.filter(
        (incident) => incident.status === "Open",
      ).length,

      resolved: this.incidents.filter(
        (incident) =>
          incident.status === "Resolved",
      ).length,
    };
  }

  /**
   * Stop listening for engine events.
   */
  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.engine = null;
  }
}

const incidentProcessor =
  new IncidentProcessor();

export default incidentProcessor;