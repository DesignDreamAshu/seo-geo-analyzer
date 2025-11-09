import { useMemo, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE || "";

type HealthResponse = {
  ok: boolean;
  timestamp?: string;
};

type AuditMetric = {
  key: string;
  label: string;
  unit: string;
  numericValue: number | null;
  displayValue: string | null;
  score: number | null;
};

type AuditCategory = {
  id: string;
  title: string;
  score: number | null;
};

type AuditOpportunity = {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  savingsMs: number | null;
  savingsBytes: number | null;
};

type FieldMetric = {
  percentile: number | null;
  category: string | null;
  distributions: Array<{ min?: number; max?: number; proportion?: number }>;
};

type AuditResponse = {
  url: string;
  requestedUrl: string;
  finalUrl: string;
  strategy: "mobile" | "desktop";
  fetchedAt: string;
  cached: boolean;
  categories: AuditCategory[];
  metrics: AuditMetric[];
  opportunities: AuditOpportunity[];
  fieldData: {
    page: Record<string, FieldMetric>;
    origin: Record<string, FieldMetric>;
  };
  psiMeta: {
    lighthouseVersion?: string;
    formFactor?: string;
    userAgent?: string;
  };
};

const STRATEGIES: Array<{ value: AuditResponse["strategy"]; label: string }> = [
  { value: "mobile", label: "Mobile (default)" },
  { value: "desktop", label: "Desktop" },
];

const FIELD_LABELS: Record<string, string> = {
  firstContentfulPaint: "First Contentful Paint",
  largestContentfulPaint: "Largest Contentful Paint",
  cumulativeLayoutShift: "Cumulative Layout Shift",
  interactionToNextPaint: "Interaction to Next Paint",
  experimentalTimeToFirstByte: "Time to First Byte",
};

const scoreClass = (score: number | null) => {
  if (score === null || Number.isNaN(score)) return "score-neutral";
  if (score >= 90) return "score-good";
  if (score >= 50) return "score-average";
  return "score-poor";
};

const formatDateTime = (value?: string) => {
  if (!value) return "N/A";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatNumeric = (metric: AuditMetric) => {
  if (metric.displayValue) return metric.displayValue;
  if (metric.numericValue === null || Number.isNaN(metric.numericValue)) return "N/A";
  if (metric.unit === "ms") {
    return `${Math.round(metric.numericValue)} ms`;
  }
  return metric.numericValue.toString();
};

const getCategoryScore = (categories: AuditCategory[], id: string) =>
  categories.find((category) => category.id?.toLowerCase() === id)?.score ?? null;

function App() {
  const [formValues, setFormValues] = useState({
    url: "",
    strategy: "mobile" as AuditResponse["strategy"],
    locale: "en_US",
    skipCache: false,
  });
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);
  const [history, setHistory] = useState<AuditResponse[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const performanceScore = useMemo(() => {
    if (!auditResult) return null;
    return getCategoryScore(auditResult.categories, "performance");
  }, [auditResult]);

  const handleAudit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = formValues.url.trim();
    if (!trimmedUrl) {
      setAuditError("Please provide a URL to audit.");
      setAuditResult(null);
      return;
    }

    setAuditLoading(true);
    setAuditError(null);
    try {
      const response = await fetch(`${API_BASE}/api/audit/lighthouse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmedUrl,
          strategy: formValues.strategy,
          locale: formValues.locale,
          skipCache: formValues.skipCache,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!data || typeof data !== "object") {
        throw new Error("Received an unexpected response from the API.");
      }
      if (!response.ok) {
        const message = "error" in data && typeof data.error === "string" ? data.error : `Audit failed (${response.status})`;
        throw new Error(message);
      }

      const payload = data as AuditResponse;
      setAuditResult(payload);
      setHistory((prev) => {
        const filtered = prev.filter((entry) => entry.url !== payload.url || entry.strategy !== payload.strategy);
        return [payload, ...filtered].slice(0, 5);
      });
    } catch (error) {
      setAuditResult(null);
      setAuditError(error instanceof Error ? error.message : "Unable to run the audit.");
    } finally {
      setAuditLoading(false);
    }
  };

  const checkHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (!response.ok) {
        throw new Error(`Health check failed (${response.status})`);
      }
      const data = (await response.json()) as HealthResponse;
      setHealth(data);
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : "Unable to reach the API.");
    } finally {
      setHealthLoading(false);
    }
  };

  const handleHistoryApply = (entry: AuditResponse) => {
    setAuditResult(entry);
    setFormValues((prev) => ({
      ...prev,
      url: entry.url,
      strategy: entry.strategy,
    }));
  };

  const renderFieldSection = (title: string, data: Record<string, FieldMetric>) => {
    const entries = Object.entries(data);
    if (!entries.length) {
      return null;
    }
    return (
      <div className="field-section">
        <p className="field-title">{title}</p>
        <ul>
          {entries.map(([key, metric]) => (
            <li key={key} className="field-row">
              <div>
                <span className="field-label">{FIELD_LABELS[key] ?? key}</span>
                <small>{metric.percentile ? `P${metric.percentile}` : "Percentile unknown"}</small>
              </div>
              <div className="field-meta">
                <span className={`pill ${scoreClass(metric.category === "FAST" ? 95 : metric.category === "AVERAGE" ? 60 : metric.category === "SLOW" ? 20 : null)}`}>
                  {metric.category ?? "N/A"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">Analyze & optimize</p>
        <h1>SEO & GEO Analyzer</h1>
        <p className="subtitle">
          Run PageSpeed Insights audits, capture Lighthouse metrics, and surface actionable opportunities for every URL you care
          about.
        </p>
      </header>

      <div className="layout">
        <section className="panel">
          <div className="panel-head">
            <h2>Run an audit</h2>
            {auditResult && (
              <span className={`pill ${auditResult.cached ? "pill-neutral" : "pill-positive"}`}>
                {auditResult.cached ? "Served from cache" : "Fresh analysis"}
              </span>
            )}
          </div>
          <form className="form" onSubmit={handleAudit}>
            <label>
              <span>Target URL</span>
              <input
                type="text"
                name="url"
                placeholder="https://www.example.com"
                value={formValues.url}
                onChange={(event) => setFormValues((prev) => ({ ...prev, url: event.target.value }))}
                autoComplete="url"
              />
            </label>

            <div className="form-row">
              <label>
                <span>Strategy</span>
                <select
                  value={formValues.strategy}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      strategy: event.target.value as AuditResponse["strategy"],
                    }))
                  }
                >
                  {STRATEGIES.map((strategy) => (
                    <option key={strategy.value} value={strategy.value}>
                      {strategy.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Locale</span>
                <input
                  type="text"
                  value={formValues.locale}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, locale: event.target.value }))}
                  placeholder="en_US"
                />
              </label>
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={formValues.skipCache}
                onChange={(event) => setFormValues((prev) => ({ ...prev, skipCache: event.target.checked }))}
              />
              <span>Skip server cache for this run</span>
            </label>

          <div className="form-actions">
            <button type="submit" className="primary" disabled={auditLoading}>
              {auditLoading ? "Running audit..." : "Run Lighthouse audit"}
            </button>
            {auditResult && (
              <div className="meta">
                <span>{auditResult.requestedUrl.replace(/^https?:\/\//, "")}</span>
                <small>{formatDateTime(auditResult.fetchedAt)}</small>
              </div>
            )}
          </div>
          </form>
          {auditError && <p className="error-note">{auditError}</p>}
        </section>

        <section className="panel">
          <div className="panel-head">
                <h2>API status</h2>
                <button type="button" className="ghost" onClick={checkHealth} disabled={healthLoading}>
                  {healthLoading ? "Checking..." : "Ping /api/health"}
                </button>
          </div>
          <div className="status-block">
            <p className="status-label">Current state</p>
            <strong>{health ? "Online" : "Unknown"}</strong>
            <small>{health?.timestamp ? `Last ping ${formatDateTime(health.timestamp)}` : "Run a check to confirm availability."}</small>
            {healthError && <span className="error-note">{healthError}</span>}
          </div>

          <div>
            <div className="panel-head">
              <h3>Recent audits</h3>
            </div>
            {history.length === 0 ? (
              <p className="muted">No audits yet.</p>
            ) : (
              <ul className="history-list">
                {history.map((entry) => {
                  const score = getCategoryScore(entry.categories, "performance");
                  return (
                    <li key={`${entry.url}-${entry.strategy}-${entry.fetchedAt}`}>
                      <button type="button" onClick={() => handleHistoryApply(entry)}>
                        <div>
                          <p>{entry.finalUrl.replace(/^https?:\/\//, "")}</p>
                          <small>
                            {entry.strategy} | {formatDateTime(entry.fetchedAt)}
                          </small>
                        </div>
                        <span className={`pill ${scoreClass(score)}`}>{score ?? "N/A"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {auditResult && (
        <>
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Latest audit</p>
                <h2>Category scores</h2>
              </div>
              <div className="meta">
                <span>Lighthouse {auditResult.psiMeta.lighthouseVersion ?? "N/A"}</span>
                <span>
                  {auditResult.strategy} | {auditResult.psiMeta.formFactor ?? "N/A"}
                </span>
              </div>
            </div>
            <div className="category-grid">
              {auditResult.categories.map((category) => (
                <article key={category.id} className="category-card">
                  <p>{category.title}</p>
                  <span className={`score ${scoreClass(category.score)}`}>{category.score ?? "N/A"}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Core Web Vitals</p>
                <h2>Lab metrics</h2>
              </div>
              <div className="meta">
                <span>{auditResult.finalUrl}</span>
                {performanceScore !== null && <span className={`pill ${scoreClass(performanceScore)}`}>Perf {performanceScore}</span>}
              </div>
            </div>
            <div className="metrics-grid">
              {auditResult.metrics.map((metric) => (
                <article key={metric.key} className="metric-card">
                  <p className="metric-title">{metric.label}</p>
                  <strong className={`metric-value ${scoreClass(metric.score)}`}>{formatNumeric(metric)}</strong>
                  <small>Score: {metric.score ?? "N/A"}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="panel split-panel">
            <div>
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Optimization ideas</p>
                  <h3>Top opportunities</h3>
                </div>
              </div>
              {auditResult.opportunities.length === 0 ? (
                <p className="muted">No critical opportunities detected.</p>
              ) : (
                <ul className="opportunity-list">
                  {auditResult.opportunities.map((opportunity) => (
                    <li key={opportunity.id}>
                      <div>
                        <p>{opportunity.title}</p>
                        {opportunity.description && <small>{opportunity.description}</small>}
                      </div>
                      <div className="opportunity-meta">
                        {typeof opportunity.savingsMs === "number" && <span>-{Math.round(opportunity.savingsMs)} ms</span>}
                        <span className={`pill ${scoreClass(opportunity.score)}`}>{opportunity.score ?? "N/A"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Real-user data</p>
                  <h3>Field performance</h3>
                </div>
              </div>
              {renderFieldSection("Page-level", auditResult.fieldData.page) ?? <p className="muted">No page-level field data.</p>}
              {renderFieldSection("Origin-level", auditResult.fieldData.origin) ?? <p className="muted">No origin-level field data.</p>}
            </div>
          </section>
        </>
      )}

      <footer className="footer">
        <small>API base: {API_BASE || "(relative /api)"}</small>
      </footer>
    </div>
  );
}

export default App;
