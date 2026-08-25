/**
 * Known URL Universe Inventory & Source Composition Engine.
 * Aggregates, deduplicates, and accounts for URL discovery sources.
 */

import { KnownUrlUniverseSummary } from "./types";

export interface UrlUniverseInput {
  crawlerUrls?: string[];
  sitemapUrls?: string[];
  gscLandingPages?: string[];
  serverLogUrls?: string[];
  backlinkUrls?: string[];
  migrationUrls?: string[];
  manualWatchlistUrls?: string[];
}

export function buildKnownUrlUniverse(inputs: UrlUniverseInput): {
  allNormalizedUrls: string[];
  urlSourceMap: Map<string, Set<string>>;
  summary: KnownUrlUniverseSummary;
} {
  const urlSourceMap = new Map<string, Set<string>>();

  function addUrls(urls: string[] | undefined, sourceName: string) {
    if (!urls) return;
    for (const u of urls) {
      if (!u || typeof u !== "string") continue;
      const clean = u.trim().toLowerCase().replace(/\/$/, "");
      if (!clean) continue;

      let sources = urlSourceMap.get(clean);
      if (!sources) {
        sources = new Set<string>();
        urlSourceMap.set(clean, sources);
      }
      sources.add(sourceName);
    }
  }

  addUrls(inputs.crawlerUrls, "CRAWLER");
  addUrls(inputs.sitemapUrls, "SITEMAP");
  addUrls(inputs.gscLandingPages, "GSC");
  addUrls(inputs.serverLogUrls, "SERVER_LOGS");
  addUrls(inputs.backlinkUrls, "BACKLINKS");
  addUrls(inputs.migrationUrls, "MIGRATION");
  addUrls(inputs.manualWatchlistUrls, "MANUAL_WATCHLIST");

  const summary: KnownUrlUniverseSummary = {
    totalKnownUrls: urlSourceMap.size,
    sources: {
      crawlerCount: inputs.crawlerUrls?.length || 0,
      sitemapCount: inputs.sitemapUrls?.length || 0,
      gscLandingPagesCount: inputs.gscLandingPages?.length || 0,
      serverLogsCount: inputs.serverLogUrls?.length || 0,
      backlinksCount: inputs.backlinkUrls?.length || 0,
      migrationCount: inputs.migrationUrls?.length || 0,
      manualWatchlistCount: inputs.manualWatchlistUrls?.length || 0,
    },
  };

  return {
    allNormalizedUrls: Array.from(urlSourceMap.keys()),
    urlSourceMap,
    summary,
  };
}
