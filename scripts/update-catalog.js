import { pool } from "../src/db/pool.js";
import { runCatalogUpdate } from "../src/services/catalog-updater.js";

try {
  const result = await runCatalogUpdate({ triggerType: "manual", dueOnly: false });
  if (result.skipped) {
    console.log(result.reason);
  } else {
    console.log(`Catalog update ${result.status}.`);
    console.log(`Sources: ${result.succeeded}/${result.checked} succeeded.`);
    console.log(`Programs/details discovered: ${result.discovered}.`);
    console.log(`Database changes: ${result.changed}.`);
    if (result.errors.length) {
      console.log("Source errors:");
      result.errors.forEach((error) => console.log(`- ${error}`));
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
