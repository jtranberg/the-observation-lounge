import observationEngine from "./core/observationEngine";

import historyProcessor from "./processors/historyProcessor";
import incidentProcessor from "./processors/incidentProcessor";
import metricsProcessor from "./processors/metricsProcessor";

import { registerDefaultApplications } from "./registry/registerApplications";

/**
 * Register the current application fleet.
 */
registerDefaultApplications();

/**
 * Register all core Observation Lounge processors.
 */
observationEngine.registerProcessor(
  historyProcessor,
);

observationEngine.registerProcessor(
  incidentProcessor,
);

observationEngine.registerProcessor(
  metricsProcessor,
);

/**
 * Start the shared engine after configuration is complete.
 */
observationEngine.start();

export {
  historyProcessor,
  incidentProcessor,
  metricsProcessor,
  observationEngine,
};