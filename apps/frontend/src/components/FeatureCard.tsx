import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => {
  return (
    <Card className="border-white/5 bg-[rgba(12,12,12,0.65)] backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
      <CardHeader>
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 mb-2">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription className="text-white/70">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
};
