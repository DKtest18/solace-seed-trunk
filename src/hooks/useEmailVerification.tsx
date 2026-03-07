import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/dkaiDb";
import { useNavigate } from "react-router-dom";

export function useEmailVerification() {
  const { user } = useAuth();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { setEmailVerified(null); setLoading(false); return; }
    const checkVerification = async () => {
      try {
        const { data, error } = await db.from("dkai_profiles").select("email_verified").eq("id", user.id).single();
        if (error) throw error;
        setEmailVerified(data?.email_verified || false);
      } catch (error) {
        console.error("Error checking email verification:", error);
        setEmailVerified(false);
      } finally {
        setLoading(false);
      }
    };
    checkVerification();
  }, [user]);

  const requireVerification = (action: string = "perform this action") => {
    if (!user) { navigate("/"); return false; }
    if (emailVerified === false) { navigate("/verify-email"); return false; }
    return true;
  };

  return { emailVerified, loading, requireVerification };
}
