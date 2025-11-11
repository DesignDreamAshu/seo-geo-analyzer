import got from "got";
import { USER_AGENT } from "./constants";
import { geoCache } from "./http";
import type { GeoLookupResult } from "./types";

interface GeoOptions {
  skipCache?: boolean;
  signal?: AbortSignal;
}

const GEO_BASE = process.env.GEO_API_BASE?.trim() || "https://ip-api.com/json";

export async function lookupGeo(hostname: string, { skipCache, signal }: GeoOptions = {}): Promise<GeoLookupResult | null> {
  if (!hostname) return null;
  const cacheKey = `geo:${hostname}`;
  if (!skipCache) {
    const cached = geoCache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await got
      .get(`${GEO_BASE.replace(/\/$/, "")}/${encodeURIComponent(hostname)}`, {
        searchParams: { fields: "status,message,country,countryCode,regionName,isp,query" },
        responseType: "json",
        timeout: { request: 8000 },
        headers: { "User-Agent": USER_AGENT },
        signal,
      })
      .json<GeoLookupResult>();

    if (!skipCache && response) {
      geoCache.set(cacheKey, response);
    }
    return response;
  } catch {
    return null;
  }
}
