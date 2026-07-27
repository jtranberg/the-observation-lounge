/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Default Application Fleet
 * ------------------------------------------------------------------
 *
 * Defines the initial software fleet and its descriptive metadata.
 *
 * MongoDB is now the permanent source of truth for registered
 * applications. This file no longer creates database records or sends
 * POST requests during application startup.
 *
 * The definitions remain available for:
 * - Future database seeding
 * - Registry form defaults
 * - Documentation
 * - Local development
 * - Restoring missing application records
 * ------------------------------------------------------------------
 */

const PROSPECTOR_API_URL =
  import.meta.env.VITE_PROSPECTOR_API_URL ||
  "http://localhost:5050";

/**
 * Supported application connection states.
 */
export const DEFAULT_APPLICATION_CONNECTION_STATUS = Object.freeze({
  CONNECTED: "Connected",
  NOT_CONNECTED: "Not Connected",
  DISABLED: "Disabled",
});

/**
 * Default application fleet definitions.
 *
 * These records are descriptive templates only.
 * They are not automatically submitted to the backend.
 */
const defaultApplications = [
  {
    id: "prospector",
    name: "Prospector",
    displayName: "The Prospector",
    service: "The Prospector API",

    description:
      "Hockey intelligence and scouting platform.",

    connectionStatus:
      DEFAULT_APPLICATION_CONNECTION_STATUS.CONNECTED,

    environment: import.meta.env.MODE,

    baseUrl: PROSPECTOR_API_URL,
    healthEndpoint: "/api/health",
    observationUrl: `${PROSPECTOR_API_URL}/api/health`,

    enabled: true,

    database: "MongoDB Atlas",
    deploymentProvider: "Render",
    frontendProvider: "Netlify",
    domain: "unitedsportsprospects.com",

    pollInterval: 60_000,

    thresholds: {
      degradedResponseMs: 1_000,
      offlineAfterFailures: 3,
    },

    metadata: {
      applicationType: "sports-intelligence",
    },
  },

  {
    id: "fan7",
    name: "Fan7",
    displayName: "Fan7",
    service: "Fan7 API",

    description:
      "Automotive customer experience and operations platform.",

    connectionStatus:
      DEFAULT_APPLICATION_CONNECTION_STATUS.NOT_CONNECTED,

    environment: "Unknown",

    baseUrl: null,
    healthEndpoint: "/api/health",
    observationUrl: null,

    enabled: true,

    database: "MongoDB Atlas",
    deploymentProvider: "Unknown",
    frontendProvider: "Netlify",
    domain: "fan7.netlify.app",

    pollInterval: 60_000,

    thresholds: {
      degradedResponseMs: 1_500,
      offlineAfterFailures: 3,
    },

    metadata: {
      applicationType: "automotive-operations",
    },
  },

  {
    id: "syndicator",
    name: "Syndicator",
    displayName: "Apartments.com Syndicator",
    service: "Property Feed API",

    description:
      "Production rental inventory syndication platform.",

    connectionStatus:
      DEFAULT_APPLICATION_CONNECTION_STATUS.CONNECTED,

    environment: "production",

    baseUrl: "https://ana-api-tov0.onrender.com",
    healthEndpoint: "/api/observation",
    observationUrl:
      "https://ana-api-tov0.onrender.com/api/observation",

    enabled: true,

    database: "Webflow",
    deploymentProvider: "Render",
    frontendProvider: "Netlify",
    domain: "Production Syndicator",

    pollInterval: 60_000,

    thresholds: {
      degradedResponseMs: 6_000,
      offlineAfterFailures: 3,
    },

    metadata: {
      applicationType: "syndication",
      marketplace: "Apartments.com",
    },
  },

  {
    id: "snowman-utility",
    name: "Snowman Utility",
    displayName: "Snowman Utility",
    service: "Snowman Utility API",

    description:
      "Web3 funding, treasury, and governance platform.",

    connectionStatus:
      DEFAULT_APPLICATION_CONNECTION_STATUS.NOT_CONNECTED,

    environment: "Unknown",

    baseUrl: null,
    healthEndpoint: "/api/health",
    observationUrl: null,

    enabled: true,

    database: "Unknown",
    deploymentProvider: "Unknown",
    frontendProvider: "Netlify",
    domain: null,

    pollInterval: 60_000,

    thresholds: {
      degradedResponseMs: 1_500,
      offlineAfterFailures: 3,
    },

    metadata: {
      applicationType: "web3-utility",
    },
  },
];

/**
 * Creates a safe copy of a default application definition.
 *
 * @param {object} application
 * @returns {object}
 */
function cloneDefaultApplication(application) {
  return {
    ...application,

    thresholds: {
      ...(application.thresholds || {}),
    },

    metadata: {
      ...(application.metadata || {}),
    },
  };
}

/**
 * Return all default fleet definitions.
 *
 * This function does not register applications and does not communicate
 * with the Observation Lounge backend.
 *
 * @returns {object[]}
 */
export function getDefaultApplications() {
  return defaultApplications.map(cloneDefaultApplication);
}

/**
 * Return one default application definition.
 *
 * @param {string} applicationId
 * @returns {object|null}
 */
export function getDefaultApplication(applicationId) {
  const application = defaultApplications.find(
    (record) => record.id === applicationId,
  );

  return application
    ? cloneDefaultApplication(application)
    : null;
}

/**
 * Returns true when a default application definition exists.
 *
 * @param {string} applicationId
 * @returns {boolean}
 */
export function hasDefaultApplication(applicationId) {
  return defaultApplications.some(
    (application) => application.id === applicationId,
  );
}

/**
 * Legacy compatibility function.
 *
 * Older startup code may still call registerDefaultApplications().
 * It now returns the fleet definitions without sending POST requests.
 *
 * @returns {object[]}
 */
export function registerDefaultApplications() {
  return getDefaultApplications();
}