import type { CheerioAPI } from "cheerio";
import { LINK_SAMPLE_LIMIT, MODULE_DEFINITIONS, USER_AGENT } from "./constants";
import { httpClient } from "./http";
import type {
  AnalysisContext,
  HighlightEntry,
  LinkSampleEntry,
  LinkSampleSummary,
  ModuleKey,
  ModuleResult,
  ModuleDetails,
  ModuleIssues,
} from "./types";
import { clampScore, roundScore, createIssueTracker, incrementIssue } from "./utils";
import { structuredDataTest } from "structured-data-testing-tool";

const HEAD_TIMEOUT_MS = 5000;
const LINK_CONCURRENCY = 5;

interface ModuleComputation {
  score: number;
  summary: string;
  recommendations: string[];
  issues: ModuleIssues;
  details: ModuleDetails;
}

type ModuleComputer = (ctx: AnalysisContext) => Promise<ModuleComputation> | ModuleComputation;

const formatMs = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return null;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
};

const formatRatio = (value: number) => `${Math.round(value * 100)}%`;

const toHighlight = (label: string, value: string | number | null | undefined, status?: HighlightEntry["status"]) => {
  if (value == null) return null;
  return { label, value: String(value), status };
};

const normalizedRel = (rel?: string) => (rel ? rel.toLowerCase() : "");

const shouldSkipHref = (href: string) => /^(javascript:|mailto:|tel:)/i.test(href);

const resolveHref = (href: string, origin: URL) => {
  try {
    return new URL(href, origin).toString();
  } catch {
    return null;
  }
};

const headCheck = async (url: string, signal?: AbortSignal): Promise<LinkSampleEntry> => {
  try {
    const response = await httpClient.head(url, {
      headers: { "User-Agent": USER_AGENT },
      throwHttpErrors: false,
      timeout: { request: HEAD_TIMEOUT_MS },
      signal,
    });
    return {
      url,
      statusCode: response.statusCode ?? null,
      ok: Boolean(response.statusCode && response.statusCode < 400),
    };
  } catch {
    return { url, statusCode: null, ok: false };
  }
};

export const evaluateLinkSample = async (
  dom: CheerioAPI,
  origin: URL,
  signal?: AbortSignal,
): Promise<LinkSampleSummary> => {
  const seen = new Set<string>();
  const candidates: Array<{ url: string; rel?: string }> = [];

  dom("a[href]").each((_, element) => {
    if (candidates.length >= LINK_SAMPLE_LIMIT) return false;
    const href = dom(element).attr("href")?.trim();
    if (!href || shouldSkipHref(href)) return;
    const absolute = resolveHref(href, origin);
    if (!absolute) return;
    try {
      const absoluteUrl = new URL(absolute);
      if (absoluteUrl.origin !== origin.origin) return;
      if (seen.has(absoluteUrl.toString())) return;
      seen.add(absoluteUrl.toString());
      candidates.push({ url: absoluteUrl.toString(), rel: dom(element).attr("rel") ?? undefined });
    } catch {
      // ignore invalid URLs
    }
  });

  const queue = [...candidates];
  const results: LinkSampleEntry[] = [];

  const workers = Array.from({ length: Math.min(LINK_CONCURRENCY, queue.length || 1) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      const entry = await headCheck(next.url, signal);
      results.push({ ...entry, rel: next.rel });
    }
  });

  await Promise.all(workers);

  return {
    total: candidates.length,
    checked: results,
    broken: results.filter((entry) => !entry.ok),
    nofollow: candidates.filter((candidate) => normalizedRel(candidate.rel).includes("nofollow")).length,
  };
};

