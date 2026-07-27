/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Application Registry
 * ------------------------------------------------------------------
 *
 * Frontend registry and API client for applications stored by the
 * Observation Lounge backend.
 *
 * MongoDB is the permanent source of truth.
 * This module maintains a local read-only cache for the dashboard and
 * Observation Engine.
 * ------------------------------------------------------------------
 */

export const APPLICATION_CONNECTION_STATUS = Object.freeze({
  CONNECTED: "Connected",
  NOT_CONNECTED: "Not Connected",
  DISABLED: "Disabled",
});

const API_BASE_URL = String(
  import.meta.env.VITE_OBSERVATION_LOUNGE_API_URL ||
    (import.meta.env.DEV ? "http://localhost:5055" : ""),
)
  .trim()
  .replace(/\/+$/, "");

const applications = new Map();

let registryLoaded = false;
let registryLoadingPromise = null;

/**
 * Build an API URL.
 *
 * @param {string} path
 * @returns {string}
 */
function buildApiUrl(path) {
  if (!API_BASE_URL) {
    throw new Error(
      "VITE_OBSERVATION_LOUNGE_API_URL is not configured.",
    );
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Safely clone a registry record.
 *
 * @param {object} application
 * @returns {object}
 */
function cloneApplication(application) {
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
 * Normalize an application returned by the backend.
 *
 * @param {object} application
 * @returns {object}
 */
function normalizeApplication(application) {
  const logicalId = application.name || application.id;

  return {
    id: logicalId,
    mongoId: application._id || application.mongoId || null,

    name:
      application.displayName ||
      application.name ||
      "Unnamed Application",

    registryName: application.name || logicalId,

    service: application.service || "Unknown Service",

    description: application.description || "",

    connectionStatus:
      application.connectionStatus ||
      APPLICATION_CONNECTION_STATUS.NOT_CONNECTED,

    healthStatus: application.healthStatus || "Unknown",

    environment: application.environment || "Unknown",

    observationUrl:
      application.healthUrl ||
      buildObservationUrl(
        application.baseUrl,
        application.healthEndpoint,
      ),

    baseUrl: application.baseUrl || "",

    healthEndpoint:
      application.healthEndpoint || "/api/health",

    enabled: application.enabled ?? true,

    database:
      application.databaseStatus ||
      application.database ||
      "Unknown",

    databaseStatus:
      application.databaseStatus || "Unknown",

    owner: application.owner || "",

    pollInterval: application.pollInterval ?? 60_000,

    lastCheckedAt: application.lastCheckedAt || null,

    lastResponseTime: application.lastResponseTime ?? null,

    createdAt: application.createdAt || null,

    updatedAt: application.updatedAt || null,

    thresholds: {
      degradedResponseMs:
        application.thresholds?.degradedResponseMs ?? 1_500,

      offlineAfterFailures:
        application.thresholds?.offlineAfterFailures ?? 3,

      ...(application.thresholds || {}),
    },

    metadata: {
      ...(application.metadata || {}),
    },
  };
}

/**
 * Build an observation URL from a base URL and endpoint.
 *
 * @param {string} baseUrl
 * @param {string} endpoint
 * @returns {string|null}
 */
function buildObservationUrl(baseUrl, endpoint = "/api/health") {
  const normalizedBaseUrl = String(baseUrl || "")
    .trim()
    .replace(/\/+$/, "");

  if (!normalizedBaseUrl) {
    return null;
  }

  const normalizedEndpoint = String(endpoint || "/api/health")
    .trim()
    .replace(/^\/?/, "/");

  if (normalizedBaseUrl.endsWith(normalizedEndpoint)) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}${normalizedEndpoint}`;
}

/**
 * Perform an API request and return its JSON response.
 *
 * @param {string} path
 * @param {RequestInit} options
 * @returns {Promise<object>}
 */
async function apiRequest(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...options,

    headers: {
      Accept: "application/json",
      ...(options.body
        ? {
            "Content-Type": "application/json",
          }
        : {}),
      ...(options.headers || {}),
    },
  });

  let payload;

try {
  payload = await response.json();
} catch {
  payload = null;
}

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        `Observation Lounge API request failed with status ${response.status}.`,
    );
  }

  return payload;
}

/**
 * Replace the local cache with applications returned by the API.
 *
 * @param {object[]} records
 */
function replaceRegistryCache(records) {
  applications.clear();

  for (const record of records) {
    const application = normalizeApplication(record);

    if (!application.id) {
      continue;
    }

    applications.set(application.id, application);
  }

  registryLoaded = true;
}

/**
 * Load the current application fleet from MongoDB.
 *
 * Concurrent callers share the same request.
 *
 * @returns {Promise<object[]>}
 */
export async function loadApplicationRegistry() {
  if (registryLoadingPromise) {
    return registryLoadingPromise;
  }

  registryLoadingPromise = apiRequest("/api/applications")
    .then((payload) => {
      replaceRegistryCache(payload.applications || []);

      return getApplications({
        includeDisabled: true,
      });
    })
    .finally(() => {
      registryLoadingPromise = null;
    });

  return registryLoadingPromise;
}

/**
 * Refresh the registry from MongoDB.
 *
 * @returns {Promise<object[]>}
 */
export async function refreshApplicationRegistry() {
  return loadApplicationRegistry();
}

/**
 * Register a new application through the backend.
 *
 * @param {object} application
 * @returns {Promise<object>}
 */
export async function registerApplication(application) {
  const payload = await apiRequest("/api/applications", {
    method: "POST",
    body: JSON.stringify(application),
  });

  const normalizedApplication = normalizeApplication(
    payload.application,
  );

  applications.set(
    normalizedApplication.id,
    normalizedApplication,
  );

  return cloneApplication(normalizedApplication);
}

/**
 * Update an existing application through the backend.
 *
 * @param {string} applicationId
 * @param {object} updates
 * @returns {Promise<object>}
 */
export async function updateApplication(applicationId, updates) {
  const current = applications.get(applicationId);

  if (!current) {
    throw new Error(
      `Application "${applicationId}" is not registered.`,
    );
  }

  if (!current.mongoId) {
    throw new Error(
      `Application "${applicationId}" does not have a MongoDB ID.`,
    );
  }

  const payload = await apiRequest(
    `/api/applications/${current.mongoId}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    },
  );

  const normalizedApplication = normalizeApplication(
    payload.application,
  );

  applications.delete(applicationId);

  applications.set(
    normalizedApplication.id,
    normalizedApplication,
  );

  return cloneApplication(normalizedApplication);
}

