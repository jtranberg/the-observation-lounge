import { createNotification } from "../../services/notificationApi";
import {
  EVENT_SEVERITY,
  EVENT_TYPES,
} from "../types/eventTypes";

function normalizeSeverity(severity) {
  const value = String(
    severity || EVENT_SEVERITY.INFO
  ).toLowerCase();

  const severityMap = {
    info: "info",
    low: "low",
    medium: "medium",
    high: "high",
    critical: "critical",
  };

  return severityMap[value] || "info";
}

function createNotificationFromEvent(event) {
  switch (event.type) {
    case EVENT_TYPES.INCIDENT_OPENED: {
      const severity = normalizeSeverity(
        event.severity
      );

      return {
        eventId: event.id,
        eventType: event.type,
        application: event.application,
        severity:
          severity === "high"
            ? "critical"
            : severity,
        title:
          event.message ||
          `${event.application} incident opened`,
        message:
          event.payload?.message ||
          event.message ||
          `${event.application} requires attention.`,
        source:
          event.source || "incident-processor",
        incidentId:
          event.payload?.id || null,
        payload: event.payload || {},
      };
    }

    case EVENT_TYPES.INCIDENT_RESOLVED:
      return {
        eventId: event.id,
        eventType: event.type,
        application: event.application,
        severity: "info",
        title: `${event.application} recovered`,
        message:
          event.message ||
          `${event.application} has returned to a healthy state.`,
        source:
          event.source || "incident-processor",
        incidentId:
          event.payload?.id || null,
        payload: event.payload || {},
      };

    default:
      return null;
  }
}

class NotificationProcessor {
  constructor() {
    this.name = "notificationProcessor";
    this.unsubscribe = null;

    this.statistics = {
      eventsEvaluated: 0,
      notificationsCreated: 0,
      notificationsSkipped: 0,
      deliveryErrors: 0,
    };
  }

  start({ eventBus }) {
    this.unsubscribe = eventBus.subscribe(
      "*",
      (event) => {
        void this.process(event);
      }
    );

    return () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    };
  }

  async process(event) {
    this.statistics.eventsEvaluated += 1;

    const notification =
      createNotificationFromEvent(event);

    if (!notification) {
      this.statistics.notificationsSkipped += 1;
      return;
    }

    try {
      await createNotification(notification);

      this.statistics.notificationsCreated += 1;
    } catch (error) {
      this.statistics.deliveryErrors += 1;

      console.error(
        "Notification Processor failed to persist notification:",
        {
          event,
          error,
        }
      );
    }
  }

  getState() {
    return {
      ...this.statistics,
    };
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

const notificationProcessor =
  new NotificationProcessor();

export default notificationProcessor;