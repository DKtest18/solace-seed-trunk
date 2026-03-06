import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";
import { Loader2, CreditCard, ExternalLink, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BuyerPolicyAcceptance } from "@/components/BuyerPolicyAcceptance";
import { useBuyerPolicy } from "@/hooks/useBuyerPolicy";

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

  const { hasAccepted: hasBuyerPolicyAccepted, isLoading: loadingPolicy, acceptPolicy, isAccepting } = useBuyerPolicy();
  const productId = searchParams.get("productId");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!productId) {
      navigate("/marketplace");
      return;
    }

    fetchProduct();
    checkCardPaymentsAvailable();
  }, [user, productId]);

  const checkCardPaymentsAvailable = async () => {
    if (!productId) return;
    setCheckingCardAvailability(true);
    try {
      const { data, error } = await supabase.rpc("is_card_payments_allowed", {
        p_product_id: productId,
      });
      if (!error) {
        setCardPaymentsAvailable(data || false);
      }
    } catch (error) {
      console.error("Error checking card availability:", error);
    } finally {
      setCheckingCardAvailability(false);
    }
  };

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
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

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-product-checkout", {
        body: {
          productId: product.id,
          quantity: 1,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error(data.error || "Failed to create checkout session");

      toast.success("Redirecting to secure payment page...");
      window.open(data.url, "_blank");
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
      await acceptPolicy();
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
                <span className="font-medium">${product.price}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-4 border-t">
                <span>Total</span>
                <span>${product.price}</span>
              </div>

              <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Secure Payment</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  All payments are processed securely via Stripe. 90% goes to the seller, 10% platform fee.
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
                      <p>✓ 90% goes directly to seller's Stripe account</p>
                      <p>✓ 10% platform fee</p>
                      <p>✓ Instant payment confirmation</p>
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