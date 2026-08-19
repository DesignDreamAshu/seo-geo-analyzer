/**
 * Legacy CMS Response Stability & Scientific Investigation Suite
 * 
 * Performs multi-method, multi-cycle diagnostics on disputed CMS URLs across:
 * 1. Production Crawler Fetcher
 * 2. Direct Axios HTTP Client
 * 3. Playwright Headless Browser
 */

import axios from "axios";
import crypto from "crypto";
import { chromium } from "playwright";
import { fetchPageHtml } from "../fetcher";

interface ProbeResult {
  method: "crawler_fetcher" | "direct_axios" | "playwright_browser";
  cycle: number;
  status: number | null;
  finalUrl: string;
  contentType: string;
  contentLength: number;
  bodyHash: string;
  title: string | null;
  h1: string | null;
  serverHeader?: string;
  cacheControl?: string;
  cfRay?: string;
  error?: string;
}

interface DisputedUrlDiagnostic {
  url: string;
  probes: ProbeResult[];
  statusObservations: number[];
  isStable: boolean;
  stabilityClassification: "stable_200" | "stable_404" | "unstable_manual_review" | "unreachable";
  rootCauseAnalysis: string;
}

const DISPUTED_URLS = [
  "https://www.botconsulting.io/jobopenings/790176000000574221",
  "https://www.botconsulting.io/jobopenings/790176000000574233",
  "https://www.botconsulting.io/jobopenings/790176000000574281",
  "https://www.botconsulting.io/jobopenings-copy/790176000000574229",
  "https://www.botconsulting.io/jobopenings-copy/790176000000574249",
  "https://www.botconsulting.io/job-categories/sales-marketing",
  "https://www.botconsulting.io/post/how-to-build-a-high-performing-gcc-in-india",
];

async function runDiagnostic() {
  console.log("=======================================================");
  console.log("   LEGACY CMS RESPONSE STABILITY INVESTIGATION SUITE   ");
  console.log("=======================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  const diagnostics: DisputedUrlDiagnostic[] = [];

  for (const url of DISPUTED_URLS) {
    console.log(`\nInvestigating Target: ${url}`);
    const probes: ProbeResult[] = [];

    for (let cycle = 1; cycle <= 3; cycle++) {
      // 1. Crawler Fetcher
      try {
        const res = await fetchPageHtml(url, 10000);
        const hash = crypto.createHash("sha256").update(res.html || "").digest("hex").slice(0, 8);
        probes.push({
          method: "crawler_fetcher",
          cycle,
          status: res.statusCode,
          finalUrl: res.finalUrl,
          contentType: res.contentType || "",
          contentLength: res.byteSize,
          bodyHash: hash,
          title: res.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null,
          h1: res.html.match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1]?.trim() || null,
          serverHeader: String(res.headers?.["server"] || ""),
          cacheControl: String(res.headers?.["cache-control"] || ""),
          cfRay: String(res.headers?.["cf-ray"] || ""),
        });
      } catch (err: any) {
        probes.push({
          method: "crawler_fetcher",
          cycle,
          status: err.response?.status || 0,
          finalUrl: url,
          contentType: "",
          contentLength: 0,
          bodyHash: "err",
          title: null,
          h1: null,
          error: err.message,
        });
      }

      // 2. Direct Axios
      try {
        const axiosRes = await axios.get(url, {
          timeout: 10000,
          validateStatus: () => true,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
        });
        const bodyStr = typeof axiosRes.data === "string" ? axiosRes.data : JSON.stringify(axiosRes.data);
        const hash = crypto.createHash("sha256").update(bodyStr).digest("hex").slice(0, 8);
        probes.push({
          method: "direct_axios",
          cycle,
          status: axiosRes.status,
          finalUrl: url,
          contentType: String(axiosRes.headers["content-type"] || ""),
          contentLength: Buffer.byteLength(bodyStr, "utf8"),
          bodyHash: hash,
          title: bodyStr.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null,
          h1: bodyStr.match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1]?.trim() || null,
          serverHeader: String(axiosRes.headers["server"] || ""),
          cacheControl: String(axiosRes.headers["cache-control"] || ""),
          cfRay: String(axiosRes.headers["cf-ray"] || ""),
        });
      } catch (err: any) {
        probes.push({
          method: "direct_axios",
          cycle,
          status: err.response?.status || 0,
          finalUrl: url,
          contentType: "",
          contentLength: 0,
          bodyHash: "err",
          title: null,
          h1: null,
          error: err.message,
        });
      }

      // 3. Playwright Browser
      try {
        const page = await context.newPage();
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
        const navStatus = response ? response.status() : 200;
        const pageTitle = await page.title().catch(() => null);
        const h1 = await page.$eval("h1", (el) => el.textContent?.trim() || null).catch(() => null);
        const content = await page.content();
        const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 8);
        await page.close();

        probes.push({
          method: "playwright_browser",
          cycle,
          status: navStatus,
          finalUrl: page.url(),
          contentType: "text/html",
          contentLength: Buffer.byteLength(content, "utf8"),
          bodyHash: hash,
          title: pageTitle,
          h1,
        });
      } catch (err: any) {
        probes.push({
          method: "playwright_browser",
          cycle,
          status: 0,
          finalUrl: url,
          contentType: "",
          contentLength: 0,
          bodyHash: "err",
          title: null,
          h1: null,
          error: err.message,
        });
      }
    }

    const statuses = probes.map((p) => p.status || 0);
    const uniqueStatuses = Array.from(new Set(statuses));
    const isStable = uniqueStatuses.length === 1 && uniqueStatuses[0] > 0;

    let stabilityClassification: DisputedUrlDiagnostic["stabilityClassification"] = "unstable_manual_review";
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

    console.log(`  -> Observed Statuses: [${statuses.join(", ")}]`);
    console.log(`  -> Classification: ${stabilityClassification}`);
    console.log(`  -> Analysis: ${rootCauseAnalysis}`);

    diagnostics.push({
      url,
      probes,
      statusObservations: statuses,
      isStable,
      stabilityClassification,
      rootCauseAnalysis,
    });
  }

  await context.close();
  await browser.close();

  console.log("\n=======================================================");
  console.log("   DIAGNOSTIC SUMMARY TABLE");
  console.log("=======================================================");
  for (const d of diagnostics) {
    console.log(`URL: ${d.url}`);
    console.log(`  Statuses: [${d.statusObservations.join(",")}] | Stability: ${d.stabilityClassification}`);
  }
}

runDiagnostic().catch(console.error);
