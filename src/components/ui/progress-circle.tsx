import { cn } from "@/lib/utils";

interface ProgressCircleProps {
  value: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export const ProgressCircle = ({ 
  value, 
  size = "md", 
  showLabel = true,
  className 
}: ProgressCircleProps) => {
  const percentage = Math.min(100, Math.max(0, value * 10));
  
  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32"
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl"
  };

  const getColor = (val: number) => {
    if (val >= 8) return "text-success";
    if (val >= 6) return "text-warning";
    return "text-destructive";
  };

  const radius = size === "sm" ? 28 : size === "md" ? 40 : 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", sizeClasses[size], className)}>
      <svg className="transform -rotate-90" width="100%" height="100%">
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          className="text-muted"
        />
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn("transition-all duration-500", getColor(value))}
        />
      </svg>
      {showLabel && (
        <span className={cn("absolute font-bold", textSizes[size], getColor(value))}>
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
};
