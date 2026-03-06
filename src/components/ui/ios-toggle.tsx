import * as React from "react";
import { cn } from "@/lib/utils";

interface IOSToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
}

export function IOSToggle({
  checked,
  onCheckedChange,
  disabled = false,
  size = "md",
  label,
  description,
}: IOSToggleProps) {
  const sizeClasses = {
    sm: { track: "w-10 h-6", thumb: "w-4 h-4", translate: "translate-x-4" },
    md: { track: "w-14 h-8", thumb: "w-6 h-6", translate: "translate-x-6" },
    lg: { track: "w-16 h-9", thumb: "w-7 h-7", translate: "translate-x-7" },
  };

  const { track, thumb, translate } = sizeClasses[size];

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          track,
          checked 
            ? "bg-green-500 shadow-inner" 
            : "bg-muted-foreground/30 shadow-inner",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute left-1 inline-block rounded-full bg-white shadow-lg ring-0 transition-transform duration-300 ease-in-out",
            thumb,
            checked && translate
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className={cn("font-medium", disabled && "opacity-50")}>
              {label}
            </span>
          )}
          {description && (
            <span className={cn("text-sm text-muted-foreground", disabled && "opacity-50")}>
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
