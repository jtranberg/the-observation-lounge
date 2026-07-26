import { useCallback, useEffect, useMemo, useState } from "react";

import "./App.css";

import { fetchApplicationHealth } from "./services/healthService";

import {
  historyProcessor,
  incidentProcessor,
  metricsProcessor,
  observationEngine,
} from "./engine";

import {
  APPLICATION_CONNECTION_STATUS,
  getApplications,
} from "./engine/registry/applicationRegistry";

import {
  EVENT_SEVERITY,
  EVENT_SOURCES,
  EVENT_TYPES,
} from "./engine/types/eventTypes";

import AppConnectionsPage from "../pages/AppConnectionsPage";

/**
 * ------------------------------------------------------------------
 * Observation Lounge
 * Main Application Dashboard
 * ------------------------------------------------------------------
 *
 * React is responsible only for:
 * - Requesting current health information
 * - Publishing normalized events into the Observation Engine
 * - Subscribing to processor state
 * - Rendering the dashboard
 *
 * Operational decisions such as incident detection and event history
 * are handled by the Observation Engine processors.
 * ------------------------------------------------------------------
 */

/**
 * Applications that have not yet been connected to the platform.
 */

/**
 * Formats an operational timestamp for display.
 *
 * @param {Date|string|null} date
 * @returns {string}
 */
function formatCheckedAt(date) {
  if (!date) {
    return "Never";
  }

  const parsedDate = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsedDate);
}

/**
 * Converts uptime seconds into a readable duration.
 *
 * @param {number|null|undefined} totalSeconds
 * @returns {string}
 */
