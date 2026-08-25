/**
 * Generic Structured JSON & CSV/TSV Log Adapter.
 * Robust fallback supporting streaming lines, CSV column mapping, and malformed row filtering.
 */

import { SeoServerLogEvent } from "../types";
import { classifyBotRequest } from "../bot-classifier";
import { normalizeLogUrl } from "../url-normalizer";

export function parseGenericJsonLine(
  line: string,
  projectId: string,
  defaultHost: string
): SeoServerLogEvent | null {
  try {
    const raw = JSON.parse(line.trim());
    const host = raw.host || raw.domain || defaultHost;
    const rawUrlOrPath = raw.url || raw.path || raw.uri || "/";
    const [pathPart, queryPart] = rawUrlOrPath.includes("://")
      ? [new URL(rawUrlOrPath).pathname, new URL(rawUrlOrPath).search.slice(1)]
      : rawUrlOrPath.split("?");

    const method = (raw.method || "GET").toUpperCase();
    const statusCode = parseInt(raw.statusCode || raw.status || "200", 10);
    const userAgent = raw.userAgent || raw.user_agent || raw.ua || "";
    const ip = raw.ip || raw.clientIp || raw.client_ip || "";
    const responseTimeMs = raw.responseTimeMs || raw.duration || raw.latency || undefined;
    const responseBytes = raw.responseBytes || raw.bytes || raw.size || undefined;

    let timestamp: string;
    try {
      timestamp = raw.timestamp || raw.time || raw.datetime ? new Date(raw.timestamp || raw.time || raw.datetime).toISOString() : new Date().toISOString();
    } catch {
      timestamp = new Date().toISOString();
    }

    const norm = normalizeLogUrl(host, pathPart, queryPart);
    const botIdentity = classifyBotRequest(userAgent, ip);

    return {
      eventId: `json_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp,
      projectId,
      host,
      method,
      rawPath: pathPart,
      rawQuery: queryPart,
      rawUrl: norm.rawUrl,
      normalizedUrl: norm.normalizedUrl,
      statusCode,
      userAgent,
      ipAddress: ip,
      responseBytes,
      responseTimeMs,
      sourceProvider: "STRUCTURED_JSON",
      resourceType: norm.resourceType,
      botIdentity,
    };
  } catch {
    return null;
  }
}

export function parseCsvTsvLine(
  line: string,
  delimiter: string = ",",
  projectId: string,
  defaultHost: string,
  headerIndices?: { timestampIdx: number; pathIdx: number; statusIdx: number; uaIdx: number; ipIdx?: number }
): SeoServerLogEvent | null {
  const parts = line.split(delimiter);
  if (parts.length < 4) return null;

  const timestampIdx = headerIndices?.timestampIdx ?? 0;
  const pathIdx = headerIndices?.pathIdx ?? 1;
  const statusIdx = headerIndices?.statusIdx ?? 2;
  const uaIdx = headerIndices?.uaIdx ?? 3;
  const ipIdx = headerIndices?.ipIdx ?? 4;

  const rawPath = parts[pathIdx]?.trim() || "/";
  const [pathPart, queryPart] = rawPath.split("?");
  const statusStr = parts[statusIdx]?.trim() || "200";
  const userAgent = parts[uaIdx]?.trim() || "";
  const ip = ipIdx < parts.length ? parts[ipIdx]?.trim() : "";

  const statusCode = parseInt(statusStr, 10);
  if (isNaN(statusCode)) return null;

  let timestamp: string;
  try {
    timestamp = new Date(parts[timestampIdx].trim()).toISOString();
  } catch {
    timestamp = new Date().toISOString();
  }

  const norm = normalizeLogUrl(defaultHost, pathPart, queryPart);
  const botIdentity = classifyBotRequest(userAgent, ip);

  return {
    eventId: `csv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp,
    projectId,
    host: defaultHost,
    method: "GET",
    rawPath: pathPart,
    rawQuery: queryPart,
    rawUrl: norm.rawUrl,
    normalizedUrl: norm.normalizedUrl,
    statusCode,
    userAgent,
    ipAddress: ip,
    sourceProvider: "CSV_TSV",
    resourceType: norm.resourceType,
    botIdentity,
  };
}
