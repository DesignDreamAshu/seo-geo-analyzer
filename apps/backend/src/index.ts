import "./env";
import express from "express";
import axios from "axios";
import cors from "cors";
import { nanoid } from "nanoid";
import { generatePdf } from "html-pdf-node";
import { ReportGenerator } from "lighthouse/report/generator/report-generator.js";
import { analyzeSite, AnalysisTimeoutError, calculateWeightedScore } from "./analysis";
import { reconstructModulesFromCrawlResult } from "./analysis/reconstruct-modules";
import { runSiteAuditCrawl } from "./crawler/engine";
import { fetchPageHtml, checkBrowserCapability } from "./crawler/fetcher";
import { processPageAuthoritatively } from "./crawler/page-processor";
import { evaluateAllDiagnosticRules } from "./crawler/rules";
import { normalizeUrl } from "./crawler/normalizer";
import { getGitProvenance } from "./crawler/verification/git-info";
import { normalizeAuditUrl } from "./storage/lighthouse-store";
import { saveShareRecord, getShareRecord } from "./storage/share-store";
import {
  createPersistenceLayer,
  normalizeDomain,
  executeAndPersistAudit,
  computeAuditComparison,
  reconstructHistoricalReportMarkdown,
} from "./crawler/persistence";
import {
  RULE_VERIFICATION_CAPABILITY_REGISTRY,
  getRuleVerificationCapability,
} from "./crawler/verification/rule-verification-registry";
import {
  verifySingleResource,
  verifyBatchAffected,
} from "./crawler/verification/issue-verifier";
import {
  evaluateOnSiteAISearchReadiness,
  generateProjectKnowledgeAndPromptUniverse,
  globalKnowledgeGovernance,
  globalAIObservationEngine,
  globalAIVisibilityAnalyticsEngine,
  globalAIVisibilityTrendEngine,
  globalAISourceIntelligenceEngine,
  globalAIOptimizationEngine,
  globalAIMeasurementEngine,
  globalAIMeasurementComparator,
  globalAICompetitiveEngine,
  globalCompetitorCrawler,
  normalizeCompetitorDomain,
  validateCompetitorAddition,
  AIOptimizationVerifier,
} from "./ai-search/engine";
import { SqliteAnalyticsRepository } from "./ai-search/analytics/persistence/sqlite-analytics-repo";
import { SqliteCitationRepository } from "./ai-search/citations/persistence/sqlite-citation-repo";
import { SqliteOptimizationRepository } from "./ai-search/optimization/persistence/sqlite-optimization-repo";
import { SqliteMeasurementRepository } from "./ai-search/measurement/persistence/sqlite-measurement-repo";
import { SqliteCompetitiveRepository } from "./ai-search/competitive/persistence/sqlite-competitive-repo";
import {
  globalRemediationWorkflowEngine,
  SqliteWorkflowRepository,
} from "./workflow";
import {
  globalClientReportEngine,
  SqliteClientReportRepository,
  ClientPdfGenerator,
  RemediationCsvExporter,
} from "./reporting";
import type { ExportPayload, ModuleSnapshot } from "./types";

const PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

async function runLighthouseViaPSI(url: string, strategy: "mobile" | "desktop") {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.PSI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY / PSI_API_KEY");
  }

  const { data } = await axios.get(PSI_URL, {
    params: {
      url,
      strategy,
      category: "performance",
      key: apiKey,
    },
  });

  if (!data?.lighthouseResult) {
    throw new Error("PSI response missing lighthouseResult");
  }

  return data.lighthouseResult;
}

async function runDualPSI(url: string) {
  const normalizedUrl = normalizeAuditUrl(url);
  const [mobile, desktop] = await Promise.all([
    runLighthouseViaPSI(normalizedUrl, "mobile"),
    runLighthouseViaPSI(normalizedUrl, "desktop"),
  ]);
  return { normalizedUrl, mobile, desktop };
}


