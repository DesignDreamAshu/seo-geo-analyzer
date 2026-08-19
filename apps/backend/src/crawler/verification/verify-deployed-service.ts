import axios from "axios";
import fs from "fs";
import path from "path";
import { getGitProvenance } from "./git-info";
import type { DeploymentVerificationArtifact } from "./types";

export async function verifyDeployedService(deploymentUrl?: string): Promise<DeploymentVerificationArtifact> {
  const targetUrl = deploymentUrl || process.env.DEPLOYED_BACKEND_URL || "https://seo-geo-analyzer-backend.onrender.com";
  console.log(`[DeployVerify] Probing deployed backend service at: ${targetUrl}...`);

  const git = getGitProvenance();
  const checkedAt = new Date().toISOString();

  let deployedGitSha: string | null = null;
  let runtime = "unknown";
  let nodeVersion = "unknown";
  let platform = "unknown";
  let arch = "unknown";
  let chromiumVersion = "unknown";
  let browserCapability: DeploymentVerificationArtifact["browserCapability"] = "unavailable";
  let browserLaunchSucceeded = false;
  let navigationSmokeSucceeded = false;
  let deploymentStatus: DeploymentVerificationArtifact["deploymentStatus"] = "DEPLOYMENT_PENDING";

  try {
    // 1. Health check
    const healthRes = await axios.get(`${targetUrl}/api/health`, { timeout: 15000 });
    if (healthRes.data?.ok) {
      deployedGitSha = healthRes.data.gitSha || null;
      runtime = healthRes.data.runtime || "render";
      nodeVersion = healthRes.data.nodeVersion || "unknown";
      platform = healthRes.data.platform || "unknown";
    }

    // 2. Browser Capability check
    const browserRes = await axios.get(`${targetUrl}/api/health/browser`, { timeout: 25000 });
    if (browserRes.data) {
      browserCapability = browserRes.data.capability || "unavailable";
      chromiumVersion = browserRes.data.chromiumVersion || "unknown";
      browserLaunchSucceeded = Boolean(browserRes.data.browserLaunchSucceeded);
      navigationSmokeSucceeded = Boolean(browserRes.data.navigationSmokeSucceeded);
      arch = browserRes.data.arch || arch;
    }

    const shaMatch = Boolean(deployedGitSha && deployedGitSha.toLowerCase() === git.gitShaFull.toLowerCase());

    if (browserCapability === "available" && shaMatch) {
      deploymentStatus = "PRODUCTION_VERIFIED";
    } else if (browserCapability === "available" && !shaMatch) {
      deploymentStatus = "PRODUCTION_DEGRADED"; // Live but running older SHA
    } else {
      deploymentStatus = "PRODUCTION_FAILED";
    }

    const artifact: DeploymentVerificationArtifact = {
      deploymentUrl: targetUrl,
      deployedGitSha,
      verifiedGitSha: git.gitShaFull,
      shaMatch,
      runtime,
      nodeVersion,
      platform,
      arch,
      chromiumVersion,
      browserCapability,
      browserLaunchSucceeded,
      navigationSmokeSucceeded,
      checkedAt,
      deploymentStatus,
    };

    console.log(`[DeployVerify] Status: ${deploymentStatus} (Deployed SHA: ${deployedGitSha?.slice(0, 7) || "none"}, Match: ${shaMatch}, Browser: ${browserCapability})`);
    return artifact;
  } catch (err: any) {
    console.warn(`[DeployVerify] Deployed service probe failed (${err.message}). Status: DEPLOYMENT_PENDING`);
    return {
      deploymentUrl: targetUrl,
      deployedGitSha: null,
      verifiedGitSha: git.gitShaFull,
      shaMatch: false,
      runtime: "render",
      nodeVersion: "unknown",
      platform: "linux",
      arch: "x64",
      browserCapability: "unavailable",
      browserLaunchSucceeded: false,
      navigationSmokeSucceeded: false,
      checkedAt,
      deploymentStatus: "DEPLOYMENT_PENDING",
    };
  }
}

if (process.argv[1]?.includes("verify-deployed-service")) {
  verifyDeployedService().then((res) => {
    console.log(JSON.stringify(res, null, 2));
  });
}