const computePerformance: ModuleComputer = (ctx) => {
  const audits = ctx.psi.lighthouseResult?.audits ?? {};
  const categories = ctx.psi.lighthouseResult?.categories ?? {};
  const perfScore = typeof categories.performance?.score === "number" ? categories.performance.score : 0;
  const score = roundScore((perfScore || 0) * 10);

  const lcp = audits["largest-contentful-paint"]?.numericValue ?? null;
  const cls = audits["cumulative-layout-shift"]?.numericValue ?? null;
  const inp = audits["interaction-to-next-paint"]?.numericValue ?? null;
  const tbt = audits["total-blocking-time"]?.numericValue ?? null;

  const issues = createIssueTracker();
  const recommendations: string[] = [];

  if (lcp && lcp > 4000) {
    incrementIssue(issues, "warning");
    recommendations.push("Reduce Largest Contentful Paint below 2.5s with image and font optimizations.");
  }
  if (cls && cls > 0.25) {
    incrementIssue(issues, "warning");
    recommendations.push("Stabilize layout shifts by reserving space for media and dynamic content.");
  }
  if (inp && inp > 500) {
    incrementIssue(issues, "critical");
    recommendations.push("Improve Interaction to Next Paint by trimming long tasks and input handlers.");
  }
  if (tbt && tbt > 600) {
    incrementIssue(issues, "warning");
    recommendations.push("Lower Total Blocking Time with code splitting and async loading.");
  }

  const highlights: HighlightEntry[] = [
    toHighlight("Performance Score", `${Math.round((perfScore || 0) * 100)}`, score >= 8 ? "good" : score >= 6 ? "warn" : "poor"),
    toHighlight("LCP", formatMs(lcp), lcp && lcp <= 2500 ? "good" : lcp && lcp <= 4000 ? "warn" : "poor"),
    toHighlight("CLS", cls?.toFixed(2) ?? null, cls && cls <= 0.1 ? "good" : cls && cls <= 0.25 ? "warn" : "poor"),
    toHighlight("INP", formatMs(inp), inp && inp <= 200 ? "good" : inp && inp <= 500 ? "warn" : "poor"),
    toHighlight("TBT", formatMs(tbt), tbt && tbt <= 200 ? "good" : tbt && tbt <= 600 ? "warn" : "poor"),
  ].filter(Boolean) as HighlightEntry[];

  return {
    score,
    summary: `PSI performance scored ${Math.round((perfScore || 0) * 100)} out of 100.`,
    recommendations,
    issues,
    details: {
      metrics: { lcp, cls, inp, tbt, perfScore: perfScore ?? null },
      highlights,
    },
  };
};

const computeSchema: ModuleComputer = async (ctx) => {
  const issues = createIssueTracker();
  const recommendations: string[] = [];
  let schemas: string[] = [];
  let failed = 0;
  let warnings = 0;

  try {
    const result = await structuredDataTest(ctx.html);
    schemas = Array.from(new Set(result.schemas ?? [])).sort();
    failed = result.failed?.length ?? 0;
    warnings = result.warnings?.length ?? 0;
    if (failed > 0) {
      incrementIssue(issues, "warning");
      recommendations.push("Fix structured data validation errors detected by the testing tool.");
    }
    if (!schemas.length) {
      incrementIssue(issues, "warning");
      recommendations.push("Add JSON-LD markup describing key entities (WebSite, WebPage, Product, etc.).");
    }
  } catch (error) {
    incrementIssue(issues, "warning");
    recommendations.push("Structured data validator failed; verify HTML output or reduce blocking scripts.");
  }

  const importantSchemas = ["WebSite", "WebPage", "Organization", "Product", "BreadcrumbList", "FAQPage", "Article"];
  const importantCount = importantSchemas.filter((schema) => schemas.includes(schema)).length;

  let score = 0;
  if (schemas.length) score += 4;
  score += Math.min(4, importantCount);
  score += failed === 0 ? 2 : 0;
  score = clampScore(score);

  if (!schemas.includes("WebSite")) {
    recommendations.push("Provide WebSite schema with SearchAction for better branded SERP coverage.");
  }
  if (!schemas.includes("BreadcrumbList")) {
    recommendations.push("Add BreadcrumbList JSON-LD to improve sitelinks.");
  }

  const highlights: HighlightEntry[] = [
    toHighlight("Schemas detected", schemas.length || 0, schemas.length ? "good" : "warn"),
    toHighlight("Validator errors", failed || 0, failed ? "warn" : "good"),
    toHighlight("Warnings", warnings || 0, warnings ? "warn" : "good"),
  ].filter(Boolean) as HighlightEntry[];

  return {
    score,
    summary: schemas.length
      ? `Detected ${schemas.length} structured data types.`
      : "No structured data detected on the scanned page.",
    recommendations,
    issues,
    details: {
      schemas,
      highlights,
    },
  };
};

