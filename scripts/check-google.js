import { googleClient, googleTrustInfo, classifyGoogleError } from "../src/services/google-auth.js";

console.log(`Node: ${googleTrustInfo.nodeVersion}`);
console.log(`Windows trusted certificates loaded: ${googleTrustInfo.systemRootCount}`);
try {
  const result = await googleClient.getFederatedSignonCertsAsync();
  console.log(`Google HTTPS verification passed (${Object.keys(result.certs).length} signing keys).`);
} catch (error) {
  console.error(`Google HTTPS verification failed: ${classifyGoogleError(error)}`);
  console.error(`Network code: ${String(error.code ?? error.cause?.code ?? "unavailable")}`);
  if (process.platform === "win32" && !googleTrustInfo.systemRootCount) {
    console.error("This Node runtime cannot load Windows trust roots. Install a current Node 24 LTS release, reopen the terminal, and retry.");
  }
  process.exitCode = 1;
}
