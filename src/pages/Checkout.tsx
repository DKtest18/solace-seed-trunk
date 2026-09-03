import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/dkaiDb";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";
import { Loader2, CreditCard, ExternalLink, Shield, Tag, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BuyerPolicyAcceptance } from "@/components/BuyerPolicyAcceptance";
import { useBuyerPolicy } from "@/hooks/useBuyerPolicy";
import { formatMoney, subscriptionLabel } from "@/lib/money";
import { fetchSellerAcceptedMethods, createPayPalOrder } from "@/lib/paypalCheckout";
import { HourglassLoader } from '@/components/HourglassLoader';
import { getCheckoutOrigin } from '@/lib/checkoutOrigin';
import { REVIEW_STATUS } from '@/lib/reviewStatus';

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_amount: number; new_total: number } | null>(null);
  const [guestPolicyAccepted, setGuestPolicyAccepted] = useState(false);
  const [ipAssignmentAccepted, setIpAssignmentAccepted] = useState(false);
  const [paypalAvailable, setPaypalAvailable] = useState(false);
  const [paypalProcessing, setPaypalProcessing] = useState(false);


  const { hasAccepted: hasBuyerPolicyAcceptedUser, isLoading: loadingPolicyUser, acceptPolicy, isAccepting } = useBuyerPolicy();
  const hasBuyerPolicyAccepted = user ? hasBuyerPolicyAcceptedUser : guestPolicyAccepted;
  const loadingPolicy = user ? loadingPolicyUser : false;
  // Fee copy is buyer-neutral now (fees are seller-side only), so no fee state
  // is needed here. The seller-side rule lives in usePlatformFee.

  const productId = searchParams.get("productId");
  const tierParam = (searchParams.get("tier") || "personal").toLowerCase();
  const licenseTier: 'personal' | 'commercial' | 'agency' | 'exclusive' =
    (['personal','commercial','agency','exclusive'] as const).includes(tierParam as any)
      ? (tierParam as any) : 'personal';

  const tierPrice = (() => {
    if (!product) return 0;
    if (licenseTier === 'commercial' && product.license_commercial_enabled && product.license_commercial_price)
      return Number(product.license_commercial_price);
    if (licenseTier === 'agency' && product.license_agency_enabled && product.license_agency_price)
      return Number(product.license_agency_price);
    if (licenseTier === 'exclusive' && product.license_exclusive_enabled && product.license_exclusive_price)
      return Number(product.license_exclusive_price);
    return Number(product.license_personal_price ?? product.price) || 0;
  })();
  const tierLabel = { personal: 'Personal', commercial: 'Commercial', agency: 'Agency / White-Label', exclusive: 'Exclusive Buyout' }[licenseTier];

  useEffect(() => {
    if (!productId) {
      navigate("/marketplace");
      return;
    }

    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await db
        .from("dkai_products")
        .select("*")
        .eq("id", productId)
        .eq("review_status", REVIEW_STATUS.APPROVED)
        .eq("is_published", true)
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

  // Which providers this seller accepts (PayPal only shows when connected + enabled).
  useEffect(() => {
    if (!product?.seller_id) return;
    let cancelled = false;
    fetchSellerAcceptedMethods(product.seller_id).then((methods) => {
      if (!cancelled) setPaypalAvailable(methods.paypal);
    });
    return () => { cancelled = true; };
  }, [product?.seller_id]);

  const handlePayPalCheckout = async () => {
    setPaypalProcessing(true);
    try {
      const referralSource = sessionStorage.getItem(`ref_${product.id}`) || undefined;
      const { approveUrl } = await createPayPalOrder({
        productId: product.id,
        licenseTier: licenseTier,
        couponCode: appliedCoupon?.code,
        referralSource,
        ipAssignmentAccepted: licenseTier === 'exclusive' ? ipAssignmentAccepted : undefined,
        origin: getCheckoutOrigin(),
      });
      toast.success("Redirecting to PayPal...");
      window.location.href = approveUrl;
    } catch (error: any) {
      console.error("PayPal checkout error:", error);
      toast.error(error.message || "Failed to start PayPal checkout");
    } finally {
      setPaypalProcessing(false);
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
          subtotal: tierPrice,
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
          origin: getCheckoutOrigin(),
          couponCode: appliedCoupon?.code,
          referralSource,
          license_tier: licenseTier,
          ip_assignment_accepted: licenseTier === 'exclusive' ? ipAssignmentAccepted : undefined,
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
        // Only translate the two explicit seller-readiness responses. Broadly
        // matching words such as "Stripe" used to hide schema/API errors and
        // made a healthy connected account look disconnected.
        const sellerNotReady = /seller has not (connected|finished)|seller.*payment setup|seller.*payout account/i.test(raw);
        const productNotAvailable = /PRODUCT_NOT_AVAILABLE|product not (available|found)/i.test(raw);
        const invalidOrigin = /INVALID_ORIGIN|invalid origin/i.test(raw);
        const friendly = invalidOrigin
          ? "The secure checkout return address was rejected. Please refresh and try again."
          : sellerNotReady
          ? "This seller has not finished payment setup yet."
          : productNotAvailable
            ? "This listing is not available for purchase right now. The seller still has to publish it."
            : raw;
        throw new Error(friendly);
      }

      let checkoutUrl: URL;
      try {
        checkoutUrl = new URL(data.url);
      } catch {
        throw new Error("Stripe returned an invalid checkout URL. Please try again.");
      }

      if (checkoutUrl.protocol !== "https:") {
        throw new Error("Stripe returned an invalid checkout URL. Please try again.");
      }

      toast.success("Redirecting to secure payment page...");
      window.location.assign(checkoutUrl.toString());
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
          <HourglassLoader size={96} />
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
                <span className="text-muted-foreground">License</span>
                <span className="font-medium">{tierLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium">
                  {formatMoney(tierPrice, (product as any).currency)}
                  {subscriptionLabel(product as any) && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {subscriptionLabel(product as any)}
                    </span>
                  )}
                </span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-green-600">
                  <span>Coupon ({appliedCoupon.code})</span>
                  <span>-{formatMoney(appliedCoupon.discount_amount, (product as any).currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-4 border-t">
                <span>Total</span>
                <span>{formatMoney(appliedCoupon ? appliedCoupon.new_total : tierPrice, (product as any).currency)}</span>
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
                  Payments are processed by Stripe or PayPal and go directly to the seller's connected payment account.
{' '}
                  Any platform fee is deducted from the seller's payout and is never added to your
                  price.{' '}
                  Stripe's standard payment processing fees apply and are borne by the seller.
                </p>
              </div>

              {licenseTier === 'exclusive' && (
                <div className="mt-4 p-4 border-2 border-destructive/40 bg-destructive/5 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Exclusive Ownership Buyout
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Payment is <strong>authorized now</strong> but only <strong>captured</strong> after the seller delivers the source files and both parties sign the IP Assignment.</li>
                    <li>Once captured, this product is <strong>permanently removed</strong> from the marketplace and full ownership transfers to you.</li>
                    <li>The seller must upload complete deliverables (source, assets, docs) within their delivery window or the authorization is voided.</li>
                  </ul>
                  <label className="flex items-start gap-2 text-xs cursor-pointer pt-1 border-t border-destructive/20">
                    <Checkbox
                      checked={ipAssignmentAccepted}
                      onCheckedChange={(v) => setIpAssignmentAccepted(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      I agree to the <a href="/legal/licenses" target="_blank" className="underline">IP Assignment Agreement</a> and understand the buyout is final once payment is captured.
                    </span>
                  </label>
                </div>
              )}
            </div>
          </Card>

          {needsPolicyAcceptance ? (
            <BuyerPolicyAcceptance onAccept={handleAcceptPolicy} isLoading={isAccepting} />
          ) : (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Payment</h2>
            
              <div className="space-y-4">
                <Alert>
                  <CreditCard className="h-4 w-4" />
                  <AlertDescription>
                    You will be redirected to {paypalAvailable ? "Stripe or PayPal" : "Stripe's"} secure payment page.
                  </AlertDescription>
                </Alert>

                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <p>✓ Secure hosted checkout</p>
                  <p>✓ No card data stored on this website</p>
                  <p>✓ Payment goes directly to the seller's payout account</p>
                  <p>✓ No platform fee is added to your price</p>
                  <p>✓ The provider's standard processing fees apply (paid by the seller)</p>
                </div>

                <div className="space-y-3 pt-4">
                  <Button
                    onClick={handleCheckout}
                    disabled={processing || paypalProcessing || (licenseTier === 'exclusive' && !ipAssignmentAccepted)}
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
                  {paypalAvailable && (
                    <Button
                      onClick={handlePayPalCheckout}
                      disabled={paypalProcessing || processing || (licenseTier === 'exclusive' && !ipAssignmentAccepted)}
                      variant="secondary"
                      className="w-full"
                      size="lg"
                    >
                      {paypalProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Pay with PayPal
                        </>
                      )}
                    </Button>
                  )}
                
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