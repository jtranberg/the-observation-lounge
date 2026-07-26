/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Application Registry
 * ------------------------------------------------------------------
 *
 * Central source of truth for every application monitored by the
 * Observation Engine.
 *
 * The dashboard should not hardcode application names or connection
 * details. It should ask this registry for the current fleet.
 *
 * Future responsibilities:
 * - Store application health endpoint URLs
 * - Track enabled and disabled integrations
 * - Define service ownership
 * - Define environment and deployment metadata
 * - Support application-specific thresholds
 * ------------------------------------------------------------------
 */

/**
 * Supported application connection states.
 */
export const APPLICATION_CONNECTION_STATUS = Object.freeze({
  CONNECTED: "Connected",
  NOT_CONNECTED: "Not Connected",
  DISABLED: "Disabled",
});

/**
 * Internal application records.
 *
 * Keep this collection private so callers cannot mutate the registry
 * directly.
 */
const applications = new Map();

/**
 * Creates a safe copy of one application record.
 *
 * @param {object} application
 * @returns {object}
 */
function cloneApplication(application) {
  return {
    ...application,
    metadata: {
      ...(application.metadata || {}),
    },
    thresholds: {
      ...(application.thresholds || {}),
    },
  };
}

/**
 * Validates a registry application before saving it.
 *
 * @param {object} application
 */
function validateApplication(application) {
  if (!application || typeof application !== "object") {
    throw new Error("Application registry entry must be an object.");
  }

  if (!application.id) {
    throw new Error("Application registry entry requires an id.");
  }

  if (!application.name) {
    throw new Error(
      `Application registry entry "${application.id}" requires a name.`,
    );
  }

  if (!application.service) {
    throw new Error(
      `Application registry entry "${application.id}" requires a service name.`,
    );
  }
}

/**
 * Register a new monitored application.
 *
 * @param {object} application
 * @returns {object}
 */
export function registerApplication(application) {
  validateApplication(application);

  if (applications.has(application.id)) {
    throw new Error(`Application "${application.id}" is already registered.`);
  }

  const normalizedApplication = {
    id: application.id,
    name: application.name,
    service: application.service,
    description: application.description || "",
    connectionStatus:
      application.connectionStatus ||
      APPLICATION_CONNECTION_STATUS.NOT_CONNECTED,
    environment: application.environment || "Unknown",
    observationUrl: application.observationUrl || application.healthUrl || null,
    enabled: application.enabled ?? true,
    database: application.database || "Unknown",
    deploymentProvider: application.deploymentProvider || "Unknown",
    frontendProvider: application.frontendProvider || "Unknown",
    domain: application.domain || null,
    thresholds: {
      degradedResponseMs: application.thresholds?.degradedResponseMs ?? 1_000,
      offlineAfterFailures: application.thresholds?.offlineAfterFailures ?? 3,
      ...application.thresholds,
    },
    metadata: {
      ...application.metadata,
    },
  };

  applications.set(normalizedApplication.id, normalizedApplication);

  return cloneApplication(normalizedApplication);
}

/**
 * Update an existing application.
 *
 * @param {string} applicationId
 * @param {object} updates
 * @returns {object}
 */
export function updateApplication(applicationId, updates) {
  const current = applications.get(applicationId);

  if (!current) {
    throw new Error(`Application "${applicationId}" is not registered.`);
  }

  const updatedApplication = {
    ...current,
    ...updates,
    id: current.id,
    thresholds: {
      ...current.thresholds,
      ...(updates.thresholds || {}),
    },
    metadata: {
      ...current.metadata,
      ...(updates.metadata || {}),
    },
  };

  validateApplication(updatedApplication);

  applications.set(applicationId, updatedApplication);

  return cloneApplication(updatedApplication);
}

/**
 * Return one application by ID.
 *
 * @param {string} applicationId
 * @returns {object|null}
 */
export function getApplication(applicationId) {
  const application = applications.get(applicationId);

  return application ? cloneApplication(application) : null;
}

/**
 * Return all registered applications.
 *
 * @param {object} options
 * @param {boolean} options.includeDisabled
 * @returns {object[]}
 */
