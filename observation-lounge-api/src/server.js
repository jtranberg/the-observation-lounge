import process from "node:process";
import dotenv from "dotenv";
import mongoose from "mongoose";

import app from "./app.js";
import { connectDatabase } from "./connectDatabase.js";

dotenv.config({
  path: ".env.local",
});

const port = Number(process.env.PORT) || 5055;

let server;

async function startServer() {
  try {
    await connectDatabase();

    server = app.listen(port, () => {
      console.log(`Observation Lounge API running on port ${port}`);
      console.log(`Health: http://localhost:${port}/api/health`);
    });
  } catch (error) {
    console.error("Observation Lounge API failed to start:", error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully.`);

  if (server) {
    server.close(async () => {
      try {
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");
        process.exit(0);
      } catch (error) {
        console.error("Shutdown error:", error);
        process.exit(1);
      }
    });

    return;
  }

  await mongoose.connection.close();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

startServer();