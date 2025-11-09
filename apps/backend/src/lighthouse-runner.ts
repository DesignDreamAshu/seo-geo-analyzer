import lighthouse from "lighthouse";
import chromeLauncher, { LaunchedChrome } from "chrome-launcher";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { ReportGenerator } from "lighthouse/report/generator/report-generator.js";
import { nanoid } from "nanoid";
import type { FormFactor, LighthouseMetricSummary, LighthouseRunRecord } from "./types";
import { normalizeAuditUrl, saveLighthouseRun } from "./storage/lighthouse-store";

interface LighthouseRunOptions {
  url: string;
  formFactor: FormFactor;
}

interface LighthouseSingleRunResult {
  lhr: lighthouse.LH.Result;
  htmlReport: string;
}

const MOBILE_THROTTLING: lighthouse.SharedFlagsSettings["throttling"] = {
  rttMs: 150,
  throughputKbps: 1638.4,
  requestLatencyMs: 562.5,
  downloadThroughputKbps: 1474.56,
  uploadThroughputKbps: 675,
  cpuSlowdownMultiplier: 4,
};

const FORM_FACTOR_SETTINGS: Record<FormFactor, lighthouse.Config.Settings> = {
  mobile: {
    formFactor: "mobile",
    throttling: MOBILE_THROTTLING,
  },
  desktop: {
    formFactor: "desktop",
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },
};

async function runSingleLighthouse({ url, formFactor }: LighthouseRunOptions): Promise<LighthouseSingleRunResult> {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dreamseo-chrome-"));
  let chrome: LaunchedChrome | null = null;

  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
      userDataDir,
    });

    const runnerResult = await lighthouse(
      url,
      {
        port: chrome.port,
        output: ["json", "html"],
        logLevel: "error",
      },
      {
        extends: "lighthouse:default",
        settings: {
          ...FORM_FACTOR_SETTINGS[formFactor],
          screenEmulation:
            formFactor === "desktop"
              ? {
                  mobile: false,
                  width: 1350,
                  height: 940,
                  deviceScaleFactor: 1,
                  disabled: false,
                }
              : undefined,
        },
      },
    );

    if (!runnerResult?.lhr) {
      throw new Error("Lighthouse did not return a valid result.");
    }

    const reports = Array.isArray(runnerResult.report) ? runnerResult.report : [runnerResult.report];
    let htmlReport =
      reports
        .map((report) => (typeof report === "string" ? report : ""))
        .find((report) => report?.trim().toLowerCase().startsWith("<!doctype")) ?? "";

    if (!htmlReport) {
      try {
        htmlReport = ReportGenerator.generateReport(runnerResult.lhr, "html");
      } catch (error) {
        console.warn("Failed to generate Lighthouse HTML report:", error);
        htmlReport = "";
      }
    }

    return { lhr: runnerResult.lhr, htmlReport };
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch (error) {
        console.warn("Failed to shutdown Chrome cleanly:", error);
      }
    }
    await fs.remove(userDataDir).catch(() => undefined);
  }
}

function toMetricSummary(lhr: lighthouse.LH.Result): LighthouseMetricSummary {
  const audits = lhr.audits;
  const categories = lhr.categories ?? {};

  const pickValue = (id: string) => audits?.[id]?.numericValue ?? null;

  return {
    score: categories.performance?.score != null ? Math.round(categories.performance.score * 100) : null,
    lcp: pickValue("largest-contentful-paint"),
    cls: pickValue("cumulative-layout-shift"),
    inp: pickValue("interaction-to-next-paint") ?? pickValue("total-blocking-time"), // fallback
    tbt: pickValue("total-blocking-time"),
    fcp: pickValue("first-contentful-paint"),
    rawCategoryScores: Object.fromEntries(
      Object.entries(categories).map(([key, category]) => [key, category?.score != null ? category.score * 100 : null]),
    ),
  };
}

export async function runLighthouseSuite(url: string): Promise<LighthouseRunRecord> {
  const normalizedUrl = normalizeAuditUrl(url);

  const mobileResult = await runSingleLighthouse({ url: normalizedUrl, formFactor: "mobile" });
  const desktopResult = await runSingleLighthouse({ url: normalizedUrl, formFactor: "desktop" });

  const record: LighthouseRunRecord = {
    id: nanoid(12),
    url: normalizedUrl,
    createdAt: new Date().toISOString(),
    mobile: toMetricSummary(mobileResult.lhr),
    desktop: toMetricSummary(desktopResult.lhr),
    raw: {
      mobile: mobileResult.lhr,
      desktop: desktopResult.lhr,
    },
    reports: {
      mobile: mobileResult.htmlReport,
      desktop: desktopResult.htmlReport,
    },
  };

  await saveLighthouseRun(record);
  return record;
}
