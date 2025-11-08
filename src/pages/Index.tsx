import { useState } from "react";
import { AnalyzerForm } from "@/components/AnalyzerForm";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ModuleCard } from "@/components/ModuleCard";
import { FeatureCard } from "@/components/FeatureCard";
import { generateMockModules, calculateOverallScore } from "@/data/mockModules";
import { useToast } from "@/hooks/use-toast";
import { Globe, TrendingUp, Shield, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
  const { toast } = useToast();

  const handleAnalyze = async (url: string, country: string) => {
    setAnalyzing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const modules = generateMockModules();
    setAnalysisData({
      url,
      country,
      modules,
      timestamp: new Date(),
    });
    
    setAnalyzing(false);
    setShowDashboard(true);
    
    toast({
      title: "Analysis Complete!",
      description: "Your website has been successfully analyzed.",
    });
  };

  const handleRecheck = async (moduleId: string) => {
    setRecheckingModule(moduleId);
    
    // Simulate recheck
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (analysisData) {
      const updatedModules = analysisData.modules.map(module => {
        if (module.id === moduleId) {
          return {
            ...module,
            score: Math.min(10, module.score + 0.5),
            lastChecked: new Date(),
          };
        }
        return module;
      });
      
      setAnalysisData({
        ...analysisData,
        modules: updatedModules,
      });
    }
    
    setRecheckingModule(null);
    toast({
      title: "Module Rechecked",
      description: "The module has been successfully rechecked.",
    });
  };

  const handleExport = () => {
    toast({
      title: "Exporting Report",
      description: "Your report is being prepared for download.",
    });
  };

  const handleShare = () => {
    toast({
      title: "Share Link Generated",
      description: "A shareable link has been copied to your clipboard.",
    });
  };

  const handleNewAnalysis = () => {
    setShowDashboard(false);
    setAnalysisData(null);
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
          />

          <div className="space-y-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Module Analysis</h2>
              <p className="text-muted-foreground">
                Detailed breakdown of all SEO and GEO modules
              </p>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {analysisData.modules.map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  onRecheck={handleRecheck}
                  isRechecking={recheckingModule === module.id}
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
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Globe className="h-8 w-8 text-primary" />
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
            iconColor="text-primary"
          />
          <FeatureCard
            icon={Zap}
            title="Quick Rechecks"
            description="Recheck individual modules without regenerating the entire report"
            iconColor="text-secondary"
          />
          <FeatureCard
            icon={Shield}
            title="Regional Precision"
            description="Target specific countries with localized SEO recommendations"
            iconColor="text-success"
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
