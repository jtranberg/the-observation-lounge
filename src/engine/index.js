import observationEngine from "./core/observationEngine";

import historyProcessor from "./processors/historyProcessor";
import incidentProcessor from "./processors/incidentProcessor";
import metricsProcessor from "./processors/metricsProcessor";

import { loadApplicationRegistry } from "./registry/applicationRegistry";

/**
 * Start the Observation Lounge.
 */
async function initializeObservationLounge() {
  try {
    await loadApplicationRegistry();

    observationEngine.registerProcessor(historyProcessor);
    observationEngine.registerProcessor(incidentProcessor);
    observationEngine.registerProcessor(metricsProcessor);

    observationEngine.start();

    console.log("Observation Lounge initialized.");
  } catch (error) {
    console.error(
      "Failed to initialize Observation Lounge:",
      error,
    );
  }
}

initializeObservationLounge();

export {
  historyProcessor,
  incidentProcessor,
  metricsProcessor,
  observationEngine,
};