const computeGeo: ModuleComputer = (ctx) => {
  const issues = createIssueTracker();
  const recommendations: string[] = [];
  const hreflangLinks = ctx.dom('link[rel="alternate"][hreflang]').toArray();
  const hreflangCount = hreflangLinks.length;
  const hasHreflang = hreflangCount > 0;
  const hreflangForTarget = ctx.targetCountry
    ? hreflangLinks.some((node) => {
        const lang = ctx.dom(node).attr("hreflang");
        return lang ? lang.toLowerCase().includes(ctx.targetCountry!.toLowerCase()) : false;
      })
    : false;
  const ccTld = (() => {
    const parts = ctx.url.hostname.split(".");
    const last = parts.pop();
    return last && last.length === 2 ? last.toUpperCase() : null;
  })();
  const ccTldMatches = ccTld && ctx.targetCountry ? ccTld === ctx.targetCountry : false;
  const serverMatches = ctx.targetCountry
    ? ctx.geo?.countryCode?.toUpperCase() === ctx.targetCountry
    : false;
  const sitemapHasHreflang = Boolean(ctx.sitemap?.hasHreflang);

  let score = 0;
  if (hasHreflang) score += 4;
  if (hreflangForTarget) score += 1;
  if (ccTldMatches) score += 2;
  if (sitemapHasHreflang) score += 2;
  if (serverMatches) score += 2;
  score = clampScore(score);

  if (!hasHreflang) {
    incrementIssue(issues, "warning");
    recommendations.push("Add hreflang annotations to signal language/region variants.");
  }
  if (!sitemapHasHreflang) {
    recommendations.push("Include xhtml:link alternates inside sitemap.xml for crawl efficiency.");
  }
  if (ctx.targetCountry && !serverMatches) {
    recommendations.push("Consider regional hosting/CDN POPs near target market.");
  }

  const highlights: HighlightEntry[] = [
    toHighlight("Hreflang tags", hreflangCount, hasHreflang ? "good" : "warn"),
    toHighlight("Sitemap alternates", sitemapHasHreflang ? "Yes" : "No", sitemapHasHreflang ? "good" : "warn"),
    toHighlight("ccTLD match", ccTldMatches ? "Yes" : "No", ccTldMatches ? "good" : "warn"),
    toHighlight("Server region", ctx.geo?.countryCode ?? "Unknown", serverMatches ? "good" : "warn"),
  ].filter(Boolean) as HighlightEntry[];

  return {
    score,
    summary: `${hreflangCount} hreflang entries detected; ${serverMatches ? "server geo aligns with" : "server geo differs from"} target market.`,
    recommendations,
    issues,
    details: {
      hreflangCount,
      ccTld,
      serverCountry: ctx.geo?.country,
      highlights,
    },
  };
};