export function getApplications({ includeDisabled = false } = {}) {
  return Array.from(applications.values())
    .filter((application) => includeDisabled || application.enabled)
    .map(cloneApplication);
}

/**
 * Return applications that are ready for live monitoring.
 *
 * @returns {object[]}
 */
export function getConnectedApplications() {
  return getApplications().filter(
    (application) =>
      application.connectionStatus ===
        APPLICATION_CONNECTION_STATUS.CONNECTED &&
      Boolean(application.observationUrl),
  );
}

/**
 * Remove an application from the registry.
 *
 * @param {string} applicationId
 * @returns {boolean}
 */
export function unregisterApplication(applicationId) {
  return applications.delete(applicationId);
}

/**
 * Returns true when an application exists.
 *
 * @param {string} applicationId
 * @returns {boolean}
 */
export function hasApplication(applicationId) {
  return applications.has(applicationId);
}

/**
 * Return registry statistics.
 *
 * @returns {object}
 */
export function getApplicationRegistryStatistics() {
  const registeredApplications = getApplications({
    includeDisabled: true,
  });

  return {
    total: registeredApplications.length,

    enabled: registeredApplications.filter((application) => application.enabled)
      .length,

    disabled: registeredApplications.filter(
      (application) => !application.enabled,
    ).length,

    connected: registeredApplications.filter(
      (application) =>
        application.connectionStatus ===
        APPLICATION_CONNECTION_STATUS.CONNECTED,
    ).length,

    notConnected: registeredApplications.filter(
      (application) =>
        application.connectionStatus ===
        APPLICATION_CONNECTION_STATUS.NOT_CONNECTED,
    ).length,
  };
}

/**
 * Clear all registered applications.
 *
 * Intended primarily for tests and future registry reloading.
 */
export function clearApplicationRegistry() {
  applications.clear();
}


/* =========================================================
   Default Application Registrations
========================================================= */

function buildObservationUrl(baseUrl, endpoint) {
  const normalizedBaseUrl = String(baseUrl || "")
    .trim()
    .replace(/\/+$/, "");

  if (!normalizedBaseUrl) {
    return null;
  }

  if (normalizedBaseUrl.endsWith(endpoint)) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}${endpoint}`;
}

const prospectorBaseUrl =
  import.meta.env.VITE_PROSPECTOR_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5050" : "");

const syndicatorObservationUrl =
  import.meta.env.VITE_SYNDICATOR_OBSERVATION_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3000/api/observation"
    : "");

registerApplication({
  id: "prospector",
  name: "Prospector",
  service: "The Prospector API",

  description:
    "Athlete intelligence, scouting, and prospect discovery platform.",

  connectionStatus:
    APPLICATION_CONNECTION_STATUS.CONNECTED,

  observationUrl: buildObservationUrl(
    prospectorBaseUrl,
    "/api/health",
  ),

  environment: import.meta.env.DEV
    ? "development"
    : "production",

  database: "MongoDB",
  deploymentProvider: "Render",
  frontendProvider: "Netlify",
  domain: "unitedsportsprospects.com",

  thresholds: {
    degradedResponseMs: 1_500,
    offlineAfterFailures: 3,
  },

  metadata: {
    applicationType: "sports-intelligence",
  },
});

registerApplication({
  id: "syndicator",
  name: "Wall Syndicator ",
  service: "Syndicator API",

  description:
    "Property feed generation and marketplace synchronization platform.",

  connectionStatus:
    APPLICATION_CONNECTION_STATUS.CONNECTED,

  observationUrl: syndicatorObservationUrl,

  environment: import.meta.env.DEV
    ? "development"
    : "production",

  database: "Webflow",
  deploymentProvider: "Render",
  frontendProvider: "Netlify",

  domain: import.meta.env.DEV
    ? "localhost:3000"
    : "Production Syndicator",

  thresholds: {
    degradedResponseMs: 2_000,
    offlineAfterFailures: 3,
  },

  metadata: {
    applicationType: "syndication",
    marketplace: "Apartments.com",
  },
});

