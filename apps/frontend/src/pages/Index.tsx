import { useState, useEffect } from "react";
import { AnalyzerForm } from "@/components/AnalyzerForm";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ModuleCard } from "@/components/ModuleCard";
import { FeatureCard } from "@/components/FeatureCard";
import { generateMockModules, calculateOverallScore } from "@/data/mockModules";
import { useToast } from "@/hooks/use-toast";
import { useLighthouseRun } from "@/hooks/use-lighthouse";
import { Globe, TrendingUp, Shield, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { exportReport, shareReport, buildApiUrl, buildApiHref } from "@/lib/api";

type HistorySnapshot = {
  timestamp: string;
  overallScore: number;
};

const Index = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [analysisData, setAnalysisData] = useState<{
    url: string;
    country: string;
    modules: ReturnType<typeof generateMockModules>;
    timestamp: Date;
  } | null>(null);
  const [recheckingModule, setRecheckingModule] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState(false);
  const [historySnapshots, setHistorySnapshots] = useState<HistorySnapshot[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();
  const lighthouse = useLighthouseRun(showDashboard && analysisData ? analysisData.url : null);
  useEffect(() => {
    if (!showDashboard) return;
    const source = new EventSource(buildApiHref("/api/events"));
    const handleToast = (event: MessageEvent) => {
      try {
        const detail = JSON.parse(event.data);
        if (detail?.title) {
          toast({
            title: detail.title,
            description: detail.description,
            variant: detail.variant,
          });
        }
      } catch {
        // ignore malformed SSE payloads
      }
    };
    source.addEventListener("toast", handleToast);
    return () => {
      source.removeEventListener("toast", handleToast);
      source.close();
    };
  }, [showDashboard, toast]);

  const handleAnalyze = async (url: string, country: string) => {
    setAnalyzing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const modules = generateMockModules();
    const overallScore = Number(calculateOverallScore(modules).toFixed(2));
    const timestamp = new Date();
    setAnalysisData({
      url,
      country,
      modules,
      timestamp,
    });
    setHistorySnapshots([{ timestamp: timestamp.toISOString(), overallScore }]);
    
    setAnalyzing(false);
    setShowDashboard(true);
    
    toast({
      title: "Analysis Complete!",
      description: "Your website has been successfully analyzed.",
    });
  };

  const handleRecheck = async (moduleId: string) => {
    if (!analysisData) {
      toast({
        title: "Cannot recheck",
        description: "Run an analysis before rechecking a module.",
        variant: "destructive",
      });
      return;
    }

    setRecheckingModule(moduleId);
    try {
      const payload = buildReportPayload();
      const response = await fetch(buildApiUrl(`/api/recheck/${moduleId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: payload.modules }),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || "Recheck failed.");
      }

      const result = await response.json();

      setAnalysisData((prev) => {
        if (!prev) return prev;
        const updatedModules = prev.modules.map((module) =>
          module.id === moduleId
            ? {
                ...module,
                score: result.module?.score ?? module.score,
                recommendations: result.module?.recommendations ?? module.recommendations,
                issues: result.module?.issues ?? module.issues,
                lastChecked: result.module?.lastChecked ? new Date(result.module.lastChecked) : new Date(),
              }
            : module,
        );
        return {
          ...prev,
          modules: updatedModules,
          timestamp: result.timestamp ? new Date(result.timestamp) : new Date(),
        };
      });

      if (result.overallScore != null) {
        setHistorySnapshots((prev) => [
          ...prev.slice(-9),
          {
            timestamp: result.timestamp ?? new Date().toISOString(),
            overallScore: Number(result.overallScore),
          },
        ]);
      }
    } catch (error) {
      toast({
        title: "Recheck failed",
        description: error instanceof Error ? error.message : "Unable to recheck module.",
        variant: "destructive",
      });
    } finally {
      setRecheckingModule(null);
    }
  };

  const buildReportPayload = () => {
    if (!analysisData) {
      throw new Error("No analysis available.");
    }

    const snapshots =
      historySnapshots.length > 0
        ? historySnapshots
        : [
            {
              timestamp: analysisData.timestamp.toISOString(),
              overallScore: Number(calculateOverallScore(analysisData.modules).toFixed(2)),
            },
          ];

    return {
      url: analysisData.url,
      country: analysisData.country,
      modules: analysisData.modules.map((module) => ({
        id: module.id,
        name: module.name,
        score: module.score,
        weight: module.weight,
        recommendations: module.recommendations,
        issues: module.issues,
        lastChecked: module.lastChecked ? new Date(module.lastChecked).toISOString() : analysisData.timestamp.toISOString(),
      })),
      historySnapshots: snapshots,
    };
  };

  const handleExport = async () => {
    if (!analysisData) {
      toast({
        title: "Nothing to export",
        description: "Run an analysis before exporting a report.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const payload = buildReportPayload();
      const blob = await exportReport(payload);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `seo-geo-report-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export ready",
        description: "PDF download has started.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export report.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!analysisData) {
      toast({
        title: "Nothing to share",
        description: "Run an analysis before sharing a report.",
        variant: "destructive",
      });
      return;
    }

    setIsSharing(true);
    try {
      const payload = buildReportPayload();
      const response = await shareReport({ ...payload, ttlHours: 48 });
      await navigator.clipboard.writeText(response.shareUrl).catch(() => {
        // fallback handled below by showing url
      });
      toast({
        title: "Share link ready",
        description: response.shareUrl,
      });
    } catch (error) {
      toast({
        title: "Share failed",
        description: error instanceof Error ? error.message : "Unable to create share link.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleNewAnalysis = () => {
    setShowDashboard(false);
    setAnalysisData(null);
    setHistorySnapshots([]);
  };

  if (analyzing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <CardTitle>Analyzing Your Website</CardTitle>
            <CardDescription>
              Running comprehensive SEO and GEO analysis across all modules
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (showDashboard && analysisData) {
    const overallScore = calculateOverallScore(analysisData.modules);
    const sortedModules = sortAscending
      ? [...analysisData.modules].sort((a, b) => a.score - b.score)
      : analysisData.modules;
    
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
          <DashboardHeader
            url={analysisData.url}
            country={analysisData.country}
            overallScore={overallScore}
            lastChecked={analysisData.timestamp}
            onExport={handleExport}
            onShare={handleShare}
            onNewAnalysis={handleNewAnalysis}
            isExporting={isExporting}
            isSharing={isSharing}
          />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Module Analysis</h2>
                <p className="text-muted-foreground">
                  Detailed breakdown of all SEO and GEO modules
                </p>
              </div>
              <label className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>Score ascending</span>
                <Switch checked={sortAscending} onCheckedChange={(checked) => setSortAscending(checked)} />
              </label>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {sortedModules.map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  onRecheck={handleRecheck}
                  isRechecking={recheckingModule === module.id}
                  lighthouseMetrics={
                    module.id === "performance"
                      ? {
                          run: lighthouse.run,
                          isLoading: lighthouse.isLoading || lighthouse.isFetching,
                          isRunning: lighthouse.isRunning,
                          onRun: lighthouse.runTest,
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-6xl space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/10 mb-4">
            <Globe className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            SEO & GEO Analyzer
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comprehensive website analysis across 10 key modules. Optimize your SEO and geographical targeting for maximum visibility.
          </p>
        </div>

        <Separator />

        {/* Features Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={TrendingUp}
            title="Modular Analysis"
            description="10 specialized modules covering every aspect of SEO and GEO optimization"
          />
          <FeatureCard
            icon={Zap}
            title="Quick Rechecks"
            description="Recheck individual modules without regenerating the entire report"
          />
          <FeatureCard
            icon={Shield}
            title="Regional Precision"
            description="Target specific countries with localized SEO recommendations"
          />
        </div>

        {/* Analyzer Form */}
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Start Your Analysis</CardTitle>
              <CardDescription className="text-center">
                Enter your website URL and select your target country to begin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyzerForm onAnalyze={handleAnalyze} />
            </CardContent>
          </Card>
        </div>

        {/* Footer Info */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Trusted by developers, agencies, and businesses worldwide
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
