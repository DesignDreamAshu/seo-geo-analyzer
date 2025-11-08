import { Button } from "@/components/ui/button";
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
    <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-8 text-primary-foreground shadow-xl">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">SEO & GEO Analysis Report</h1>
          <p className="text-primary-foreground/90 mb-4 text-lg">{url}</p>
          <div className="flex flex-wrap gap-4 text-sm text-primary-foreground/80">
            <span>Target Country: <strong>{country}</strong></span>
            <span>•</span>
            <span>Last Checked: <strong>{lastChecked.toLocaleString()}</strong></span>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-sm text-primary-foreground/80 mb-2">Overall Score</p>
            <ProgressCircle value={overallScore} size="lg" className="text-primary-foreground" />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={onExport}
              variant="secondary"
              size="sm"
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={onShare}
              variant="secondary"
              size="sm"
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              onClick={onNewAnalysis}
              variant="secondary"
              size="sm"
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              New Analysis
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
