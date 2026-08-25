/**
 * Unified Log Parser Factory & Stream Coordinator.
 * Safely digests multi-line log streams, tracks detailed rejection reasons,
 * deduplicates only genuine duplicates, and exposes honest adapter support states.
 */

import { SeoServerLogEvent, LogDatasetCompleteness, AdapterSupportState } from "../types";
import { parseApacheNginxLine } from "./apache-nginx";
import { parseCloudflareLogEvent } from "./cloudflare";
import { parseVercelLogEvent } from "./vercel";
import { parseGenericJsonLine, parseCsvTsvLine } from "./generic-json-csv";

export interface LogIngestionResult {
  events: SeoServerLogEvent[];
  totalParsed: number;
  totalRejected: number;
  rejectionRatePercent: number;
  rejectionReasons: Record<string, number>;
  completeness: LogDatasetCompleteness;
  provider: string;
  adapterSupportState: AdapterSupportState;
}

export function getAdapterSupportState(provider: string): AdapterSupportState {
  switch (provider) {
    case "NGINX_APACHE":
    case "CLOUDFLARE":
    case "VERCEL":
    case "STRUCTURED_JSON":
    case "CSV":
    case "TSV":
      return "IMPLEMENTED_AND_TESTED";
    case "AWS_CLOUDFRONT":
    case "AWS_ALB":
      return "GENERIC_IMPORT_SUPPORTED";
    default:
      return "GENERIC_IMPORT_SUPPORTED";
  }
}

export function parseLogLines(params: {
  lines: string[];
  provider: "NGINX_APACHE" | "CLOUDFLARE" | "VERCEL" | "STRUCTURED_JSON" | "CSV" | "TSV" | "AWS_CLOUDFRONT" | "AWS_ALB" | "AUTO";
  projectId: string;
  defaultHost: string;
  isPartialDataset?: boolean;
}): LogIngestionResult {
  const events: SeoServerLogEvent[] = [];
  const seenEventKeys = new Set<string>();
  const rejectionReasons: Record<string, number> = {};
  let rejected = 0;

  for (let idx = 0; idx < params.lines.length; idx++) {
    const line = params.lines[idx];
    if (!line || !line.trim()) continue;
    if (line.startsWith("#")) continue; // Comment line

    let event: SeoServerLogEvent | null = null;

    try {
      if (params.provider === "NGINX_APACHE") {
        event = parseApacheNginxLine(line, params.projectId, params.defaultHost);
      } else if (params.provider === "CLOUDFLARE") {
        event = parseCloudflareLogEvent(JSON.parse(line), params.projectId, params.defaultHost);
      } else if (params.provider === "VERCEL") {
        event = parseVercelLogEvent(JSON.parse(line), params.projectId, params.defaultHost);
      } else if (params.provider === "CSV") {
        event = parseCsvTsvLine(line, ",", params.projectId, params.defaultHost);
      } else if (params.provider === "TSV" || params.provider === "AWS_CLOUDFRONT") {
        event = parseCsvTsvLine(line, "\t", params.projectId, params.defaultHost);
      } else if (params.provider === "STRUCTURED_JSON" || params.provider === "AUTO" || params.provider === "AWS_ALB") {
        if (line.trim().startsWith("{")) {
          event = parseGenericJsonLine(line, params.projectId, params.defaultHost);
        } else {
          event = parseApacheNginxLine(line, params.projectId, params.defaultHost);
        }
      }
    } catch {
      event = null;
    }

    if (event) {
      // Robust signature including timestamp, IP, method, path, status, bytes, and userAgent
      const key = `${event.timestamp}_${event.ipAddress}_${event.method}_${event.rawPath}_${event.statusCode}_${event.responseBytes || 0}_${event.userAgent}`;
      if (!seenEventKeys.has(key)) {
        seenEventKeys.add(key);
        events.push(event);
      }
    } else {
      rejected++;
      const reason = line.startsWith("{") ? "MALFORMED_JSON" : "UNRECOGNIZED_LOG_SYNTAX";
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
    }
  }

  const total = events.length + rejected;
  const rate = total > 0 ? (rejected / total) * 100 : 0;

  let completeness: LogDatasetCompleteness = "COMPLETE";
  if (params.isPartialDataset) {
    completeness = "PARTIAL";
  } else if (total === 0 || rate > 50) {
    completeness = "INVALID";
  }

  return {
    events,
    totalParsed: events.length,
    totalRejected: rejected,
    rejectionRatePercent: Math.round(rate * 10) / 10,
    rejectionReasons,
    completeness,
    provider: params.provider,
    adapterSupportState: getAdapterSupportState(params.provider),
  };
}

/**
 * Streaming / Chunk processor for large log files to ensure bounded memory execution.
 */
export function* parseLogChunks(
  chunks: string[][],
  params: {
    provider: "NGINX_APACHE" | "CLOUDFLARE" | "VERCEL" | "STRUCTURED_JSON" | "CSV" | "TSV" | "AWS_CLOUDFRONT" | "AWS_ALB" | "AUTO";
    projectId: string;
    defaultHost: string;
  }
): Generator<SeoServerLogEvent[]> {
  for (const chunk of chunks) {
    const res = parseLogLines({
      lines: chunk,
      provider: params.provider,
      projectId: params.projectId,
      defaultHost: params.defaultHost,
    });
    yield res.events;
  }
}
