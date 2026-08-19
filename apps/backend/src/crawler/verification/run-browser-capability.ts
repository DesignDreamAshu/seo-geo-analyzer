import { checkBrowserCapability } from "../fetcher";
import type { BrowserCapabilityArtifact, VerificationEnvironment } from "./types";

export async function executeBrowserCapabilityCheck(
  verificationRunId: string,
  gitSha: string,
  environment: VerificationEnvironment
): Promise<BrowserCapabilityArtifact> {
  console.log(`[Verify:Capability] Running browser capability verification...`);
  const result = await checkBrowserCapability();

  const artifact: BrowserCapabilityArtifact = {
    verificationRunId,
    gitSha,
    generatedAt: new Date().toISOString(),
    capability: result.capability,
    details: result.details,
    launchSuccess: result.capability !== "unavailable",
    navigationSmokeSuccess: result.capability === "available",
    environment,
  };

  console.log(`[Verify:Capability] Result: ${artifact.capability.toUpperCase()} (${artifact.details})`);
  return artifact;
}
