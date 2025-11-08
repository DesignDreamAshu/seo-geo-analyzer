import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconColor?: string;
}

export const FeatureCard = ({ icon: Icon, title, description, iconColor = "text-primary" }: FeatureCardProps) => {
  return (
    <Card>
      <CardHeader>
        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-2`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
};
