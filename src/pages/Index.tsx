import { useState } from "react";
import { AnalyzerForm } from "@/components/AnalyzerForm";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ModuleCard } from "@/components/ModuleCard";
import { generateMockModules, calculateOverallScore } from "@/data/mockModules";
import { useToast } from "@/hooks/use-toast";
import { Globe, TrendingUp, Shield, Zap } from "lucide-react";

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-2xl font-bold text-foreground">Analyzing Your Website...</h2>
          <p className="text-muted-foreground">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (showDashboard && analysisData) {
    const overallScore = calculateOverallScore(analysisData.modules);
    
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <DashboardHeader
            url={analysisData.url}
            country={analysisData.country}
            overallScore={overallScore}
            lastChecked={analysisData.timestamp}
            onExport={handleExport}
            onShare={handleShare}
            onNewAnalysis={handleNewAnalysis}
          />

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Module Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16 space-y-6">
          <div className="inline-block p-3 bg-primary/10 rounded-2xl mb-4">
            <Globe className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-foreground mb-4">
            SEO & GEO Analyzer
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comprehensive website analysis across 10 key modules. Optimize your SEO and geographical targeting for maximum visibility.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-card p-6 rounded-xl border-2 border-border hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Modular Analysis</h3>
            <p className="text-sm text-muted-foreground">
              10 specialized modules covering every aspect of SEO and GEO optimization
            </p>
          </div>
          
          <div className="bg-card p-6 rounded-xl border-2 border-border hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-secondary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Quick Rechecks</h3>
            <p className="text-sm text-muted-foreground">
              Recheck individual modules without regenerating the entire report
            </p>
          </div>
          
          <div className="bg-card p-6 rounded-xl border-2 border-border hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Regional Precision</h3>
            <p className="text-sm text-muted-foreground">
              Target specific countries with localized SEO recommendations
            </p>
          </div>
        </div>

        {/* Analyzer Form */}
        <div className="max-w-2xl mx-auto bg-card p-8 rounded-2xl shadow-xl border-2 border-border">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
            Start Your Analysis
          </h2>
          <AnalyzerForm onAnalyze={handleAnalyze} />
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            Trusted by developers, agencies, and businesses worldwide
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
