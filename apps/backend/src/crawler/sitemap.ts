import axios from "axios";
import zlib from "zlib";
import { XMLParser } from "fast-xml-parser";
import { normalizeUrl } from "./normalizer";
import type { SitemapUrlEntry } from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

const DEFAULT_USER_AGENT = "DreamSEO-Bot/1.0 (+https://dreamseo.dev)";

/**
 * Decompresses gzipped buffer if payload is gzipped.
 */
function decompressIfNeeded(buffer: Buffer): string {
  try {
    if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      return zlib.gunzipSync(buffer).toString("utf-8");
    }
  } catch {
    // fallback to string conversion
  }
  return buffer.toString("utf-8");
}

/**
 * Recursively fetches and parses XML sitemaps and sitemap indexes.
 */
export async function fetchAllSitemaps(
  seedUrl: string,
  robotsSitemaps: string[] = [],
  signal?: AbortSignal,
): Promise<{ urls: SitemapUrlEntry[]; sitemapFiles: string[]; errors: string[] }> {
  const origin = new URL(seedUrl).origin;
  const discoveredSitemapUrls = new Set<string>(robotsSitemaps);

  // Common standard sitemap locations
  if (discoveredSitemapUrls.size === 0) {
    discoveredSitemapUrls.add(new URL("/sitemap.xml", origin).toString());
    discoveredSitemapUrls.add(new URL("/sitemap_index.xml", origin).toString());
  }

  const sitemapQueue = Array.from(discoveredSitemapUrls);
  const processedSitemaps = new Set<string>();
  const allUrls = new Map<string, SitemapUrlEntry>();
  const sitemapFiles: string[] = [];
  const errors: string[] = [];

  const MAX_SITEMAPS = 15; // Prevent recursive bomb
  const MAX_URLS_TO_RECORD = 5000;

  while (sitemapQueue.length > 0 && processedSitemaps.size < MAX_SITEMAPS) {
    const currentSitemapUrl = sitemapQueue.shift()!;
    if (processedSitemaps.has(currentSitemapUrl)) continue;
    processedSitemaps.add(currentSitemapUrl);

    try {
      const response = await axios.get(currentSitemapUrl, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
        responseType: "arraybuffer",
        timeout: 8000,
        signal,
        validateStatus: (status) => status === 200,
      });

      sitemapFiles.push(currentSitemapUrl);
      const rawXml = decompressIfNeeded(Buffer.from(response.data));
      const parsed = xmlParser.parse(rawXml);

      if (!parsed || typeof parsed !== "object") {
        continue;
      }

      // Case 1: Sitemap Index (<sitemapindex><sitemap><loc>...)
      if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
        const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
          ? parsed.sitemapindex.sitemap
          : [parsed.sitemapindex.sitemap];

        for (const s of sitemaps) {
          const loc = s?.loc ? String(s.loc).trim() : null;
          if (loc && !processedSitemaps.has(loc)) {
            sitemapQueue.push(loc);
          }
        }
        continue;
      }

      // Case 2: Standard Sitemap (<urlset><url><loc>...)
      if (parsed.urlset && parsed.urlset.url) {
        const urlEntries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];

        for (const entry of urlEntries) {
          if (allUrls.size >= MAX_URLS_TO_RECORD) break;
          const rawLoc = entry?.loc ? String(entry.loc).trim() : null;
          if (!rawLoc) continue;

          const normalized = normalizeUrl(rawLoc);
          if (!normalized) continue;

          if (!allUrls.has(normalized)) {
            allUrls.set(normalized, {
              loc: normalized,
              lastmod: entry.lastmod ? String(entry.lastmod) : undefined,
              changefreq: entry.changefreq ? String(entry.changefreq) : undefined,
              priority: entry.priority ? String(entry.priority) : undefined,
              sourceSitemap: currentSitemapUrl,
            });
          }
        }
      }
    } catch (err: any) {
      errors.push(`Failed to fetch sitemap: ${currentSitemapUrl} (${err.message})`);
    }
  }

  return {
    urls: Array.from(allUrls.values()),
    sitemapFiles,
    errors,
  };
}
