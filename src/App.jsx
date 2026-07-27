import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./App.css";

import {
  historyProcessor,
  incidentProcessor,
  metricsProcessor,
  observationEngine,
} from "./engine";

import {
  APPLICATION_CONNECTION_STATUS,
  checkApplicationHealth as checkRegistryApplicationHealth,
  getApplications,
  refreshApplicationRegistry,
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

function loadRegistryApplications() {
  return getApplications();
}

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [applicationHealth, setApplicationHealth] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [registryError, setRegistryError] = useState("");

  const [metricsState, setMetricsState] = useState(() =>
    metricsProcessor.getState(),
  );

  const [historyState, setHistoryState] = useState(() =>
    historyProcessor.getState(),
  );

  const [incidentState, setIncidentState] = useState(() =>
    incidentProcessor.getState(),
  
  );

  const initialHealthCheckStarted = useRef(false);

  /**
   * Applications loaded from the MongoDB-backed registry cache.
   */
  const [registeredApplications, setRegisteredApplications] = useState(() =>
    loadRegistryApplications(),
  );

  /**
   * Load the latest application registry from the backend after mount.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadApplications() {
      try {
        setRegistryLoading(true);
        setRegistryError("");

        const applications = await refreshApplicationRegistry();

        if (!cancelled) {
          setRegisteredApplications(applications);
        }
      } catch (error) {
        if (!cancelled) {
          setRegistryError(
            error.message || "Unable to load application registry.",
          );
        }
      } finally {
        if (!cancelled) {
          setRegistryLoading(false);
        }
      }
    }

    void loadApplications();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Only connected applications with an observation endpoint can be polled.
   */
  const monitorableApplications = useMemo(
    () =>
      registeredApplications.filter(
        (application) =>
          application.connectionStatus ===
            APPLICATION_CONNECTION_STATUS.CONNECTED &&
          Boolean(application.observationUrl),
      ),
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
   * Check one application through the MongoDB-backed registry and publish
   * the normalized result into the Observation Engine.
   */
  const checkApplicationHealth = useCallback(
    async (application) => {
      try {
        const {
          application: updatedApplication,
          check,
        } = await checkRegistryApplicationHealth(application.id);

        const result = {
          id: updatedApplication.id,
          name: updatedApplication.name,
          status:
            check?.healthStatus ||
            updatedApplication.healthStatus ||
            "Unknown",
          responseTime:
            check?.responseTime ??
            updatedApplication.lastResponseTime ??
            null,
          database:
            check?.databaseStatus ||
            updatedApplication.databaseStatus ||
            updatedApplication.database ||
            "Unknown",
          service:
            updatedApplication.service || updatedApplication.name,
          environment:
            updatedApplication.environment || "Unknown",
          uptimeSeconds:
            check?.uptimeSeconds ??
            check?.data?.uptimeSeconds ??
            null,
          checkedAt:
            updatedApplication.lastCheckedAt || new Date(),
          httpStatus: check?.httpStatus ?? null,
          reachable: check?.reachable ?? false,
          metrics: check?.metrics || {},
          widgets: check?.widgets || [],
          raw: check || null,
          error: check?.error || null,
        };

        setRegisteredApplications((current) =>
          current.map((registeredApplication) =>
            registeredApplication.id === application.id
              ? {
                  ...registeredApplication,
                  ...updatedApplication,
                }
              : registeredApplication,
          ),
        );

        setApplicationHealth((current) => ({
          ...current,
          [application.id]: result,
        }));

        publishHealthResult(result);

        return result;
      } catch (error) {
        const fallbackResult = {
          id: application.id,
          name: application.name,
          status: "Offline",
          responseTime: null,
          database: "Unknown",
          service: application.service || application.name,
          environment: application.environment || "Unknown",
          uptimeSeconds: null,
          checkedAt: new Date(),
          httpStatus: null,
          reachable: false,
          metrics: {},
          widgets: [],
          raw: null,
          error:
            error.message || "Unexpected health-check failure.",
        };

        setApplicationHealth((current) => ({
          ...current,
          [application.id]: fallbackResult,
        }));

        publishHealthResult(fallbackResult);

        return fallbackResult;
      }
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
   * Return to the dashboard, refresh the MongoDB registry, and then run
   * health checks against the refreshed fleet.
   */
  const showDashboard = useCallback(async () => {
    setActivePage("dashboard");

    try {
      setRegistryLoading(true);
      setRegistryError("");

      const applications = await refreshApplicationRegistry();

      setRegisteredApplications(applications);

      const connectedApplications = applications.filter(
        (application) =>
          application.connectionStatus ===
            APPLICATION_CONNECTION_STATUS.CONNECTED &&
          Boolean(application.observationUrl),
      );

      await Promise.all(
        connectedApplications.map((application) =>
          checkApplicationHealth(application),
        ),
      );
    } catch (error) {
      setRegistryError(
        error.message || "Unable to refresh application registry.",
      );
    } finally {
      setRegistryLoading(false);
    }
  }, [checkApplicationHealth]);

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
   * Run one initial fleet check after the registry loads and continue
   * monitoring every five minutes.
   */
  useEffect(() => {
    if (
      registryLoading ||
      monitorableApplications.length === 0
    ) {
      return undefined;
    }

    if (!initialHealthCheckStarted.current) {
      initialHealthCheckStarted.current = true;
      void checkAllApplications();
    }

    const intervalId = window.setInterval(() => {
      void checkAllApplications();
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    checkAllApplications,
    monitorableApplications.length,
    registryLoading,
  ]);

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
              onClick={() => {
                void showDashboard();
              }}
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

            {registryLoading && (
              <p className="application-message">
                Loading application registry...
              </p>
            )}

            {registryError && (
              <p className="application-error" role="alert">
                {registryError}
              </p>
            )}

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
