/* eslint-disable no-unused-vars */
import process from "node:process";
import applicationRoutes from "./routes/applicationRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";


const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://the-observation-lounge.netlify.app",
];

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server requests and tools without an Origin header.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_request, response) => {
  response.status(200).json({
    success: true,
    service: "observation-lounge-api",
    message: "Observation Lounge API is running.",
    documentation: {
      health: "/api/health",
      applications: "/api/applications",
    },
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/applications", applicationRoutes);

app.use((request, response) => {
  response.status(404).json({
    success: false,
    error: "Route not found.",
    method: request.method,
    path: request.originalUrl,
  });
});

// Keep this last so it catches errors from all middleware and routes.
app.use((error, _request, response, _next) => {
  console.error("Observation Lounge API error:", error);

  response.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error."
        : error.message,
  });
});

export default app;