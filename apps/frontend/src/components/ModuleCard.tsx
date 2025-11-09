import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  GaugeCircle,
  Loader2,
  ChevronDown,
  Download,
  BarChart2,
  CircleHelp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LighthouseMetricSummary, LighthouseRunRecord } from "@/types/lighthouse";
import { buildApiHref } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getWeightRationale } from "@/data/weight-rationale";

export interface ModuleData {
  id: string;
  name: string;
  score: number;
  weight: number;
  issues: {
    critical: number;
    warning: number;
    info: number;
  };
  recommendations: string[];
  lastChecked?: Date;
}

interface ModuleCardProps {
  module: ModuleData;
  onRecheck: (moduleId: string) => void;
  isRechecking?: boolean;
  lighthouseMetrics?: {
    run?: LighthouseRunRecord | null;
    isLoading?: boolean;
    isRunning?: boolean;
    onRun?: () => void | Promise<void>;
  };
}

const formatMsToSeconds = (value: number | null) => {
  if (value == null) return "—";
  return `${(value / 1000).toFixed(2)}s`;
};

const formatMs = (value: number | null) => {
  if (value == null) return "—";
  return `${Math.round(value)}ms`;
};

const formatScore = (value: number | null) => {
  if (value == null) return "—";
  return `${Math.round(value)}`;
};

const formatCls = (value: number | null) => {
  if (value == null) return "—";
  return value.toFixed(2);
};

const formatTimestamp = (value?: Date | string) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

type MetricKey = "score" | "lcp" | "cls" | "inp" | "tbt";
type MetricSummary = Pick<LighthouseMetricSummary, MetricKey>;

const metricConfig: Record<
  MetricKey,
  {
    label: string;
    formatter: (value: number | null) => string;
    thresholds: { good: number; warn: number };
    largerIsBetter?: boolean;
  }
> = {
  score: {
    label: "Performance Score",
    formatter: formatScore,
    thresholds: { good: 90, warn: 50 },
    largerIsBetter: true,
  },
  lcp: {
    label: "Largest Contentful Paint",
    formatter: formatMsToSeconds,
    thresholds: { good: 2500, warn: 4000 },
  },
  cls: {
    label: "Cumulative Layout Shift",
    formatter: formatCls,
    thresholds: { good: 0.1, warn: 0.25 },
  },
  inp: {
    label: "Interaction to Next Paint",
    formatter: formatMs,
    thresholds: { good: 200, warn: 500 },
  },
  tbt: {
    label: "Total Blocking Time",
    formatter: formatMs,
    thresholds: { good: 200, warn: 600 },
  },
};

type Severity = "good" | "warn" | "poor" | "unknown";

const severityStyles: Record<Severity, { dot: string; text: string; label: string }> = {
  good: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Good" },
  warn: { dot: "bg-amber-300", text: "text-amber-300", label: "Needs improvement" },
  poor: { dot: "bg-rose-400", text: "text-rose-300", label: "Poor" },
  unknown: { dot: "bg-white/40", text: "text-white/50", label: "Unknown" },
};

const metricDescriptions: Record<MetricKey, string> = {
  score: "Performance score is Lighthouse's aggregate across core metrics. Aim for 90+.",
  lcp: "Largest Contentful Paint measures loading speed. Keep it under 2.5s for good UX.",
  cls: "Cumulative Layout Shift captures visual stability. Scores below 0.1 are ideal.",
  inp: "Interaction to Next Paint reflects responsiveness. Under 200ms feels instant.",
  tbt: "Total Blocking Time highlights main-thread blocking. Reduce to improve INP.",
};

const evaluateMetric = (key: MetricKey, value: number | null): Severity => {
  if (value == null) return "unknown";
  const descriptor = metricConfig[key];

  if (descriptor.largerIsBetter) {
    if (value >= descriptor.thresholds.good) return "good";
    if (value >= descriptor.thresholds.warn) return "warn";
    return "poor";
  }

  if (value <= descriptor.thresholds.good) return "good";
  if (value <= descriptor.thresholds.warn) return "warn";
  return "poor";
};