const app = express();
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const extraOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];
const allowedOrigins = [...defaultOrigins, ...extraOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes("*") ||
        origin.endsWith(".lovable.app") ||
        origin.endsWith(".lovableproject.com") ||
        origin.endsWith(".netlify.app") ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive CORS for deployed SEO tools
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// Health Check Endpoints
app.get(["/api/health", "/health"], (req, res) => {
  res.json({
    status: "ok",
    service: "seo-geo-analyzer-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeModules = (modules: ModuleSnapshot[] = []): ModuleSnapshot[] =>
  modules.map((module) => ({
    id: module.id ?? nanoid(6),
    name: module.name ?? "Untitled Module",
    score: Number.isFinite(Number(module.score)) ? Number(module.score) : 0,
    weight: Number.isFinite(Number(module.weight)) ? Number(module.weight) : 0,
    recommendations: Array.isArray(module.recommendations)
      ? module.recommendations.map((rec) => String(rec))
      : [],
    issues: {
      critical: Number(module.issues?.critical ?? 0),
      warning: Number(module.issues?.warning ?? 0),
      info: Number(module.issues?.info ?? 0),
    },
    lastChecked: module.lastChecked ?? null,
  }));

const buildGroupedRecommendations = (modules: ModuleSnapshot[]) => {
  const grouped = {
    critical: [] as string[],
    warnings: [] as string[],
    improvements: [] as string[],
  };

  modules.forEach((module) => {
    if (!module.recommendations?.length) return;
    const severity =
      module.issues.critical > 0
        ? "critical"
        : module.issues.warning > 0
          ? "warnings"
          : "improvements";
    module.recommendations.forEach((rec) => {
      grouped[severity].push(`${module.name}: ${rec}`);
    });
  });

  return grouped;
};

const normalizeExportPayload = (payload: ExportPayload): ExportPayload => {
  const normalizedModules = normalizeModules(payload.modules ?? []);
  const snapshots = Array.isArray(payload.historySnapshots) ? payload.historySnapshots : [];

  return {
    url: normalizeAuditUrl(payload.url),
    country: String(payload.country ?? "").trim(),
    modules: normalizedModules,
    historySnapshots: snapshots.map((snapshot) => ({
      timestamp: snapshot?.timestamp ? new Date(snapshot.timestamp).toISOString() : new Date().toISOString(),
      overallScore: Number(snapshot?.overallScore ?? 0),
    })),
    groupedRecommendations: buildGroupedRecommendations(normalizedModules),
  };
};

const renderReportHtml = (payload: ExportPayload) => {
  const grouped = payload.groupedRecommendations ?? buildGroupedRecommendations(payload.modules);
  const historyRows =
    payload.historySnapshots?.length
      ? payload.historySnapshots
          .map(
            (snapshot) => `
            <tr>
              <td>${escapeHtml(new Date(snapshot.timestamp).toLocaleString())}</td>
              <td>${snapshot.overallScore.toFixed(2)}</td>
            </tr>
          `,
          )
          .join("")
      : '<tr><td colspan="2">No history snapshots recorded.</td></tr>';

  const modulesHtml = payload.modules
    .map(
      (module) => `
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 style="margin:0;font-size:16px;">${escapeHtml(module.name)}</h3>
            <p style="margin:4px 0;color:#6b7280;font-size:12px;">
              Weight ${module.weight}% &middot; Score ${module.score.toFixed(1)}
            </p>
          </div>
          <div style="text-align:right;font-size:12px;color:#6b7280;">
            <div>Last checked</div>
            <div>${module.lastChecked ? escapeHtml(new Date(module.lastChecked).toLocaleString()) : "—"}</div>
          </div>
        </div>
        <div style="margin-top:12px;font-size:13px;color:#374151;">
          <strong>Recommendations</strong>
          <ul>
            ${module.recommendations.map((rec) => `<li>${escapeHtml(rec)}</li>`).join("") || "<li>No recommendations.</li>"}
          </ul>
        </div>
      </div>
    `,
    )
    .join("");

  const groupedHtml = (label: string, items: string[]) => `
    <div style="flex:1;min-width:200px;">
      <h4 style="margin-bottom:8px;">${label}</h4>
      <ul>
        ${items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>None recorded.</li>"}
      </ul>
    </div>
  `;

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>SEO & GEO Analysis Report</title>
    </head>
    <body style="font-family:Arial,sans-serif;padding:24px;background:#f7f7f8;color:#111827;">
      <header style="margin-bottom:24px;">
        <p style="text-transform:uppercase;letter-spacing:4px;font-size:12px;color:#6b7280;margin:0;">Report</p>
        <h1 style="margin:4px 0 8px 0;">SEO & GEO Analysis Report</h1>
        <p style="margin:0;color:#374151;">${escapeHtml(payload.url)}</p>
        <p style="margin:4px 0 0 0;color:#6b7280;">Country: ${escapeHtml(payload.country)}</p>
      </header>
      <section style="margin-bottom:24px;">
        <h2>History Snapshots</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:8px;">Timestamp</th>
              <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:8px;">Overall Score</th>
            </tr>
          </thead>
          <tbody>
            ${historyRows}
          </tbody>
        </table>
      </section>
      <section style="margin-bottom:24px;">
        <h2>Grouped Recommendations</h2>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          ${groupedHtml("Critical", grouped.critical)}
          ${groupedHtml("Warnings", grouped.warnings)}
          ${groupedHtml("Improvements", grouped.improvements)}
        </div>
      </section>
      <section>
        <h2>Modules</h2>
        ${modulesHtml}
      </section>
    </body>
  </html>`;
};

const isExportPayloadValid = (payload: ExportPayload | undefined): payload is ExportPayload =>
  Boolean(
    payload &&
      typeof payload.url === "string" &&
      payload.url.trim().length &&
      typeof payload.country === "string" &&
      payload.country.trim().length &&
      Array.isArray(payload.modules) &&
      payload.modules.length,
  );

app.post("/api/export", async (req, res) => {
  const payload = req.body as ExportPayload;
  if (!isExportPayloadValid(payload)) {
    return res.status(400).json({ error: "Invalid export payload" });
  }

  try {
    const normalizedPayload = normalizeExportPayload(payload);
    const pdfBuffer = await generatePdf(
      { content: renderReportHtml(normalizedPayload) },
      { format: "A4", printBackground: true },
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="seo-geo-report-${Date.now()}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Unable to export report", error);
    return res.status(500).json({ error: "Unable to export report", message: (error as Error).message });
  }
});

app.post("/api/share", async (req, res) => {
  const payload = req.body as ExportPayload & { ttlHours?: number };
  if (!isExportPayloadValid(payload)) {
    return res.status(400).json({ error: "Invalid share payload" });
  }

  try {
    const normalizedPayload = normalizeExportPayload(payload);
    const ttlHours = Number.isFinite(Number(payload.ttlHours))
      ? Math.max(1, Math.min(168, Number(payload.ttlHours)))
      : 48;
    const token = nanoid(16);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    await saveShareRecord({
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      payload: normalizedPayload,
    });

    const shareUrl = `${req.protocol}://${req.get("host")}/api/share/${token}`;
    return res.status(201).json({
      token,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Unable to create share link", error);
    return res.status(500).json({ error: "Unable to create share link", message: (error as Error).message });
  }
});

app.get("/api/share/:token", async (req, res) => {
  const record = await getShareRecord(req.params.token);
  if (!record) {
    return res.status(404).json({ error: "Share link not found or expired" });
  }
  return res.json(record);
});

type SSEClient = {
  res: express.Response;
  heartbeat: NodeJS.Timeout;
};

const sseClients = new Set<SSEClient>();

const sendEvent = (event: string, data: unknown) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.res.write(payload);
  }
};

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write("event: ping\ndata: {}\n\n");

  const client: SSEClient = {
    res,
    heartbeat: setInterval(() => {
      try {
        res.write("event: ping\ndata: {}\n\n");
      } catch {
        clearInterval(client.heartbeat);
        sseClients.delete(client);
      }
    }, 30000),
  };

  sseClients.add(client);

  req.on("close", () => {
    clearInterval(client.heartbeat);
    sseClients.delete(client);
  });
});

const persistence = createPersistenceLayer();

async function ensureProjectForUrl(url: string, country?: string, device?: string) {
  const normDomain = normalizeDomain(url);
  let project = await persistence.projects.getProjectByDomain(normDomain);
  if (!project) {
    const projectId = `proj_${nanoid(8)}`;
    let hostname = "site";
    try {
      const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
      hostname = parsedUrl.hostname.replace(/^www\./, "");
    } catch {
      hostname = normDomain;
    }
    project = await persistence.projects.createProject({
      projectId,
      name: hostname,
      primaryDomain: url.startsWith("http") ? url : `https://${url}`,
      normalizedDomain: normDomain,
      status: "ACTIVE",
      defaultCountry: country || "US",
      defaultDevice: (device as any) || "MOBILE",
    });
  }
  return project;
}

const handleCrawlerAuditRequest = async (req: express.Request, res: express.Response) => {
  const { url, maxPages, maxDepth, concurrency, allowSubdomains, respectRobotsTxt } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  try {
    sendEvent("crawler:start", { url });

    const project = await ensureProjectForUrl(url);

    const persistedOutput = await executeAndPersistAudit({
      project,
      persistenceLayer: persistence,
      crawlOptions: {
        seedUrl: url,
        maxPages: Number(maxPages) || 50,
        maxDepth: Number(maxDepth) || 5,
        concurrency: Number(concurrency) || 5,
        allowSubdomains: Boolean(allowSubdomains),
        respectRobotsTxt: respectRobotsTxt !== false,
        onProgress: (progress) => {
          sendEvent("crawler:progress", progress);
        },
      },
      trigger: "MANUAL",
    });

    const auditResult = persistedOutput.crawlResult
      ? {
          ...persistedOutput.crawlResult,
          auditId: persistedOutput.auditRun.auditRunId,
          persistedAuditRun: persistedOutput.auditRun,
          comparison: persistedOutput.comparison,
        }
      : {
          auditId: persistedOutput.auditRun.auditRunId,
          seedUrl: url,
          normalizedSeedUrl: project.normalizedDomain,
          startedAt: persistedOutput.auditRun.startedAt,
          completedAt: persistedOutput.auditRun.completedAt || new Date().toISOString(),
          durationMs: 0,
          healthScore: persistedOutput.metrics.seoScore || 80,
          inventory: {
            totalCrawled: persistedOutput.pages.length,
            totalIndexable: persistedOutput.pages.filter((p) => p.indexability === "INDEXABLE").length,
            totalNonIndexable: persistedOutput.pages.filter((p) => p.indexability === "NON_INDEXABLE").length,
            totalRedirects: persistedOutput.pages.filter((p) => p.redirectChain && p.redirectChain.length > 0).length,
            totalBrokenPages: persistedOutput.pages.filter((p) => p.statusCode >= 400).length,
            sitemapDiscoveredCount: 0,
            sitemapOrphanCount: 0,
            crawlIsolatedCount: 0,
          },
          severityCounts: {
            critical: persistedOutput.metrics.criticalCount,
            warnings: persistedOutput.metrics.highCount,
            opportunities: persistedOutput.metrics.mediumCount,
            notices: persistedOutput.metrics.lowCount,
          },
          categories: [],
          issues: persistedOutput.findings.map((f) => ({
            id: f.auditFindingId,
            code: f.ruleId,
            category: "general",
            title: f.message,
            description: f.message,
            recommendation: "Review and remediate issue.",
            confidence: "confirmed",
            confidenceScore: 1.0,
            impactScore: 10,
            affectedCount: 1,
            severity: f.severity.toLowerCase(),
            affectedPages: [{ url: f.normalizedUrl, evidence: f.evidence }],
          })),
          crawledPages: persistedOutput.pages.map((p) => ({
            url: p.normalizedUrl,
            normalizedUrl: p.normalizedUrl,
            statusCode: p.statusCode,
            isIndexable: p.indexability === "INDEXABLE",
            indexabilityStatus: p.indexability === "INDEXABLE" ? "Indexable" : "Non-Indexable",
            canonicalUrl: p.canonicalUrl,
            title: p.title,
            metaDescription: p.metaDescription,
            h1s: p.h1Summary ? [p.h1Summary] : [],
            crawlDepth: p.crawlDepth,
            responseTimeMs: p.responseMetadata?.responseTimeMs || 0,
            wordCount: p.responseMetadata?.wordCount || 0,
            classification: { primaryClass: "page", confidence: 1.0 },
            outlinks: [],
          })),
          sitemapOrphans: [],
          linkGraphSummary: {},
          persistedAuditRun: persistedOutput.auditRun,
          comparison: persistedOutput.comparison,
        };

    console.log(`[API /api/crawler/audit FINAL PERSISTED RESULT]`, {
      auditId: auditResult.auditId,
      pagesCount: auditResult.crawledPages.length,
      issuesCount: auditResult.issues.length,
      healthScore: auditResult.healthScore,
      comparison: persistedOutput.comparison ? `Baseline #${persistedOutput.comparison.baselineSequenceNumber}` : "Baseline",
    });

    sendEvent("crawler:complete", auditResult);

    sendEvent("toast", {
      title: "Site Audit Complete",
      description: `Crawled ${auditResult.inventory.totalCrawled} pages with Health Score ${auditResult.healthScore}/100.`,
    });

    return res.json(auditResult);
  } catch (error) {
    console.error("Site audit crawler error:", error);
    return res.status(500).json({
      error: "Unable to complete site audit crawl",
      message: (error as Error).message,
    });
  }
};

app.post("/api/crawler/audit", handleCrawlerAuditRequest);
app.post("/api/audit/crawl", handleCrawlerAuditRequest);

// --- Phase 24 Project Persistence & Audit History REST API ---

// 1. List Projects with latest audit run and comparison summary
app.get("/api/projects", async (_req, res) => {
  try {
    const projects = await persistence.projects.listProjects("ACTIVE");
    const enriched = await Promise.all(
      projects.map(async (p) => {
        const auditCount = await persistence.auditRuns.countAuditRunsForProject(p.projectId);
        const latestAudit = await persistence.auditRuns.getLatestCompletedAuditRun(p.projectId);
        let latestMetrics = null;
        let latestComparison = null;
        if (latestAudit) {
          latestMetrics = await persistence.auditMetrics.getMetricsForAuditRun(latestAudit.auditRunId);
          const comparisons = await persistence.auditComparisons.listComparisonsForProject(p.projectId, 1);
          latestComparison = comparisons[0] || null;
        }
        return {
          ...p,
          auditCount,
          latestAudit,
          latestMetrics,
          latestComparison,
        };
      })
    );
    return res.json({ ok: true, projects: enriched });
  } catch (err) {
    console.error("Failed to list projects", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 2. Create or find Project
app.post("/api/projects", async (req, res) => {
  try {
    const { domain, name, defaultCountry, defaultDevice } = req.body || {};
    if (!domain) return res.status(400).json({ error: "domain is required" });
    const project = await ensureProjectForUrl(domain, defaultCountry, defaultDevice);
    if (name && name !== project.name) {
      await persistence.projects.updateProject(project.projectId, { name });
    }
    return res.json({ ok: true, project });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 3. Get Project by ID
app.get("/api/projects/:projectId", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const auditCount = await persistence.auditRuns.countAuditRunsForProject(project.projectId);
    return res.json({ ok: true, project: { ...project, auditCount } });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 4. List Audit Runs for a Project (with sequence, date, metrics, and comparison)
app.get("/api/projects/:projectId/audits", async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const audits = await persistence.auditRuns.listAuditRunsForProject(
      req.params.projectId,
      Number(limit),
      Number(offset)
    );
    const comparisons = await persistence.auditComparisons.listComparisonsForProject(req.params.projectId, 100);
    const enrichedAudits = await Promise.all(
      audits.map(async (audit) => {
        const metrics = await persistence.auditMetrics.getMetricsForAuditRun(audit.auditRunId);
        const comp = comparisons.find((c) => c.currentAuditRunId === audit.auditRunId) || null;
        return {
          ...audit,
          metrics,
          comparisonWithPrevious: comp,
        };
      })
    );
    return res.json({ ok: true, audits: enrichedAudits });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 5. Get Single Historical Audit Run Details
app.get("/api/audits/:auditRunId", async (req, res) => {
  try {
    const auditRun = await persistence.auditRuns.getAuditRunById(req.params.auditRunId);
    if (!auditRun) return res.status(404).json({ error: "Audit run not found" });
    const project = await persistence.projects.getProjectById(auditRun.projectId);
    const pages = await persistence.auditPages.getPagesForAuditRun(auditRun.auditRunId, 1000);
    const findings = await persistence.auditFindings.getFindingsForAuditRun(auditRun.auditRunId, 5000);
    const metrics = await persistence.auditMetrics.getMetricsForAuditRun(auditRun.auditRunId);
    const comparisons = await persistence.auditComparisons.listComparisonsForProject(auditRun.projectId, 50);
    const comparisonWithPrevious = comparisons.find((c) => c.currentAuditRunId === auditRun.auditRunId) || null;
    const historicalReportMarkdown = reconstructHistoricalReportMarkdown({
      projectName: project?.name || "Website",
      auditRun,
      pages,
      findings,
      metrics,
      comparisonWithPrevious,
    });

    // Check if full snapshot exists
    const snapshot = await persistence.auditSnapshots.getSnapshot(auditRun.auditRunId);
    let siteAudit: any = null;
    if (snapshot && snapshot.payloadJson) {
      try {
        const parsed = JSON.parse(snapshot.payloadJson);
        if (parsed.crawlResult) {
          siteAudit = parsed.crawlResult;
        }
      } catch {}
    }

    if (!siteAudit) {
      // Reconstruct siteAudit structure cleanly from persisted entities
      siteAudit = {
        auditId: auditRun.auditRunId,
        seedUrl: project?.primaryDomain || "",
        normalizedSeedUrl: project?.normalizedDomain || "",
        startedAt: auditRun.startedAt,
        completedAt: auditRun.completedAt || auditRun.startedAt,
        durationMs: 0,
        healthScore: metrics?.seoScore ?? 80,
        inventory: {
          totalCrawled: pages.length,
          totalIndexable: pages.filter((p) => p.indexability === "INDEXABLE").length,
          totalNonIndexable: pages.filter((p) => p.indexability !== "INDEXABLE").length,
          totalRedirects: pages.filter((p) => p.redirectChain && p.redirectChain.length > 0).length,
          totalBrokenPages: pages.filter((p) => p.statusCode >= 400).length,
          sitemapDiscoveredCount: 0,
          sitemapOrphanCount: 0,
          crawlIsolatedCount: 0,
        },
        severityCounts: {
          critical: metrics?.criticalCount ?? 0,
          warnings: metrics?.highCount ?? 0,
          opportunities: metrics?.mediumCount ?? 0,
          notices: metrics?.lowCount ?? 0,
        },
        categories: [],
        issues: findings.map((f) => ({
          id: f.auditFindingId,
          code: f.ruleId,
          category: f.evidence?.category || "general",
          title: f.message,
          description: f.evidence?.description || f.message,
          severity: (f.severity?.toLowerCase() || "opportunity") as any,
          confidence: "confirmed" as any,
          confidenceScore: 1.0,
          impactScore: f.severity === "CRITICAL" ? 4 : f.severity === "HIGH" ? 3 : 2,
          scorePenalty: f.evidence?.scorePenalty || 0,
          affectedPages: f.evidence?.affectedPages || [{ url: f.normalizedUrl, evidence: f.evidence }],
          affectedCount: f.evidence?.affectedCount || 1,
          affectedOccurrences: 1,
          affectedUniquePages: 1,
          eligiblePageCount: pages.length || 1,
          affectedRatio: 1 / Math.max(1, pages.length),
        })),
        crawledPages: pages.map((p) => ({
          url: p.originalUrl || p.normalizedUrl,
          requestedUrl: p.originalUrl || p.normalizedUrl,
          normalizedUrl: p.normalizedUrl,
          finalUrl: p.finalUrl || p.originalUrl || p.normalizedUrl,
          statusCode: p.statusCode,
          redirectHops: [],
          contentType: "text/html",
          resourceType: "html_page" as any,
          responseTimeMs: p.responseMetadata?.responseTimeMs || 0,
          depth: p.crawlDepth || 0,
          html: "",
          headers: {},
          crawledAt: p.createdAt,
          sourceMode: "raw_http" as any,
          renderMode: "raw" as any,
          renderReason: "persisted_snapshot",
          renderConfidence: "high" as any,
          rawWordCount: p.responseMetadata?.wordCount || 0,
          rawDocumentWordCount: p.responseMetadata?.wordCount || 0,
          visibleBodyWordCount: p.responseMetadata?.wordCount || 0,
          mainContentWordCount: p.responseMetadata?.wordCount || 0,
          renderedWordCount: p.responseMetadata?.wordCount || 0,
          rawH1Count: 1,
          renderedH1Count: 1,
          rawTitle: p.title || null,
          renderedTitle: p.title || null,
          soft404Status: "valid_page" as any,
          title: p.title || null,
          titleLength: p.title?.length || 0,
          metaDescription: p.metaDescription || null,
          metaDescriptionLength: p.metaDescription?.length || 0,
          canonicalUrl: p.canonicalUrl || null,
          isCanonicalSelfReferencing: true,
          isCanonicalTargetReachable: true,
          metaRobots: null,
          xRobotsTag: null,
          isIndexable: p.indexability === "INDEXABLE",
          indexabilityStatus: (p.indexability?.toLowerCase() || "indexable") as any,
          h1s: p.h1Summary ? [p.h1Summary] : [],
          h1Count: 1,
          h1Tags: [],
          h2Tags: [],
          h3Tags: [],
          headingsOutline: [],
          headingsHierarchyValid: true,
          headingsHierarchyIssues: [],
          wordCount: p.responseMetadata?.wordCount || 0,
          textToHtmlRatio: 0,
          landmarks: { hasMain: true, mainCount: 1, navCount: 1, footerCount: 1, headerCount: 1, asideCount: 0 },
          forms: [],
          images: [],
          resources: [],
          outlinks: [],
          openGraph: { rawTags: [], missingRequiredTags: [], duplicateTags: [], emptyTags: [], imageFetchState: "FETCH_NOT_EVALUATED", canonicalConsistent: true, validationStatus: "NOT_EVALUATED" },
          twitterCard: { rawTags: [], missingTags: [], hasExplicitCard: false, hasOgFallback: false, validationStatus: "NOT_EVALUATED" },
          schemaJsonLd: [],
          classification: { primaryClass: "marketing_landing", confidence: 1.0, signals: [] },
        })),
        scoreBreakdown: {
          startingScore: 100,
          finalScore: metrics?.seoScore ?? 80,
          totalDeductions: Math.max(0, 100 - (metrics?.seoScore ?? 80)),
          deductions: [],
        },
      };
    }

    const modules = reconstructModulesFromCrawlResult(siteAudit);

    return res.json({
      ok: true,
      project,
      auditRun,
      pages,
      findings,
      metrics,
      comparisonWithPrevious,
      historicalReportMarkdown,
      siteAudit,
      modules,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 5b. Get Latest Completed Audit Run for Project
app.get("/api/projects/:projectId/latest-audit", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const latestAudit = await persistence.auditRuns.getLatestCompletedAuditRun(project.projectId);
    if (!latestAudit) return res.status(404).json({ error: "No completed audits found for project" });

    const pages = await persistence.auditPages.getPagesForAuditRun(latestAudit.auditRunId, 1000);
    const findings = await persistence.auditFindings.getFindingsForAuditRun(latestAudit.auditRunId, 5000);
    const metrics = await persistence.auditMetrics.getMetricsForAuditRun(latestAudit.auditRunId);
    const comparisons = await persistence.auditComparisons.listComparisonsForProject(project.projectId, 50);
    const comparisonWithPrevious = comparisons.find((c) => c.currentAuditRunId === latestAudit.auditRunId) || null;

    const snapshot = await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId);
    let siteAudit: any = null;
    if (snapshot && snapshot.payloadJson) {
      try {
        const parsed = JSON.parse(snapshot.payloadJson);
        if (parsed.crawlResult) {
          siteAudit = parsed.crawlResult;
        }
      } catch {}
    }

    const modules = reconstructModulesFromCrawlResult(siteAudit);

    return res.json({
      ok: true,
      project,
      auditRun: latestAudit,
      pages,
      findings,
      metrics,
      comparisonWithPrevious,
      siteAudit,
      modules,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 6. Get Historical Report Markdown
app.get("/api/audits/:auditRunId/report", async (req, res) => {
  try {
    const auditRun = await persistence.auditRuns.getAuditRunById(req.params.auditRunId);
    if (!auditRun) return res.status(404).send("Audit run not found");
    const project = await persistence.projects.getProjectById(auditRun.projectId);
    const pages = await persistence.auditPages.getPagesForAuditRun(auditRun.auditRunId, 1000);
    const findings = await persistence.auditFindings.getFindingsForAuditRun(auditRun.auditRunId, 5000);
    const metrics = await persistence.auditMetrics.getMetricsForAuditRun(auditRun.auditRunId);
    const comparisons = await persistence.auditComparisons.listComparisonsForProject(auditRun.projectId, 50);
    const comparisonWithPrevious = comparisons.find((c) => c.currentAuditRunId === auditRun.auditRunId) || null;
    const markdown = reconstructHistoricalReportMarkdown({
      projectName: project?.name || "Website",
      auditRun,
      pages,
      findings,
      metrics,
      comparisonWithPrevious,
    });
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    return res.send(markdown);
  } catch (err) {
    return res.status(500).send((err as Error).message);
  }
});

// 7. Compare Two Audit Runs (Baseline vs Current)
app.get("/api/projects/:projectId/compare", async (req, res) => {
  try {
    const { baselineAuditRunId, currentAuditRunId } = req.query as { baselineAuditRunId: string; currentAuditRunId: string };
    if (!baselineAuditRunId || !currentAuditRunId) {
      return res.status(400).json({ error: "baselineAuditRunId and currentAuditRunId are required" });
    }
    let comparison = await persistence.auditComparisons.getComparison(baselineAuditRunId, currentAuditRunId);
    if (!comparison) {
      const baselineAudit = await persistence.auditRuns.getAuditRunById(baselineAuditRunId);
      const currentAudit = await persistence.auditRuns.getAuditRunById(currentAuditRunId);
      if (!baselineAudit || !currentAudit) {
        return res.status(404).json({ error: "One or both audit runs not found" });
      }
      const baselinePages = await persistence.auditPages.getPagesForAuditRun(baselineAuditRunId, 5000);
      const currentPages = await persistence.auditPages.getPagesForAuditRun(currentAuditRunId, 5000);
      const baselineFindings = await persistence.auditFindings.getFindingsForAuditRun(baselineAuditRunId, 5000);
      const currentFindings = await persistence.auditFindings.getFindingsForAuditRun(currentAuditRunId, 5000);
      const historicalFindings = await persistence.auditFindings.listHistoricalFindingsForFingerprints(
        req.params.projectId,
        currentFindings.map((f) => f.findingFingerprint)
      );
      comparison = computeAuditComparison({
        projectId: req.params.projectId,
        baselineAudit,
        currentAudit,
        baselinePages,
        currentPages,
        baselineFindings,
        currentFindings,
        historicalFindingsForProject: historicalFindings,
      });
      await persistence.auditComparisons.saveComparison(comparison);
    }
    return res.json({ ok: true, comparison });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 8. Finding History (Lifecycle across audits)
app.get("/api/projects/:projectId/findings/history", async (req, res) => {
  try {
    const { fingerprint } = req.query as { fingerprint: string };
    if (!fingerprint) {
      return res.status(400).json({ error: "fingerprint query param is required" });
    }
    const history = await persistence.auditFindings.getFindingHistory(req.params.projectId, fingerprint);
    return res.json({ ok: true, history });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 9. URL History (Page snapshots across audits)
app.get("/api/projects/:projectId/urls/history", async (req, res) => {
  try {
    const { url } = req.query as { url: string };
    if (!url) {
      return res.status(400).json({ error: "url query param is required" });
    }
    const history = await persistence.auditPages.getPageHistory(req.params.projectId, url);
    return res.json({ ok: true, history });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 10. Trigger Full Re-Crawl Audit for Project (Strictly inheriting source audit configuration)
app.post("/api/projects/:projectId/recrawl", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const { maxPages, maxDepth, sourceAuditRunId } = req.body || {};

    // Source audit configuration is authoritative
    const sourceAudit = sourceAuditRunId
      ? await persistence.auditRuns.getAuditRunById(sourceAuditRunId)
      : await persistence.auditRuns.getLatestAuditRunForProject(req.params.projectId);

    const prevConfig = sourceAudit?.configurationSnapshot?.crawlSettings;
    const prevMaxPages = prevConfig?.maxPages;
    const prevMaxDepth = prevConfig?.maxDepth;

    let isConfigFallback = false;
    let effectiveMaxPages: number;
    if (typeof maxPages === "number" && maxPages > 0) {
      effectiveMaxPages = maxPages;
    } else if (typeof prevMaxPages === "number" && prevMaxPages > 0) {
      effectiveMaxPages = prevMaxPages;
    } else {
      effectiveMaxPages = 150;
      isConfigFallback = true;
    }

    const effectiveMaxDepth = (typeof maxDepth === "number" && maxDepth > 0) ? maxDepth : (prevMaxDepth && prevMaxDepth > 0 ? prevMaxDepth : 5);

    console.log(`[API /api/projects/:projectId/recrawl] Re-crawling ${project.primaryDomain} | Source audit: ${sourceAudit?.auditRunId || "latest"} | Inherited maxPages: ${effectiveMaxPages} (fallback: ${isConfigFallback}) | maxDepth: ${effectiveMaxDepth}`);

    sendEvent("crawler:start", { url: project.primaryDomain });
    const output = await executeAndPersistAudit({
      project,
      persistenceLayer: persistence,
      crawlOptions: {
        seedUrl: project.primaryDomain,
        maxPages: effectiveMaxPages,
        maxDepth: effectiveMaxDepth,
        onProgress: (p) => sendEvent("crawler:progress", p),
      },
      trigger: "MANUAL",
    });
    sendEvent("crawler:complete", {
      auditId: output.auditRun.auditRunId,
      pagesCount: output.pages.length,
      healthScore: output.metrics.seoScore,
      siteAudit: output.crawlResult,
    });
    return res.json({ ok: true, isConfigFallback, effectiveMaxPages, ...output });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 11. Verification Capabilities Registry
app.get("/api/rules/verification-capabilities", (_req, res) => {
  return res.json({
    ok: true,
    capabilities: RULE_VERIFICATION_CAPABILITY_REGISTRY,
    totalRules: 95,
  });
});

// 12. Targeted Issue Verification (Verify Issue / Verify All Affected)
app.post("/api/projects/:projectId/verify-issue", async (req, res) => {
  try {
    const { ruleId, findingFingerprint, affectedResources = [], sourceAuditRunId } = req.body || {};
    if (!ruleId) {
      return res.status(400).json({ error: "ruleId is required." });
    }

    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Execute live issue verification across all specified affected resources
    const batchSummary = await verifyBatchAffected(
      ruleId,
      affectedResources,
      project.normalizedDomain,
      3, // Concurrency limit
      12000 // Timeout
    );

    // Record verification event in finding lifecycle history if sourceAuditRunId is present
    if (sourceAuditRunId) {
      const recordsToInsert = batchSummary.results.map((r) => ({
        auditFindingId: `vf_${nanoid(10)}`,
        auditRunId: sourceAuditRunId,
        projectId: project.projectId,
        ruleId,
        severity: (r.status === "VERIFIED_FIXED" ? "LOW" : "HIGH") as any,
        findingState: (r.isFixed ? "FIXED" : "OPEN") as any,
        message: r.message,
        evidence: {
          verificationType: "ISSUE_LIVE_VERIFICATION",
          observedUrl: r.url,
          targetUrl: r.targetUrl,
          verificationResult: r.status,
          liveEvidence: r.liveEvidence,
          verifiedAt: r.verifiedAt,
        },
        normalizedUrl: normalizeUrl(r.url),
        findingFingerprint: findingFingerprint || `fp_${ruleId}_${normalizeUrl(r.url)}`,
        createdAt: r.verifiedAt,
      }));

      if (recordsToInsert.length > 0) {
        await persistence.auditFindings.batchInsertFindings(recordsToInsert);
      }
    }

    return res.json({
      ok: true,
      ruleId,
      findingFingerprint,
      ...batchSummary,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 13. Targeted Finding Verification (Single Resource Verify Fix)
app.post("/api/projects/:projectId/verify-finding", async (req, res) => {
  try {
    const { findingFingerprint, ruleId, url, targetUrl, rawHref, domSelector, codeSnippet, occurrences, sourceAuditRunId } = req.body || {};
    if (!url || !ruleId) {
      return res.status(400).json({ error: "url and ruleId are required." });
    }

    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Execute rule-specific verification for single resource
    const verificationResult = await verifySingleResource(
      ruleId,
      { url, targetUrl, rawHref, domSelector, codeSnippet, occurrences },
      project.normalizedDomain,
      12000
    );

    // Record verification event in finding lifecycle history if source audit run exists
    if (sourceAuditRunId) {
      await persistence.auditFindings.batchInsertFindings([
        {
          auditFindingId: `vf_${nanoid(10)}`,
          auditRunId: sourceAuditRunId,
          projectId: project.projectId,
          ruleId,
          severity: (verificationResult.isFixed ? "LOW" : "HIGH") as any,
          findingState: (verificationResult.isFixed ? "FIXED" : "OPEN") as any,
          message: verificationResult.message,
          evidence: {
            verificationType: "FINDING_VERIFICATION",
            observedUrl: url,
            targetUrl: verificationResult.targetUrl,
            verificationResult: verificationResult.status,
            occurrenceDiff: verificationResult.occurrenceDiff,
            liveEvidence: verificationResult.liveEvidence,
            verifiedAt: verificationResult.verifiedAt,
          },
          normalizedUrl: normalizeUrl(url),
          findingFingerprint: findingFingerprint || `fp_${ruleId}_${normalizeUrl(url)}`,
          createdAt: verificationResult.verifiedAt,
        },
      ]);
    }

    return res.json({
      ok: true,
      verificationResult: verificationResult.status,
      ruleId,
      url,
      isFixed: verificationResult.isFixed,
      findingFingerprint,
      message: verificationResult.message,
      occurrenceDiff: verificationResult.occurrenceDiff,
      liveEvidence: verificationResult.liveEvidence,
      verifiedAt: verificationResult.verifiedAt,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 12. Targeted Page Recheck (Recheck This Page)
app.post("/api/projects/:projectId/recheck-page", async (req, res) => {
  try {
    const { url, sourceAuditRunId } = req.body || {};
    if (!url) return res.status(400).json({ error: "url is required" });

    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const fetchRes = await fetchPageHtml(url);
    if (!fetchRes.ok && fetchRes.statusCode === 0) {
      return res.json({
        ok: true,
        url,
        statusCode: 0,
        status: "FETCH_FAILED",
        issues: [],
        message: "Failed to connect to target URL.",
      });
    }

    const pageData = await processPageAuthoritatively(
      url,
      normalizeUrl(url),
      fetchRes.finalUrl,
      fetchRes.statusCode,
      fetchRes.redirectHops,
      fetchRes.html,
      fetchRes.headers,
      fetchRes.responseTimeMs,
      0,
      { seedNormalized: project.normalizedDomain }
    );

    const evalResults = evaluateAllDiagnosticRules([pageData]);

    // Retrieve previous findings for this URL if sourceAuditRunId provided
    let previousFindings: any[] = [];
    if (sourceAuditRunId) {
      const allAuditFindings = await persistence.auditFindings.getFindingsForAuditRun(sourceAuditRunId, 2000);
      previousFindings = allAuditFindings.filter((f) => f.normalizedUrl === normalizeUrl(url));
    }

    const currentRuleCodes = new Set(evalResults.issues.map((i) => i.code));
    const previousRuleCodes = new Set(previousFindings.map((f) => f.ruleId));

    const fixedIssues = previousFindings.filter((f) => !currentRuleCodes.has(f.ruleId));
    const stillPresentIssues = evalResults.issues.filter((i) => previousRuleCodes.has(i.code));
    const newIssuesOnPage = evalResults.issues.filter((i) => !previousRuleCodes.has(i.code));

    // Save page snapshot to URL history
    await persistence.auditPages.batchInsertPages([
      {
        auditPageId: `pr_${nanoid(10)}`,
        auditRunId: sourceAuditRunId || `recheck_${Date.now()}`,
        projectId: project.projectId,
        originalUrl: url,
        finalUrl: pageData.finalUrl,
        normalizedUrl: normalizeUrl(url),
        crawlDepth: 0,
        statusCode: pageData.statusCode,
        indexability: pageData.isIndexable ? "INDEXABLE" : "NON_INDEXABLE",
        title: pageData.title || undefined,
        responseMetadata: {
          responseTimeMs: pageData.responseTimeMs,
          wordCount: pageData.wordCount,
          verificationType: "PAGE_RECHECK",
          issuesCount: evalResults.issues.length,
        },
        createdAt: new Date().toISOString(),
      },
    ]);

    return res.json({
      ok: true,
      url,
      statusCode: pageData.statusCode,
      title: pageData.title,
      wordCount: pageData.wordCount,
      indexability: pageData.isIndexable ? "INDEXABLE" : "NON_INDEXABLE",
      fixedCount: fixedIssues.length,
      stillPresentCount: stillPresentIssues.length,
      newCount: newIssuesOnPage.length,
      fixedIssues: fixedIssues.map((f) => ({ ruleId: f.ruleId, message: f.message })),
      currentIssues: evalResults.issues,
      recheckedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 13. Trigger Crawl Audit for Project
app.post("/api/projects/:projectId/crawl", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const { maxPages, maxDepth } = req.body || {};
    sendEvent("crawler:start", { url: project.primaryDomain });
    const output = await executeAndPersistAudit({
      project,
      persistenceLayer: persistence,
      crawlOptions: {
        seedUrl: project.primaryDomain,
        maxPages: Number(maxPages) || 50,
        maxDepth: Number(maxDepth) || 5,
        onProgress: (p) => sendEvent("crawler:progress", p),
      },
      trigger: "MANUAL",
    });
    sendEvent("crawler:complete", {
      auditId: output.auditRun.auditRunId,
      pagesCount: output.pages.length,
      healthScore: output.metrics.seoScore,
      siteAudit: output.crawlResult,
    });
    return res.json({ ok: true, ...output });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/analyze", async (req, res) => {
  const { url, strategy, locale, skipCache, maxPages } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  const requestedMaxPages = Number(maxPages) > 0 ? Number(maxPages) : 150;
  console.log(`[API /api/analyze] Starting analysis for ${url} | Requested maxPages: ${requestedMaxPages}`);

  try {
    sendEvent("crawler:start", { url });

    const project = await ensureProjectForUrl(url);

    // Run both single-page module audit and multi-page crawler with persistence concurrently
    const [analysis, persistedOutput] = await Promise.all([
      analyzeSite({
        url,
        strategy,
        locale,
        skipCache: Boolean(skipCache),
      }),
      executeAndPersistAudit({
        project,
        persistenceLayer: persistence,
        crawlOptions: {
          seedUrl: url,
          maxPages: requestedMaxPages,
          maxDepth: 5,
          concurrency: 5,
          onProgress: (progress) => {
            sendEvent("crawler:progress", progress);
          },
        },
        trigger: "MANUAL",
      }).catch((err) => {
        console.error("Crawler persistence error in /api/analyze:", err);
        return null;
      }),
    ]);

    let siteAudit = null;
    if (persistedOutput) {
      siteAudit = persistedOutput.crawlResult
        ? {
            ...persistedOutput.crawlResult,
            auditId: persistedOutput.auditRun.auditRunId,
            persistedAuditRun: persistedOutput.auditRun,
            comparison: persistedOutput.comparison,
          }
        : {
            auditId: persistedOutput.auditRun.auditRunId,
            seedUrl: url,
            normalizedSeedUrl: project.normalizedDomain,
            startedAt: persistedOutput.auditRun.startedAt,
            completedAt: persistedOutput.auditRun.completedAt || new Date().toISOString(),
            durationMs: 0,
            healthScore: persistedOutput.metrics.seoScore || 80,
            inventory: {
              totalCrawled: persistedOutput.pages.length,
              totalIndexable: persistedOutput.pages.filter((p) => p.indexability === "INDEXABLE").length,
              totalNonIndexable: persistedOutput.pages.filter((p) => p.indexability === "NON_INDEXABLE").length,
              totalRedirects: persistedOutput.pages.filter((p) => p.redirectChain && p.redirectChain.length > 0).length,
              totalBrokenPages: persistedOutput.pages.filter((p) => p.statusCode >= 400).length,
              sitemapDiscoveredCount: 0,
              sitemapOrphanCount: 0,
              crawlIsolatedCount: 0,
            },
            severityCounts: {
              critical: persistedOutput.metrics.criticalCount,
              warnings: persistedOutput.metrics.highCount,
              opportunities: persistedOutput.metrics.mediumCount,
              notices: persistedOutput.metrics.lowCount,
            },
            categories: [],
            issues: persistedOutput.findings.map((f) => ({
              id: f.auditFindingId,
              code: f.ruleId,
              category: "general",
              title: f.message,
              description: f.message,
              recommendation: "Review and remediate issue.",
              confidence: "confirmed",
              confidenceScore: 1.0,
              impactScore: 10,
              affectedCount: 1,
              severity: f.severity.toLowerCase(),
              affectedPages: [{ url: f.normalizedUrl, evidence: f.evidence }],
            })),
            crawledPages: persistedOutput.pages.map((p) => ({
              url: p.normalizedUrl,
              normalizedUrl: p.normalizedUrl,
              statusCode: p.statusCode,
              isIndexable: p.indexability === "INDEXABLE",
              indexabilityStatus: p.indexability === "INDEXABLE" ? "Indexable" : "Non-Indexable",
              canonicalUrl: p.canonicalUrl,
              title: p.title,
              metaDescription: p.metaDescription,
              h1s: p.h1Summary ? [p.h1Summary] : [],
              crawlDepth: p.crawlDepth,
              responseTimeMs: p.responseMetadata?.responseTimeMs || 0,
              wordCount: p.responseMetadata?.wordCount || 0,
              classification: { primaryClass: "page", confidence: 1.0 },
              outlinks: [],
            })),
            sitemapOrphans: [],
            linkGraphSummary: {},
            persistedAuditRun: persistedOutput.auditRun,
            comparison: persistedOutput.comparison,
          };

      console.log(`[API /api/analyze FINAL PERSISTED RESULT]`, {
        auditId: siteAudit.auditId,
        pagesCount: siteAudit.crawledPages.length,
        issuesCount: siteAudit.issues.length,
        healthScore: siteAudit.healthScore,
      });
      sendEvent("crawler:complete", siteAudit);
    }

    const combinedResponse = {
      ...analysis,
      siteAudit,
    };

    res.json(combinedResponse);

    sendEvent("toast", {
      title: "Analysis complete",
      description: `Finished auditing ${analysis.url} (${siteAudit?.inventory?.totalCrawled || 1} pages crawled)`,
    });
  } catch (error) {
    if (error instanceof AnalysisTimeoutError) {
      return res.status(504).json({ error: error.message });
    }
    console.error("Unable to analyze site", error);
    return res.status(500).json({ error: "Unable to analyze site", message: (error as Error).message });
  }
});

app.post("/api/recheck/:moduleId", async (req, res) => {
  const modulesInput = req.body?.modules;
  if (!Array.isArray(modulesInput) || !modulesInput.length) {
    return res.status(400).json({ error: "modules array is required" });
  }

  const normalizedModules = normalizeModules(modulesInput as ModuleSnapshot[]);
  const targetIndex = normalizedModules.findIndex((module) => module.id === req.params.moduleId);
  if (targetIndex === -1) {
    return res.status(404).json({ error: "Module not found in payload" });
  }

  const target = normalizedModules[targetIndex];
  const now = new Date();

  const delta = Number(((Math.random() - 0.3) * 0.8).toFixed(2));
  const updatedScore = Math.max(0, Math.min(10, Number((target.score + delta).toFixed(2))));

  const updatedModule: ModuleSnapshot = {
    ...target,
    score: updatedScore,
    lastChecked: now.toISOString(),
  };

  normalizedModules[targetIndex] = updatedModule;
  const overallScore = calculateWeightedScore(
    normalizedModules.map((module) => ({ score: module.score, weight: module.weight })),
  );

  const responsePayload = {
    module: updatedModule,
    overallScore,
    timestamp: now.toISOString(),
  };

  res.json(responsePayload);

  sendEvent("toast", {
    title: "Module Rechecked",
    description: `${updatedModule.name} was updated successfully.`,
  });
});

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "seo-geo-analyzer-api" });
});

app.get("/api/health", (_req, res) => {
  const git = getGitProvenance();
  res.json({
    ok: true,
    service: "seo-geo-analyzer-api",
    gitSha: process.env.RENDER_GIT_COMMIT || git.gitShaFull,
    nodeVersion: process.version,
    platform: process.platform,
    time: new Date().toISOString(),
  });
});

app.get("/api/health/browser", async (_req, res) => {
  const capability = await checkBrowserCapability();
  const git = getGitProvenance();
  return res.json({
    ok: capability.capability === "available",
    runtime: process.env.RENDER ? "render" : "local",
    gitSha: process.env.RENDER_GIT_COMMIT || git.gitShaFull,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    capability: capability.capability,
    details: capability.details,
    chromiumVersion: capability.chromiumVersion,
    browserLaunchSucceeded: capability.browserLaunchSucceeded,
    navigationSmokeSucceeded: capability.navigationSmokeSucceeded,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/lighthouse-runs", async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ ok: false, error: "url is required" });
  }

  try {
    const { normalizedUrl, mobile, desktop } = await runDualPSI(url);
    return res.json({ ok: true, url: normalizedUrl, lighthouse: { mobile, desktop } });
  } catch (err) {
    console.error("PSI run error", (err as Error).message);
    return res.status(500).json({
      ok: false,
      error: "Unable to complete Lighthouse audit via PSI API",
    });
  }
});

app.get("/api/lighthouse-runs", async (req, res) => {
  const { url } = req.query || {};
  if (!url) {
    return res.status(400).json({ ok: false, error: "url is required" });
  }

  try {
    const { normalizedUrl, mobile, desktop } = await runDualPSI(String(url));
    return res.json({ ok: true, url: normalizedUrl, lighthouse: { mobile, desktop } });
  } catch (err) {
    console.error("PSI fetch error", (err as Error).message);
    return res.status(500).json({
      ok: false,
      error: "Unable to fetch Lighthouse audit",
    });
  }
});

app.get("/api/lighthouse-runs/latest", async (req, res) => {
  const { url } = req.query || {};
  if (!url) {
    return res.status(400).json({ ok: false, error: "url is required" });
  }

  try {
    const { normalizedUrl, mobile, desktop } = await runDualPSI(String(url));
    return res.json({ ok: true, url: normalizedUrl, lighthouse: { mobile, desktop } });
  } catch (err) {
    console.error("PSI latest error", (err as Error).message);
    return res.status(500).json({
      ok: false,
      error: "Unable to fetch latest Lighthouse audit",
    });
  }
});

app.get("/api/lighthouse-runs/report", async (req, res) => {
  const { url, strategy } = req.query || {};
  if (!url) {
    return res.status(400).send("url is required");
  }
  const normalizedUrl = normalizeAuditUrl(String(url));
  const device = strategy === "desktop" ? "desktop" : "mobile";

  try {
    const lighthouse = await runLighthouseViaPSI(normalizedUrl, device);
    const html = ReportGenerator.generateReport(lighthouse, "html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.send(html);
  } catch (err) {
    console.error("PSI report error", (err as Error).message);
    return res.status(500).send("Unable to render Lighthouse report");
  }
});

// ==========================================
// PHASE 28B & 28C: AI SEARCH INTELLIGENCE ENDPOINTS
// ==========================================

// 1. Get On-Site AI Readiness Report (Phase 28B)
app.get("/api/projects/:projectId/ai-search/readiness", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    if (!latestAudit) return res.status(404).json({ error: "No audit runs found for project" });

    const snapshot = await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId);
    const payload = snapshot ? JSON.parse(snapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const readinessReport = evaluateOnSiteAISearchReadiness(crawledPages);
    return res.json({ ok: true, report: readinessReport });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 2. Get Project Knowledge Profile (Phase 28C)
app.get("/api/projects/:projectId/ai-search/knowledge-profile", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    if (!latestAudit) return res.status(404).json({ error: "No audit runs found for project" });

    const snapshot = await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId);
    const payload = snapshot ? JSON.parse(snapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { profile } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    return res.json({ ok: true, profile });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 3. Confirm Knowledge Item
app.post("/api/projects/:projectId/ai-search/knowledge-profile/confirm-item", async (req, res) => {
  try {
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: "itemId is required" });
    globalKnowledgeGovernance.confirmItem(req.params.projectId, itemId);
    return res.json({ ok: true, confirmedItemId: itemId });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 4. Reject Knowledge Item
app.post("/api/projects/:projectId/ai-search/knowledge-profile/reject-item", async (req, res) => {
  try {
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: "itemId is required" });
    globalKnowledgeGovernance.rejectItem(req.params.projectId, itemId);
    return res.json({ ok: true, rejectedItemId: itemId });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 5. Edit Knowledge Item
app.post("/api/projects/:projectId/ai-search/knowledge-profile/edit-item", async (req, res) => {
  try {
    const { itemId, updates } = req.body || {};
    if (!itemId || !updates) return res.status(400).json({ error: "itemId and updates required" });
    globalKnowledgeGovernance.editItem(req.params.projectId, itemId, updates);
    return res.json({ ok: true, editedItemId: itemId });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 6. Get Prompt Universe (Phase 28C)
app.get("/api/projects/:projectId/ai-search/prompts", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    if (!latestAudit) return res.status(404).json({ error: "No audit runs found for project" });

    const snapshot = await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId);
    const payload = snapshot ? JSON.parse(snapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    return res.json({ ok: true, promptUniverse });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ==========================================
// PHASE 28D: LIVE AI VISIBILITY OBSERVATION ENDPOINTS
// ==========================================

// 7. Get Provider Capabilities
app.get("/api/projects/:projectId/ai-search/providers", async (_req, res) => {
  try {
    const capabilities = globalAIObservationEngine.getProviderCapabilities();
    return res.json({ ok: true, providers: capabilities });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 8. Estimate Observation Run Requests
app.post("/api/projects/:projectId/ai-search/observations/estimate", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    const snapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
    const payload = snapshot ? JSON.parse(snapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    const config = req.body || {};
    const estimate = globalAIObservationEngine.estimateObservationRequests(
      config,
      promptUniverse.allCandidates
    );

    return res.json({ ok: true, estimate });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 9. Execute Live AI Observation Run
app.post("/api/projects/:projectId/ai-search/observations/run", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    const snapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
    const payload = snapshot ? JSON.parse(snapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    const config = {
      projectId: project.projectId,
      promptTier: req.body?.promptTier || "TIER_1",
      selectedPromptIds: req.body?.selectedPromptIds,
      selectedClusterIds: req.body?.selectedClusterIds,
      providers: req.body?.providers || ["OPENAI", "GEMINI", "PERPLEXITY"],
      samplingMode: req.body?.samplingMode || "QUICK",
      runsPerPrompt: req.body?.runsPerPrompt || 1,
      country: req.body?.country || "US",
      language: req.body?.language || "en",
    };

    const runSummary = await globalAIObservationEngine.executeObservationRun(
      config,
      profile,
      promptUniverse
    );

    return res.json({ ok: true, runSummary });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 10. List Observation Runs History
app.get("/api/projects/:projectId/ai-search/observations/runs", async (req, res) => {
  try {
    const runs = globalAIObservationEngine.getObservationRuns(req.params.projectId);
    return res.json({ ok: true, runs });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 11. Get Observations for Run
app.get("/api/projects/:projectId/ai-search/observations/runs/:runId/observations", async (req, res) => {
  try {
    const observations = globalAIObservationEngine.getObservationsForRun(req.params.runId);
    return res.json({ ok: true, observations });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 12. Manual Import Observation
app.post("/api/projects/:projectId/ai-search/observations/manual-import", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    const snapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
    const payload = snapshot ? JSON.parse(snapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    const { promptText, responseText, sourceEngineName, citations } = req.body || {};
    if (!promptText || !responseText) {
      return res.status(400).json({ error: "promptText and responseText are required." });
    }

    const matchedPrompt = promptUniverse.allCandidates.find(
      (p) => p.prompt.toLowerCase() === promptText.trim().toLowerCase()
    );

    const observation = globalAIObservationEngine.importManualObservation(
      { promptText, responseText, sourceEngineName, citations },
      profile,
      matchedPrompt
    );

    return res.json({ ok: true, observation });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ==========================================
// PHASE 28E: AI VISIBILITY ANALYTICS ENDPOINTS
// ==========================================

const analyticsRepo = new SqliteAnalyticsRepository(persistence.db);

// 13. Get Latest Analytics Snapshot
app.get("/api/projects/:projectId/ai-search/analytics/latest", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Check if snapshot exists
    let snapshot = analyticsRepo.getLatestSnapshotForProject(project.projectId);
    if (!snapshot) {
      // If no snapshot exists, derive from latest observation run and observations
      const runs = globalAIObservationEngine.getObservationRuns(project.projectId, 1);
      if (runs.length > 0) {
        const latestRun = runs[0];
        const observations = globalAIObservationEngine.getObservationsForRun(latestRun.runId);

        const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
        const auditSnapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
        const payload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;
        const crawledPages = payload?.crawlResult?.crawledPages || [];

        const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
          project.projectId,
          project.normalizedDomain,
          crawledPages
        );

        snapshot = globalAIVisibilityAnalyticsEngine.computeAnalytics(
          project.projectId,
          latestRun.runId,
          observations,
          profile,
          promptUniverse
        );

        analyticsRepo.saveAnalyticsSnapshot(snapshot);
      }
    }

    return res.json({ ok: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 14. Recalculate Analytics from Persisted Observations (Zero Provider Calls)
app.post("/api/projects/:projectId/ai-search/analytics/recalculate", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const runs = globalAIObservationEngine.getObservationRuns(project.projectId, 1);
    if (runs.length === 0) {
      return res.status(400).json({ error: "No observation runs exist to calculate analytics." });
    }

    const latestRun = runs[0];
    const observations = globalAIObservationEngine.getObservationsForRun(latestRun.runId);

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    const auditSnapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
    const payload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    const snapshot = globalAIVisibilityAnalyticsEngine.computeAnalytics(
      project.projectId,
      latestRun.runId,
      observations,
      profile,
      promptUniverse
    );

    analyticsRepo.saveAnalyticsSnapshot(snapshot);
    return res.json({ ok: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 15. Get Longitudinal Trends and Run Comparisons
app.get("/api/projects/:projectId/ai-search/analytics/trends", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const runs = globalAIObservationEngine.getObservationRuns(project.projectId, 20);
    const snapshots = analyticsRepo.listSnapshotsForProject(project.projectId, 20);

    const trends = globalAIVisibilityTrendEngine.computeProjectTrends(
      project.projectId,
      runs,
      snapshots
    );

    // If at least 2 runs, compare latest two
    if (runs.length >= 2) {
      const currentRun = runs[0];
      const baselineRun = runs[1];
      const currentObs = globalAIObservationEngine.getObservationsForRun(currentRun.runId);
      const baselineObs = globalAIObservationEngine.getObservationsForRun(baselineRun.runId);

      trends.latestComparison = globalAIVisibilityTrendEngine.compareRuns(
        baselineRun,
        baselineObs,
        currentRun,
        currentObs
      );
    }

    return res.json({ ok: true, trends });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ==========================================
// PHASE 28F: AI CITATION & SOURCE INTELLIGENCE ENDPOINTS
// ==========================================

const citationRepo = new SqliteCitationRepository(persistence.db);

// 16. Get Latest Citation Intelligence Snapshot
app.get("/api/projects/:projectId/ai-search/citations/latest", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    let snapshot = citationRepo.getLatestSnapshotForProject(project.projectId);
    if (!snapshot) {
      const runs = globalAIObservationEngine.getObservationRuns(project.projectId, 1);
      if (runs.length > 0) {
        const latestRun = runs[0];
        const observations = globalAIObservationEngine.getObservationsForRun(latestRun.runId);

        const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
        const auditSnapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
        const payload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;
        const crawledPages = payload?.crawlResult?.crawledPages || [];

        const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
          project.projectId,
          project.normalizedDomain,
          crawledPages
        );

        snapshot = globalAISourceIntelligenceEngine.computeSourceIntelligence(
          project.projectId,
          latestRun.runId,
          observations,
          profile,
          promptUniverse,
          crawledPages
        );

        citationRepo.saveCitationSnapshot(snapshot);
      }
    }

    return res.json({ ok: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 17. Recalculate Citation Intelligence from Persisted Observations (Zero Provider Calls)
app.post("/api/projects/:projectId/ai-search/citations/recalculate", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const runs = globalAIObservationEngine.getObservationRuns(project.projectId, 1);
    if (runs.length === 0) {
      return res.status(400).json({ error: "No observation runs exist to calculate citation intelligence." });
    }

    const latestRun = runs[0];
    const observations = globalAIObservationEngine.getObservationsForRun(latestRun.runId);

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    const auditSnapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
    const payload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    const snapshot = globalAISourceIntelligenceEngine.computeSourceIntelligence(
      project.projectId,
      latestRun.runId,
      observations,
      profile,
      promptUniverse,
      crawledPages
    );

    citationRepo.saveCitationSnapshot(snapshot);
    return res.json({ ok: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 18. Get Citation Gaps
app.get("/api/projects/:projectId/ai-search/citations/gaps", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const snapshot = citationRepo.getLatestSnapshotForProject(project.projectId);
    const gaps = snapshot?.gaps || [];

    return res.json({ ok: true, gaps });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ==========================================
// PHASE 28G: AI VISIBILITY OPTIMIZATION & FIX INTELLIGENCE ENDPOINTS
// ==========================================

const optimizationRepo = new SqliteOptimizationRepository(persistence.db);
const optimizationVerifier = new AIOptimizationVerifier();

// 19. Get Latest Optimization Snapshot
app.get("/api/projects/:projectId/ai-search/optimization/latest", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    let snapshot = optimizationRepo.getLatestSnapshot(project.projectId);
    if (!snapshot) {
      const runs = globalAIObservationEngine.getObservationRuns(project.projectId, 1);
      const latestRun = runs[0];
      const observations = latestRun ? globalAIObservationEngine.getObservationsForRun(latestRun.runId) : [];

      const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
      const auditSnapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
      const payload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;
      const crawledPages = payload?.crawlResult?.crawledPages || [];

      const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
        project.projectId,
        project.normalizedDomain,
        crawledPages
      );

      const pageContexts = crawledPages.map((p: any) => ({
        url: p.pageUrl || p.url,
        title: p.rawFacts?.title || p.title,
        metaDescription: p.rawFacts?.metaDescription || p.metaDescription,
        h1Texts: p.rawFacts?.h1Texts || (p.rawFacts?.h1Count > 0 ? [p.rawFacts?.title] : []),
        headings: p.headingsOutline?.map((h: any) => h.text) || [],
        visibleText: p.rawFacts?.visibleTextSample || p.text || "",
        schemaTypes: p.jsonLdBlocks?.flatMap((j: any) => j.types || []) || [],
      }));

      snapshot = globalAIOptimizationEngine.computeOptimizationSnapshot(
        project.projectId,
        latestRun?.runId || "run_init",
        profile,
        promptUniverse,
        observations,
        pageContexts
      );

      optimizationRepo.saveSnapshot(snapshot);
    }

    return res.json({ ok: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 20. Generate Fresh Optimization Snapshot
app.post("/api/projects/:projectId/ai-search/optimization/generate", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const runs = globalAIObservationEngine.getObservationRuns(project.projectId, 1);
    const latestRun = runs[0];
    const observations = latestRun ? globalAIObservationEngine.getObservationsForRun(latestRun.runId) : [];

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    const auditSnapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
    const payload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    const pageContexts = crawledPages.map((p: any) => ({
      url: p.pageUrl || p.url,
      title: p.rawFacts?.title || p.title,
      metaDescription: p.rawFacts?.metaDescription || p.metaDescription,
      h1Texts: p.rawFacts?.h1Texts || (p.rawFacts?.h1Count > 0 ? [p.rawFacts?.title] : []),
      headings: p.headingsOutline?.map((h: any) => h.text) || [],
      visibleText: p.rawFacts?.visibleTextSample || p.text || "",
      schemaTypes: p.jsonLdBlocks?.flatMap((j: any) => j.types || []) || [],
    }));

    const snapshot = globalAIOptimizationEngine.computeOptimizationSnapshot(
      project.projectId,
      latestRun?.runId || "run_init",
      profile,
      promptUniverse,
      observations,
      pageContexts
    );

    optimizationRepo.saveSnapshot(snapshot);
    return res.json({ ok: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 21. Verify Finding Remediation (Level 1 and Level 2)
app.post("/api/projects/:projectId/ai-search/optimization/verify-finding", async (req, res) => {
  try {
    const { findingId } = req.body;
    if (!findingId) return res.status(400).json({ error: "Missing findingId" });

    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const snapshot = optimizationRepo.getLatestSnapshot(project.projectId);
    if (!snapshot) return res.status(404).json({ error: "No optimization snapshot found" });

    const finding = snapshot.findings.find((f) => f.id === findingId);
    if (!finding) return res.status(404).json({ error: "Finding not found in latest snapshot" });

    const runs = globalAIObservationEngine.getObservationRuns(project.projectId, 1);
    const latestRun = runs[0];
    const observations = latestRun ? globalAIObservationEngine.getObservationsForRun(latestRun.runId) : [];

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    const auditSnapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
    const payload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { profile } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    const pageContexts = crawledPages.map((p: any) => ({
      url: p.pageUrl || p.url,
      title: p.rawFacts?.title || p.title,
      metaDescription: p.rawFacts?.metaDescription || p.metaDescription,
      h1Texts: p.rawFacts?.h1Texts || (p.rawFacts?.h1Count > 0 ? [p.rawFacts?.title] : []),
      headings: p.headingsOutline?.map((h: any) => h.text) || [],
      visibleText: p.rawFacts?.visibleTextSample || p.text || "",
      schemaTypes: p.jsonLdBlocks?.flatMap((j: any) => j.types || []) || [],
    }));

    const result = optimizationVerifier.verifyRemediation(finding, pageContexts, observations, profile);
    optimizationRepo.updateFindingLifecycle(findingId, result.updatedStatus);

    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 22. Update Finding Lifecycle Status
app.post("/api/projects/:projectId/ai-search/optimization/update-status", async (req, res) => {
  try {
    const { findingId, status } = req.body;
    if (!findingId || !status) return res.status(400).json({ error: "Missing findingId or status" });

    optimizationRepo.updateFindingLifecycle(findingId, status);
    return res.json({ ok: true, findingId, status });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// PHASE 28I: AI MEASUREMENT & BENCHMARKING ENDPOINTS
// ============================================================================
const measurementRepo = new SqliteMeasurementRepository(persistence.db);

// 23. Get Latest Measurement Snapshot
app.get("/api/projects/:projectId/ai-search/measurement/latest", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    let snapshot = measurementRepo.getLatestMeasurementSnapshot(project.projectId);
    if (!snapshot) {
      // Auto-generate initial measurement snapshot from latest audit & optimization snapshot
      let optSnapshot = optimizationRepo.getLatestSnapshot(project.projectId);
      const runs = globalAIObservationEngine.getObservationRuns(project.projectId, 1);
      const latestRun = runs[0];
      const observations = latestRun ? globalAIObservationEngine.getObservationsForRun(latestRun.runId) : [];

      const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
      const auditSnapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
      const payload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;
      const crawledPages = payload?.crawlResult?.crawledPages || [];

      const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
        project.projectId,
        project.normalizedDomain,
        crawledPages
      );

      const pageContexts = crawledPages.map((p: any) => ({
        url: p.pageUrl || p.url,
        title: p.rawFacts?.title || p.title,
        metaDescription: p.rawFacts?.metaDescription || p.metaDescription,
        h1Texts: p.rawFacts?.h1Texts || (p.rawFacts?.h1Count > 0 ? [p.rawFacts?.title] : []),
        headings: p.headingsOutline?.map((h: any) => h.text) || [],
        visibleText: p.rawFacts?.visibleTextSample || p.text || "",
        schemaTypes: p.jsonLdBlocks?.flatMap((j: any) => j.types || []) || [],
      }));

      if (!optSnapshot) {
        optSnapshot = globalAIOptimizationEngine.computeOptimizationSnapshot(
          project.projectId,
          latestRun?.runId || "run_init",
          profile,
          promptUniverse,
          observations,
          pageContexts
        );
        optimizationRepo.saveSnapshot(optSnapshot);
      }

      snapshot = globalAIMeasurementEngine.computeMeasurementSnapshot(
        project.projectId,
        latestAudit?.auditRunId || "audit_init",
        optSnapshot,
        profile,
        promptUniverse,
        pageContexts,
        observations,
        optSnapshot.findings
      );

      measurementRepo.saveMeasurementSnapshot(snapshot);
    }

    return res.json({ ok: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 24. Generate Fresh Measurement Snapshot
app.post("/api/projects/:projectId/ai-search/measurement/generate", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const runs = globalAIObservationEngine.getObservationRuns(project.projectId, 1);
    const latestRun = runs[0];
    const observations = latestRun ? globalAIObservationEngine.getObservationsForRun(latestRun.runId) : [];

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    const auditSnapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
    const payload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    const pageContexts = crawledPages.map((p: any) => ({
      url: p.pageUrl || p.url,
      title: p.rawFacts?.title || p.title,
      metaDescription: p.rawFacts?.metaDescription || p.metaDescription,
      h1Texts: p.rawFacts?.h1Texts || (p.rawFacts?.h1Count > 0 ? [p.rawFacts?.title] : []),
      headings: p.headingsOutline?.map((h: any) => h.text) || [],
      visibleText: p.rawFacts?.visibleTextSample || p.text || "",
      schemaTypes: p.jsonLdBlocks?.flatMap((j: any) => j.types || []) || [],
    }));

    let optSnapshot = optimizationRepo.getLatestSnapshot(project.projectId);
    if (!optSnapshot) {
      optSnapshot = globalAIOptimizationEngine.computeOptimizationSnapshot(
        project.projectId,
        latestRun?.runId || "run_init",
        profile,
        promptUniverse,
        observations,
        pageContexts
      );
      optimizationRepo.saveSnapshot(optSnapshot);
    }

    const snapshot = globalAIMeasurementEngine.computeMeasurementSnapshot(
      project.projectId,
      latestAudit?.auditRunId || "audit_init",
      optSnapshot,
      profile,
      promptUniverse,
      pageContexts,
      observations,
      optSnapshot.findings
    );

    measurementRepo.saveMeasurementSnapshot(snapshot);
    return res.json({ ok: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 25. Get Measurement History
app.get("/api/projects/:projectId/ai-search/measurement/history", async (req, res) => {
  try {
    const history = measurementRepo.getMeasurementHistory(req.params.projectId, 20);
    return res.json({ ok: true, history });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 26. Compare Measurement Snapshots
app.get("/api/projects/:projectId/ai-search/measurement/compare", async (req, res) => {
  try {
    const { baselineId, currentId } = req.query;
    const history = measurementRepo.getMeasurementHistory(req.params.projectId, 20);

    if (history.length < 2 && (!baselineId || !currentId)) {
      return res.json({ ok: true, comparison: null, note: "Need at least 2 snapshots to compute comparison." });
    }

    const currentSnapshot = currentId
      ? history.find((h) => h.measurementId === currentId) || history[0]
      : history[0];

    const baselineSnapshot = baselineId
      ? history.find((h) => h.measurementId === baselineId) || history[1]
      : history[1];

    if (!currentSnapshot || !baselineSnapshot) {
      return res.status(404).json({ error: "Could not resolve comparison snapshots." });
    }

    const comparison = globalAIMeasurementComparator.compareSnapshots(baselineSnapshot, currentSnapshot);
    measurementRepo.saveComparison(comparison);

    return res.json({ ok: true, comparison });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// PHASE 28J: COMPETITOR AI INTELLIGENCE & BENCHMARKING ENDPOINTS
// ============================================================================
const competitiveRepo = new SqliteCompetitiveRepository(persistence.db);

// 27. List Project Competitors
app.get("/api/projects/:projectId/ai-search/competitors", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const competitors = competitiveRepo.getCompetitors(project.projectId);
    return res.json({ ok: true, competitors });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 28. Add Project Competitor
app.post("/api/projects/:projectId/ai-search/competitors", async (req, res) => {
  try {
    const { domain, displayName } = req.body;
    if (!domain) return res.status(400).json({ error: "Missing competitor domain" });

    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const existingCompetitors = competitiveRepo.getCompetitors(project.projectId);
    const normalizedDomain = normalizeCompetitorDomain(domain);

    validateCompetitorAddition(
      project.normalizedDomain,
      normalizedDomain,
      existingCompetitors.map((c) => c.domain)
    );

    const newCompetitor = {
      competitorId: `comp_${nanoid(10)}`,
      projectId: project.projectId,
      domain: normalizedDomain,
      displayName: displayName || normalizedDomain,
      status: "ACTIVE" as const,
      source: "USER_CONFIGURED" as const,
      confidence: 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    competitiveRepo.addCompetitor(newCompetitor);
    return res.json({ ok: true, competitor: newCompetitor });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

// 29. Update Competitor Status
app.patch("/api/projects/:projectId/ai-search/competitors/:competitorId", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !["ACTIVE", "INACTIVE", "ARCHIVED"].includes(status)) {
      return res.status(400).json({ error: "Invalid competitor status" });
    }

    competitiveRepo.updateCompetitorStatus(req.params.competitorId, status);
    return res.json({ ok: true, competitorId: req.params.competitorId, status });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 30. Delete Competitor
app.delete("/api/projects/:projectId/ai-search/competitors/:competitorId", async (req, res) => {
  try {
    competitiveRepo.deleteCompetitor(req.params.competitorId);
    return res.json({ ok: true, deletedCompetitorId: req.params.competitorId });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 31. Get Latest Competitive Benchmark Snapshot
app.get("/api/projects/:projectId/ai-search/competitive/latest", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const snapshot = competitiveRepo.getLatestBenchmarkSnapshot(project.projectId);
    const competitors = competitiveRepo.getCompetitors(project.projectId);

    return res.json({ ok: true, snapshot, competitors });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 32. Generate Competitive Benchmark Snapshot
app.post("/api/projects/:projectId/ai-search/competitive/generate", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const competitors = competitiveRepo.getCompetitors(project.projectId);
    const activeCompetitors = competitors.filter((c) => c.status === "ACTIVE");

    const clientMeasurementSnapshot = measurementRepo.getLatestMeasurementSnapshot(project.projectId);
    if (!clientMeasurementSnapshot) {
      return res.status(400).json({ error: "No client measurement baseline snapshot found. Generate client measurement first." });
    }

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    const auditSnapshot = latestAudit ? await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId) : null;
    const payload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;
    const crawledPages = payload?.crawlResult?.crawledPages || [];

    const { profile: clientProfile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      project.projectId,
      project.normalizedDomain,
      crawledPages
    );

    const clientPageContexts = crawledPages.map((p: any) => ({
      url: p.pageUrl || p.url,
      title: p.rawFacts?.title || p.title,
      metaDescription: p.rawFacts?.metaDescription || p.metaDescription,
      h1Texts: p.rawFacts?.h1Texts || (p.rawFacts?.h1Count > 0 ? [p.rawFacts?.title] : []),
      headings: p.headingsOutline?.map((h: any) => h.text) || [],
      visibleText: p.rawFacts?.visibleTextSample || p.text || "",
      schemaTypes: p.jsonLdBlocks?.flatMap((j: any) => j.types || []) || [],
    }));

    // Build competitor contexts via real competitor crawler
    const competitorContexts = await Promise.all(
      activeCompetitors.map((comp) => globalCompetitorCrawler.crawlCompetitor(comp, { maxPages: 25 }))
    );

    const snapshot = globalAICompetitiveEngine.generateCompetitiveBenchmark(
      project.projectId,
      clientMeasurementSnapshot,
      clientProfile,
      promptUniverse,
      clientPageContexts,
      competitorContexts,
      []
    );

    competitiveRepo.saveBenchmarkSnapshot(snapshot);
    return res.json({ ok: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// PHASE 28K: REMEDIATION WORKFLOW & CLIENT REPORTING ENDPOINTS
// ============================================================================
const workflowRepo = new SqliteWorkflowRepository(persistence.db);
const clientReportRepo = new SqliteClientReportRepository(persistence.db);

// 33. List Workflow Action Items
app.get("/api/projects/:projectId/workflow/action-items", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    let items = workflowRepo.getActionItems(project.projectId);

    // Auto-reconcile if empty and full audit exists
    if (items.length === 0) {
      const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
      if (latestAudit) {
        const auditSnapshot = await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId);
        if (auditSnapshot) {
          const payload = JSON.parse(auditSnapshot.payloadJson);
          items = globalRemediationWorkflowEngine.generateActionItemsFromAudit(
            project.projectId,
            latestAudit.auditRunId,
            payload.crawlResult || payload,
            []
          );
          workflowRepo.saveActionItems(items);
        }
      }
    }

    const { status, priority, category, sourceType, assignee, isBlocked, search } = req.query;
    const filtered = globalRemediationWorkflowEngine.filterActionItems(items, {
      status: status as any,
      priority: priority as any,
      category: category as string,
      sourceType: sourceType as any,
      assignee: assignee as string,
      isBlocked: isBlocked !== undefined ? isBlocked === "true" : undefined,
      searchQuery: search as string,
    });

    const summary = globalRemediationWorkflowEngine.computeQueueSummary(project.projectId, items);
    return res.json({ ok: true, actionItems: filtered, summary });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 34. Get Action Item Detail
app.get("/api/projects/:projectId/workflow/action-items/:actionItemId", async (req, res) => {
  try {
    const item = workflowRepo.getActionItemById(req.params.actionItemId);
    if (!item) return res.status(404).json({ error: "Action item not found" });

    return res.json({ ok: true, actionItem: item });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 35. Reconcile Workflow State
app.post("/api/projects/:projectId/workflow/reconcile", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    let existingItems = workflowRepo.getActionItems(project.projectId);
    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);

    if (latestAudit) {
      const auditSnapshot = await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId);
      if (auditSnapshot) {
        const payload = JSON.parse(auditSnapshot.payloadJson);
        existingItems = globalRemediationWorkflowEngine.generateActionItemsFromAudit(
          project.projectId,
          latestAudit.auditRunId,
          payload.crawlResult || payload,
          existingItems
        );
      }
    }

    // Reconcile AI snapshot if available
    const optSnapshot = optimizationRepo.getLatestSnapshot(project.projectId);
    if (optSnapshot) {
      existingItems = globalRemediationWorkflowEngine.generateActionItemsFromAIOptimization(
        project.projectId,
        optSnapshot,
        existingItems
      );
    }

    // Reconcile Competitive snapshot if available
    const compSnapshot = competitiveRepo.getLatestBenchmarkSnapshot(project.projectId);
    if (compSnapshot) {
      existingItems = globalRemediationWorkflowEngine.generateActionItemsFromCompetitiveBenchmark(
        project.projectId,
        compSnapshot,
        existingItems
      );
    }

    workflowRepo.saveActionItems(existingItems);
    const summary = globalRemediationWorkflowEngine.computeQueueSummary(project.projectId, existingItems);
    return res.json({ ok: true, actionItems: existingItems, summary });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 36. Update Status
app.patch("/api/projects/:projectId/workflow/action-items/:actionItemId/status", async (req, res) => {
  try {
    const { status, details } = req.body;
    if (!status) return res.status(400).json({ error: "Missing status" });

    const item = workflowRepo.getActionItemById(req.params.actionItemId);
    if (!item) return res.status(404).json({ error: "Action item not found" });

    const updated = globalRemediationWorkflowEngine.updateItemStatus(item, status, "USER", details);
    workflowRepo.saveActionItem(updated);

    return res.json({ ok: true, actionItem: updated });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 37. Assign Action Item
app.patch("/api/projects/:projectId/workflow/action-items/:actionItemId/assign", async (req, res) => {
  try {
    const { assigneeName } = req.body;
    const item = workflowRepo.getActionItemById(req.params.actionItemId);
    if (!item) return res.status(404).json({ error: "Action item not found" });

    const updated = globalRemediationWorkflowEngine.assignItem(item, assigneeName || null, "USER");
    workflowRepo.saveActionItem(updated);

    return res.json({ ok: true, actionItem: updated });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 38. Set Due Date
app.patch("/api/projects/:projectId/workflow/action-items/:actionItemId/due-date", async (req, res) => {
  try {
    const { dueDate } = req.body;
    const item = workflowRepo.getActionItemById(req.params.actionItemId);
    if (!item) return res.status(404).json({ error: "Action item not found" });

    const updated = globalRemediationWorkflowEngine.setDueDate(item, dueDate || null, "USER");
    workflowRepo.saveActionItem(updated);

    return res.json({ ok: true, actionItem: updated });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 39. Set Priority Override
app.patch("/api/projects/:projectId/workflow/action-items/:actionItemId/priority", async (req, res) => {
  try {
    const { userPriority } = req.body;
    const item = workflowRepo.getActionItemById(req.params.actionItemId);
    if (!item) return res.status(404).json({ error: "Action item not found" });

    const updated = globalRemediationWorkflowEngine.setPriorityOverride(item, userPriority || null, "USER");
    workflowRepo.saveActionItem(updated);

    return res.json({ ok: true, actionItem: updated });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 40. Add Note
app.post("/api/projects/:projectId/workflow/action-items/:actionItemId/notes", async (req, res) => {
  try {
    const { text, author } = req.body;
    if (!text) return res.status(400).json({ error: "Missing note text" });

    const item = workflowRepo.getActionItemById(req.params.actionItemId);
    if (!item) return res.status(404).json({ error: "Action item not found" });

    const updated = globalRemediationWorkflowEngine.addNote(item, author || "Team Member", text);
    workflowRepo.saveActionItem(updated);

    return res.json({ ok: true, actionItem: updated });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 41. Set / Clear Blocker
app.patch("/api/projects/:projectId/workflow/action-items/:actionItemId/blocker", async (req, res) => {
  try {
    const { blockerReason, blockerDetail } = req.body;
    const item = workflowRepo.getActionItemById(req.params.actionItemId);
    if (!item) return res.status(404).json({ error: "Action item not found" });

    const updated = globalRemediationWorkflowEngine.setBlocker(item, blockerReason || null, blockerDetail || null, "USER");
    workflowRepo.saveActionItem(updated);

    return res.json({ ok: true, actionItem: updated });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 42. Live Verify Action Item
app.post("/api/projects/:projectId/workflow/action-items/:actionItemId/verify", async (req, res) => {
  try {
    const item = workflowRepo.getActionItemById(req.params.actionItemId);
    if (!item) return res.status(404).json({ error: "Action item not found" });

    const updated = await globalRemediationWorkflowEngine.verifyActionItem(item);
    workflowRepo.saveActionItem(updated);

    return res.json({ ok: true, actionItem: updated });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 43. Get Workflow Queue Summary
app.get("/api/projects/:projectId/workflow/summary", async (req, res) => {
  try {
    const items = workflowRepo.getActionItems(req.params.projectId);
    const summary = globalRemediationWorkflowEngine.computeQueueSummary(req.params.projectId, items);
    return res.json({ ok: true, summary });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 44. Export Remediation CSV
app.get("/api/projects/:projectId/workflow/export/csv", async (req, res) => {
  try {
    const items = workflowRepo.getActionItems(req.params.projectId);
    const csvContent = RemediationCsvExporter.exportActionItemsToCsv(items);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="remediation-queue-${req.params.projectId}.csv"`);
    return res.send(csvContent);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 45. Generate Client Report Snapshot
app.post("/api/projects/:projectId/reports/generate", async (req, res) => {
  try {
    const project = await persistence.projects.getProjectById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const latestAudit = await persistence.auditRuns.getLatestAuditRunForProject(project.projectId);
    if (!latestAudit) return res.status(400).json({ error: "No audit snapshot found for project." });

    const auditSnapshot = await persistence.auditSnapshots.getSnapshot(latestAudit.auditRunId);
    const currentAuditPayload = auditSnapshot ? JSON.parse(auditSnapshot.payloadJson) : null;

    // Previous audit if requested or available
    const auditHistory = await persistence.auditRuns.listAuditRunsForProject(project.projectId);
    const prevAuditRun = auditHistory.length > 1 ? auditHistory[1] : null;
    let previousAuditPayload = null;
    if (prevAuditRun) {
      const prevSnap = await persistence.auditSnapshots.getSnapshot(prevAuditRun.auditRunId);
      previousAuditPayload = prevSnap ? JSON.parse(prevSnap.payloadJson) : null;
    }

    const actionItems = workflowRepo.getActionItems(project.projectId);
    const aiMeasurementSnapshot = measurementRepo.getLatestMeasurementSnapshot(project.projectId);
    const compSnapshot = competitiveRepo.getLatestBenchmarkSnapshot(project.projectId);

    const report = globalClientReportEngine.generateClientReport(
      project.projectId,
      project.primaryDomain || "BOT Consulting",
      project.normalizedDomain || "botconsulting.io",
      currentAuditPayload,
      previousAuditPayload,
      actionItems,
      aiMeasurementSnapshot,
      compSnapshot,
      req.body || {}
    );

    clientReportRepo.saveReportSnapshot(report);
    return res.json({ ok: true, report });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 46. Get Latest Client Report Snapshot
app.get("/api/projects/:projectId/reports/latest", async (req, res) => {
  try {
    const report = clientReportRepo.getLatestReportSnapshot(req.params.projectId);
    return res.json({ ok: true, report });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 47. List Report History
app.get("/api/projects/:projectId/reports/history", async (req, res) => {
  try {
    const history = clientReportRepo.listReportHistory(req.params.projectId);
    return res.json({ ok: true, history });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 48. Get Report Snapshot by ID
app.get("/api/projects/:projectId/reports/:reportId", async (req, res) => {
  try {
    const report = clientReportRepo.getReportSnapshotById(req.params.reportId);
    if (!report) return res.status(404).json({ error: "Report snapshot not found" });

    return res.json({ ok: true, report });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// 49. Export Report to HTML / PDF
app.get("/api/projects/:projectId/reports/:reportId/export/pdf", async (req, res) => {
  try {
    const report = clientReportRepo.getReportSnapshotById(req.params.reportId);
    if (!report) return res.status(404).json({ error: "Report snapshot not found" });

    const html = ClientPdfGenerator.generateReportHtml(report);
    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`Dream SEO backend listening on http://localhost:${PORT}`);
});
