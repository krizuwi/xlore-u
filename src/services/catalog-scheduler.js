import { config } from "../config.js";
import { runCatalogUpdate } from "./catalog-updater.js";

const STARTUP_DELAY_MS = 10_000;
let startupTimer;
let intervalTimer;

async function update() {
  try {
    const result = await runCatalogUpdate({ triggerType: "scheduled", dueOnly: true });
    if (!result.skipped && result.checked > 0) {
      console.log(
        `Catalog update ${result.status}: ${result.succeeded}/${result.checked} sources, ${result.changed} changes.`
      );
    }
  } catch (error) {
    console.error(`Catalog update failed: ${error.message}`);
  }
}

export function startCatalogScheduler() {
  if (!config.catalogUpdater.enabled) {
    console.log("Catalog updater is disabled.");
    return;
  }
  const intervalMs = config.catalogUpdater.intervalHours * 60 * 60 * 1000;
  startupTimer = setTimeout(update, STARTUP_DELAY_MS);
  intervalTimer = setInterval(update, intervalMs);
  intervalTimer.unref();
  console.log(`Catalog updater enabled (checks every ${config.catalogUpdater.intervalHours} hours).`);
}

export function stopCatalogScheduler() {
  clearTimeout(startupTimer);
  clearInterval(intervalTimer);
}
