import { checkBrowserCapability } from "../fetcher";
import type { BrowserCapabilityArtifact, VerificationEnvironment } from "./types";

export async function executeBrowserCapabilityCheck(
  verificationRunId: string,
  gitShaFull: string,
  environment: VerificationEnvironment
): Promise<BrowserCapabilityArtifact> {
  console.log(`[Verify:Capability] Running browser capability verification...`);
  const result = await checkBrowserCapability();

  const artifact: BrowserCapabilityArtifact = {
    verificationRunId,
    gitShaFull,
    generatedAt: new Date().toISOString(),
    capability: result.capability,
    details: result.details,
    chromiumVersion: result.chromiumVersion || "unknown",
    chromiumExecutableAvailable: result.chromiumExecutableAvailable,
    browserLaunchSucceeded: result.browserLaunchSucceeded,
    navigationSmokeSucceeded: result.navigationSmokeSucceeded,
    environment,
  };

  console.log(`[Verify:Capability] Result: ${artifact.capability.toUpperCase()} (Chromium: ${artifact.chromiumVersion}, ${artifact.details})`);
  return artifact;
}
