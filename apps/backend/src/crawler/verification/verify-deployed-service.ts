import axios from "axios";
import { getGitProvenance } from "./git-info";
import type { DeploymentStatusClassification, DeploymentVerificationArtifact } from "./types";

function extractUrlFromArgs(): string | null {
  for (const arg of process.argv) {
    if (arg.startsWith("--url=")) {
      return arg.replace("--url=", "").trim();
    }
  }
  return process.env.DEPLOYED_BACKEND_URL || null;
}

export async function verifyDeployedService(deploymentUrlOverride?: string): Promise<DeploymentVerificationArtifact> {
  const targetUrl = deploymentUrlOverride || extractUrlFromArgs();
  const git = getGitProvenance();
  const checkedAt = new Date().toISOString();

  if (!targetUrl) {
    console.log("[DeployVerify] No deployment URL specified. Status: DEPLOYMENT_URL_NOT_CONFIGURED");
    return {
      deploymentUrl: null,
      deployedGitSha: null,
      verifiedGitSha: git.gitShaFull,
      shaMatch: false,
      runtime: "unknown",
      nodeVersion: "unknown",
      platform: "unknown",
      arch: "unknown",
      browserCapability: "unavailable",
      browserLaunchSucceeded: false,
      navigationSmokeSucceeded: false,
      checkedAt,
      deploymentStatus: "DEPLOYMENT_URL_NOT_CONFIGURED",
      errorMessage: "No DEPLOYED_BACKEND_URL or --url=<url> argument was configured.",
    };
  }

  console.log(`[DeployVerify] Probing deployed backend service at: ${targetUrl}...`);

  let deployedGitSha: string | null = null;
  let runtime = "unknown";
  let nodeVersion = "unknown";
  let platform = "unknown";
  let arch = "unknown";
  let chromiumVersion = "unknown";
  let browserCapability: DeploymentVerificationArtifact["browserCapability"] = "unavailable";
  let browserLaunchSucceeded = false;
  let navigationSmokeSucceeded = false;
  let deploymentStatus: DeploymentStatusClassification = "DEPLOYMENT_PENDING";
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let httpStatus: number | null = null;

  try {
    // 1. Health check probe
    const healthRes = await axios.get(`${targetUrl}/api/health`, { timeout: 12000 });
    httpStatus = healthRes.status;

    if (healthRes.data?.ok) {
      deployedGitSha = healthRes.data.gitSha || null;
      runtime = healthRes.data.runtime || "render";
      nodeVersion = healthRes.data.nodeVersion || "unknown";
      platform = healthRes.data.platform || "unknown";
    } else {
      deploymentStatus = "HEALTH_ROUTE_MISSING";
    }

    // 2. Browser Capability check
    try {
      const browserRes = await axios.get(`${targetUrl}/api/health/browser`, { timeout: 20000 });
      if (browserRes.data) {
        browserCapability = browserRes.data.capability || "unavailable";
        chromiumVersion = browserRes.data.chromiumVersion || "unknown";
        browserLaunchSucceeded = Boolean(browserRes.data.browserLaunchSucceeded);
        navigationSmokeSucceeded = Boolean(browserRes.data.navigationSmokeSucceeded);
        arch = browserRes.data.arch || arch;
      }
    } catch (bErr: any) {
      browserCapability = "unavailable";
    }

    const shaMatch = Boolean(
      deployedGitSha && deployedGitSha.toLowerCase() === git.gitShaFull.toLowerCase()
    );

    if (deploymentStatus !== "HEALTH_ROUTE_MISSING") {
      if (browserCapability === "available" && shaMatch) {
        deploymentStatus = "PRODUCTION_VERIFIED";
      } else if (!shaMatch && deployedGitSha) {
        deploymentStatus = "SHA_MISMATCH";
      } else if (browserCapability !== "available") {
        deploymentStatus = "BROWSER_UNAVAILABLE";
      } else {
        deploymentStatus = "SERVICE_UNAVAILABLE";
      }
    }
  } catch (err: any) {
    errorCode = err.code || "REQUEST_FAILED";
    errorMessage = err.message;
    httpStatus = err.response?.status || null;

    if (err.code === "ENOTFOUND") {
      deploymentStatus = "DNS_UNRESOLVED";
    } else if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
      deploymentStatus = "CONNECTION_TIMEOUT";
    } else if (httpStatus && httpStatus >= 500) {
      deploymentStatus = "SERVICE_UNAVAILABLE";
    } else if (httpStatus === 404) {
      deploymentStatus = "HEALTH_ROUTE_MISSING";
    } else {
      deploymentStatus = "HTTP_ERROR";
    }
  }

  const artifact: DeploymentVerificationArtifact = {
    deploymentUrl: targetUrl,
    deployedGitSha,
    verifiedGitSha: git.gitShaFull,
    shaMatch: Boolean(deployedGitSha && deployedGitSha.toLowerCase() === git.gitShaFull.toLowerCase()),
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
    errorCode,
    errorMessage,
    httpStatus,
  };

  console.log(
    `[DeployVerify] Status: ${deploymentStatus} (Deployed SHA: ${deployedGitSha?.slice(0, 7) || "none"}, Code: ${errorCode || "none"})`
  );
  return artifact;
}

if (process.argv[1]?.includes("verify-deployed-service")) {
  verifyDeployedService().then((res) => {
    console.log(JSON.stringify(res, null, 2));
  });
}
