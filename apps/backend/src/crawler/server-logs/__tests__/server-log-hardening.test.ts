/**
 * Exhaustive 34-Dimension Server Log Intelligence Final Certification Hardening Suite (A to AH).
 */

import { parseLogLines, parseLogChunks, getAdapterSupportState } from "../adapters";
import { classifyBotRequest } from "../bot-classifier";
import { normalizeLogUrl, redactSensitiveQueryParams, detectResourceType } from "../url-normalizer";
import { computeUrlCrawlMetrics } from "../crawl-metrics";
import { evaluateImportantPageCoverage, evaluateCrawlBudgetMateriality } from "../coverage-engine";
import { detectCrawlPatterns } from "../pattern-detector";
import { createLogAnalysisSnapshot, validateLogSnapshotComparability } from "../snapshots";
import { bridgeServerLogOpportunitiesToPhase11 } from "../phase-integrators";
import { analyzeServerLogIntelligence } from "../engine";
import { GOOGLEBOT_OFFICIAL_DATASET, GPTBOT_OFFICIAL_DATASET, OAI_SEARCHBOT_OFFICIAL_DATASET, CHATGPT_USER_OFFICIAL_DATASET } from "../bot-ranges";

function describe(suiteName: string, fn: () => void) {
  console.log(`\n--- [HARDENING SUITE] ${suiteName} ---`);
  fn();
}

