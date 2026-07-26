import {
  APPLICATION_CONNECTION_STATUS,
  hasApplication,
  registerApplication,
} from "./applicationRegistry";

/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Default Application Registration
 * ------------------------------------------------------------------
 *
 * Registers the initial software fleet.
 *
 * Registration is idempotent, meaning Vite hot reloads will not cause
 * duplicate-application errors.
 * ------------------------------------------------------------------
 */

const PROSPECTOR_API_URL =
  import.meta.env.VITE_PROSPECTOR_API_URL ||
  "http://localhost:5050";

/**
 * Register an application only when it does not already exist.
 *
 * @param {object} application
 */
function registerIfMissing(application) {
  if (hasApplication(application.id)) {
    return;
  }

  registerApplication(application);
}

/**
 * Register the current Observation Lounge fleet.
 */
export function registerDefaultApplications() {
  registerIfMissing({
    id: "prospector",
    name: "Prospector",
    service: "The Prospector API",
    description:
      "Hockey intelligence and scouting platform.",
    connectionStatus:
      APPLICATION_CONNECTION_STATUS.CONNECTED,
    environment: import.meta.env.MODE,
    healthUrl: `${PROSPECTOR_API_URL}/api/health`,
    enabled: true,
    database: "MongoDB Atlas",
    deploymentProvider: "Render",
    frontendProvider: "Netlify",
    domain: "unitedsportsprospector.com",
    thresholds: {
      degradedResponseMs: 1_000,
      offlineAfterFailures: 3,
    },
  });

  registerIfMissing({
    id: "fan7",
    name: "Fan7",
    service: "Fan7 API",
    description:
      "Automotive customer experience and operations platform.",
    connectionStatus:
      APPLICATION_CONNECTION_STATUS.NOT_CONNECTED,
    environment: "Unknown",
    healthUrl: null,
    enabled: true,
    database: "MongoDB Atlas",
    deploymentProvider: "Unknown",
    frontendProvider: "Netlify",
    domain: "fan7.netlify.app",
  });

  registerIfMissing({
    id: "syndicator",
    name: "Syndicator",
    service: "Property Feed API",
    description:
      "Production rental inventory syndication platform.",
    connectionStatus:
      APPLICATION_CONNECTION_STATUS.NOT_CONNECTED,
    environment: "Unknown",
    healthUrl: null,
    enabled: true,
    database: "Unknown",
    deploymentProvider: "Render",
    frontendProvider: "Netlify",
    domain: null,
  });

  registerIfMissing({
    id: "snowman-utility",
    name: "Snowman Utility",
    service: "Snowman Utility API",
    description:
      "Web3 funding, treasury, and governance platform.",
    connectionStatus:
      APPLICATION_CONNECTION_STATUS.NOT_CONNECTED,
    environment: "Unknown",
    healthUrl: null,
    enabled: true,
    database: "Unknown",
    deploymentProvider: "Unknown",
    frontendProvider: "Netlify",
    domain: null,
  });
}