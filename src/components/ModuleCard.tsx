import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { RefreshCw, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export const ModuleCard = ({ module, onRecheck, isRechecking }: ModuleCardProps) => {
  const getStatusBadge = (score: number) => {
    if (score >= 8) return { variant: "default" as const, label: "Excellent", className: "bg-success text-success-foreground" };
    if (score >= 6) return { variant: "default" as const, label: "Good", className: "bg-warning text-warning-foreground" };
    return { variant: "destructive" as const, label: "Needs Work" };
  };

  const status = getStatusBadge(module.score);
  const totalIssues = module.issues.critical + module.issues.warning + module.issues.info;

  return (
    <Card>
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold leading-none tracking-tight">
              {module.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              Weight: {module.weight}%
            </p>
          </div>
          <ProgressCircle value={module.score} size="md" />
        </div>

        <div className="flex items-center gap-2">
          <Badge className={cn(status.className)}>
            {status.label}
          </Badge>
          {totalIssues > 0 && (
            <span className="text-sm text-muted-foreground">
              {totalIssues} {totalIssues === 1 ? 'issue' : 'issues'}
            </span>
          )}
        </div>

        {totalIssues > 0 && (
          <div className="rounded-lg border bg-card p-3 space-y-2">
            {module.issues.critical > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span>{module.issues.critical} Critical</span>
              </div>
            )}
            {module.issues.warning > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span>{module.issues.warning} Warnings</span>
              </div>
            )}
            {module.issues.info > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>{module.issues.info} Improvements</span>
              </div>
            )}
          </div>
        )}

        {module.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recommendations</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {module.recommendations.slice(0, 2).map((rec, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span className="flex-1">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button
          onClick={() => onRecheck(module.id)}
          disabled={isRechecking}
          variant="outline"
          className="w-full"
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
    </Card>
  );
};