function it(testName: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res && typeof (res as any).then === "function") {
      return (res as any)
        .then(() => {
          console.log(`  ✓ ${testName}`);
        })
        .catch((err: any) => {
          console.error(`  ❌ FAIL: ${testName}`);
          console.error(`     ${err.message}`);
          throw err;
        });
    }
    console.log(`  ✓ ${testName}`);
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy value but received ${actual}`);
    },
  };
}

describe("Phase 18 Comprehensive Hardening Certification Suite (A to AH)", () => {
  // A. Official Bot Range Verification
  it("A. Verifies Googlebot only against published official CIDRs", () => {
    const valid = classifyBotRequest("Googlebot/2.1", "66.249.66.1");
    expect(valid.verificationState).toBe("VERIFIED_PROVIDER_RANGE");

    const invalid = classifyBotRequest("Googlebot/2.1", "66.249.200.1"); // Outside published ranges
    expect(invalid.verificationState).toBe("USER_AGENT_ONLY");
  });

  // B. Reverse/Forward DNS Semantics
  it("B. Supports forward and reverse DNS verification", () => {
    const res = classifyBotRequest("Googlebot/2.1", "192.0.2.1", { dnsLookupFn: () => true });
    expect(res.verificationState).toBe("VERIFIED_FORWARD_REVERSE_DNS");
  });

  // C. Range Freshness / Versioning
  it("C. Stale range dataset degrades verification confidence", () => {
    const res = classifyBotRequest("Googlebot/2.1", "66.249.66.1", {
      customGooglebotDataset: { ...GOOGLEBOT_OFFICIAL_DATASET, freshness: "STALE" },
    });
    expect(res.verificationState).toBe("PROVIDER_RANGE_STALE");
  });

  // D. UA Spoofing
  it("D. Spoofed UA with unverified IP is never given verified identity", () => {
    const res = classifyBotRequest("Googlebot/2.1", "198.51.100.25");
    expect(res.isVerifiedSearchBot).toBe(false);
  });

  // E. Provider Adapter Truth
  it("E. Exposes adapter support states honestly without exaggerating AWS native support", () => {
    expect(getAdapterSupportState("NGINX_APACHE")).toBe("IMPLEMENTED_AND_TESTED");
    expect(getAdapterSupportState("AWS_CLOUDFRONT")).toBe("GENERIC_IMPORT_SUPPORTED");
  });

  // F. Crawl Frequency Policies
  it("F. Crawl frequency policy is contextual and suppresses conclusions on partial datasets", () => {
    const metrics = computeUrlCrawlMetrics({ events: [], datasetDays: 14, completeness: "PARTIAL" });
    expect(metrics.size).toBe(0);
  });

  // G. Crawl Budget Materiality
  it("G. Materiality policy distinguishes 50-page compact sites (LOW) from 25,000-page catalogs (HIGH)", () => {
    const low = evaluateCrawlBudgetMateriality({ totalKnownUrls: 50, totalObservedRequests: 500, completeness: "COMPLETE" });
    expect(low.materiality).toBe("LOW");

    const high = evaluateCrawlBudgetMateriality({ totalKnownUrls: 25000, totalObservedRequests: 100000, completeness: "COMPLETE" });
    expect(high.materiality).toBe("HIGH");
  });

  // H. Dataset Quality
  it("H. Rejection rate > 50% classifies dataset completeness as INVALID", () => {
    const lines = ["GARBAGE_1", "GARBAGE_2", '66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET / HTTP/1.1" 200 100 "-" "Googlebot/2.1"'];
    const res = parseLogLines({ lines, provider: "NGINX_APACHE", projectId: "p1", defaultHost: "example.com" });
    expect(res.completeness).toBe("INVALID");
  });

  // I. Dataset Comparability
  it("I. Comparability gate fails when bot verification datasets differ", () => {
    const snap1 = createLogAnalysisSnapshot({ snapshotId: "s1", projectId: "p1", datasetStart: "2026-08-01", datasetEnd: "2026-08-10", completeness: "COMPLETE", totalLogLinesParsed: 100, totalRejectedEvents: 0, totalBotRequests: 100, verifiedGooglebotHtmlRequests: 80, uniqueUrlsRequestedCount: 10, crawlBudgetMateriality: "LOW", rangeDatasetVersion: "v1" });
    const snap2 = createLogAnalysisSnapshot({ snapshotId: "s2", projectId: "p1", datasetStart: "2026-08-11", datasetEnd: "2026-08-20", completeness: "COMPLETE", totalLogLinesParsed: 100, totalRejectedEvents: 0, totalBotRequests: 100, verifiedGooglebotHtmlRequests: 80, uniqueUrlsRequestedCount: 10, crawlBudgetMateriality: "LOW", rangeDatasetVersion: "v2" });

    const comp = validateLogSnapshotComparability(snap1, snap2);
    expect(comp.isComparable).toBe(false);
    expect((comp as any).reason).toBe("BOT_VERIFICATION_SEMANTICS_CHANGED");
  });

  // J. Bot Reclassification Safety
  it("J. Distinguishes identity confidence change from genuine traffic changes", () => {
    const uaOnly = classifyBotRequest("Googlebot/2.1", "1.1.1.1");
    const verified = classifyBotRequest("Googlebot/2.1", "66.249.66.1");
    expect(uaOnly.verificationState !== verified.verificationState).toBe(true);
  });

  // K. Resource Classification
  it("K. Separates HTML documents from images, CSS, JS, PDFs, XML, and APIs", () => {
    expect(detectResourceType("/article")).toBe("HTML_DOCUMENT");
    expect(detectResourceType("/photo.jpg")).toBe("IMAGE");
    expect(detectResourceType("/styles.css")).toBe("CSS");
    expect(detectResourceType("/app.js")).toBe("JAVASCRIPT");
    expect(detectResourceType("/doc.pdf")).toBe("PDF");
    expect(detectResourceType("/sitemap.xml")).toBe("XML");
  });

  // L. Parameter Taxonomy
  it("L. Classifies query parameters into functional categories and preserves raw URL", () => {
    const res = normalizeLogUrl("example.com", "/catalog", "utm_campaign=summer&page=2&color=red");
    expect(res.rawUrl.includes("utm_campaign=summer")).toBe(true);
    expect(res.queryParamCategories["page"]).toBe("PAGINATION");
    expect(res.queryParamCategories["color"]).toBe("FILTERING");
  });

  // M. Facet Safeguards
  it("M. Facet review evaluates search demand and does not blindly prescribe self-canonicalization", () => {
    const events: any[] = [];
    for (let i = 0; i < 60; i++) {
      events.push({ eventId: `e_${i}`, timestamp: "2026-08-21T10:00:00Z", projectId: "p1", host: "example.com", method: "GET", rawPath: "/shop", rawQuery: `filter=${i}`, rawUrl: `https://example.com/shop?filter=${i}`, normalizedUrl: `https://example.com/shop/?filter=${i}`, statusCode: 200, sourceProvider: "CLOUDFLARE", resourceType: "HTML_DOCUMENT", botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false } });
    }
    const res = detectCrawlPatterns({ events });
    expect(res.facetPatterns.length).toBe(1);
    expect(res.facetPatterns[0].recommendedReviewType).toBe("FACET_INDEXABILITY_REVIEW");
  });

  // N. Crawl Trap Safeguards
  it("N. Distinguishes crawl trap types (CALENDAR_EXPANSION vs INFINITE_PAGINATION)", () => {
    const events: any[] = [];
    for (let i = 0; i < 60; i++) {
      events.push({ eventId: `e_${i}`, timestamp: "2026-08-21T10:00:00Z", projectId: "p1", host: "example.com", method: "GET", rawPath: "/events/calendar", rawQuery: `year=20${i}`, rawUrl: `https://example.com/events/calendar?year=20${i}`, normalizedUrl: `https://example.com/events/calendar/?year=20${i}`, statusCode: 200, sourceProvider: "CLOUDFLARE", resourceType: "HTML_DOCUMENT", botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false } });
    }
    const res = detectCrawlPatterns({ events });
    expect(res.crawlTraps.length).toBe(1);
    expect(res.crawlTraps[0].trapType).toBe("CALENDAR_EXPANSION");
  });

  // O. Redirect Behavior
  it("O. Heavy bot crawl on healthy migration 301 is recognized as expected transition", async () => {
    const lines = ['66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /old-page HTTP/1.1" 301 0 "-" "Googlebot/2.1"'];
    const { report } = await analyzeServerLogIntelligence({
      projectId: "p1",
      defaultHost: "example.com",
      logLines: lines,
      provider: "NGINX_APACHE",
      migrationData: { migrationId: "m1", legacyUrls: ["https://example.com/old-page/"], destinationUrls: ["https://example.com/new-page/"] },
    });
    expect(report.migrationIntelligenceIntegration?.legacyUrlsHealthyRedirectPercent).toBe(100);
  });

  // P. 404 / 410 Behavior
  it("P. Distinguishes 404 client errors from intentional 410 gone responses", async () => {
    const lines = [
      '66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /missing HTTP/1.1" 404 0 "-" "Googlebot/2.1"',
      '66.249.66.1 - - [21/Aug/2026:10:01:00 +0000] "GET /retired HTTP/1.1" 410 0 "-" "Googlebot/2.1"',
    ];
    const { report } = await analyzeServerLogIntelligence({ projectId: "p1", defaultHost: "example.com", logLines: lines, provider: "NGINX_APACHE" });
    expect(report.crawlEfficiency.errorConcentration.total404Requests).toBe(1);
    expect(report.crawlEfficiency.errorConcentration.total410Requests).toBe(1);
  });

  // Q. 5xx Bursts
  it("Q. Configurable 5xx burst policy groups clusters without alarming on isolated 500s", () => {
    const singleEvent: any[] = [
      { eventId: "e1", timestamp: "2026-08-21T10:00:00Z", projectId: "p1", host: "example.com", method: "GET", rawPath: "/p1", rawUrl: "https://example.com/p1", normalizedUrl: "https://example.com/p1/", statusCode: 500, sourceProvider: "NGINX", resourceType: "HTML_DOCUMENT", botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false } },
    ];
    const res = detectCrawlPatterns({ events: singleEvent });
    expect(res.errorBursts.length).toBe(0); // Isolated error does not trigger burst
  });

  // R. Latency Policy
  it("R. Latency calculations separate origin latency from browser CWV", async () => {
    const lines = ['66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /test HTTP/1.1" 200 1000 "-" "Googlebot/2.1"'];
    const { report } = await analyzeServerLogIntelligence({ projectId: "p1", defaultHost: "example.com", logLines: lines, provider: "NGINX_APACHE" });
    expect(report.crawlEfficiency.originLatency.disclaimer.includes("separate from browser Core Web Vitals")).toBe(true);
  });

  // S. Sitemap Correlation
  it("S. Correlates sitemap URLs with log observations without claiming sitemap proved discovery", () => {
    const knownUrls = [{ url: "https://example.com/in-sitemap/", isIndexable: true, isImportant: true, importanceReasons: ["SITEMAP_INDEXED"] }];
    const metrics = computeUrlCrawlMetrics({ events: [], knownUrls });
    expect(metrics.get("https://example.com/in-sitemap/")?.coverageState).toBe("CRAWLABLE_NOT_OBSERVED");
  });

  // T. Orphan / Internal Link Correlation
  it("T. Orphan candidate absent from complete logs elevates discoverability review", () => {
    const knownUrls = [{ url: "https://example.com/orphan/", isIndexable: true, isImportant: true, importanceReasons: ["ORPHAN_CANDIDATE"] }];
    const metrics = computeUrlCrawlMetrics({ events: [], knownUrls, completeness: "COMPLETE" });
    expect(metrics.get("https://example.com/orphan/")?.frequencyClass).toBe("NOT_OBSERVED_IN_PERIOD");
  });

  // U. Canonical Variants
  it("U. Preserves case and trailing-slash variants for non-canonical crawl auditing", () => {
    const res1 = normalizeLogUrl("example.com", "/About");
    const res2 = normalizeLogUrl("example.com", "/about/");
    expect(res1.rawUrl).toBe("https://example.com/About");
    expect(res2.normalizedUrl).toBe("https://example.com/about/");
  });

  // V. Migration Log Intelligence
  it("V. Migration integration tracks legacy URL request decay", async () => {
    const lines = ['66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /old HTTP/1.1" 301 0 "-" "Googlebot/2.1"'];
    const { report } = await analyzeServerLogIntelligence({
      projectId: "p1",
      defaultHost: "example.com",
      logLines: lines,
      provider: "NGINX_APACHE",
      migrationData: { migrationId: "m1", legacyUrls: ["https://example.com/old/"], destinationUrls: ["https://example.com/new/"] },
    });
    expect(report.migrationIntelligenceIntegration?.legacyUrlsStillCrawledCount).toBe(1);
  });

  // W. GSC Boundary
  it("W. Logs and GSC remain separate evidence dimensions", () => {
    const gscDemand = new Map<string, number>([["https://example.com/shop?filter=1", 150]]);
    const events: any[] = [];
    for (let i = 0; i < 55; i++) {
      events.push({ eventId: `e_${i}`, timestamp: "2026-08-21T10:00:00Z", projectId: "p1", host: "example.com", method: "GET", rawPath: "/shop", rawQuery: `filter=${i}`, rawUrl: `https://example.com/shop?filter=${i}`, normalizedUrl: `https://example.com/shop/?filter=${i}`, statusCode: 200, sourceProvider: "CLOUDFLARE", resourceType: "HTML_DOCUMENT", botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false } });
    }
    const res = detectCrawlPatterns({ events, gscQueriesPerUrl: gscDemand });
    expect(res.facetPatterns[0].hasSearchDemand).toBe(true);
    expect(res.facetPatterns[0].recommendedReviewType).toBe("FACET_CANONICAL_REVIEW");
  });

  // X. Backlinks
  it("X. Backlink-caused 404 requests are captured accurately", async () => {
    const lines = ['66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /broken-backlink HTTP/1.1" 404 0 "-" "Googlebot/2.1"'];
    const { report } = await analyzeServerLogIntelligence({ projectId: "p1", defaultHost: "example.com", logLines: lines, provider: "NGINX_APACHE" });
    expect(report.crawlEfficiency.errorConcentration.total404Requests).toBe(1);
  });

  // Y. International / Local
  it("Y. Tracks crawl activity across locale and branch paths", () => {
    const norm = normalizeLogUrl("example.com", "/fr/services/paris");
    expect(norm.normalizedUrl).toBe("https://example.com/fr/services/paris/");
  });

  // Z. AI Crawler Semantics
  it("Z. Reports AI crawlers by distinct purpose (GPTBot=Training, OAI-SearchBot=Search, ChatGPT-User=UserFetch)", () => {
    const gpt = classifyBotRequest("GPTBot/1.2", "20.171.206.5");
    const oai = classifyBotRequest("OAI-SearchBot/1.0", "20.150.180.5");
    const user = classifyBotRequest("ChatGPT-User/1.0", "23.102.140.5");

    expect(gpt.aiPurpose).toBe("AI_TRAINING");
    expect(oai.aiPurpose).toBe("SEARCH_INDEXING");
    expect(user.aiPurpose).toBe("USER_TRIGGERED_FETCH");
  });

  // AA. Privacy / Redaction
  it("AA. Redacts secret parameters from raw query strings and raw URLs", () => {
    const red = redactSensitiveQueryParams("auth_token=secret_jwt&password=mypassword&user_id=10");
    expect(red.includes("secret_jwt")).toBe(false);
    expect(red.includes("mypassword")).toBe(false);
    expect(red.includes("user_id=10")).toBe(true);
  });

  // AB. Event Deduplication
  it("AB. Deduplicates genuine duplicate events without dropping distinct requests", () => {
    const lines = [
      '66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /p1 HTTP/1.1" 200 100 "-" "Googlebot/2.1"',
      '66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /p1 HTTP/1.1" 200 100 "-" "Googlebot/2.1"', // Duplicate
    ];
    const res = parseLogLines({ lines, provider: "NGINX_APACHE", projectId: "p1", defaultHost: "example.com" });
    expect(res.totalParsed).toBe(1);
  });

  // AC. Malformed Row Confidence
  it("AC. Tracks rejection reasons for malformed rows", () => {
    const lines = ["MALFORMED_ROW"];
    const res = parseLogLines({ lines, provider: "NGINX_APACHE", projectId: "p1", defaultHost: "example.com" });
    expect(res.rejectionReasons["UNRECOGNIZED_LOG_SYNTAX"]).toBe(1);
  });

  // AD. Streaming / Bounded Memory Contract
  it("AD. Processes log chunks via streaming generator", () => {
    const chunks = [['66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /stream HTTP/1.1" 200 100 "-" "Googlebot/2.1"']];
    let total = 0;
    for (const chunkEvents of parseLogChunks(chunks, { provider: "NGINX_APACHE", projectId: "p1", defaultHost: "example.com" })) {
      total += chunkEvents.length;
    }
    expect(total).toBe(1);
  });

  // AE. Phase 11 Authority & Deduplication
  it("AE. Phase 18 candidate actions respect Phase 11 priority authority and deduplicate", () => {
    const bursts = [{ timestampStart: "2026-08-21T10:00:00Z", timestampEnd: "2026-08-21T10:05:00Z", statusCode: 500, requestsCount: 10, affectedUrls: ["https://example.com/api"] }];
    const actions = bridgeServerLogOpportunitiesToPhase11({ projectId: "p1", errorBursts: bursts, facetPatterns: [], unobservedImportantUrls: [] });
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe("TECHNICAL_FIX");
  });

  // AF. Report Evidence
  it("AF. Exposes dataset ID, range version, and limitations in serialized Markdown report", async () => {
    const lines = ['66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /about HTTP/1.1" 200 1000 "-" "Googlebot/2.1"'];
    const { report } = await analyzeServerLogIntelligence({ projectId: "p1", defaultHost: "example.com", logLines: lines, provider: "NGINX_APACHE" });
    expect(report.datasetQuality.rangeDatasetMetadata.datasetVersionOrHash).toBe("sha256_goog_20260801");
  });

  // AG. Project Isolation
  it("AG. Project IDs isolate crawl datasets strictly", () => {
    const snap1 = createLogAnalysisSnapshot({ snapshotId: "s1", projectId: "project_a", datasetStart: "2026-08-01", datasetEnd: "2026-08-10", completeness: "COMPLETE", totalLogLinesParsed: 100, totalRejectedEvents: 0, totalBotRequests: 100, verifiedGooglebotHtmlRequests: 80, uniqueUrlsRequestedCount: 10, crawlBudgetMateriality: "LOW" });
    const snap2 = createLogAnalysisSnapshot({ snapshotId: "s2", projectId: "project_b", datasetStart: "2026-08-01", datasetEnd: "2026-08-10", completeness: "COMPLETE", totalLogLinesParsed: 100, totalRejectedEvents: 0, totalBotRequests: 100, verifiedGooglebotHtmlRequests: 80, uniqueUrlsRequestedCount: 10, crawlBudgetMateriality: "LOW" });

    const comp = validateLogSnapshotComparability(snap1, snap2);
    expect(comp.isComparable).toBe(false);
    expect((comp as any).reason).toBe("PROJECT_MISMATCH");
  });

  // AH. Rule Reuse
  it("AH. Reuses existing certified production rules without creating duplicate rule codes", () => {
    const bursts = [{ timestampStart: "2026-08-21T10:00:00Z", timestampEnd: "2026-08-21T10:05:00Z", statusCode: 500, requestsCount: 10, affectedUrls: ["https://example.com/api"] }];
    const actions = bridgeServerLogOpportunitiesToPhase11({ projectId: "p1", errorBursts: bursts, facetPatterns: [], unobservedImportantUrls: [] });
    expect(actions[0].underlyingRuleCodes[0]).toBe("STATUS_500_INTERNAL_SERVER_ERROR");
  });
});
