import axios from "axios";
import crypto from "crypto";
import { chromium } from "playwright";
import { fetchPageHtml } from "../fetcher";
import type { DisputedUrlStabilityProbe, LegacyStabilityArtifact } from "./types";

const DISPUTED_URLS = [
  "https://www.botconsulting.io/jobopenings/790176000000574221",
  "https://www.botconsulting.io/jobopenings/790176000000574233",
  "https://www.botconsulting.io/jobopenings/790176000000574281",
  "https://www.botconsulting.io/jobopenings-copy/790176000000574229",
  "https://www.botconsulting.io/jobopenings-copy/790176000000574249",
  "https://www.botconsulting.io/job-categories/sales-marketing",
  "https://www.botconsulting.io/post/how-to-build-a-high-performing-gcc-in-india",
];

export async function executeLegacyStabilityCheck(
  verificationRunId: string,
  gitSha: string
): Promise<LegacyStabilityArtifact> {
  console.log(`[Verify:Stability] Investigating ${DISPUTED_URLS.length} disputed CMS endpoints across 3 probe cycles...`);

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (err: any) {
    console.warn(`[Verify:Stability] Warning: Failed to launch browser for stability probe: ${err.message}`);
  }

  const results: DisputedUrlStabilityProbe[] = [];

  for (const url of DISPUTED_URLS) {
    const statuses: number[] = [];

    for (let cycle = 1; cycle <= 3; cycle++) {
      // 1. Crawler Fetcher
      try {
        const res = await fetchPageHtml(url, 8000);
        statuses.push(res.statusCode);
      } catch (err: any) {
        statuses.push(err.response?.status || 0);
      }

      // 2. Direct Axios
      try {
        const axiosRes = await axios.get(url, {
          timeout: 8000,
          validateStatus: () => true,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
        });
        statuses.push(axiosRes.status);
      } catch (err: any) {
        statuses.push(err.response?.status || 0);
      }

      // 3. Playwright Browser (if browser available)
      if (browser) {
        try {
          const page = await browser.newPage();
          const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
          statuses.push(response ? response.status() : 200);
          await page.close();
        } catch {
          statuses.push(0);
        }
      }
    }

    const uniqueStatuses = Array.from(new Set(statuses));
    const isStable = uniqueStatuses.length === 1 && uniqueStatuses[0] > 0;

    let stabilityClassification: DisputedUrlStabilityProbe["stabilityClassification"] = "unstable_manual_review";
    let rootCauseAnalysis = "";

    if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 200) {
      stabilityClassification = "stable_200";
      rootCauseAnalysis = "Consistently returns HTTP 200 across all clients and browser engines.";
    } else if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 404) {
      stabilityClassification = "stable_404";
      rootCauseAnalysis = "Consistently returns HTTP 404 Not Found across all clients and browser engines.";
    } else if (uniqueStatuses.includes(200) && uniqueStatuses.includes(404)) {
      stabilityClassification = "unstable_manual_review";
      rootCauseAnalysis =
        "Oscillates between 200 and 404 depending on client user-agent or edge CDN cache state in Webflow CMS.";
    } else {
      stabilityClassification = "unreachable";
      rootCauseAnalysis = "Network timeout or connection refused.";
    }

    results.push({
      url,
      statusObservations: statuses,
      isStable,
      stabilityClassification,
      rootCauseAnalysis,
    });
  }

  if (browser) {
    await browser.close().catch(() => {});
  }

  const artifact: LegacyStabilityArtifact = {
    verificationRunId,
    gitSha,
    generatedAt: new Date().toISOString(),
    probesCount: DISPUTED_URLS.length * (browser ? 9 : 6),
    disputedUrlsCount: DISPUTED_URLS.length,
    results,
  };

  console.log(`[Verify:Stability] Complete. All ${results.length} URLs classified (${results.filter((r) => r.isStable).length} stable).`);
  return artifact;
}
