import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Shield, Clock } from "lucide-react";

export default function EmailVerification() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60); // Start with 60 second cooldown
  const [initialSend, setInitialSend] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Check if already verified
    const checkVerification = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email_verified")
        .eq("id", user.id)
        .single();

      if (data?.email_verified) {
        toast({
          title: "Already verified",
          description: "Your email is already verified!",
        });
        navigate("/");
      }
    };

    checkVerification();

    // Send initial verification code
    if (!initialSend) {
      setInitialSend(true);
      handleSendCode();
    }
  }, [user, navigate]);

  const handleSendCode = async () => {
    try {
      const { error } = await supabase.functions.invoke("send-verification-code");
      
      if (error) throw error;
      
      toast({
        title: "Code sent",
        description: "A verification code has been sent to your email",
      });
      
      setCooldown(60);
    } catch (error: any) {
      console.error("Failed to send code:", error);
      toast({
        title: "Failed to send code",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter a 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-code", {
        body: { code },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success!",
        description: "Your email has been verified! You can now access all features.",
      });

      // Refresh user session
      await supabase.auth.refreshSession();
      
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
      setCode(""); // Clear the code on error
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    
    setResendLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-verification-code");

      if (error) throw error;

      toast({
        title: "Code sent",
        description: "A new verification code has been sent to your email",
      });

      setCooldown(60);
    } catch (error: any) {
      toast({
        title: "Failed to send code",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Verify Your Email</CardTitle>
          <CardDescription className="text-center">
            We've sent a 6-digit verification code to your email address.
            Please enter it below to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Verify Email
                </>
              )}
            </Button>

            <div className="text-center space-y-2">
              {cooldown > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Resend available in <strong>{cooldown}s</strong></span>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={handleResendCode}
                disabled={resendLoading || cooldown > 0}
                className="text-sm"
              >
                {resendLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Resend verification code"
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> You must verify your email before you can:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
              <li>Create or buy products</li>
              <li>Post in community</li>
              <li>Comment or review</li>
              <li>Send messages</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}