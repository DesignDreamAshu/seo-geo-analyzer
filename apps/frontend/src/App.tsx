import { useState } from "react";
import { API_BASE } from "./lib/apiBase";

const App = () => {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const runAudit = async () => {
    if (!url) {
      alert("Enter a website URL");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const payload = await response.json();
      setData(payload);
    } catch (error) {
      console.error("Audit failed", error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const metrics = (data as { metrics?: Record<string, unknown>; url?: string })?.metrics ?? null;
  const targetUrl = (data as { url?: string })?.url;

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>SEO GEO Analyzer</h1>
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Enter website URL (https://...)"
        style={{ width: "300px", marginRight: 8 }}
      />
      <button onClick={runAudit} disabled={loading}>
        {loading ? "Running..." : "Run Audit"}
      </button>
      <button
        onClick={async () => {
          if (!url) {
            alert("Enter a website URL");
            return;
          }
          setLoading(true);
          try {
            const response = await fetch(`${API_BASE}/api/geo`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url }),
            });
            const payload = await response.json();
            setData(payload);
          } catch (error) {
            console.error("Geo audit failed", error);
            alert("Something went wrong");
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        style={{ marginLeft: 8 }}
      >
        {loading ? "Running..." : "Run GEO Test"}
      </button>

      {metrics && (
        <div style={{ marginTop: 20 }}>
          <h3>Results for: {targetUrl}</h3>
          <ul>
            {Object.entries(metrics).map(([key, value]) => (
              <li key={key}>
                <b>{key}:</b> {String(value)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data && Array.isArray((data as { results?: Array<any> }).results) && (
        <div style={{ marginTop: 20 }}>
          <h3>Geo Test Results for: {targetUrl}</h3>
          <table border={1} cellPadding={8} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Region</th>
                <th>Performance</th>
                <th>FCP</th>
                <th>LCP</th>
                <th>TBT</th>
                <th>CLS</th>
              </tr>
            </thead>
            <tbody>
              {((data as { results?: Array<{ region: string; metrics: Record<string, unknown> }> }).results ?? []).map((result) => (
                <tr key={result.region}>
                  <td>{result.region}</td>
                  <td>{result.metrics.performance as string}</td>
                  <td>{result.metrics.FCP as string}</td>
                  <td>{result.metrics.LCP as string}</td>
                  <td>{result.metrics.TBT as string}</td>
                  <td>{result.metrics.CLS as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default App;
