import { randomUUID } from "node:crypto";

// Generated afresh for every build, even a redeployment of the same Git commit.
export function feedbackReleasePlugin() {
  const release = randomUUID();
  return {
    name: "xlore-feedback-release",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "feedback-release.json", source: JSON.stringify({ release }) });
    }
  };
}
