import type { ModuleIssues, ModuleResult } from "./types";

export const clampScore = (value: number, min = 0, max = 10) => {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
};

export const roundScore = (value: number, precision = 2) => {
  return Number(clampScore(value).toFixed(precision));
};

export const calculateWeightedScore = (modules: Array<Pick<ModuleResult, "score" | "weight">>) => {
  if (!modules.length) return 0;
  const totals = modules.reduce(
    (acc, module) => {
      acc.weight += module.weight;
      acc.sum += module.score * module.weight;
      return acc;
    },
    { weight: 0, sum: 0 },
  );
  if (totals.weight === 0) return 0;
  return roundScore(totals.sum / totals.weight);
};

export const deriveCountryFromLocale = (locale?: string | null) => {
  if (!locale) return null;
  const match = String(locale).replace("-", "_").split("_");
  if (match.length < 2) return null;
  const country = match.pop();
  if (!country) return null;
  const normalized = country.trim().toUpperCase();
  return normalized.length >= 2 ? normalized.slice(-2) : null;
};

export const normalizeHeaders = (headers: Record<string, string | string[] | undefined>): Record<string, string> => {
  const normalized: Record<string, string> = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
    if (!key) return;
    const headerKey = key.toLowerCase();
    if (Array.isArray(value)) {
      normalized[headerKey] = value.join(", ");
    } else if (typeof value === "string") {
      normalized[headerKey] = value;
    }
  });
  return normalized;
};

export const createIssueTracker = (initial?: Partial<ModuleIssues>): ModuleIssues => ({
  critical: initial?.critical ?? 0,
  warning: initial?.warning ?? 0,
  info: initial?.info ?? 0,
});

export const incrementIssue = (issues: ModuleIssues, severity: keyof ModuleIssues) => {
  issues[severity] += 1;
};

export const formatNumber = (value: number | null | undefined, digits = 2) => {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
};
