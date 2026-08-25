/**
 * Apache & Nginx Access Log Adapter.
 * Supports Nginx/Apache Combined Log Format and Common Log Format (CLF).
 */

import { SeoServerLogEvent } from "../types";
import { classifyBotRequest } from "../bot-classifier";
import { normalizeLogUrl } from "../url-normalizer";

// Example Combined format:
// 66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /services/itsm HTTP/1.1" 200 4520 "https://google.com" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
const COMBINED_LOG_REGEX = /^(\S+) \S+ \S+ \[([\w:/]+\s[+\-]\d{4})\] "(\S+)\s+([^"\s]+)(?:\s+HTTP\/[\d.]+)?\" (\d{3}) (\d+|-)(?: "([^"]*)" "([^"]*)")?/;

export function parseApacheNginxLine(
  line: string,
  projectId: string,
  defaultHost: string
): SeoServerLogEvent | null {
  const match = COMBINED_LOG_REGEX.exec(line.trim());
  if (!match) return null;

  const [, ip, dateStr, method, fullPath, statusStr, bytesStr, referrer, userAgent] = match;

  let timestamp: string;
  try {
    // Parse Apache date format: 21/Aug/2026:10:00:00 +0000
    const cleanDateStr = dateStr.replace(/^(\d{2})\/(\w{3})\/(\d{4}):/, "$1 $2 $3 ");
    timestamp = new Date(cleanDateStr).toISOString();
  } catch {
    timestamp = new Date().toISOString();
  }

  const [pathPart, queryPart] = fullPath.split("?");
  const norm = normalizeLogUrl(defaultHost, pathPart, queryPart);
  const botIdentity = classifyBotRequest(userAgent, ip);

  const statusCode = parseInt(statusStr, 10);
  const responseBytes = bytesStr === "-" ? 0 : parseInt(bytesStr, 10);

  return {
    eventId: `evt_${Math.abs(timestamp.length + fullPath.length)}_${Date.now().toString(36)}`,
    timestamp,
    projectId,
    host: defaultHost,
    method: method.toUpperCase(),
    rawPath: pathPart,
    rawQuery: queryPart,
    rawUrl: norm.rawUrl,
    normalizedUrl: norm.normalizedUrl,
    statusCode,
    userAgent,
    ipAddress: ip,
    responseBytes,
    referrer: referrer === "-" ? undefined : referrer,
    sourceProvider: "NGINX_APACHE",
    resourceType: norm.resourceType,
    botIdentity,
  };
}
