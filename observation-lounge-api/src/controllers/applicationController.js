import mongoose from "mongoose";

import Application from "../models/Application.js";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function getApplications(_request, response, next) {
  try {
    const applications = await Application.find().sort({
      createdAt: 1,
    });

    response.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    next(error);
  }
}

export async function getApplicationById(request, response, next) {
  try {
    const { id } = request.params;

    if (!isValidObjectId(id)) {
      return response.status(400).json({
        success: false,
        error: "Invalid application ID.",
      });
    }

    const application = await Application.findById(id);

    if (!application) {
      return response.status(404).json({
        success: false,
        error: "Application not found.",
      });
    }

    return response.status(200).json({
      success: true,
      application,
    });
  } catch (error) {
    return next(error);
  }
}

export async function createApplication(request, response, next) {
  try {
    const application = await Application.create(request.body);

    response.status(201).json({
      success: true,
      application,
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        error: "An application with that name already exists.",
      });
    }

    return next(error);
  }
}

export async function updateApplication(request, response, next) {
  try {
    const { id } = request.params;

    if (!isValidObjectId(id)) {
      return response.status(400).json({
        success: false,
        error: "Invalid application ID.",
      });
    }

    const application = await Application.findByIdAndUpdate(id, request.body, {
      new: true,
      runValidators: true,
    });

    if (!application) {
      return response.status(404).json({
        success: false,
        error: "Application not found.",
      });
    }

    return response.status(200).json({
      success: true,
      application,
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        error: "An application with that name already exists.",
      });
    }

    return next(error);
  }
}

export async function deleteApplication(request, response, next) {
  try {
    const { id } = request.params;

    if (!isValidObjectId(id)) {
      return response.status(400).json({
        success: false,
        error: "Invalid application ID.",
      });
    }

    const application = await Application.findByIdAndDelete(id);

    if (!application) {
      return response.status(404).json({
        success: false,
        error: "Application not found.",
      });
    }

    return response.status(200).json({
      success: true,
      message: "Application deleted.",
      application,
    });
  } catch (error) {
    return next(error);
  }
}

export async function checkApplicationHealth(request, response, next) {
  const startedAt = Date.now();

  try {
    const { id } = request.params;

    if (!isValidObjectId(id)) {
      return response.status(400).json({
        success: false,
        error: "Invalid application ID.",
      });
    }

    const application = await Application.findById(id);

    if (!application) {
      return response.status(404).json({
        success: false,
        error: "Application not found.",
      });
    }

    if (!application.enabled) {
      return response.status(409).json({
        success: false,
        error: "Application monitoring is disabled.",
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const healthResponse = await fetch(application.healthUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Observation-Lounge/1.0",
        },
        signal: controller.signal,
      });

      const responseTime = Date.now() - startedAt;

      let healthPayload = {};

      try {
        healthPayload = await healthResponse.json();
      } catch {
        healthPayload = {};
      }

      const reportedStatus = String(
        healthPayload.status?.state ??
          healthPayload.status ??
          healthPayload.health ??
          "",
      ).toLowerCase();

      const payloadHealthy =
        healthPayload.ok === true ||
        healthPayload.success === true ||
        reportedStatus === "healthy";

      const isHealthy = healthResponse.ok && payloadHealthy;

      const databaseStatus =
        healthPayload.database?.status ??
        healthPayload.databaseStatus ??
        healthPayload.database ??
        healthPayload.db ??
        "Unknown";

      application.healthStatus = isHealthy ? "Healthy" : "Degraded";
      application.connectionStatus = "Connected";
      application.lastCheckedAt = new Date();
      application.lastResponseTime = responseTime;
      application.databaseStatus = String(databaseStatus);

      await application.save();

      return response.status(200).json({
        success: true,
        check: {
          reachable: true,
          httpStatus: healthResponse.status,
          responseTime,
          healthStatus: application.healthStatus,
          databaseStatus: application.databaseStatus,
          checkedAt: application.lastCheckedAt,
          payload: healthPayload,
        },
        application,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const responseTime = Date.now() - startedAt;
    const { id } = request.params;

    if (isValidObjectId(id)) {
      await Application.findByIdAndUpdate(id, {
        healthStatus: "Offline",
        connectionStatus: "Not Connected",
        lastCheckedAt: new Date(),
        lastResponseTime: responseTime,
        databaseStatus: "Unknown",
      }).catch((updateError) => {
        console.error(
          "Failed to update offline application state:",
          updateError.message,
        );
      });
    }

    if (error.name === "AbortError") {
      return response.status(504).json({
        success: false,
        error: "Application health check timed out.",
        check: {
          reachable: false,
          responseTime,
          healthStatus: "Offline",
        },
      });
    }

    if (
      error instanceof TypeError &&
      String(error.message).toLowerCase().includes("fetch")
    ) {
      return response.status(502).json({
        success: false,
        error: "Application health endpoint could not be reached.",
        check: {
          reachable: false,
          responseTime,
          healthStatus: "Offline",
        },
      });
    }

    return next(error);
  }
}
