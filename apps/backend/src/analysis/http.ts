import "../env";
import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import got from "got";
import { CACHE_TTL_MS, USER_AGENT } from "./constants";
import { TtlCache } from "./cache";
import type {
  AnalyzeStrategy,
  GeoLookupResult,
  HtmlFetchResult,
  PsiResponse,
  RobotsResult,
  SitemapEntrySummary,
  SitemapSummary,
} from "./types";
import { normalizeHeaders } from "./utils";

const psiCache = new TtlCache<PsiResponse>(CACHE_TTL_MS);
const htmlCache = new TtlCache<HtmlFetchResult>(CACHE_TTL_MS);
const robotsCache = new TtlCache<RobotsResult>(CACHE_TTL_MS);
const sitemapCache = new TtlCache<SitemapSummary | null>(CACHE_TTL_MS);

const baseClient = got.extend({
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  },
  timeout: {
    request: 12000,
  },
  retry: {
    limit: 1,
  },
});

export const httpClient = baseClient;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
  parseTagValue: true,
  trimValues: true,
});

interface FetchOptions {
  skipCache?: boolean;
  signal?: AbortSignal;
}

export async function fetchPsi(
  url: string,
  strategy: AnalyzeStrategy,
  locale: string,
  { skipCache, signal }: FetchOptions = {},
): Promise<PsiResponse> {
  const cacheKey = `${strategy}:${locale}:${url}`;
  if (!skipCache) {
    const cached = psiCache.get(cacheKey);
    if (cached) return cached;
  }

  const searchParams = new URLSearchParams({
    url,
    strategy: strategy === "desktop" ? "DESKTOP" : "MOBILE",
    locale,
  });

  ["performance", "seo", "best-practices", "accessibility"].forEach((category) =>
    searchParams.append("category", category),
  );

  const apiKey = process.env.PSI_API_KEY?.trim();
  if (apiKey) {
    searchParams.set("key", apiKey);
  }

  const response = await got
    .get("https://www.googleapis.com/pagespeedonline/v5/runPagespeed", {
      searchParams,
      responseType: "json",
      timeout: { request: 20000 },
      signal,
    })
    .json<PsiResponse>();

  if (!response?.lighthouseResult) {
    throw new Error("PageSpeed Insights response did not include a Lighthouse result.");
  }

  if (!skipCache) {
    psiCache.set(cacheKey, response);
  }
  return response;
}

export async function fetchHtmlDocument(url: string, { skipCache, signal }: FetchOptions = {}): Promise<HtmlFetchResult> {
  const cacheKey = `html:${url}`;
  if (!skipCache) {
    const cached = htmlCache.get(cacheKey);
    if (cached) return cached;
  }

  const response = await baseClient.get(url, {
    signal,
    responseType: "text",
    timeout: { request: 15000 },
  });

  if (response.statusCode >= 400) {
    throw new Error(`Unable to download HTML (${response.statusCode})`);
  }

  const contentType = response.headers["content-type"];
  if (contentType && !String(contentType).toLowerCase().includes("text/html")) {
    throw Object.assign(new Error(`Target URL did not return HTML (content-type: ${contentType})`), {
      code: "NON_HTML",
    });
  }

  const html = response.body;
  const dom = load(html);
  const normalizedHeaders = normalizeHeaders(response.headers);
  const result: HtmlFetchResult = {
    html,
    dom,
    finalUrl: response.url ?? url,
    headers: normalizedHeaders,
    statusCode: response.statusCode,
    contentType: contentType ? String(contentType) : null,
  };

  if (!skipCache) {
    htmlCache.set(cacheKey, result);
  }
  return result;
}

const robotsClient = baseClient.extend({
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "text/plain",
  },
});

export async function fetchRobotsTxt(originUrl: URL, { skipCache, signal }: FetchOptions = {}): Promise<RobotsResult> {
  const robotsUrl = new URL("/robots.txt", originUrl.origin).toString();
  if (!skipCache) {
    const cached = robotsCache.get(robotsUrl);
    if (cached) return cached;
  }
  try {
    const response = await robotsClient.get(robotsUrl, {
      throwHttpErrors: false,
      signal,
      timeout: { request: 8000 },
    });
    if (response.statusCode >= 400) {
      const fallback = { text: null, fetchedFrom: robotsUrl };
      if (!skipCache) robotsCache.set(robotsUrl, fallback);
      return fallback;
    }

    const body = response.body?.trim() ?? "";
    const result = {
      text: body.length ? body : null,
      fetchedFrom: robotsUrl,
    };
    if (!skipCache) robotsCache.set(robotsUrl, result);
    return result;
  } catch {
    const fallback = { text: null, fetchedFrom: robotsUrl };
    if (!skipCache) robotsCache.set(robotsUrl, fallback);
    return fallback;
  }
}

