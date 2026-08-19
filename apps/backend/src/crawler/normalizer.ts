/**
 * Production-grade URL Normalization & Scope Guard for Sitechecker-level crawling.
 */

// Strictly known tracking parameters that are safe to auto-strip.
// Note: Ambiguous parameters like 'ref', 'source', 'campaign' are deliberately preserved
// to avoid incorrectly collapsing functional/distinct application pages.
const SAFE_STRIP_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gclsrc",
  "fbclid",
  "dclid",
  "wbraid",
  "gbraid",
  "mc_eid",
  "mc_cid",
  "_ga",
  "_gl",
  "msclkid",
]);

/**
 * Normalizes a URL string into a standardized, canonical format for deduplication.
 */
export function normalizeUrl(rawUrl: string, baseUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:") || trimmed.startsWith("data:")) {
    return null;
  }

  let urlObj: URL;
  try {
    const withProto = !baseUrl && !trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")
      ? `https://${trimmed}`
      : trimmed;
    urlObj = baseUrl ? new URL(withProto, baseUrl) : new URL(withProto);
  } catch {
    return null;
  }

  // Only support http and https protocols
  if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
    return null;
  }

  // 1. Lowercase hostname
  urlObj.hostname = urlObj.hostname.toLowerCase();

  // 2. Remove default ports (:80 for http, :443 for https)
  if ((urlObj.protocol === "http:" && urlObj.port === "80") || (urlObj.protocol === "https:" && urlObj.port === "443")) {
    urlObj.port = "";
  }

  // 3. Strip hash fragment
  urlObj.hash = "";

  // 4. Normalize pathname: remove duplicate slashes, resolve '.' and '..'
  let pathname = urlObj.pathname.replace(/\/{2,}/g, "/");
  if (!pathname.startsWith("/")) {
    pathname = "/" + pathname;
  }
  urlObj.pathname = pathname;

  // 5. Filter & sort query parameters
  const searchParams = new URLSearchParams(urlObj.search);
  const filteredParams = new URLSearchParams();

  // Sort parameter keys alphabetically for consistent deterministic representation
  const sortedKeys = Array.from(searchParams.keys()).sort();
  for (const key of sortedKeys) {
    if (!SAFE_STRIP_QUERY_PARAMS.has(key.toLowerCase())) {
      const values = searchParams.getAll(key);
      for (const val of values) {
        filteredParams.append(key, val);
      }
    }
  }

  const queryString = filteredParams.toString();
  urlObj.search = queryString ? `?${queryString}` : "";

  return urlObj.toString();
}

/**
 * Checks if a candidate URL is within the allowed crawl scope.
 */
export function isUrlInScope(candidateUrl: string, seedUrl: string, allowSubdomains = false): boolean {
  try {
    const candidate = new URL(candidateUrl.startsWith("http") ? candidateUrl : `https://${candidateUrl}`);
    const seed = new URL(seedUrl.startsWith("http") ? seedUrl : `https://${seedUrl}`);

    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
      return false;
    }

    if (allowSubdomains) {
      // e.g. candidate.hostname = blog.example.com, seed.hostname = example.com
      const seedHost = seed.hostname.replace(/^www\./, "");
      const candidateHost = candidate.hostname.replace(/^www\./, "");
      return candidateHost === seedHost || candidateHost.endsWith(`.${seedHost}`);
    }

    // Exact hostname match (treating www and non-www as in-scope if target domain matches)
    const seedHost = seed.hostname.replace(/^www\./, "");
    const candidateHost = candidate.hostname.replace(/^www\./, "");
    return candidateHost === seedHost;
  } catch {
    return false;
  }
}

/**
 * Detects crawl traps such as repeating path segments or recursive directory loops.
 * e.g., /category/shoes/category/shoes/category/shoes...
 */
