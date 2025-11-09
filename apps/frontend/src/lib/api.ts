import type { LighthouseRunRecord } from "@/types/lighthouse";

export interface ReportModulePayload {
  id: string;
  name: string;
  score: number;
  weight: number;
  recommendations: string[];
  issues: {
    critical: number;
    warning: number;
    info: number;
  };
  lastChecked?: string | null;
}

export interface ReportHistorySnapshot {
  timestamp: string;
  overallScore: number;
}

export interface ExportPayload {
  url: string;
  country: string;
  modules: ReportModulePayload[];
  historySnapshots?: ReportHistorySnapshot[];
}

export interface SharePayload extends ExportPayload {
  ttlHours?: number;
}

export interface ShareResponse {
  token: string;
  shareUrl: string;
  expiresAt: string;
}

const configuredBase = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").trim();
export const apiBaseUrl = configuredBase.endsWith("/") ? configuredBase.replace(/\/+$/, "") : configuredBase;

export const buildApiUrl = (path: string) => `${apiBaseUrl}${path}`;
export const buildApiHref = buildApiUrl;

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 404) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return response.json() as Promise<T>;
}

export async function fetchLatestLighthouseRun(url: string): Promise<LighthouseRunRecord | null> {
  const response = await fetch(buildApiUrl(`/api/lighthouse-runs/latest?url=${encodeURIComponent(url)}`), {
    headers: { Accept: "application/json" },
  });

  if (response.status === 404) {
    return null;
  }

  return handleResponse<LighthouseRunRecord>(response);
}

export async function triggerLighthouseRun(url: string): Promise<LighthouseRunRecord> {
  const response = await fetch(buildApiUrl("/api/lighthouse-runs"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ url }),
  });

  return handleResponse<LighthouseRunRecord>(response);
}

export async function exportReport(payload: ExportPayload): Promise<Blob> {
  const response = await fetch(buildApiUrl("/api/export"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Unable to export report.");
  }

  return response.blob();
}

export async function shareReport(payload: SharePayload): Promise<ShareResponse> {
  const response = await fetch(buildApiUrl("/api/share"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<ShareResponse>(response);
}
