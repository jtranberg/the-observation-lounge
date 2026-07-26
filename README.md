# Observation Lounge

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2024-F7DF1E?logo=javascript)
![Observation Engine](https://img.shields.io/badge/Architecture-Event--Driven-7C3AED)
![Monitoring](https://img.shields.io/badge/Platform-Operational%20Intelligence-0F766E)
![License](https://img.shields.io/badge/License-MIT-green)
---
## Future Badges

![Health Monitoring](https://img.shields.io/badge/Health-Monitoring-22C55E)
![Incident Detection](https://img.shields.io/badge/Incidents-Automatic-E11D48)
![Metrics Engine](https://img.shields.io/badge/Metrics-Live-2563EB)
![Event Bus](https://img.shields.io/badge/Event%20Bus-Processor%20Architecture-9333EA)
![Application Registry](https://img.shields.io/badge/Application-Registry-F59E0B)

> **Operational Intelligence Platform for monitoring production applications, system health, performance, incidents, and live operational events.**

![Observation Lounge Icon](./public/observation-lounge.png)

![Observation Lounge Dashboard](./public/screenshot.png)

---

## Key Features

- Event-driven Observation Engine
- Live application health monitoring
- Automatic incident detection and resolution
- Real-time operational event stream
- Performance metrics and response-time tracking
- Extensible Application Registry
- Modular processor architecture

---

## Overview

Observation Lounge is a centralized operations platform designed to monitor a fleet of production applications from one place.

It provides live health checks, performance metrics, event history, incident detection, and automatic recovery tracking through a reusable event-driven architecture.

The platform currently monitors **The Prospector API** and is structured to support additional applications and infrastructure services such as:

- Fan7
- Syndicator
- Snowman Utility
- Stripe
- MongoDB Atlas
- Render
- Netlify
- GitHub Actions
- Background jobs
- Deployment pipelines

---

## Current Capabilities

---

### Live Application Monitoring

Observation Lounge performs recurring health checks and displays:

- Current application status
- API response time
- Database connectivity
- Environment
- Backend provider
- Frontend provider
- Domain
- Server uptime
- Last checked time

---
### Diagram

                 Applications
                      │
          ┌───────────┼───────────┐
          │           │           │
     Prospector     Fan7     Snowman
          │           │           │
          └───────────┼───────────┘
                      │
              Observation Engine
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   Event Bus    Metrics Processor  Incident Processor
        │             │             │
        └─────────────┼─────────────┘
                      │
             Observation Lounge UI
---

## Automatic Incident Detection

Observation Lounge watches application health transitions and responds automatically.

---

### Incident opening

An incident is opened when a monitored application changes from:

---

```text
Healthy → Offline
```

or:

```text
Healthy → Degraded
```

### Incident resolution

An open incident is resolved automatically when the application recovers:

---

```text
Offline → Healthy
```

```text
Degraded → Healthy
```

---

## Operational Event Stream

Every event published through the Observation Engine is recorded in the live event stream.

---

### Current events

- Observation Engine started
- Prospector health check
- Prospector incident opened
- Prospector incident resolved

---

### Planned events

- Stripe payment failed
- Deployment completed
- MongoDB latency increased
- Customer sync failed
- Background job completed
- SSL certificate renewed

---

## Session Metrics

The Metrics Processor currently tracks:

- Total health checks
- Healthy checks
- Degraded checks
- Offline checks
- Average response time
- Fastest response time
- Slowest response time
- Latest response time
- Per-application performance metrics

---

## Architecture

Observation Lounge uses a modular event-driven architecture.

---

```text
Application Health Service
          │
          ▼
Observation Engine
          │
          ▼
Event Bus
          │
          ├── History Processor
          ├── Incident Processor
          ├── Metrics Processor
          └── Future Alert Processor
          │
          ▼
React Dashboard
```

React is responsible for requesting data and displaying processor state.

Operational logic is handled by the Observation Engine and its processors.

---

## Observation Engine

The Observation Engine coordinates the platform.

---

### Responsibilities

- Starting and stopping the engine
- Registering processors
- Publishing normalized events
- Routing events through the Event Bus
- Protecting the platform from processor failures
- Reporting engine statistics

---

## Event Bus

The Event Bus is the central communication layer.

Applications and services publish events without needing to know which processors will receive them.

---

```text
Publisher
   │
   ▼
Event Bus
   ├── History Processor
   ├── Incident Processor
   ├── Metrics Processor
   └── Future Alert Processor
```

This keeps the platform modular, loosely coupled, and extensible.

---

## Application Registry

The Application Registry is the source of truth for the monitored software fleet.

Each registered application can define:

- Application ID
- Name
- Service
- Description
- Connection status
- Environment
- Health endpoint
- Database provider
- Deployment provider
- Frontend provider
- Domain
- Performance thresholds
- Additional metadata

---

### Current registered applications

| Application | Connection status |
|---|---|
| Prospector | Connected |
| Fan7 | Not connected |
| Syndicator | Not connected |
| Snowman Utility | Not connected |

---

## Project Structure

```text
src/
├── engine/
│   ├── core/
│   │   ├── eventBus.js
│   │   └── observationEngine.js
│   │
│   ├── processors/
│   │   ├── historyProcessor.js
│   │   ├── incidentProcessor.js
│   │   └── metricsProcessor.js
│   │
│   ├── registry/
│   │   ├── applicationRegistry.js
│   │   └── registerApplications.js
│   │
│   ├── services/
│   │   └── eventFactory.js
│   │
│   ├── types/
│   │   └── eventTypes.js
│   │
│   └── index.js
│
├── services/
│   └── healthService.js
│
├── App.jsx
├── App.css
└── main.jsx
```

---

## Technology

- React
- Vite
- JavaScript
- CSS
- Event-driven architecture
- Browser Fetch API
- React Hooks
- Extensible processor system

---

## Local Development

Install dependencies:

```bash
npm install
```

Create a local environment file:

```text
.env.local
```

Add the local Prospector API URL:

```env
VITE_PROSPECTOR_API_URL=http://localhost:5050
```

Start the application:

```bash
npm run dev
```

Observation Lounge will normally be available at:

```text
http://localhost:5174
```

The exact port may vary if another Vite application is already running.

---

## Production Environment

Configure the production Prospector API:

```env
VITE_PROSPECTOR_API_URL=https://the-prospector.onrender.com
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## Health Endpoint

The currently monitored Prospector endpoint is:

```http
GET /api/health
```

Example response:

```json
{
  "ok": true,
  "service": "The Prospector API",
  "environment": "development",
  "database": "Connected",
  "uptimeSeconds": 57,
  "timestamp": "2026-07-24T04:10:31.403Z"
}
```

Observation Lounge converts the response into a normalized health event and publishes it through the Observation Engine.

---

## Event Structure

All operational events are normalized before entering the engine.

```js
{
  id: "event-id",
  type: "health.check",
  application: "Prospector",
  source: "api",
  severity: "info",
  message: "Prospector health check: Healthy",
  payload: {
    status: "Healthy",
    responseTime: 5,
    database: "Connected"
  },
  timestamp: new Date(),
  createdAt: new Date()
}
```

---

## Event Types

---

### Categories

- `health.*`
- `incident.*`
- `performance.*`
- `billing.*`
- `job.*`
- `deployment.*`
- `security.*`
- `system.*`

---

### Examples

```text
health.check
health.offline
health.recovered
incident.opened
incident.resolved
billing.payment_failed
job.completed
deployment.failed
security.login_failed
system.error
```
---

## Roadmap

---

### Phase 1 — Observation Core

- [x] Application Registry
- [x] Event Factory
- [x] Event Bus
- [x] Observation Engine
- [x] Health monitoring
- [x] Event history
- [x] Performance metrics
- [x] Incident detection
- [x] Automatic incident resolution

---

### Phase 2 — Operational Intelligence

- [ ] Persistent operations database
- [ ] Historical uptime reports
- [ ] Response-time charts
- [ ] Alert rules
- [ ] Email notifications
- [ ] Deployment tracking
- [ ] Background job monitoring
- [ ] Stripe billing events
- [ ] MongoDB monitoring
- [ ] SSL and domain monitoring

---

### Phase 3 — Multi-Application Operations

- [ ] Fan7 integration
- [ ] Syndicator integration
- [ ] Snowman Utility integration
- [ ] Unified fleet health
- [ ] Per-application detail views
- [ ] Asset Registry
- [ ] Infrastructure monitoring
- [ ] Environment separation

---

### Phase 4 — AI Operations

- [ ] Incident summaries
- [ ] Root-cause suggestions
- [ ] Anomaly detection
- [ ] Performance trend analysis
- [ ] Failure prediction
- [ ] Automated postmortems
- [ ] Operational recommendations

---

## Product Direction

Observation Lounge is designed to become more than a dashboard.

It is evolving into a reusable operational intelligence platform capable of monitoring:

- Applications
- APIs
- Databases
- Payment systems
- Deployments
- Background jobs
- Domains
- SSL certificates
- Cloud infrastructure
- External integrations

The dashboard is one consumer of the Observation Engine.

Future consumers may include:

- Command-line tools
- Mobile dashboards
- Slack alerts
- Email reports
- Public status pages
- AI operations assistants
- External APIs

---

## Current Status

Observation Lounge currently supports:

- Prospector health monitoring
- Automatic outage detection
- Automatic incident creation
- Automatic recovery detection
- Automatic incident resolution
- Live event history
- Session performance metrics
- Application Registry

The first complete outage and recovery cycle has been successfully tested.

---

## License

MIT

---