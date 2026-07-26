import {
  EVENT_SEVERITY,
  EVENT_SOURCES,
  isValidEventSeverity,
  isValidEventType,
} from "../types/eventTypes";

/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Event Factory
 * ------------------------------------------------------------------
 *
 * Creates normalized operational events before they enter the
 * Observation Engine.
 *
 * All applications and services should publish events through this
 * factory so the engine receives a consistent structure.
 * ------------------------------------------------------------------
 */

/**
 * Creates a unique event identifier.
 *
 * @returns {string}
 */
function createEventId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Creates a normalized Observation Lounge event.
 *
 * @param {object} input
 * @param {string} input.type
 * @param {string} input.application
 * @param {string} [input.source]
 * @param {string} [input.severity]
 * @param {string} [input.message]
 * @param {object} [input.payload]
 * @param {Date|string} [input.timestamp]
 * @param {object} [input.metadata]
 * @returns {object}
 */
export function createObservationEvent({
  type,
  application,
  source = EVENT_SOURCES.APPLICATION,
  severity = EVENT_SEVERITY.INFO,
  message = "",
  payload = {},
  timestamp = new Date(),
  metadata = {},
}) {
  if (!type) {
    throw new Error("Observation event type is required.");
  }

  if (!application) {
    throw new Error("Observation event application is required.");
  }

  if (!isValidEventType(type)) {
    throw new Error(`Unknown observation event type: ${type}`);
  }

  if (!isValidEventSeverity(severity)) {
    throw new Error(`Unknown observation event severity: ${severity}`);
  }

  const parsedTimestamp =
    timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(parsedTimestamp.getTime())) {
    throw new Error("Observation event timestamp is invalid.");
  }

  return {
    id: createEventId(),
    type,
    application,
    source,
    severity,
    message,
    payload,
    metadata,
    timestamp: parsedTimestamp,
    createdAt: new Date(),
  };
}