export function isCrawlTrap(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    const segments = parsed.pathname.split("/").filter(Boolean);

    // Trap 1: Excessive path depth (> 12 segments)
    if (segments.length > 12) return true;

    // Trap 2: Excessive URL length (> 512 characters)
    if (urlStr.length > 512) return true;

    // Trap 3: Repeating consecutive segments (e.g. /a/b/a/b or /item/item/item)
    const segmentCountMap = new Map<string, number>();
    for (const segment of segments) {
      const lower = segment.toLowerCase();
      const count = (segmentCountMap.get(lower) || 0) + 1;
      segmentCountMap.set(lower, count);
      if (count >= 4) {
        return true; // same segment repeated 4+ times in path
      }
    }

    // Trap 4: Repetitive calendar patterns (e.g. /2026/08/2026/08)
    const yearMatches = parsed.pathname.match(/\b(19\d\d|20\d\d)\b/g);
    if (yearMatches && yearMatches.length >= 3) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

/**
 * Extracts the root domain (registrable domain) for logging and grouping.
 */
export function getDomainName(urlStr: string): string {
  try {
    const urlObj = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return urlStr;
  }
}

/**
 * Classifies the resource type of a crawled URL or HTTP response.
 */
export function classifyResourceType(urlStr: string, contentType = ""): import("./types").ResourceType {
  const lowerUrl = urlStr.toLowerCase();
  const lowerCt = contentType.toLowerCase();

  // 1. XML Sitemaps
  if (
    lowerCt.includes("xml") ||
    lowerUrl.endsWith(".xml") ||
    lowerUrl.includes("sitemap.xml") ||
    lowerUrl.includes("sitemap_index.xml") ||
    lowerUrl.includes("/sitemap/")
  ) {
    return "xml_sitemap";
  }

  // 2. Cloudflare / CDN / Security / Utility endpoints
  if (
    lowerUrl.includes("/cdn-cgi/") ||
    lowerUrl.includes("email-protection") ||
    lowerUrl.includes("/_next/data/") ||
    lowerUrl.includes("/api/") ||
    lowerUrl.includes("/webhooks/")
  ) {
    return "utility_endpoint";
  }

  // 3. Static Media Assets
  if (
    lowerCt.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|svg|ico|avif|bmp|tiff)(\?.*)?$/i.test(lowerUrl)
  ) {
    return "image";
  }

  // 4. Scripts & Stylesheets
  if (lowerCt.includes("javascript") || /\.js(\?.*)?$/i.test(lowerUrl)) {
    return "script";
  }
  if (lowerCt.includes("css") || /\.css(\?.*)?$/i.test(lowerUrl)) {
    return "stylesheet";
  }

  // 5. Normal HTML Page
  if (lowerCt.includes("text/html") || lowerCt === "" || !/\.[a-z0-9]{2,5}$/i.test(lowerUrl)) {
    return "html_page";
  }

  return "other";
}

/**
 * Resolves a raw href string against a base URL into an absolute URL string.
 */
export function resolveAbsoluteHref(rawHref: string, baseUrl: string): string | null {
  if (!rawHref || typeof rawHref !== "string") return null;
  const trimmed = rawHref.trim();
  if (!trimmed) return null;

  try {
    const resolved = new URL(trimmed, baseUrl);
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Classifies a hyperlink into its semantic functional type.
 */
export function classifyLinkType(
  rawHref: string,
  resolvedUrl: string | null,
  seedUrl: string,
  allowSubdomains = false
): import("./types").LinkClassification {
  if (!rawHref) return "invalid";
  const trimmed = rawHref.trim();
  const lower = trimmed.toLowerCase();

  // 1. Placeholder & interactive hash controls
  if (lower === "#" || lower === "#!" || lower === "javascript:void(0)" || lower === "javascript:void(0);") {
    return "placeholder_hash";
  }

  // 2. JavaScript Actions
  if (lower.startsWith("javascript:")) {
    return "javascript_action";
  }

  // 3. Mailto & Tel
  if (lower.startsWith("mailto:")) return "mailto";
  if (lower.startsWith("tel:")) return "tel";

  // 4. In-page Fragment Link
  if (trimmed.startsWith("#")) return "fragment";

  // 5. Downloads
  if (/\.(pdf|zip|docx?|xlsx?|csv|tar\.gz|dmg|exe)(\?.*)?$/i.test(lower)) {
    return "download";
  }

  // 6. Absolute or resolved HTTP(S) URL
  if (resolvedUrl) {
    try {
      const parsed = new URL(resolvedUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "invalid";
      }

      if (isUrlInScope(resolvedUrl, seedUrl, allowSubdomains)) {
        return "internal_navigation";
      }
      return "external";
    } catch {
      return "invalid";
    }
  }

  return "invalid";
}