const sitemapClient = baseClient.extend({
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
  },
});

const collectSitemapCandidates = (robotsTxt: string | null, origin: URL) => {
  const candidates = new Set<string>();
  if (robotsTxt) {
    robotsTxt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .forEach((line) => {
        if (/^sitemap:/i.test(line)) {
          const sitemapUrl = line.split(":")[1]?.trim();
          if (sitemapUrl) {
            try {
              const absolute = new URL(sitemapUrl, origin.origin).toString();
              candidates.add(absolute);
            } catch {
              // ignore
            }
          }
        }
      });
  }

  if (!candidates.size) {
    candidates.add(new URL("/sitemap.xml", origin.origin).toString());
  }

  return Array.from(candidates).slice(0, 3);
};

const parseSitemapEntries = (payload: unknown): SitemapEntrySummary[] => {
  const entries: SitemapEntrySummary[] = [];
  if (!payload || typeof payload !== "object") return entries;
  const doc = payload as Record<string, unknown>;
  const urlset = doc.urlset ?? doc.urlSet;
  const sitemapIndex = doc.sitemapindex ?? doc.sitemapIndex;

  const normalizeEntries = (raw: unknown) => {
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list
      .map((entry) => entry as Record<string, unknown>)
      .filter((entry) => typeof entry?.loc === "string")
      .map((entry) => {
        const alternates: Array<{ hreflang: string; href: string }> = [];
        const linkNodes = entry["xhtml:link"] ?? entry.link ?? [];
        const nodes = Array.isArray(linkNodes) ? linkNodes : linkNodes ? [linkNodes] : [];
        nodes.forEach((node) => {
          const candidate = node as Record<string, unknown>;
          const rel = String(candidate.rel ?? "").toLowerCase();
          const hreflang = candidate.hreflang ?? candidate["hreflang"];
          const href = candidate.href ?? candidate["href"];
          if (rel === "alternate" && typeof hreflang === "string" && typeof href === "string") {
            alternates.push({ hreflang: hreflang.toLowerCase(), href });
          }
        });

        return {
          loc: String(entry.loc),
          lastmod: entry.lastmod ? String(entry.lastmod) : undefined,
          alternates: alternates.length ? alternates : undefined,
        };
      });
  };

  if (urlset) {
    entries.push(...normalizeEntries((urlset as Record<string, unknown>).url));
  } else if (sitemapIndex) {
    entries.push(...normalizeEntries((sitemapIndex as Record<string, unknown>).sitemap));
  }

  return entries;
};

export async function fetchSitemaps(
  origin: URL,
  robotsTxt: string | null,
  { skipCache, signal }: FetchOptions = {},
): Promise<SitemapSummary | null> {
  const cacheKey = `sitemap:${origin.origin}`;
  if (!skipCache) {
    const cached = sitemapCache.get(cacheKey);
    if (cached) return cached;
  }

  const candidates = collectSitemapCandidates(robotsTxt, origin);
  const fetched: SitemapSummary["fetched"] = [];
  let hasHreflang = false;

  for (const sitemapUrl of candidates) {
    try {
      const response = await sitemapClient.get(sitemapUrl, {
        throwHttpErrors: false,
        timeout: { request: 12000 },
        signal,
      });
      if (response.statusCode >= 400 || !response.body) {
        fetched.push({ url: sitemapUrl, ok: false, statusCode: response.statusCode });
        continue;
      }

      const parsed = xmlParser.parse(response.body);
      const entries = parseSitemapEntries(parsed);
      if (entries.some((entry) => entry.alternates && entry.alternates.length > 0)) {
        hasHreflang = true;
      }

      fetched.push({
        url: sitemapUrl,
        ok: true,
        statusCode: response.statusCode,
        entries: entries.slice(0, 100),
      });

      // Prefer first successful fetch to keep payload small
      break;
    } catch (error) {
      fetched.push({
        url: sitemapUrl,
        ok: false,
        statusCode: undefined,
      });
    }
  }

  const summary: SitemapSummary | null = fetched.length
    ? {
        urls: candidates,
        fetched,
        hasHreflang,
      }
    : null;

  if (!skipCache) {
    sitemapCache.set(cacheKey, summary);
  }

  return summary;
}

export const geoCache = new TtlCache<GeoLookupResult>(CACHE_TTL_MS);
