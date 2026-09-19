import https from "node:https";
import tls from "node:tls";
import { OAuth2Client } from "google-auth-library";

const systemRoots = process.platform === "win32" && typeof tls.getCACertificates === "function"
  ? tls.getCACertificates("system") : [];
const defaultRoots = typeof tls.getCACertificates === "function"
  ? tls.getCACertificates("default") : tls.rootCertificates;

// Pass trust directly to Google's HTTPS transport. This also works on Node
// releases with getCACertificates but without setDefaultCACertificates.
const googleAgent = new https.Agent({
  ca: [...new Set([...defaultRoots, ...systemRoots])],
  rejectUnauthorized: true,
  keepAlive: true
});

export const googleClient = new OAuth2Client({
  transporterOptions: { agent: googleAgent, timeout: 15000 }
});

export const googleTrustInfo = {
  nodeVersion: process.version,
  systemRootCount: systemRoots.length
};

export function classifyGoogleError(error) {
  const chain = [];
  for (let current = error; current && chain.length < 5; current = current.cause) {
    chain.push(current);
  }
  const codes = chain.map((item) => String(item.code ?? "").toUpperCase());
  const message = chain.map((item) => String(item.message ?? "")).join(" ").toLowerCase();
  if (codes.some((code) => ["SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(code)) || /self[- ]signed|unable to verify|unable to get local issuer|certificate has expired/.test(message)) {
    return "GOOGLE_TLS_TRUST";
  }
  if (message.includes("failed to retrieve verification certificates")) return "GOOGLE_KEYS_UNAVAILABLE";
  if (message.includes("wrong recipient") || message.includes("audience")) return "GOOGLE_AUDIENCE";
  if (message.includes("too late") || message.includes("expired")) return "GOOGLE_EXPIRED";
  return "GOOGLE_INVALID_TOKEN";
}
