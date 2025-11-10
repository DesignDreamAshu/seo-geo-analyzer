import { FormEvent, useMemo, useState } from "react";
import { API_BASE } from "./lib/apiBase";
import "./App.css";

type Category = {
  id: string;
  title: string;
  score: number | null;
};

type Metric = {
  key: string;
  label: string;
  displayValue: string | null;
  numericValue: number | null;
  unit: string;
  score: number | null;
};

type Opportunity = {
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
};

type AuditResponse = {
  url: string;
  requestedUrl: string;
  finalUrl: string;
  strategy: string;
  fetchedAt: string;
  cached: boolean;
  categories: Category[];
  metrics: Metric[];
  opportunities: Opportunity[];
  fieldData: {
    page: Record<string, FieldMetric>;
    origin: Record<string, FieldMetric>;
  };
  psiMeta?: {
    lighthouseVersion?: string;
    formFactor?: string;
  };
};

const STRATEGIES = [
  { label: "Mobile (default)", value: "mobile" },
  { label: "Desktop", value: "desktop" },
];

const DEFAULT_URL = "https://dreamicons.app/";
const DEFAULT_LOCALE = "en_US";

const formatScore = (score: number | null) => {
  if (typeof score !== "number") {
    return "n/a";
  }
  return `${score}`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const App = () => {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [strategy, setStrategy] = useState("mobile");
  const [locale, setLocale] = useState(DEFAULT_LOCALE);
  const [skipCache, setSkipCache] = useState(false);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const baseUrl = API_BASE || "";

  const handleAudit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url.trim()) {
      setError("Please provide a URL to audit.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/audit/lighthouse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          strategy,
          locale,
          skipCache,
        }),
      });
      const rawBody = await response.text();
      let payload: AuditResponse | { error?: string } | null = null;
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = null;
        }
      }

      if (!response.ok) {
        const message =
          (payload as { error?: string } | null)?.error || rawBody || `Audit failed with status ${response.status}`;
        throw new Error(message);
      }

      if (!payload) {
        throw new Error("Received empty response from the server");
      }

      setAudit(payload as AuditResponse);
    } catch (err) {
      setAudit(null);
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    if (!audit) {
      return null;
    }
    const urlInfo = audit.finalUrl || audit.requestedUrl || audit.url;
    return {
      target: urlInfo,
      fetchedAt: formatDate(audit.fetchedAt),
      cached: audit.cached,
      strategy: audit.strategy,
    };
  }, [audit]);

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Dream SEO</p>
          <h1>Lighthouse Test</h1>
          <p className="subheading">Run PageSpeed Insights audits with caching, localization, and strategy presets.</p>
        </div>
      </header>

      <div className="layout-grid">
        <section className="panel">
          <h2>Run an audit</h2>
          <p className="panel-subtitle">
            Provide the URL you want to test, pick the Lighthouse strategy, and optionally bypass the API cache.
          </p>
          <form className="audit-form" onSubmit={handleAudit}>
            <label className="field">
              <span>Target URL</span>
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com"
                required
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Strategy</span>
                <select value={strategy} onChange={(event) => setStrategy(event.target.value)}>
                  {STRATEGIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Locale</span>
                <input value={locale} onChange={(event) => setLocale(event.target.value)} placeholder="en_US" />
              </label>
            </div>

            <label className="inline-field">
              <input type="checkbox" checked={skipCache} onChange={(event) => setSkipCache(event.target.checked)} />
              <span>Skip server cache for this run</span>
            </label>

            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Running audit…" : "Run Lighthouse audit"}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        </section>

        <section className="panel results-panel">
          {summary ? (
            <>
              <div className="result-meta">
                <div>
                  <p className="meta-label">Audited URL</p>
                  <p className="meta-value">{summary.target}</p>
                </div>
                <div className="meta-stack">
                  <span>{summary.strategy.toUpperCase()}</span>
                  <span>{summary.cached ? "Cached" : "Fresh run"}</span>
                  <span>{summary.fetchedAt}</span>
                </div>
              </div>

              <div className="categories">
                {audit?.categories.map((category) => (
                  <article key={category.id} className="category-card">
                    <span className="category-score">{formatScore(category.score)}</span>
                    <p>{category.title}</p>
                  </article>
                ))}
              </div>

              <div className="metrics-grid">
                {audit?.metrics.map((metric) => (
                  <article key={metric.key} className="metric-card">
                    <p className="metric-label">{metric.label}</p>
                    <p className="metric-value">{metric.displayValue ?? "n/a"}</p>
                    <p className="metric-score">Score: {formatScore(metric.score)}</p>
                  </article>
                ))}
              </div>

              {audit?.opportunities.length ? (
                <div className="opportunities">
                  <h3>Top opportunities</h3>
                  <ul>
                    {audit.opportunities.map((opportunity) => (
                      <li key={opportunity.id}>
                        <div>
                          <p className="op-title">{opportunity.title}</p>
                          <p className="op-desc">{opportunity.description}</p>
                        </div>
                        <span>{opportunity.savingsMs ? `${opportunity.savingsMs} ms saved` : "n/a"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="placeholder">Run an audit to view metrics, opportunities, and field data.</p>
              )}
            </>
          ) : (
            <div className="placeholder">
              <p>Run an audit to see Lighthouse scores, opportunities, and field data.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default App;
