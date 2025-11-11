import "./env";
import express from "express";
import cors, { type CorsOptions } from "cors";
import { nanoid } from "nanoid";
import { ReportGenerator } from "lighthouse/report/generator/report-generator.js";
import { generatePdf } from "html-pdf-node";
import detectPort from "detect-port";
import { runLighthouseSuite } from "./lighthouse-runner";
import { analyzeSite, AnalysisTimeoutError, calculateWeightedScore } from "./analysis";
import {
  getLatestLighthouseRun,
  getLatestLighthouseRunForUrl,
  getLighthouseRunById,
  getLighthouseRunsForUrl,
  normalizeAuditUrl,
  readLighthouseRuns,
} from "./storage/lighthouse-store";
import { saveShareRecord, getShareRecord } from "./storage/share-store";
import type { ExportPayload, ModuleSnapshot } from "./types";

const configuredOrigins = (process.env.CORS_ORIGIN ?? "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const aliasHostnames = new Map<string, string[]>([
  ["localhost", ["127.0.0.1", "0.0.0.0"]],
  ["127.0.0.1", ["localhost", "0.0.0.0"]],
  ["0.0.0.0", ["localhost", "127.0.0.1"]],
]);

const allowedOrigins = configuredOrigins.flatMap((origin) => {
  try {
    const url = new URL(origin);
    const portSegment = url.port ? `:${url.port}` : "";
    const normalized = `${url.protocol}//${url.hostname}${portSegment}`;
    const aliases = aliasHostnames.get(url.hostname) ?? [];
    const aliasOrigins = aliases.map((host) => `${url.protocol}//${host}${portSegment}`);
    return [normalized, ...aliasOrigins];
  } catch {
    return [origin];
  }
});
const uniqueAllowedOrigins = new Set(allowedOrigins);

const allowAllOrigins = uniqueAllowedOrigins.size === 0 || uniqueAllowedOrigins.has("*");

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowAllOrigins || uniqueAllowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin "${origin}" is not allowed by CORS`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  optionsSuccessStatus: 204,
};

const app = express();
const corsMiddleware = cors(corsOptions);
app.use(corsMiddleware);
app.options("*", corsMiddleware);
app.use(express.json({ limit: "1mb" }));

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

app.post("/api/analyze", async (req, res) => {
  const { url, strategy, locale, skipCache } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  try {
    const analysis = await analyzeSite({
      url,
      strategy,
      locale,
      skipCache: Boolean(skipCache),
    });

    res.json(analysis);

    sendEvent("toast", {
      title: "Analysis complete",
      description: `Finished auditing ${analysis.url}`,
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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/lighthouse-runs", async (req, res) => {
  const { url } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url in body" });
  }

  try {
    const normalizedUrl = normalizeAuditUrl(url);
    const record = await runLighthouseSuite(normalizedUrl);
    return res.status(201).json(record);
  } catch (error) {
    return res.status(500).json({
      error: "Unable to complete Lighthouse audit",
      message: (error as Error).message,
    });
  }
});

app.get("/api/lighthouse-runs/latest", async (req, res) => {
  const { url } = req.query;
  const record = typeof url === "string" && url.length
    ? await getLatestLighthouseRunForUrl(url)
    : await getLatestLighthouseRun();

  if (!record) {
    return res.status(404).json({ error: "No Lighthouse runs stored yet." });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.json(record);
});

app.get("/api/lighthouse-runs/:id", async (req, res) => {
  const record = await getLighthouseRunById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: "Run not found." });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.json(record);
});

app.get("/api/lighthouse-runs/:id/report", async (req, res) => {
  const record = await getLighthouseRunById(req.params.id);
  if (!record) {
    return res.status(404).send("Run not found");
  }

  const device = typeof req.query.device === "string" ? req.query.device : "mobile";
  const format = typeof req.query.format === "string" ? req.query.format.toLowerCase() : "html";

  const lhr =
    device === "desktop"
      ? (record.raw?.desktop as Record<string, unknown> | undefined)
      : (record.raw?.mobile as Record<string, unknown> | undefined);

  if (!lhr) {
    return res.status(404).send("Report data unavailable");
  }

  const buildHtml = () => {
    const stored =
      device === "desktop" ? record.reports?.desktop ?? record.reports?.mobile : record.reports?.mobile ?? record.reports?.desktop;
    return stored && stored.length ? stored : ReportGenerator.generateReport(lhr, "html");
  };

  switch (format) {
    case "json": {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${record.id}-${device}.json"`);
      return res.send(lhr);
    }
    case "pdf": {
      try {
        const html = buildHtml();
        const pdfBuffer = await generatePdf({ content: html }, { format: "A4", printBackground: true });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${record.id}-${device}.pdf"`);
        return res.send(pdfBuffer);
      } catch (error) {
        console.error("Unable to render Lighthouse PDF", error);
        return res.status(500).send("Unable to render Lighthouse report");
      }
    }
    case "html":
    default: {
      try {
        const html = buildHtml();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `inline; filename="${record.id}-${device}.html"`);
        return res.send(html);
      } catch (error) {
        console.error("Unable to render Lighthouse report on demand", error);
        return res.status(500).send("Unable to render Lighthouse report");
      }
    }
  }
});

app.get("/api/lighthouse-runs", async (req, res) => {
  const { url } = req.query;
  if (typeof url === "string" && url.length) {
    const runs = await getLighthouseRunsForUrl(url);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ count: runs.length, runs });
  }

  const runs = await readLighthouseRuns();
  res.setHeader("Cache-Control", "no-store");
  return res.json({ count: runs.length, runs });
});

const DEFAULT_PORT = Number(process.env.PORT) || 4000;

const startServer = async () => {
  const availablePort = await detectPort(DEFAULT_PORT);

  if (availablePort !== DEFAULT_PORT) {
    console.warn(
      `Requested port ${DEFAULT_PORT} is in use. Falling back to available port ${availablePort}.`,
    );
  }

  app.listen(availablePort, () => {
    console.log(`Dream SEO backend listening on http://localhost:${availablePort}`);
  });
};

startServer().catch((error) => {
  console.error("Unable to start backend server", error);
  process.exit(1);
});
