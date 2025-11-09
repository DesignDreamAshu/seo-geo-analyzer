import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { Download, Share2, RefreshCw, Loader2 } from "lucide-react";

interface DashboardHeaderProps {
  url: string;
  country: string;
  overallScore: number;
  lastChecked: Date;
  onExport: () => void;
  onShare: () => void;
  onNewAnalysis: () => void;
  isExporting?: boolean;
  isSharing?: boolean;
}

export const DashboardHeader = ({
  url,
  country,
  overallScore,
  lastChecked,
  onExport,
  onShare,
  onNewAnalysis,
  isExporting,
  isSharing,
}: DashboardHeaderProps) => {
  return (
    <Card className="relative overflow-hidden border border-white/5 bg-gradient-to-r from-[#111111] via-[#1f1f1f] to-[#5a5a5a] text-white shadow-[0_25px_65px_rgba(0,0,0,0.6)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent_60%)]" />
      <div className="relative p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 space-y-2">
            <div className="text-sm uppercase tracking-[0.3em] text-white/60">Report</div>
            <h1 className="text-3xl font-bold tracking-tight">SEO & GEO Analysis Report</h1>
            <p className="text-lg text-white/80">{url}</p>
            <div className="flex flex-wrap gap-3 text-sm text-white/70 pt-2">
              <div className="flex items-center gap-1">
                <span>Target Country:</span>
                <span className="font-medium">{country}</span>
              </div>
              <span className="text-white/40">|</span>
              <div className="flex items-center gap-1">
                <span>Last Checked:</span>
                <span className="font-medium">{lastChecked.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-white/70">Overall Score</p>
              <ProgressCircle value={overallScore} size="lg" />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={onExport}
                disabled={isExporting}
                size="sm"
                className="border border-white/15 bg-white/10 text-white hover:bg-white/20"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </>
                )}
              </Button>
              <Button
                onClick={onShare}
                disabled={isSharing}
                size="sm"
                className="border border-white/15 bg-white/10 text-white hover:bg-white/20"
              >
                {isSharing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </>
                )}
              </Button>
              <Button
                onClick={onNewAnalysis}
                size="sm"
                className="border border-white/15 bg-white/10 text-white hover:bg-white/20"
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