function formatUptime(totalSeconds) {
  if (
    totalSeconds == null ||
    !Number.isFinite(totalSeconds) ||
    totalSeconds < 0
  ) {
    return "Unknown";
  }

  const seconds = Math.floor(totalSeconds);

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

/**
 * Maps operational statuses to CSS classes.
 *
 * @param {string} status
 * @returns {string}
 */
function getStatusClass(status) {
  switch (status) {
    case "Healthy":
      return "healthy";

    case "Degraded":
      return "degraded";

    case "Offline":
      return "offline";

    case "Checking":
      return "checking";

    default:
      return "unknown";
  }
}

/**
 * Formats API response time.
 *
 * @param {number|null|undefined} responseTime
 * @returns {string}
 */
function formatResponseTime(responseTime) {
  return responseTime != null ? `${responseTime} ms` : "—";
}

/**
 * Returns the status represented by an engine event.
 *
 * Health events carry their status inside the event payload.
 *
 * @param {object} event
 * @returns {string}
 */
function getEventStatus(event) {
  if (event.type === EVENT_TYPES.HEALTH_CHECK) {
    return event.payload?.status || "Unknown";
  }

  if (event.type === EVENT_TYPES.INCIDENT_OPENED) {
    return "Opened";
  }

  if (event.type === EVENT_TYPES.INCIDENT_RESOLVED) {
    return "Resolved";
  }

  return event.severity || "Info";
}

/**
 * Creates a readable event-stream label.
 *
 * @param {object} event
 * @returns {string}
 */
function getEventLabel(event) {
  if (event.type === EVENT_TYPES.HEALTH_CHECK) {
    return `${event.application} health check`;
  }

  if (event.type === EVENT_TYPES.INCIDENT_OPENED) {
    return `${event.application} incident opened`;
  }

  if (event.type === EVENT_TYPES.INCIDENT_RESOLVED) {
    return `${event.application} incident resolved`;
  }

  return event.message || event.type;
}

/**
 * Determines the CSS status class for an event.
 *
 * @param {object} event
 * @returns {string}
 */
function getEventStatusClass(event) {
  if (event.type === EVENT_TYPES.HEALTH_CHECK) {
    return getStatusClass(event.payload?.status);
  }

  if (event.type === EVENT_TYPES.INCIDENT_OPENED) {
    return "offline";
  }

  if (event.type === EVENT_TYPES.INCIDENT_RESOLVED) {
    return "healthy";
  }

  switch (event.severity) {
    case EVENT_SEVERITY.CRITICAL:
    case EVENT_SEVERITY.HIGH:
      return "offline";

    case EVENT_SEVERITY.MEDIUM:
      return "degraded";

    default:
      return "unknown";
  }
}

const CONNECTIONS_STORAGE_KEY = "observation-lounge-connections";

function normalizeSavedConnection(connection) {
  const latestObservation = connection.latestObservation || {};

  const observationApplication =
    latestObservation.application &&
    typeof latestObservation.application === "object"
      ? latestObservation.application
      : {};

  const observationService =
    latestObservation.service && typeof latestObservation.service === "object"
      ? latestObservation.service
      : {};

  const observationDatabase =
    latestObservation.database && typeof latestObservation.database === "object"
      ? latestObservation.database
      : {};

  return {
    ...connection,

    id: connection.id,
    name:
      observationApplication.name || connection.name || "Unnamed Application",

    service:
      observationService.name ||
      latestObservation.service ||
      connection.name ||
      "Unknown Service",

    description: connection.description || "",

    observationUrl: connection.observationUrl || null,
    dashboardUrl: connection.dashboardUrl || "",

    connectionStatus:
      connection.enabled === false
        ? APPLICATION_CONNECTION_STATUS.DISABLED
        : APPLICATION_CONNECTION_STATUS.CONNECTED,

    environment:
      latestObservation.environment || connection.environment || "Unknown",

    database:
      observationDatabase.status || latestObservation.database || "Unknown",

    deploymentProvider: connection.deploymentProvider || "Unknown",

    frontendProvider: connection.frontendProvider || "Unknown",

    domain: connection.dashboardUrl || connection.observationUrl || null,

    enabled: connection.enabled !== false,

    thresholds: {
      degradedResponseMs: 2_000,
      offlineAfterFailures: 3,
    },

    metadata: {
      applicationType: connection.appType || "custom",
      visibility: connection.visibility || "private",
      featured: connection.featured === true,
    },
  };
}

function getSavedRegistryApplications() {
  try {
    const storedValue = window.localStorage.getItem(CONNECTIONS_STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((connection) => connection && connection.id)
      .map(normalizeSavedConnection);
  } catch (error) {
    console.error("Unable to load saved application registry:", error);

    return [];
  }
}

function loadRegistryApplications() {
  const savedApplications = getSavedRegistryApplications();

  return savedApplications.length > 0 ? savedApplications : getApplications();
}

function getProspectorObservationUrl() {
  const configuredUrl = import.meta.env.VITE_PROSPECTOR_API_URL?.trim();

  if (!configuredUrl) {
    return import.meta.env.DEV ? "http://localhost:5050/api/health" : "";
  }

  const normalizedUrl = configuredUrl.replace(/\/+$/, "");

  return normalizedUrl.endsWith("/api/health")
    ? normalizedUrl
    : `${normalizedUrl}/api/health`;
}

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [applicationHealth, setApplicationHealth] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const [metricsState, setMetricsState] = useState(() =>
    metricsProcessor.getState(),
  );

  const [historyState, setHistoryState] = useState(() =>
    historyProcessor.getState(),
  );

  const [incidentState, setIncidentState] = useState(() =>
    incidentProcessor.getState(),
  );

  /**
   * Application definitions supplied by the Connections registry.
   *
   * Browser-saved registry entries are preferred. The code registry is
   * retained as a fallback until the registry is moved to a shared API.
   */
  const [registeredApplications, setRegisteredApplications] = useState(() =>
    loadRegistryApplications(),
  );

 function showDashboard() {
  setActivePage("dashboard");
}
  /**
   * Reload registry entries when another tab changes localStorage.
   */
  useEffect(() => {
    function handleStorageChange(event) {
      if (event.key && event.key !== CONNECTIONS_STORAGE_KEY) {
        return;
      }

      setRegisteredApplications(loadRegistryApplications());
    }

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  /**
   * Only connected applications with an observation endpoint can be polled.
   */
  const monitorableApplications = useMemo(
    () =>
      registeredApplications
        .filter(
          (application) =>
            application.connectionStatus ===
            APPLICATION_CONNECTION_STATUS.CONNECTED,
        )
        .map((application) => {
          if (application.observationUrl) {
            return application;
          }

          if (application.id === "prospector") {
            return {
              ...application,
              observationUrl: getProspectorObservationUrl(),
            };
          }

          return application;
        })
        .filter((application) => Boolean(application.observationUrl)),
    [registeredApplications],
  );

  /**
   * Publish a normalized application health result into the engine.
   */
  const publishHealthResult = useCallback((result) => {
    const applicationName = result.name || result.id || "Unknown application";

    observationEngine.publish({
      type: EVENT_TYPES.HEALTH_CHECK,
      application: applicationName,
      source: EVENT_SOURCES.API,
      severity:
        result.status === "Offline"
          ? EVENT_SEVERITY.HIGH
          : result.status === "Degraded"
            ? EVENT_SEVERITY.MEDIUM
            : EVENT_SEVERITY.INFO,
      message: `${applicationName} health check: ${result.status}`,
      payload: result,
      timestamp: result.checkedAt || new Date(),
    });
  }, []);

  /**
   * Check one application and store the latest normalized result by ID.
   */
  const checkApplicationHealth = useCallback(
    async (application) => {
      const result = await fetchApplicationHealth(application);

      setApplicationHealth((current) => ({
        ...current,
        [application.id]: result,
      }));

      publishHealthResult(result);

      return result;
    },
    [publishHealthResult],
  );

  /**
   * Check every connected application in parallel.
   */
  const checkAllApplications = useCallback(
    async ({ manual = false } = {}) => {
      if (manual) {
        setRefreshing(true);
      }

      try {
        await Promise.all(
          monitorableApplications.map((application) =>
            checkApplicationHealth(application),
          ),
        );
      } finally {
        if (manual) {
          setRefreshing(false);
        }
      }
    },
    [checkApplicationHealth, monitorableApplications],
  );

  /**
   * Subscribe React to processor-owned operational state.
   */
  useEffect(() => {
    const unsubscribeHistory = historyProcessor.subscribe((nextState) => {
      setHistoryState(nextState);
    });

    const unsubscribeIncidents = incidentProcessor.subscribe((nextState) => {
      setIncidentState(nextState);
    });

    const unsubscribeMetrics = metricsProcessor.subscribe((nextState) => {
      setMetricsState(nextState);
    });

    return () => {
      unsubscribeHistory();
      unsubscribeIncidents();
      unsubscribeMetrics();
    };
  }, []);

  /**
   * Run an initial fleet check and continue monitoring every 30 seconds.
   */
  useEffect(() => {
    const initialCheckId = window.setTimeout(() => {
      void checkAllApplications();
    }, 0);

    const intervalId = window.setInterval(() => {
      void checkAllApplications();
    }, 30_000);

    return () => {
      window.clearTimeout(initialCheckId);
      window.clearInterval(intervalId);
    };
  }, [checkAllApplications]);

  /**
   * Merge registry configuration with current health results.
   */
  const applications = useMemo(
    () =>
      registeredApplications.map((application) => {
        const liveHealth = applicationHealth[application.id];

        if (liveHealth) {
          return {
            ...application,
            ...liveHealth,
            id: application.id,
            name: application.name,
            service:
              liveHealth.service || application.service || application.name,
          };
        }

        return {
          ...application,
          status:
            application.connectionStatus ===
            APPLICATION_CONNECTION_STATUS.CONNECTED
              ? "Checking"
              : application.connectionStatus,
          responseTime: null,
          uptimeSeconds: null,
          checkedAt: null,
          error: null,
          metrics: {},
          widgets: [],
        };
      }),
    [applicationHealth, registeredApplications],
  );

  /**
   * Processor-owned operational state.
   */
  const healthHistory = historyState.events;
  const incidents = incidentState.incidents;
  const openIncidents = incidentState.open;

  /**
   * Fleet metrics.
   */
  const healthyApplications = applications.filter(
    (application) => application.status === "Healthy",
  ).length;

  const degradedApplications = applications.filter(
    (application) => application.status === "Degraded",
  ).length;

  const offlineApplications = applications.filter(
    (application) => application.status === "Offline",
  ).length;

  const checkingApplications = applications.filter(
    (application) => application.status === "Checking",
  ).length;

  const applicationsNeedingAttention =
    degradedApplications + offlineApplications;

  const averageSessionResponse = metricsState.health.averageResponseTime;

  const connectedApplications = applications.filter(
    (application) =>
      application.connectionStatus === APPLICATION_CONNECTION_STATUS.CONNECTED,
  );

  const overallHealthy =
    connectedApplications.length > 0 &&
    connectedApplications.every(
      (application) => application.status === "Healthy",
    );

  /**
   * Fleet-wide status shown in the Lounge header.
   */
  const connectedApplicationCount = connectedApplications.length;

  let systemStatusLabel = "All connected applications healthy";

  if (connectedApplicationCount === 0) {
    systemStatusLabel = "No applications connected";
  } else if (offlineApplications > 0) {
    systemStatusLabel = `${offlineApplications} offline`;
  } else if (degradedApplications > 0) {
    systemStatusLabel = `${degradedApplications} degraded`;
  } else if (checkingApplications > 0) {
    systemStatusLabel = "Checking application fleet";
  }

  return (
    <main className="lounge-shell">
      {/* Observation Lounge header */}
      <header className="lounge-header">
        <div className="lounge-brand">
          <img
            src="/observation-lounge.png"
            alt="Observation Lounge"
            className="lounge-logo"
          />

          <div>
            <p className="eyebrow">Operational Intelligence Platform</p>

            <h1>OBSERVATION LOUNGE</h1>

            <p className="subtitle">
              Mission control for your production applications. Observe. Detect.
              Respond.
            </p>
          </div>
        </div>

        <div className="lounge-header-actions">
          <nav
            className="lounge-navigation"
            aria-label="Observation Lounge navigation"
          >
            <button
              className={`navigation-button ${
                activePage === "dashboard" ? "active" : ""
              }`}
              type="button"
              onClick={showDashboard}
            >
              Dashboard
            </button>

            <button
              className={`navigation-button ${
                activePage === "connections" ? "active" : ""
              }`}
              type="button"
              onClick={() => setActivePage("connections")}
            >
              Connections
            </button>
          </nav>

          <div
            className={`system-status ${
              overallHealthy ? "system-status-healthy" : "system-status-warning"
            }`}
          >
            <span className="status-dot" />
            {systemStatusLabel}
          </div>
        </div>
      </header>

      {activePage === "dashboard" && (
        <>
          {/* Fleet summary */}
          <section className="summary-grid" aria-label="Fleet health summary">
            <article className="metric-card">
              <span>Applications</span>
              <strong>{applications.length}</strong>
            </article>

            <article className="metric-card">
              <span>Healthy</span>
              <strong>{healthyApplications}</strong>
            </article>

            <article className="metric-card">
              <span>Needs attention</span>
              <strong>{applicationsNeedingAttention}</strong>
            </article>

            <article className="metric-card">
              <span>Average response</span>
              <strong>{formatResponseTime(averageSessionResponse)}</strong>
            </article>

            <article className="metric-card">
              <span>Open incidents</span>
              <strong>{openIncidents}</strong>
            </article>
          </section>

          {/* Application fleet cards */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Fleet status</p>
                <h2>Applications</h2>
              </div>

              <button
                className="refresh-button"
                type="button"
                onClick={() => {
                  void checkAllApplications({
                    manual: true,
                  });
                }}
                disabled={refreshing}
              >
                {refreshing ? "Checking..." : "Refresh health"}
              </button>
            </div>

            <div className="application-grid">
              {applications.map((application) => {
                const statusClass = getStatusClass(application.status);

                return (
                  <article className="application-card" key={application.id}>
                    <div className="application-topline">
                      <h3>{application.name}</h3>

                      <span className={`status-badge ${statusClass}`}>
                        {application.status}
                      </span>
                    </div>

                    <dl>
                      <div>
                        <dt>Service</dt>
                        <dd>{application.service || "Unknown"}</dd>
                      </div>

                      <div>
                        <dt>Response</dt>
                        <dd>{formatResponseTime(application.responseTime)}</dd>
                      </div>

                      <div>
                        <dt>Database</dt>
                        <dd>{application.database || "Unknown"}</dd>
                      </div>

                      <div>
                        <dt>Environment</dt>
                        <dd>{application.environment || "Unknown"}</dd>
                      </div>

                      <div>
                        <dt>Backend</dt>
                        <dd>{application.deploymentProvider || "Unknown"}</dd>
                      </div>

                      <div>
                        <dt>Frontend</dt>
                        <dd>{application.frontendProvider || "Unknown"}</dd>
                      </div>

                      <div>
                        <dt>Domain</dt>
                        <dd>{application.domain || "Not configured"}</dd>
                      </div>

                      <div>
                        <dt>Uptime</dt>
                        <dd>{formatUptime(application.uptimeSeconds)}</dd>
                      </div>

                      <div>
                        <dt>Last checked</dt>
                        <dd>{formatCheckedAt(application.checkedAt)}</dd>
                      </div>
                    </dl>

                    {application.error && (
                      <p className="application-error" role="alert">
                        {application.error}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {/* Engine-managed incident centre */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Incident centre</p>
                <h2>Incidents</h2>
              </div>

              <span className="event-count">
                {incidentState.open} open · {incidentState.resolved} resolved
              </span>
            </div>

            <div className="incident-list">
              {incidents.length === 0 ? (
                <div className="event-empty">
                  No incidents recorded during this session.
                </div>
              ) : (
                incidents.map((incident) => (
                  <article className="incident-row" key={incident.id}>
                    <div>
                      <strong>{incident.title}</strong>

                      <p>
                        {incident.application} ·{" "}
                        {formatCheckedAt(incident.openedAt)}
                        {incident.resolvedAt
                          ? ` · Resolved ${formatCheckedAt(
                              incident.resolvedAt,
                            )}`
                          : ""}
                      </p>
                    </div>

                    <div className="incident-meta">
                      <span className={`severity-badge ${incident.severity}`}>
                        {incident.severity}
                      </span>

                      <span
                        className={`incident-status ${incident.status.toLowerCase()}`}
                      >
                        {incident.status}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          {/* Engine-managed event history */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Live activity</p>
                <h2>Event stream</h2>
              </div>

              <span className="event-count">
                {healthHistory.length} recent{" "}
                {healthHistory.length === 1 ? "event" : "events"}
              </span>
            </div>

            <div className="event-list">
              {healthHistory.length === 0 ? (
                <div className="event-empty">
                  Waiting for the first engine event...
                </div>
              ) : (
                healthHistory.map((event) => {
                  const eventStatus = getEventStatus(event);

                  const eventStatusClass = getEventStatusClass(event);

                  const responseTime =
                    event.type === EVENT_TYPES.HEALTH_CHECK
                      ? event.payload?.responseTime
                      : null;

                  return (
                    <div className="event-row" key={event.id}>
                      <span>{formatCheckedAt(event.timestamp)}</span>

                      <strong>{getEventLabel(event)}</strong>

                      <em className={`event-status ${eventStatusClass}`}>
                        {eventStatus}

                        {responseTime != null ? ` · ${responseTime} ms` : ""}
                      </em>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}

      {activePage === "connections" && (
        <AppConnectionsPage registeredApplications={registeredApplications} />
      )}
    </main>
  );
}
