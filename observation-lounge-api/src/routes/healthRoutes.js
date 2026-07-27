/* eslint-disable no-undef */
import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

function getDatabaseStatus() {
  switch (mongoose.connection.readyState) {
    case 0:
      return "disconnected";

    case 1:
      return "connected";

    case 2:
      return "connecting";

    case 3:
      return "disconnecting";

    default:
      return "unknown";
  }
}

router.get("/", (request, response) => {
  const databaseStatus = getDatabaseStatus();
  const databaseConnected = mongoose.connection.readyState === 1;

  response.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    service: "observation-lounge-api",
    status: databaseConnected ? "healthy" : "degraded",
    environment: process.env.NODE_ENV || "development",
    database: databaseStatus,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;