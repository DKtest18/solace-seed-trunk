import { AdminBadge } from "./AdminBadge";
import { VerifiedBadge } from "./VerifiedBadge";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/dkaiDb";

interface UserDisplayNameProps {
  userId: string;
  username?: string;
  className?: string;
  showBadges?: boolean;
}

export function UserDisplayName({ 
  userId, 
  username, 
  className = "",
  showBadges = true 
}: UserDisplayNameProps) {
  const { data: profile } = useQuery({
    queryKey: ["profile-verification", userId],
    queryFn: async () => {
      const { data, error } = await db
        .from("dkai_profiles")
        .select("email_verified, username")
        .eq("id", userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const displayName = username || profile?.username || "User";

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{displayName}</span>
      {showBadges && (
        <>
          {profile?.email_verified && <VerifiedBadge />}
          <AdminBadge userId={userId} />
        </>
      )}
    </span>
  );
}
