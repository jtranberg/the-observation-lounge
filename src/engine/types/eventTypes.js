/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Event Types
 * ------------------------------------------------------------------
 *
 * Central registry of event names used throughout the Observation
 * Engine.
 *
 * Keeping event names in one place prevents spelling mistakes,
 * inconsistent naming, and hard-to-track string values across the app.
 * ------------------------------------------------------------------
 */

export const EVENT_TYPES = Object.freeze({
  /**
   * Health events
   */
  HEALTH_CHECK: "health.check",
  HEALTH_DEGRADED: "health.degraded",
  HEALTH_OFFLINE: "health.offline",
  HEALTH_RECOVERED: "health.recovered",

  /**
   * Incident events
   */
  INCIDENT_OPENED: "incident.opened",
  INCIDENT_UPDATED: "incident.updated",
  INCIDENT_RESOLVED: "incident.resolved",

  /**
   * Performance events
   */
  PERFORMANCE_SAMPLE: "performance.sample",
  PERFORMANCE_SLOW_RESPONSE: "performance.slow_response",

  /**
   * Billing events
   */
  BILLING_PAYMENT_SUCCEEDED: "billing.payment_succeeded",
  BILLING_PAYMENT_FAILED: "billing.payment_failed",
  BILLING_SUBSCRIPTION_UPDATED: "billing.subscription_updated",
  BILLING_SUBSCRIPTION_CANCELLED: "billing.subscription_cancelled",

  /**
   * Background job events
   */
  JOB_STARTED: "job.started",
  JOB_COMPLETED: "job.completed",
  JOB_FAILED: "job.failed",

  /**
   * Deployment events
   */
  DEPLOYMENT_STARTED: "deployment.started",
  DEPLOYMENT_COMPLETED: "deployment.completed",
  DEPLOYMENT_FAILED: "deployment.failed",
  DEPLOYMENT_ROLLED_BACK: "deployment.rolled_back",

  /**
   * Security events
   */
  SECURITY_LOGIN_FAILED: "security.login_failed",
  SECURITY_ACCESS_DENIED: "security.access_denied",
  SECURITY_SUSPICIOUS_ACTIVITY: "security.suspicious_activity",

  /**
   * System events
   */
  SYSTEM_ERROR: "system.error",
  SYSTEM_WARNING: "system.warning",
  SYSTEM_INFO: "system.info",
});

/**
 * Event severity levels.
 *
 * These values will be used for alerts, incidents, filtering,
 * dashboards, and future notification rules.
 */
export const EVENT_SEVERITY = Object.freeze({
  INFO: "info",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

/**
 * Event source categories.
 *
 * A source identifies which part of the monitored system generated
 * the event.
 */
export const EVENT_SOURCES = Object.freeze({
  APPLICATION: "application",
  API: "api",
  DATABASE: "database",
  BILLING: "billing",
  JOB: "job",
  DEPLOYMENT: "deployment",
  SECURITY: "security",
  INFRASTRUCTURE: "infrastructure",
  OBSERVATION_ENGINE: "observation-engine",
});

/**
 * Returns true when a supplied value is a registered event type.
 *
 * @param {string} eventType
 * @returns {boolean}
 */
export function isValidEventType(eventType) {
  return Object.values(EVENT_TYPES).includes(eventType);
}

/**
 * Returns true when a supplied value is a registered severity level.
 *
 * @param {string} severity
 * @returns {boolean}
 */
export function isValidEventSeverity(severity) {
  return Object.values(EVENT_SEVERITY).includes(severity);
}