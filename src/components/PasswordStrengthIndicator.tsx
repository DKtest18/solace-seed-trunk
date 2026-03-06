import { getPasswordStrength } from "@/utils/passwordValidation";
import { Progress } from "./ui/progress";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const { strength, score } = getPasswordStrength(password);
  const percentage = (score / 7) * 100;

  const colors = {
    weak: "bg-red-500",
    medium: "bg-yellow-500",
    strong: "bg-blue-500",
    "very-strong": "bg-green-500",
  };

  const labels = {
    weak: "Weak",
    medium: "Medium",
    strong: "Strong",
    "very-strong": "Very Strong",
  };

  return (
    <div className="space-y-2">
      <Progress value={percentage} className={`h-2 ${colors[strength]}`} />
      <p className="text-sm text-muted-foreground">
        Password strength: <span className="font-semibold">{labels[strength]}</span>
      </p>
    </div>
  );
}