export const ModuleCard = ({ module, onRecheck, isRechecking, lighthouseMetrics }: ModuleCardProps) => {
  const [expandedSeverity, setExpandedSeverity] = useState<string | null>(null);
  const toggleSeverity = (label: string) => {
    setExpandedSeverity((prev) => (prev === label ? null : label));
  };

  const getStatusBadge = (score: number) => {
    if (score >= 8) {
      return {
        label: "Excellent",
        className: "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30",
      };
    }
    if (score >= 6) {
      return {
        label: "Good",
        className: "bg-amber-950/60 text-amber-300 border border-amber-400/30",
      };
    }
    return {
      label: "Needs Work",
      className: "bg-orange-950/60 text-orange-300 border border-orange-500/30",
    };
  };

  const status = getStatusBadge(module.score);
  const totalIssues = module.issues.critical + module.issues.warning + module.issues.info;

  const issueBreakdown = [
    {
      label: "Critical",
      value: module.issues.critical,
      icon: AlertCircle,
      color: "text-[#FF8F66]",
      bg: "bg-[#2C1812]",
    },
    {
      label: "Warnings",
      value: module.issues.warning,
      icon: AlertTriangle,
      color: "text-[#F6C049]",
      bg: "bg-[#2A2111]",
    },
    {
      label: "Improvements",
      value: module.issues.info,
      icon: CheckCircle2,
      color: "text-[#3DD598]",
      bg: "bg-[#13241B]",
    },
  ].filter((item) => item.value > 0);

  return (
    <Card className="border-white/5 bg-[rgba(12,12,12,0.75)] backdrop-blur-sm shadow-[0_20px_45px_rgba(0,0,0,0.55)]">
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold leading-none tracking-tight text-white">
              {module.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <span>Weight: {module.weight}%</span>
              {getWeightRationale(module.id) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-white/80 underline decoration-dotted focus:outline-none"
                    >
                      <CircleHelp className="h-3 w-3" />
                      Why this weight?
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs text-white">
                    {getWeightRationale(module.id)}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {module.lastChecked && (
              <p className="text-xs text-white/45">
                Last checked {formatTimestamp(module.lastChecked) ?? "recently"}
              </p>
            )}
          </div>
          <ProgressCircle value={module.score} size="md" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider", status.className)}>
            {status.label}
          </Badge>
          {totalIssues > 0 && (
            <span className="text-sm text-white/70">
              {totalIssues} {totalIssues === 1 ? "issue" : "issues"}
            </span>
          )}
        </div>

        {issueBreakdown.length > 0 && (
          <div className="rounded-xl border border-white/5 bg-white/5 p-3 space-y-2">
            {issueBreakdown.map(({ label, value, icon: Icon, color, bg }) => {
              const isExpanded = expandedSeverity === label;
              return (
                <button
                  type="button"
                  key={label}
                  onClick={() => toggleSeverity(label)}
                  className={cn(
                    "w-full rounded-lg border border-transparent px-3 py-2 text-left text-sm text-white/80 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                    bg,
                    isExpanded && "border-white/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", color)} />
                      <span>{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-semibold", color)}>{value}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-white/80 transition-transform",
                          isExpanded ? "rotate-180" : "rotate-0",
                        )}
                      />
                    </div>
                  </div>
                  {isExpanded && module.recommendations.length > 0 && (
                    <div className="mt-3 space-y-2 border-l border-white/10 pl-3 text-sm text-white/70">
                      <p>
                        Address these{" "}
                        <span className="font-semibold text-white">{label.toLowerCase()}</span> items impacting{" "}
                        <span className="font-semibold text-white">{module.name}</span>.
                      </p>
                      <ul className="space-y-2">
                        {module.recommendations.map((rec, idx) => (
                          <li key={`${label}-${idx}`} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/50" />
                            <span className="flex-1">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {module.id === "performance" && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 justify-center border-white/15 bg-white/5 text-white hover:bg-white/15"
                    disabled={!lighthouseMetrics?.run || lighthouseMetrics.isRunning}
                  >
                    <BarChart2 className="mr-2 h-4 w-4" />
                    View Lighthouse Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl overflow-hidden border border-white/10 bg-[#0f0f0f] text-white sm:max-h-[85vh] sm:overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">Lighthouse Metrics</DialogTitle>
                    {lighthouseMetrics?.run?.createdAt && (
                      <p className="text-sm text-white/70">
                        Last run{" "}
                        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
                          new Date(lighthouseMetrics.run.createdAt),
                        )}
                      </p>
                    )}
                  </DialogHeader>
                  {lighthouseMetrics?.run ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        {(["mobile", "desktop"] as const).map((formFactor) => {
                          const summary = lighthouseMetrics.run?.[formFactor] as MetricSummary | undefined;
                          return (
                            <div key={formFactor} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                              <div className="flex items-center justify-between">
                                <h5 className="text-base font-semibold capitalize">{formFactor}</h5>
                                <span className="text-xs uppercase tracking-wide text-white/60">
                                  {formFactor === "mobile" ? "Phone" : "Desktop"}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {(Object.keys(metricConfig) as MetricKey[]).map((metricKey) => {
                                  const descriptor = metricConfig[metricKey];
                                  const value = summary?.[metricKey] ?? null;
                                  const severity = evaluateMetric(metricKey, value);
                                  const styles = severityStyles[severity];
                                  return (
                                    <Tooltip key={`${formFactor}-${metricKey}`}>
                                      <TooltipTrigger asChild>
                                        <div className="flex cursor-help items-center justify-between rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm transition hover:border-white/30">
                                          <div className="flex items-center gap-2">
                                            <span className={cn("h-2.5 w-2.5 rounded-full", styles.dot)} />
                                            <div className="flex flex-col leading-tight">
                                              <span className="font-medium">{descriptor.label}</span>
                                              <span className={cn("text-xs", styles.text)}>{styles.label}</span>
                                            </div>
                                          </div>
                                          <span className="font-semibold">{descriptor.formatter(value)}</span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" sideOffset={6} className="max-w-xs text-xs">
                                        {metricDescriptions[metricKey]}
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                {(["html", "pdf"] as const).map((format) => (
                                  <Button
                                    key={`${formFactor}-${format}`}
                                    variant="outline"
                                    asChild
                                    className="justify-center border-white/20 bg-black/40 text-xs hover:bg-white/10"
                                  >
                                    <a
                                      href={buildApiHref(
                                        `/api/lighthouse-runs/${lighthouseMetrics.run!.id}/report?device=${formFactor}&format=${format}`,
                                      )}
                                      target={format === "html" ? "_blank" : "_self"}
                                      rel="noopener noreferrer"
                                      download={format !== "html"}
                                    >
                                      <Download className="mr-2 inline h-3.5 w-3.5" />
                                      {format === "html" ? "View Report" : format.toUpperCase()}
                                    </a>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">No Lighthouse data yet. Run a test to populate metrics.</p>
                  )}
                </DialogContent>
              </Dialog>

              <Button
                onClick={() => void lighthouseMetrics?.onRun?.()}
                disabled={!lighthouseMetrics?.onRun || lighthouseMetrics.isRunning}
                className="flex-1 justify-center border border-white/15 bg-white/10 text-white hover:bg-white/20"
              >
                {lighthouseMetrics?.isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <GaugeCircle className="mr-2 h-4 w-4" />
                    Run Lighthouse Test
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => onRecheck(module.id)}
            disabled={isRechecking}
            className="w-full justify-center border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
          >
            {isRechecking ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Rechecking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Recheck Module
              </>
            )}
          </Button>

        </div>
      </div>
    </Card>
  );
};

