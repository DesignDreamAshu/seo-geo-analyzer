import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { Download, Share2, RefreshCw } from "lucide-react";

interface DashboardHeaderProps {
  url: string;
  country: string;
  overallScore: number;
  lastChecked: Date;
  onExport: () => void;
  onShare: () => void;
  onNewAnalysis: () => void;
}

export const DashboardHeader = ({
  url,
  country,
  overallScore,
  lastChecked,
  onExport,
  onShare,
  onNewAnalysis,
}: DashboardHeaderProps) => {
  return (
    <Card className="border-none bg-gradient-to-r from-primary to-secondary">
      <div className="p-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex-1 space-y-1 text-primary-foreground">
            <h1 className="text-3xl font-bold tracking-tight">SEO & GEO Analysis Report</h1>
            <p className="text-lg text-primary-foreground/90">{url}</p>
            <div className="flex flex-wrap gap-2 text-sm text-primary-foreground/80 pt-2">
              <div className="flex items-center gap-1">
                <span>Target Country:</span>
                <span className="font-medium">{country}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <span>Last Checked:</span>
                <span className="font-medium">{lastChecked.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-primary-foreground/80">Overall Score</p>
              <ProgressCircle value={overallScore} size="lg" className="text-primary-foreground" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={onExport}
                variant="secondary"
                size="sm"
                className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                onClick={onShare}
                variant="secondary"
                size="sm"
                className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button
                onClick={onNewAnalysis}
                variant="secondary"
                size="sm"
                className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                New
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
