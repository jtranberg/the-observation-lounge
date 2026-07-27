import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    eventType: {
      type: String,
      required: [true, "Notification event type is required."],
      trim: true,
      index: true,
    },

    application: {
      type: String,
      required: [true, "Notification application is required."],
      trim: true,
      maxlength: 120,
      index: true,
    },

    severity: {
      type: String,
      enum: ["info", "low", "medium", "high", "critical"],
      default: "info",
      index: true,
    },

    title: {
      type: String,
      required: [true, "Notification title is required."],
      trim: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: [true, "Notification message is required."],
      trim: true,
      maxlength: 1000,
    },

    status: {
      type: String,
      enum: ["unread", "read", "archived"],
      default: "unread",
      index: true,
    },

    source: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "observation-engine",
    },

    incidentId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    externalDeliveryRequired: {
      type: Boolean,
      default: false,
      index: true,
    },

    externalDeliveryStatus: {
      type: String,
      enum: [
        "not-required",
        "pending",
        "sent",
        "failed",
      ],
      default: "not-required",
    },

    readAt: {
      type: Date,
      default: null,
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({
  status: 1,
  createdAt: -1,
});

notificationSchema.index({
  application: 1,
  createdAt: -1,
});

notificationSchema.index(
  {
    eventId: 1,
    eventType: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      eventId: {
        $type: "string",
      },
    },
  }
);

const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

export default Notification;