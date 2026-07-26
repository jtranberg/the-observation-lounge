/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Application Health Service
 * ------------------------------------------------------------------
 *
 * Performs health checks against registered application observation
 * endpoints and returns one consistent object for the Lounge engine.
 *
 * Responsibilities:
 * - Measure response latency
 * - Detect timeouts and unavailable applications
 * - Support optional authentication
 * - Normalize different backend response formats
 * - Preserve widget declarations returned by applications
 * - Return a consistent operational result
 * ------------------------------------------------------------------
 */

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Normalize a backend status value into a Lounge status.
 *
 * @param {unknown} value
 * @returns {"Healthy" | "Degraded" | "Offline"}
 */
function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();

  if (
    status === "healthy" ||
    status === "operational" ||
    status === "online" ||
    status === "ok" ||
    status === "connected"
  ) {
    return "Healthy";
  }

  if (
    status === "degraded" ||
    status === "warning" ||
    status === "partial" ||
    status === "maintenance"
  ) {
    return "Degraded";
  }

  if (
    status === "offline" ||
    status === "failed" ||
    status === "failure" ||
    status === "unavailable" ||
    status === "disconnected"
  ) {
    return "Offline";
  }

  return "Healthy";
}

/**
 * Build request headers for a registered application.
 *
 * @param {object} application
 * @returns {Record<string, string>}
 */
function createHeaders(application) {
  const headers = {
    Accept: "application/json",
  };

  if (
    application.authType === "bearer" &&
    application.authToken
  ) {
    headers.Authorization = `Bearer ${application.authToken}`;
  }

  if (
    application.authType === "api-key" &&
    application.authToken
  ) {
    headers["x-observation-key"] = application.authToken;
  }

  return headers;
}

/**
 * Extract a status from several supported observation formats.
 *
 * Supported examples:
 *
 * { ok: true }
 * { status: "healthy" }
 * { status: { state: "operational" } }
 * { health: { status: "healthy" } }
 *
 * @param {object} data
 * @returns {"Healthy" | "Degraded" | "Offline"}
 */
function getNormalizedStatus(data) {
  if (data?.ok === false || data?.success === false) {
    return "Degraded";
  }

  const backendStatus =
    data?.status?.state ||
    data?.status?.value ||
    data?.status ||
    data?.health?.status ||
    data?.health?.state ||
    (data?.ok === true ? "healthy" : null) ||
    (data?.success === true ? "healthy" : null);

  return normalizeStatus(backendStatus);
}

/**
 * Perform one health check for a registered application.
 *
 * @param {object} application
 * @param {string} application.id
 * @param {string} application.name
 * @param {string} application.observationUrl
 * @param {string} [application.environment]
 * @param {string} [application.authType]
 * @param {string} [application.authToken]
 * @param {number} [timeoutMs]
 */
export async function fetchApplicationHealth(
  application,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const startedAt = performance.now();
  const checkedAt = new Date();

  try {
    if (!application?.observationUrl) {
      throw new Error("Observation endpoint is not configured");
    }

    console.log("HEALTH CHECK REQUEST", {
  application: application.name,
  url: application.observationUrl,
});

    const response = await fetch(application.observationUrl, {
      method: "GET",
      headers: createHeaders(application),
      signal: controller.signal,
    });

    const responseTime = Math.round(
      performance.now() - startedAt,
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Observation endpoint did not return valid JSON",
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Health check returned HTTP ${response.status}`,
      );
    }

    return {
      id: application.id,
      name:
        data.application?.name ||
        data.application ||
        data.name ||
        application.name,

      status: getNormalizedStatus(data),

      responseTime,

      service:
        data.service?.name ||
        data.service ||
        application.service ||
        application.name,

      environment:
        data.environment ||
        application.environment ||
        "Unknown",

      version:
        data.version ||
        data.service?.version ||
        "Unknown",

      database:
        data.database?.status ||
        data.database ||
        data.mongo?.status ||
        data.mongo ||
        data.db?.status ||
        data.db ||
        "Unknown",

      uptimeSeconds:
        data.uptimeSeconds ??
        data.uptime?.seconds ??
        data.uptime ??
        null,

      checkedAt,

      message:
        data.status?.message ||
        data.message ||
        "Observation endpoint responded successfully.",

      metrics:
        data.metrics && typeof data.metrics === "object"
          ? data.metrics
          : {},

      widgets:
        Array.isArray(data.widgets)
          ? data.widgets
          : [],

      raw: data,

      error: null,
    };
  } catch (error) {
    return {
      id: application?.id,
      name: application?.name || "Unknown Application",

      status: "Offline",

      responseTime: null,

      service:
        application?.service ||
        application?.name ||
        "Unknown Service",

      environment:
        application?.environment ||
        "Unknown",

      version: "Unknown",

      database: "Unknown",

      uptimeSeconds: null,

      checkedAt,

      message: "",

      metrics: {},

      widgets: [],

      raw: null,

      error:
        error.name === "AbortError"
          ? `Health check timed out after ${timeoutMs} ms`
          : error.message ||
            "Unable to reach observation endpoint",
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}