import mongoose from "mongoose";

import Notification from "../models/Notification.js";

const VALID_SEVERITIES = new Set([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

function normalizeSeverity(value) {
  const severity = String(value || "info").toLowerCase();

  return VALID_SEVERITIES.has(severity)
    ? severity
    : "info";
}

function shouldRequireExternalDelivery(severity) {
  return severity === "critical";
}

/**
 * POST /api/notifications
 */
export async function createNotification(req, res, next) {
  try {
    const {
      eventId = null,
      eventType,
      application,
      severity: incomingSeverity,
      title,
      message,
      source = "observation-engine",
      incidentId = null,
      payload = {},
    } = req.body;

    if (!eventType || !application || !title || !message) {
      return res.status(400).json({
        success: false,
        message:
          "eventType, application, title, and message are required.",
      });
    }

    const severity = normalizeSeverity(incomingSeverity);

    const externalDeliveryRequired =
      shouldRequireExternalDelivery(severity);

    const notificationData = {
      eventId,
      eventType,
      application,
      severity,
      title,
      message,
      source,
      incidentId,
      payload,
      externalDeliveryRequired,
      externalDeliveryStatus:
        externalDeliveryRequired
          ? "pending"
          : "not-required",
    };

    let notification;

    if (eventId) {
      notification = await Notification.findOneAndUpdate(
        {
          eventId,
          eventType,
        },
        {
          $setOnInsert: notificationData,
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        }
      );
    } else {
      notification =
        await Notification.create(notificationData);
    }

    return res.status(201).json({
      success: true,
      notification,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/notifications
 *
 * Supported query parameters:
 * ?status=unread
 * ?severity=critical
 * ?application=Prospector
 * ?limit=50
 */
export async function getNotifications(req, res, next) {
  try {
    const {
      status,
      severity,
      application,
    } = req.query;

    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 50;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (severity) {
      filter.severity = normalizeSeverity(severity);
    }

    if (application) {
      filter.application = application;
    }

    const notifications = await Notification.find(filter)
      .sort({
        createdAt: -1,
      })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/notifications/unread-count
 */
export async function getUnreadNotificationCount(
  req,
  res,
  next
) {
  try {
    const count = await Notification.countDocuments({
      status: "unread",
    });

    return res.json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/notifications/:id/read
 */
export async function markNotificationAsRead(
  req,
  res,
  next
) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const notification =
      await Notification.findByIdAndUpdate(
        id,
        {
          $set: {
            status: "read",
            readAt: new Date(),
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.json({
      success: true,
      notification,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/notifications/read-all
 */
export async function markAllNotificationsAsRead(
  req,
  res,
  next
) {
  try {
    const readAt = new Date();

    const result = await Notification.updateMany(
      {
        status: "unread",
      },
      {
        $set: {
          status: "read",
          readAt,
        },
      }
    );

    return res.json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
}