const computeSeoBasics: ModuleComputer = (ctx) => {
  const issues = createIssueTracker();
  const recommendations: string[] = [];

  const title = ctx.dom("title").first().text().trim();
  const metaDescription = ctx.dom('meta[name="description" i]').attr("content")?.trim() ?? "";
  const canonicals = ctx.dom('link[rel="canonical"]').toArray();
  const robotsMeta = ctx.dom('meta[name="robots" i]').attr("content") ?? "";
  const robotsDirectives = robotsMeta
    .split(/[,;]\s*/)
    .map((entry) => entry.toLowerCase())
    .filter(Boolean);

  const headersRobots = ctx.headers["x-robots-tag"] ?? "";
  const headerDirectives = headersRobots
    .split(/[,;]\s*/)
    .map((entry) => entry.toLowerCase())
    .filter(Boolean);

  const indexable = ![...robotsDirectives, ...headerDirectives].some((directive) =>
    ["noindex", "none"].includes(directive),
  );

  let score = 0;
  const perCheck = 2;

  if (title.length >= 30 && title.length <= 60) {
    score += perCheck;
  } else {
    incrementIssue(issues, "warning");
    recommendations.push("Keep the <title> tag between 30-60 characters.");
  }

  if (metaDescription.length >= 70 && metaDescription.length <= 160) {
    score += perCheck;
  } else {
    recommendations.push("Meta description should be 70-160 characters describing the page intent.");
  }

  if (canonicals.length === 1) {
    score += perCheck;
  } else {
    incrementIssue(issues, "warning");
    recommendations.push(canonicals.length === 0 ? "Add a canonical tag." : "Avoid multiple canonical tags.");
  }

  if (indexable) {
    score += perCheck;
  } else {
    incrementIssue(issues, "critical");
    recommendations.push("Remove noindex directives to allow crawling.");
  }

  if (ctx.sitemap?.fetched?.some((entry) => entry.ok)) {
    score += perCheck;
  } else {
    recommendations.push("Ensure sitemap.xml is accessible and referenced in robots.txt.");
  }

  score = clampScore(score);

  const highlights: HighlightEntry[] = [
    toHighlight("Title length", title.length, title.length ? "good" : "warn"),
    toHighlight("Meta description", metaDescription.length, metaDescription.length ? "good" : "warn"),
    toHighlight("Canonical tags", canonicals.length || 0, canonicals.length === 1 ? "good" : "warn"),
    toHighlight("Indexable", indexable ? "Yes" : "No", indexable ? "good" : "poor"),
    toHighlight("Sitemap reachable", ctx.sitemap?.fetched?.some((entry) => entry.ok) ? "Yes" : "No", ctx.sitemap?.fetched?.some((entry) => entry.ok) ? "good" : "warn"),
  ].filter(Boolean) as HighlightEntry[];

  return {
    score,
    summary: indexable ? "Core on-page tags are mostly configured." : "Indexing directives currently block crawlers.",
    recommendations,
    issues,
    details: {
      title,
      metaDescription,
      indexable,
      highlights,
    },
  };
};

const computeSocial: ModuleComputer = async (ctx) => {
  const issues = createIssueTracker();
  const recommendations: string[] = [];

  const ogTitle = ctx.dom('meta[property="og:title"]').attr("content")?.trim();
  const ogDescription = ctx.dom('meta[property="og:description"]').attr("content")?.trim();
  const ogImage = ctx.dom('meta[property="og:image"]').attr("content")?.trim();
  const twitterCard = ctx.dom('meta[name="twitter:card"]').attr("content")?.trim();

  let score = 0;
  const present = [ogTitle, ogDescription, ogImage].filter(Boolean).length;
  if (present === 3) {
    score += 7;
  } else {
    score += clampScore((present / 3) * 7);
    recommendations.push("Populate og:title, og:description, and og:image for richer shares.");
  }

  if (twitterCard) {
    score += 1;
  } else {
    recommendations.push("Add twitter:card to define summary or summary_large_image previews.");
  }

  let imageOk = false;
  if (ogImage) {
    const imageUrl = resolveHref(ogImage, ctx.url);
    if (imageUrl) {
      try {
        const response = await httpClient.head(imageUrl, {
          throwHttpErrors: false,
          timeout: { request: 7000 },
          headers: { "User-Agent": USER_AGENT },
        });
        imageOk = Boolean(response.statusCode && response.statusCode < 400);
        if (!imageOk) {
          recommendations.push("Open Graph image URL is unreachable.");
        }
      } catch {
        recommendations.push("Open Graph image could not be verified.");
      }
    }
  }

  if (imageOk) {
    score += 2;
  }

  score = clampScore(score);

  if (!ogTitle || !ogDescription) {
    incrementIssue(issues, "warning");
  }

  const highlights: HighlightEntry[] = [
    toHighlight("OG title", ogTitle ? "Yes" : "No", ogTitle ? "good" : "warn"),
    toHighlight("OG description", ogDescription ? "Yes" : "No", ogDescription ? "good" : "warn"),
    toHighlight("OG image", ogImage ? "Yes" : "No", ogImage ? "good" : "warn"),
    toHighlight("Twitter card", twitterCard ? twitterCard : "None", twitterCard ? "good" : "warn"),
  ].filter(Boolean) as HighlightEntry[];

  return {
    score,
    summary: present === 3 ? "Social previews look healthy." : "Missing Open Graph metadata lowers share quality.",
    recommendations,
    issues,
    details: {
      highlights,
    },
  };
};

