import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "observation-lounge-connections";

const initialForm = {
  name: "",
  description: "",
  appType: "saas",
  environment: "production",
  observationUrl: "",
  dashboardUrl: "",
  authType: "bearer",
  authToken: "",
  pollingIntervalMinutes: 5,
  visibility: "private",
  enabled: true,
  featured: false,
};

function createConnectionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `connection-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function normalizeUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function getStoredConnections() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    console.error("Unable to read stored connections:", error);
    return [];
  }
}

function getStatusLabel(connection) {
  if (!connection.enabled) {
    return "Disabled";
  }

  return connection.lastTestStatus || "Not tested";
}

export default function AppConnectionsPage() {
  const [connections, setConnections] = useState(getStoredConnections);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
  }, [connections]);

  const enabledConnections = useMemo(
    () => connections.filter((connection) => connection.enabled),
    [connections]
  );

  function updateField(event) {
    const { name, type, checked, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : name === "pollingIntervalMinutes"
            ? Number(value)
            : value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setFormMessage("");
    setFormError("");
  }

  function validateForm() {
    if (!form.name.trim()) {
      return "Application name is required.";
    }

    if (!form.observationUrl.trim()) {
      return "Observation API URL is required.";
    }

    try {
      new URL(form.observationUrl);
    } catch {
      return "Enter a valid observation API URL.";
    }

    if (form.dashboardUrl.trim()) {
      try {
        new URL(form.dashboardUrl);
      } catch {
        return "Enter a valid dashboard URL.";
      }
    }

    if (
      form.authType !== "none" &&
      !form.authToken.trim() &&
      !editingId
    ) {
      return "An observation token is required for this authentication type.";
    }

    return "";
  }

  function handleSubmit(event) {
    event.preventDefault();

    setFormMessage("");
    setFormError("");

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    const timestamp = new Date().toISOString();

    if (editingId) {
      setConnections((current) =>
        current.map((connection) => {
          if (connection.id !== editingId) {
            return connection;
          }

          return {
            ...connection,
            ...form,
            name: form.name.trim(),
            description: form.description.trim(),
            observationUrl: normalizeUrl(form.observationUrl),
            dashboardUrl: normalizeUrl(form.dashboardUrl),
            authToken:
              form.authToken.trim() || connection.authToken || "",
            updatedAt: timestamp,
          };
        })
      );

      setFormMessage("Application connection updated.");
    } else {
      const newConnection = {
        id: createConnectionId(),
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        observationUrl: normalizeUrl(form.observationUrl),
        dashboardUrl: normalizeUrl(form.dashboardUrl),
        authToken: form.authToken.trim(),
        lastTestStatus: "",
        lastTestMessage: "",
        lastTestedAt: "",
        lastResponseTimeMs: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      setConnections((current) => [newConnection, ...current]);
      setFormMessage("Application connection added.");
    }

    setForm(initialForm);
    setEditingId(null);
  }

  function editConnection(connection) {
    setEditingId(connection.id);
    setFormMessage("");
    setFormError("");

    setForm({
      name: connection.name || "",
      description: connection.description || "",
      appType: connection.appType || "saas",
      environment: connection.environment || "production",
      observationUrl: connection.observationUrl || "",
      dashboardUrl: connection.dashboardUrl || "",
      authType: connection.authType || "none",
      authToken: "",
      pollingIntervalMinutes:
        connection.pollingIntervalMinutes || 5,
      visibility: connection.visibility || "private",
      enabled: connection.enabled !== false,
      featured: connection.featured === true,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function toggleConnection(connectionId) {
    setConnections((current) =>
      current.map((connection) =>
        connection.id === connectionId
          ? {
              ...connection,
              enabled: !connection.enabled,
              updatedAt: new Date().toISOString(),
            }
          : connection
      )
    );
  }

  function removeConnection(connectionId) {
    const connection = connections.find(
      (item) => item.id === connectionId
    );

    const confirmed = window.confirm(
      `Remove the connection for ${
        connection?.name || "this application"
      }?`
    );

    if (!confirmed) {
      return;
    }

    setConnections((current) =>
      current.filter((item) => item.id !== connectionId)
    );

    if (editingId === connectionId) {
      resetForm();
    }
  }

  async function testConnection(connection) {
    setTestingId(connection.id);

    const startedAt = performance.now();

    try {
      const headers = {
        Accept: "application/json",
      };

      if (
        connection.authType === "bearer" &&
        connection.authToken
      ) {
        headers.Authorization = `Bearer ${connection.authToken}`;
      }

      if (
        connection.authType === "api-key" &&
        connection.authToken
      ) {
        headers["x-observation-key"] = connection.authToken;
      }

      const response = await fetch(connection.observationUrl, {
        method: "GET",
        headers,
      });

      const responseTimeMs = Math.round(
        performance.now() - startedAt
      );

      let responseBody = null;

      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }

      if (!response.ok) {
        throw new Error(
          responseBody?.message ||
            `Observation endpoint returned HTTP ${response.status}.`
        );
      }

      const state =
        responseBody?.status?.state ||
        responseBody?.status ||
        "operational";

      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                lastTestStatus:
                  state === "operational"
                    ? "Operational"
                    : String(state),
                lastTestMessage:
                  responseBody?.status?.message ||
                  "Observation endpoint responded successfully.",
                lastTestedAt: new Date().toISOString(),
                lastResponseTimeMs: responseTimeMs,
                latestObservation: responseBody,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
    } catch (error) {
      const responseTimeMs = Math.round(
        performance.now() - startedAt
      );

      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                lastTestStatus: "Connection failed",
                lastTestMessage:
                  error.message || "Unable to reach observation endpoint.",
                lastTestedAt: new Date().toISOString(),
                lastResponseTimeMs: responseTimeMs,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
    } finally {
      setTestingId(null);
    }
  }

  return (
    <main className="page-shell connections-page">
      <section className="page-header">
        <p className="eyebrow">Application Registry</p>
        <h1>App Connections</h1>

        <p>
          Register applications and connect their observation API routes
          without hard-coding new application cards.
        </p>
      </section>

      <section className="connection-summary">
        <article>
          <strong>{connections.length}</strong>
          <span>Total applications</span>
        </article>

        <article>
          <strong>{enabledConnections.length}</strong>
          <span>Enabled connections</span>
        </article>

        <article>
          <strong>
            {
              connections.filter(
                (connection) =>
                  connection.lastTestStatus === "Operational"
              ).length
            }
          </strong>
          <span>Operational</span>
        </article>
      </section>

      <section className="connection-form-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {editingId ? "Edit Connection" : "New Connection"}
            </p>

            <h2>
              {editingId
                ? "Update application connection"
                : "Connect an application"}
            </h2>
          </div>

          {editingId && (
            <button
              className="secondary-button"
              type="button"
              onClick={resetForm}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form className="connection-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Application Name
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                placeholder="Apartments.com Syndicator"
              />
            </label>

            <label>
              Application Type
              <select
                name="appType"
                value={form.appType}
                onChange={updateField}
              >
                <option value="saas">SaaS Platform</option>
                <option value="api">API</option>
                <option value="integration">Integration</option>
                <option value="data-platform">Data Platform</option>
                <option value="web3">Web3</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <label>
              Environment
              <select
                name="environment"
                value={form.environment}
                onChange={updateField}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </label>

            <label>
              Visibility
              <select
                name="visibility"
                value={form.visibility}
                onChange={updateField}
              >
                <option value="private">Private</option>
                <option value="internal">Internal</option>
                <option value="public">Public</option>
              </select>
            </label>

            <label className="full-width">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                placeholder="Production property feed and synchronization platform."
                rows={3}
              />
            </label>

            <label className="full-width">
              Observation API URL
              <input
                name="observationUrl"
                type="url"
                value={form.observationUrl}
                onChange={updateField}
                placeholder="https://example.com/api/observation"
              />
            </label>

            <label className="full-width">
              Dashboard URL
              <input
                name="dashboardUrl"
                type="url"
                value={form.dashboardUrl}
                onChange={updateField}
                placeholder="https://example.com"
              />
            </label>

            <label>
              Authentication
              <select
                name="authType"
                value={form.authType}
                onChange={updateField}
              >
                <option value="none">No Authentication</option>
                <option value="bearer">Bearer Token</option>
                <option value="api-key">API Key Header</option>
              </select>
            </label>

            <label>
              Observation Token
              <input
                name="authToken"
                type="password"
                value={form.authToken}
                onChange={updateField}
                placeholder={
                  editingId
                    ? "Leave blank to keep current token"
                    : "Enter read-only observation token"
                }
                disabled={form.authType === "none"}
              />
            </label>

            <label>
              Polling Interval
              <select
                name="pollingIntervalMinutes"
                value={form.pollingIntervalMinutes}
                onChange={updateField}
              >
                <option value={1}>Every minute</option>
                <option value={5}>Every 5 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
              </select>
            </label>
          </div>

          <div className="checkbox-row">
            <label>
              <input
                name="enabled"
                type="checkbox"
                checked={form.enabled}
                onChange={updateField}
              />
              Enable connection
            </label>

            <label>
              <input
                name="featured"
                type="checkbox"
                checked={form.featured}
                onChange={updateField}
              />
              Feature in Lounge
            </label>
          </div>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          {formMessage && (
            <p className="form-success" role="status">
              {formMessage}
            </p>
          )}

          <div className="form-actions">
            <button className="primary-button" type="submit">
              {editingId
                ? "Update Connection"
                : "Save Connection"}
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={resetForm}
            >
              Clear Form
            </button>
          </div>
        </form>
      </section>

      <section className="connections-list-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Registered Applications</p>
            <h2>Connected applications</h2>
          </div>
        </div>

        {connections.length === 0 ? (
          <div className="empty-state">
            <h3>No applications connected.</h3>

            <p>
              Add the Syndicator as the first Observation Lounge
              connection.
            </p>
          </div>
        ) : (
          <div className="connections-list">
            {connections.map((connection) => (
              <article
                className="connection-card"
                key={connection.id}
              >
                <div className="connection-card-header">
                  <div>
                    <div className="connection-title-row">
                      <h3>{connection.name}</h3>

                      {connection.featured && (
                        <span className="connection-badge">
                          Featured
                        </span>
                      )}
                    </div>

                    <p>
                      {connection.description ||
                        "No application description added."}
                    </p>
                  </div>

                  <span
                    className={`connection-status ${
                      connection.enabled
                        ? "is-enabled"
                        : "is-disabled"
                    }`}
                  >
                    {getStatusLabel(connection)}
                  </span>
                </div>

                <dl className="connection-details">
                  <div>
                    <dt>Type</dt>
                    <dd>{connection.appType}</dd>
                  </div>

                  <div>
                    <dt>Environment</dt>
                    <dd>{connection.environment}</dd>
                  </div>

                  <div>
                    <dt>Visibility</dt>
                    <dd>{connection.visibility}</dd>
                  </div>

                  <div>
                    <dt>Polling</dt>
                    <dd>
                      Every {connection.pollingIntervalMinutes} minute
                      {connection.pollingIntervalMinutes === 1
                        ? ""
                        : "s"}
                    </dd>
                  </div>

                  <div>
                    <dt>Response Time</dt>
                    <dd>
                      {connection.lastResponseTimeMs !== null
                        ? `${connection.lastResponseTimeMs} ms`
                        : "Not tested"}
                    </dd>
                  </div>

                  <div>
                    <dt>Last Tested</dt>
                    <dd>
                      {connection.lastTestedAt
                        ? new Date(
                            connection.lastTestedAt
                          ).toLocaleString()
                        : "Not tested"}
                    </dd>
                  </div>
                </dl>

                <div className="connection-endpoint">
                  <span>Observation endpoint</span>
                  <code>{connection.observationUrl}</code>
                </div>

                {connection.lastTestMessage && (
                  <p className="connection-message">
                    {connection.lastTestMessage}
                  </p>
                )}

                <div className="connection-card-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => testConnection(connection)}
                    disabled={
                      testingId === connection.id ||
                      !connection.enabled
                    }
                  >
                    {testingId === connection.id
                      ? "Testing..."
                      : "Test Connection"}
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => editConnection(connection)}
                  >
                    Edit
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      toggleConnection(connection.id)
                    }
                  >
                    {connection.enabled ? "Disable" : "Enable"}
                  </button>

                  {connection.dashboardUrl && (
                    <a
                      className="secondary-button"
                      href={connection.dashboardUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open App
                    </a>
                  )}

                  <button
                    className="danger-button"
                    type="button"
                    onClick={() =>
                      removeConnection(connection.id)
                    }
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}