import { Beer, Wine, Martini, GlassWater, Sparkles } from "lucide-react";

interface Props {
  type: "beer" | "wine" | "cocktail" | "shot" | "champagne";
  className?: string;
  size?: number;
}

export function DrinkIcon({ type, className, size = 20 }: Props) {
  const Icon =
    type === "beer" ? Beer :
    type === "wine" ? Wine :
    type === "cocktail" ? Martini :
    type === "shot" ? GlassWater :
    Sparkles;
  return <Icon className={className} size={size} strokeWidth={1.5} />;
}