const computeSecurity: ModuleComputer = (ctx) => {
  const isHttps = ctx.url.protocol === "https:";
  const issues = createIssueTracker();
  const recommendations: string[] = [];
  if (!isHttps) {
    incrementIssue(issues, "critical");
    recommendations.push("Serve the site over HTTPS to avoid major SEO penalties.");
    return {
      score: 0,
      summary: "HTTPS is required for any meaningful score.",
      recommendations,
      issues,
      details: { https: false, highlights: [toHighlight("HTTPS", "No", "poor")] },
    };
  }

  let score = 0;
  const hsts = ctx.headers["strict-transport-security"];
  const xcto = ctx.headers["x-content-type-options"];
  const xfo = ctx.headers["x-frame-options"];
  const csp = ctx.headers["content-security-policy"];
  const contentType = ctx.headers["content-type"] ?? "";

  if (hsts) score += 2;
  else recommendations.push("Add Strict-Transport-Security header.");

  if (xcto?.toLowerCase().includes("nosniff")) score += 2;
  else recommendations.push("Add X-Content-Type-Options: nosniff.");

  const frameProtected =
    (xfo && !/allow/.test(xfo.toLowerCase())) ||
    (csp && /frame-ancestors/i.test(csp) && !/frame-ancestors\s+\*/i.test(csp));
  if (frameProtected) score += 2;
  else recommendations.push("Set X-Frame-Options DENY or a CSP frame-ancestors rule.");

  if (/text\/html/i.test(contentType) && /charset=/i.test(contentType)) score += 2;
  else recommendations.push("Return Content-Type: text/html; charset=UTF-8.");

  const mixedContent = ctx.dom("[src],[href]")
    .toArray()
    .filter((node) => {
      const value = ctx.dom(node).attr("src") ?? ctx.dom(node).attr("href");
      return value?.startsWith("http://");
    }).length;

  if (mixedContent === 0) score += 2;
  else {
    incrementIssue(issues, "warning");
    recommendations.push("Mixed-content resources detected; upgrade to HTTPS.");
  }

  score = clampScore(score);

  const highlights: HighlightEntry[] = [
    toHighlight("HSTS", hsts ? "Yes" : "No", hsts ? "good" : "warn"),
    toHighlight("NoSniff", xcto?.toLowerCase().includes("nosniff") ? "Yes" : "No", xcto ? "good" : "warn"),
    toHighlight("Frame protection", frameProtected ? "Yes" : "No", frameProtected ? "good" : "warn"),
    toHighlight("Mixed content refs", mixedContent, mixedContent ? "warn" : "good"),
  ].filter(Boolean) as HighlightEntry[];

  return {
    score,
    summary: mixedContent ? "Security headers set but mixed content detected." : "Core security headers look good.",
    recommendations,
    issues,
    details: {
      https: true,
      hsts: Boolean(hsts),
      mixedContent,
      highlights,
    },
  };
};

const computeAccessibility: ModuleComputer = (ctx) => {
  const images = ctx.dom("img").toArray();
  const missingAlt: Array<{ src?: string | null; index: number }> = [];
  const withAlt = images.filter((node, index) => {
    const alt = ctx.dom(node).attr("alt");
    const hasAlt = typeof alt === "string" && alt.trim().length > 0;
    if (!hasAlt) {
      missingAlt.push({ src: ctx.dom(node).attr("src"), index });
    }
    return hasAlt;
  });
  const altRatio = images.length ? withAlt.length / images.length : 1;

  const landmarkSelectors = ["main", "nav", "header", "footer", "aside", "[role=main]", "[role=navigation]", "[role=banner]", "[role=contentinfo]"];
  const foundLandmarks = new Set<string>();
  landmarkSelectors.forEach((selector) => {
    if (ctx.dom(selector).length > 0) {
      foundLandmarks.add(selector);
    }
  });

  let score = clampScore(Math.round(altRatio * 6));
  if (altRatio >= 0.95) {
    score += 2;
  }
  if (foundLandmarks.size >= 2) {
    score += 2;
  }
  score = clampScore(score);

  const issues = createIssueTracker();
  const recommendations: string[] = [];

  if (altRatio < 0.95) {
    incrementIssue(issues, "warning");
    recommendations.push("Add descriptive alt text to all meaningful images. Decorative media should use empty alt attributes.");
  }

  if (foundLandmarks.size < 2) {
    recommendations.push("Use at least two semantic landmarks (<main>, <nav>, <aside>, etc.) for better keyboard navigation.");
  }

  const highlights: HighlightEntry[] = [
    toHighlight("Images with alt", `${withAlt.length}/${images.length}`, altRatio >= 0.95 ? "good" : "warn"),
    toHighlight("Landmark types", foundLandmarks.size ? `${foundLandmarks.size}` : "0", foundLandmarks.size >= 2 ? "good" : "warn"),
  ].filter(Boolean) as HighlightEntry[];

  return {
    score,
    summary: `Alt coverage at ${formatRatio(altRatio)}.`,
    recommendations,
    issues,
    details: {
      totalImages: images.length,
      imagesWithAlt: withAlt.length,
      missingAltSample: missingAlt.slice(0, 5),
      landmarksDetected: Array.from(foundLandmarks),
      highlights,
    },
  };
};

