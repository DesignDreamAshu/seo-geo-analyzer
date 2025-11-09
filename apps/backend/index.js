import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(
  cors({
    origin: CORS_ORIGIN,
  }),
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "seo-geo-analyzer-api", time: new Date().toISOString() });
});

app.post("/api/audit", async (req, res) => {
  try {
    const { url } = req.body ?? {};
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GOOGLE_API_KEY is not configured" });
    }

    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}`;
    const { data } = await axios.get(endpoint);

    const lighthouse = data.lighthouseResult;
    if (!lighthouse) {
      return res.status(502).json({ error: "Unexpected PageSpeed response" });
    }

    const metrics = {
      performance: Math.round((lighthouse.categories?.performance?.score ?? 0) * 100),
      FCP: lighthouse.audits?.["first-contentful-paint"]?.displayValue ?? "n/a",
      LCP: lighthouse.audits?.["largest-contentful-paint"]?.displayValue ?? "n/a",
      TBT: lighthouse.audits?.["total-blocking-time"]?.displayValue ?? "n/a",
      CLS: lighthouse.audits?.["cumulative-layout-shift"]?.displayValue ?? "n/a",
      SpeedIndex: lighthouse.audits?.["speed-index"]?.displayValue ?? "n/a",
    };

    return res.json({ url, metrics });
  } catch (error) {
    console.error("Audit error:", error.message);
    return res.status(500).json({ error: "Failed to fetch PageSpeed data" });
  }
});

app.post("/api/geo", async (req, res) => {
  try {
    const { url } = req.body ?? {};
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GOOGLE_API_KEY is not configured" });
    }

    const regions = [
      { name: "India (Asia-South1)", locale: "en", strategy: "desktop" },
      { name: "USA (us-central1)", locale: "en", strategy: "desktop" },
      { name: "UK (europe-west2)", locale: "en", strategy: "desktop" },
    ];

    const results = await Promise.all(
      regions.map(async (region) => {
        const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
          url,
        )}&key=${apiKey}&strategy=${region.strategy}&locale=${region.locale}`;
        const { data } = await axios.get(endpoint);
        const lighthouse = data.lighthouseResult ?? {};
        const metrics = {
          performance: Math.round((lighthouse.categories?.performance?.score ?? 0) * 100),
          FCP: lighthouse.audits?.["first-contentful-paint"]?.displayValue ?? "n/a",
          LCP: lighthouse.audits?.["largest-contentful-paint"]?.displayValue ?? "n/a",
          TBT: lighthouse.audits?.["total-blocking-time"]?.displayValue ?? "n/a",
          CLS: lighthouse.audits?.["cumulative-layout-shift"]?.displayValue ?? "n/a",
        };
        return { region: region.name, metrics };
      }),
    );

    return res.json({ url, results });
  } catch (error) {
    console.error("Geo audit error:", error.message);
    return res.status(500).json({ error: "Failed to run GEO audits" });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