/**
 * Run a live health check through the Observation Lounge backend.
 *
 * @param {string} applicationId
 * @returns {Promise<object>}
 */
export async function checkApplicationHealth(applicationId) {
  const current = applications.get(applicationId);

  if (!current) {
    throw new Error(
      `Application "${applicationId}" is not registered.`,
    );
  }

  if (!current.mongoId) {
    throw new Error(
      `Application "${applicationId}" does not have a MongoDB ID.`,
    );
  }

  const payload = await apiRequest(
    `/api/applications/${current.mongoId}/check`,
    {
      method: "POST",
    },
  );

  const normalizedApplication = normalizeApplication(
    payload.application,
  );

  applications.set(
    normalizedApplication.id,
    normalizedApplication,
  );

  return {
    application: cloneApplication(normalizedApplication),
    check: payload.check,
  };
}

/**
 * Return one cached application by logical ID.
 *
 * @param {string} applicationId
 * @returns {object|null}
 */
export function getApplication(applicationId) {
  const application = applications.get(applicationId);

  return application ? cloneApplication(application) : null;
}

/**
 * Return all cached applications.
 *
 * Call loadApplicationRegistry() during application startup before
 * relying on this method.
 *
 * @param {object} options
 * @param {boolean} options.includeDisabled
 * @returns {object[]}
 */
export function getApplications({ includeDisabled = false } = {}) {
  return Array.from(applications.values())
    .filter(
      (application) =>
        includeDisabled || application.enabled,
    )
    .map(cloneApplication);
}

/**
 * Return applications ready for live monitoring.
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
 * Remove an application through the backend.
 *
 * @param {string} applicationId
 * @returns {Promise<boolean>}
 */
export async function unregisterApplication(applicationId) {
  const current = applications.get(applicationId);

  if (!current) {
    return false;
  }

  if (!current.mongoId) {
    throw new Error(
      `Application "${applicationId}" does not have a MongoDB ID.`,
    );
  }

  await apiRequest(`/api/applications/${current.mongoId}`, {
    method: "DELETE",
  });

  return applications.delete(applicationId);
}

/**
 * Returns true when an application exists in the local cache.
 *
 * @param {string} applicationId
 * @returns {boolean}
 */
export function hasApplication(applicationId) {
  return applications.has(applicationId);
}

/**
 * Return registry statistics from the local cache.
 *
 * @returns {object}
 */
export function getApplicationRegistryStatistics() {
  const registeredApplications = getApplications({
    includeDisabled: true,
  });

  return {
    total: registeredApplications.length,

    enabled: registeredApplications.filter(
      (application) => application.enabled,
    ).length,

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
 * Returns whether the first registry load has completed.
 *
 * @returns {boolean}
 */
export function isApplicationRegistryLoaded() {
  return registryLoaded;
}

/**
 * Clear the frontend registry cache.
 *
 * This does not delete records from MongoDB.
 */
export function clearApplicationRegistry() {
  applications.clear();
  registryLoaded = false;
}