const computeLinks: ModuleComputer = (ctx) => {
  const issues = createIssueTracker();
  const recommendations: string[] = [];
  const brokenCount = ctx.linkSample.broken.length;
  const totalChecked = ctx.linkSample.total;
  const nofollowRatio = totalChecked ? ctx.linkSample.nofollow / totalChecked : 0;
  const brokenRatio = totalChecked ? brokenCount / totalChecked : 0;

  let score = 10;
  if (brokenCount) {
    score -= Math.min(6, brokenRatio * 10);
    recommendations.push(`${brokenCount} sampled links returned errors; fix or remove broken URLs.`);
    incrementIssue(issues, "warning");
  }

  if (nofollowRatio > 0.2) {
    score -= Math.min(3, nofollowRatio * 5);
    recommendations.push("High nofollow ratio on internal links. Ensure important pages can receive internal equity.");
  }

  if (totalChecked < 10) {
    score -= 1;
    recommendations.push("Limited link sampling (less than 10). Add more internal links on the homepage.");
  }

  const indexable = ctx.dom('meta[name="robots" i]').attr("content")?.toLowerCase().includes("noindex")
    ? false
    : !ctx.headers["x-robots-tag"]?.toLowerCase().includes("noindex");

  if (!indexable) {
    score = Math.min(score, 4);
    incrementIssue(issues, "critical");
    recommendations.push("Remove noindex directives that block crawling.");
  }

  score = clampScore(score);

  const highlights: HighlightEntry[] = [
    toHighlight("Links sampled", totalChecked || 0, totalChecked >= 10 ? "good" : "warn"),
    toHighlight("Broken links", brokenCount || 0, brokenCount ? "warn" : "good"),
    toHighlight("Nofollow ratio", formatRatio(nofollowRatio), nofollowRatio > 0.2 ? "warn" : "good"),
    toHighlight("Indexable", indexable ? "Yes" : "No", indexable ? "good" : "poor"),
  ].filter(Boolean) as HighlightEntry[];

  return {
    score,
    summary: brokenCount ? `${brokenCount} of ${totalChecked} sampled links failed.` : "Sampled links healthy.",
    recommendations,
    issues,
    details: {
      totalSampled: totalChecked,
      brokenSample: ctx.linkSample.broken.slice(0, 5),
      nofollowRatio,
      highlights,
    },
  };
};

const COMPUTERS: Record<ModuleKey, ModuleComputer> = {
  performance: computePerformance,
  schema: computeSchema,
  geo: computeGeo,
  seo_basics: computeSeoBasics,
  social: computeSocial,
  security: computeSecurity,
  accessibility: computeAccessibility,
  links: computeLinks,
};

export const buildModuleResults = async (ctx: AnalysisContext): Promise<ModuleResult[]> => {
  const results: ModuleResult[] = [];
  const timestamp = new Date().toISOString();

  for (const definition of MODULE_DEFINITIONS) {
    const computer = COMPUTERS[definition.key];
    if (!computer) continue;
    const moduleResult = await computer(ctx);
    results.push({
      key: definition.key,
      label: definition.label,
      weight: definition.weight,
      score: moduleResult.score,
      summary: moduleResult.summary,
      recommendations: moduleResult.recommendations,
      issues: moduleResult.issues,
      details: moduleResult.details,
      lastChecked: timestamp,
    });
  }

  return results;
};
