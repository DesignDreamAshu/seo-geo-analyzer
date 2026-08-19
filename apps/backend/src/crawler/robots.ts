import axios from "axios";

export interface RobotsTxtResult {
  text: string | null;
  sitemaps: string[];
  crawlDelayMs: number | null;
  disallowedPatterns: string[];
  allowedPatterns: string[];
  isUrlDisallowed: (urlPath: string) => boolean;
}

const DEFAULT_USER_AGENT = "DreamSEO-Bot/1.0 (+https://dreamseo.dev)";

/**
 * Fetches and parses robots.txt for a given domain origin.
 */
export async function fetchAndParseRobotsTxt(originUrl: URL, signal?: AbortSignal): Promise<RobotsTxtResult> {
  const robotsUrl = new URL("/robots.txt", originUrl.origin).toString();
  const sitemaps: string[] = [];
  let crawlDelayMs: number | null = null;
  const disallowedPatterns: string[] = [];
  const allowedPatterns: string[] = [];
  let rawText: string | null = null;

  try {
    const response = await axios.get(robotsUrl, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      timeout: 6000,
      signal,
      validateStatus: (status) => status < 500, // don't throw on 404
    });

    if (response.status === 200 && typeof response.data === "string") {
      rawText = response.data;
      const lines = rawText.split(/\r?\n/);
      let appliesToUs = false;

      for (const line of lines) {
        const cleanLine = line.split("#")[0].trim();
        if (!cleanLine) continue;

        const colonIndex = cleanLine.indexOf(":");
        if (colonIndex === -1) continue;

        const directive = cleanLine.slice(0, colonIndex).trim().toLowerCase();
        const value = cleanLine.slice(colonIndex + 1).trim();

        if (directive === "sitemap" && value) {
          try {
            const absoluteSitemap = new URL(value, originUrl.origin).toString();
            if (!sitemaps.includes(absoluteSitemap)) {
              sitemaps.push(absoluteSitemap);
            }
          } catch {
            // invalid sitemap URL
          }
          continue;
        }

        if (directive === "user-agent") {
          const ua = value.toLowerCase();
          appliesToUs = ua === "*" || ua.includes("dreamseo") || ua.includes("bot");
          continue;
        }

        if (appliesToUs) {
          if (directive === "disallow" && value) {
            disallowedPatterns.push(value);
          } else if (directive === "allow" && value) {
            allowedPatterns.push(value);
          } else if (directive === "crawl-delay" && value) {
            const seconds = parseFloat(value);
            if (!isNaN(seconds) && seconds > 0) {
              crawlDelayMs = Math.min(10000, Math.round(seconds * 1000)); // cap at 10s
            }
          }
        }
      }
    }
  } catch {
    // robots.txt missing or network error -> treat as fully allowed
  }

  // Helper function to test if path matches a robots pattern
  const matchesPattern = (path: string, pattern: string): boolean => {
    if (!pattern) return false;
    if (pattern === "/") return true;

    // Convert robots glob syntax (* and $) to regex
    let regexStr = "^" + pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");

    if (regexStr.endsWith("\\$")) {
      regexStr = regexStr.slice(0, -2) + "$";
    }

    try {
      const regex = new RegExp(regexStr);
      return regex.test(path);
    } catch {
      return path.startsWith(pattern);
    }
  };

  const isUrlDisallowed = (urlPath: string): boolean => {
    // If specific allow pattern matches, it takes precedence if more specific
    for (const allow of allowedPatterns) {
      if (matchesPattern(urlPath, allow)) {
        return false;
      }
    }
    for (const disallow of disallowedPatterns) {
      if (matchesPattern(urlPath, disallow)) {
        return true;
      }
    }
    return false;
  };

  return {
    text: rawText,
    sitemaps,
    crawlDelayMs,
    disallowedPatterns,
    allowedPatterns,
    isUrlDisallowed,
  };
}
