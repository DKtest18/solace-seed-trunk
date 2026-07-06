import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/dkaiDb";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";
import { Loader2, CreditCard, ExternalLink, Shield, Tag } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { BuyerPolicyAcceptance } from "@/components/BuyerPolicyAcceptance";
import { useBuyerPolicy } from "@/hooks/useBuyerPolicy";
import { usePlatformFee } from "@/hooks/usePlatformFee";
import { formatMoney, subscriptionLabel } from "@/lib/money";

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cardPaymentsAvailable, setCardPaymentsAvailable] = useState(false);
  const [checkingCardAvailability, setCheckingCardAvailability] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_amount: number; new_total: number } | null>(null);
  const [guestPolicyAccepted, setGuestPolicyAccepted] = useState(false);

  const { hasAccepted: hasBuyerPolicyAcceptedUser, isLoading: loadingPolicyUser, acceptPolicy, isAccepting } = useBuyerPolicy();
  const hasBuyerPolicyAccepted = user ? hasBuyerPolicyAcceptedUser : guestPolicyAccepted;
  const loadingPolicy = user ? loadingPolicyUser : false;
  const { feePct, sellerPct, launchPromoActive, promoBanner } = usePlatformFee();
  const productId = searchParams.get("productId");

  useEffect(() => {
    if (!productId) {
      navigate("/marketplace");
      return;
    }

    fetchProduct();
    checkCardPaymentsAvailable();
  }, [productId]);

  const checkCardPaymentsAvailable = async () => {
    if (!productId) return;
    setCheckingCardAvailability(true);
    try {
      const { data, error } = await db.rpc("dkai_is_card_payments_allowed", {
        p_product_id: productId,
      });
      if (!error) {
        setCardPaymentsAvailable(data || false);
      } else {
        // Guests may not have access to the RPC — default to true and let
        // the checkout function surface the real reason if the seller isn't
        // connected.
        setCardPaymentsAvailable(true);
      }
    } catch (error) {
      console.error("Error checking card availability:", error);
      setCardPaymentsAvailable(true);
    } finally {
      setCheckingCardAvailability(false);
    }
  };

  const fetchProduct = async () => {
    try {
      const { data, error } = await db
        .from("dkai_products")
        .select("*")
        .eq("id", productId)
        .single();

      if (error) throw error;
      setProduct(data);
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Product could not be loaded");
      navigate("/marketplace");
    } finally {
      setLoading(false);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim() || !product) return;
    setCouponLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-coupon", {
        body: {
          code: couponCode.trim().toUpperCase(),
          seller_id: product.seller_id,
          product_id: product.id,
          subtotal: Number(product.price),
        },
      });
      if (error) throw error;
      if (!data?.valid) throw new Error(data?.error || "Invalid coupon");
      setAppliedCoupon({
        code: couponCode.trim().toUpperCase(),
        discount_amount: Number(data.discount_amount),
        new_total: Number(data.new_total),
      });
      toast.success(`Coupon applied: -$${Number(data.discount_amount).toFixed(2)}`);
    } catch (e: any) {
      setAppliedCoupon(null);
      toast.error(e.message || "Could not apply coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const referralSource = sessionStorage.getItem(`ref_${product.id}`) || undefined;
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          product_id: product.id,
          productId: product.id, // backward-compat with deployed function
          origin: window.location.origin,
          couponCode: appliedCoupon?.code,
          referralSource,
        },
      });

      // Surface the REAL error from the edge function body (not the generic non-2xx)
      let serverError: string | undefined;
      const ctx: any = (error as any)?.context;
      if (ctx && typeof ctx.clone === "function") {
        try {
          const body = await ctx.clone().json();
          serverError = body?.error || body?.message;
          console.error("create-checkout-session error body:", body);
        } catch {
          try { serverError = await ctx.clone().text(); } catch { /* ignore */ }
        }
      }
      if (!serverError && data && (data as any).error) serverError = (data as any).error;

      if (error || !data?.url) {
        const raw = serverError || (error as any)?.message || "Failed to create checkout session";
        // Human-friendly translation for known cases
        const friendly = /stripe|payout|connected|onboard/i.test(raw)
          ? "This seller has not finished payment setup yet."
          : raw;
        throw new Error(friendly);
      }

      toast.success("Redirecting to secure payment page...");
      window.location.href = data.url;
    } catch (error: any) {
      console.error("Card checkout error:", error);
      toast.error(error.message || "Failed to initiate card payment");
    } finally {
      setProcessing(false);
    }
  };

  if (loading || loadingPolicy) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!product) return null;

  const needsPolicyAcceptance = !hasBuyerPolicyAccepted && !showPayment;

  const handleAcceptPolicy = async () => {
    try {
      if (user) {
        await acceptPolicy();
      } else {
        setGuestPolicyAccepted(true);
      }
      setShowPayment(true);
      toast.success('Buyer policy accepted!');
    } catch (error) {
      console.error('Error accepting policy:', error);
      toast.error('Failed to accept policy');
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">Complete Order</h1>

        <div className="grid gap-8 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Product</span>
                <span className="font-medium">{product.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium">${Number(product.price).toFixed(2)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-green-600">
                  <span>Coupon ({appliedCoupon.code})</span>
                  <span>-${appliedCoupon.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-4 border-t">
                <span>Total</span>
                <span>${(appliedCoupon ? appliedCoupon.new_total : Number(product.price)).toFixed(2)}</span>
              </div>

              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="w-4 h-4" /> Have a coupon?
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="ENTER CODE"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={!!appliedCoupon || couponLoading}
                  />
                  {appliedCoupon ? (
                    <Button variant="outline" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}>
                      Remove
                    </Button>
                  ) : (
                    <Button onClick={applyCoupon} disabled={!couponCode.trim() || couponLoading}>
                      {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Secure Payment</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Payments are processed by Stripe and go directly to the seller's Stripe account.
                  {launchPromoActive
                    ? ` 0% platform fee — launch promo for the first 20 sales on the platform.`
                    : ` Platform fee: ${feePct}%.`}{' '}
                  Stripe's standard payment processing fees apply and are borne by the seller.
                </p>
              </div>
            </div>
          </Card>

          {needsPolicyAcceptance ? (
            <BuyerPolicyAcceptance onAccept={handleAcceptPolicy} isLoading={isAccepting} />
          ) : (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Payment</h2>
            
              <div className="space-y-4">
                {checkingCardAvailability ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : !cardPaymentsAvailable ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Card payments are not available for this product. The seller needs to connect their Stripe account first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Alert>
                      <CreditCard className="h-4 w-4" />
                      <AlertDescription>
                        You will be redirected to Stripe's secure payment page.
                      </AlertDescription>
                    </Alert>

                    <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                      <p>✓ Secure Stripe Checkout</p>
                      <p>✓ No card data stored on this website</p>
                      <p>✓ Payment goes directly to the seller's Stripe account</p>
                      <p>✓ {launchPromoActive ? '0% platform fee (launch promo — first 20 platform sales)' : `${feePct}% platform fee`}</p>
                      <p>✓ Stripe's standard processing fees apply (paid by the seller)</p>
                    </div>
                  </>
                )}

                <div className="space-y-3 pt-4">
                  <Button
                    onClick={handleCheckout}
                    disabled={processing || !cardPaymentsAvailable || checkingCardAvailability}
                    className="w-full"
                    size="lg"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Pay with Card
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="w-full"
                    disabled={processing}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}