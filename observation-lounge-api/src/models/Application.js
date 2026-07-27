import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Application name is required."],
      trim: true,
      unique: true,
      maxlength: 100,
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: 120,
    },

    service: {
      type: String,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    baseUrl: {
      type: String,
      required: [true, "Application base URL is required."],
      trim: true,
    },

    healthEndpoint: {
      type: String,
      required: [true, "Health endpoint is required."],
      trim: true,
      default: "/api/health",
    },

    environment: {
      type: String,
      enum: ["development", "staging", "production"],
      default: "production",
    },

    connectionStatus: {
      type: String,
      enum: ["Connected", "Not Connected", "Disabled"],
      default: "Not Connected",
    },

    healthStatus: {
      type: String,
      enum: ["Healthy", "Degraded", "Offline", "Unknown"],
      default: "Unknown",
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    pollInterval: {
      type: Number,
      min: 5000,
      default: 60000,
    },

    owner: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    lastCheckedAt: {
      type: Date,
      default: null,
    },

    lastResponseTime: {
      type: Number,
      min: 0,
      default: null,
    },

    databaseStatus: {
      type: String,
      trim: true,
      default: "Unknown",
    },
  },
  {
    timestamps: true,
  }
);

applicationSchema.virtual("healthUrl").get(function getHealthUrl() {
  const baseUrl = this.baseUrl.replace(/\/+$/, "");
  const endpoint = this.healthEndpoint.startsWith("/")
    ? this.healthEndpoint
    : `/${this.healthEndpoint}`;

  return `${baseUrl}${endpoint}`;
});

applicationSchema.set("toJSON", {
  virtuals: true,
});

applicationSchema.set("toObject", {
  virtuals: true,
});

const Application = mongoose.model("Application", applicationSchema);

export default Application;