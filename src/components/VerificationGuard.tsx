import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { Loader2 } from "lucide-react";

interface VerificationGuardProps {
  children: ReactNode;
}

export function VerificationGuard({ children }: VerificationGuardProps) {
  const { emailVerified, loading } = useEmailVerification();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && emailVerified === false) {
      navigate("/verify-email");
    }
  }, [emailVerified, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (emailVerified === false) {
    return null;
  }

  return <>{children}</>;
}