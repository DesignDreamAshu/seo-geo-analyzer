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
    <Card className="p-6 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground mb-1">{module.name}</h3>
          <p className="text-sm text-muted-foreground">Weight: {module.weight}%</p>
        </div>
        <ProgressCircle value={module.score} size="md" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className={cn("font-medium", status.className)}>
            {status.label}
          </Badge>
          {totalIssues > 0 && (
            <span className="text-sm text-muted-foreground">
              {totalIssues} {totalIssues === 1 ? 'issue' : 'issues'} found
            </span>
          )}
        </div>

        {totalIssues > 0 && (
          <div className="space-y-2 pt-2 border-t">
            {module.issues.critical > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-foreground">{module.issues.critical} Critical</span>
              </div>
            )}
            {module.issues.warning > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-foreground">{module.issues.warning} Warnings</span>
              </div>
            )}
            {module.issues.info > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="text-foreground">{module.issues.info} Improvements</span>
              </div>
            )}
          </div>
        )}

        {module.recommendations.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium text-foreground mb-2">Top Recommendations:</p>
            <ul className="space-y-1">
              {module.recommendations.slice(0, 2).map((rec, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button
          onClick={() => onRecheck(module.id)}
          disabled={isRechecking}
          variant="outline"
          className="w-full mt-4"
        >
          {isRechecking ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Rechecking...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Recheck Module
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
