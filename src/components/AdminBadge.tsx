import { Shield } from "lucide-react";
import { useHasRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";

interface AdminBadgeProps {
  userId: string;
  className?: string;
}

export function AdminBadge({ userId, className = "" }: AdminBadgeProps) {
  const { hasRole, isLoading } = useHasRole("admin");
  const { user } = useAuth();

  // Only check if this is the current user or if we need to fetch role for another user
  const isCurrentUser = user?.id === userId;
  
  if (isLoading && isCurrentUser) return null;
  
  // For current user, use the role check
  if (isCurrentUser && !hasRole) return null;

  // For other users, we'd need to fetch their role - for now, only show for current user if admin
  if (!isCurrentUser) return null;

  return (
    <span 
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-semibold ${className}`}
      title="Administrator"
    >
      <Shield className="h-3 w-3" />
      <span>Admin</span>
    </span>
  );
}