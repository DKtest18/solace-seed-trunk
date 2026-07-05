import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, MessageCircle, HelpCircle, Star, Flag } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ProductReviews } from '@/components/ProductReviews';
import { ProductQA } from '@/components/ProductQA';
import { RatingDisplay } from '@/components/RatingDisplay';
import { ReportDialog } from '@/components/ReportDialog';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { ProductMediaGallery } from '@/components/ProductMediaGallery';
import { ReturnPolicyDisplay } from '@/components/ReturnPolicyDisplay';

// Track product analytics
const trackProductEvent = async (productId: string, eventType: 'view' | 'click', userId?: string, metadata?: any) => {
  try {
    const sessionId = sessionStorage.getItem('session_id') || crypto.randomUUID();
    sessionStorage.setItem('session_id', sessionId);

    await db.from('dkai_product_analytics').insert({
      product_id: productId,
      event_type: eventType,
      user_id: userId || null,
      session_id: sessionId,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error('Error tracking product event:', error);
  }
};

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [reportOpen, setReportOpen] = useState(false);

  // Capture referral ?ref=<code> for attribution + persist for checkout
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (!ref || !id) return;
    sessionStorage.setItem(`ref_${id}`, ref);
    const sessionId = sessionStorage.getItem('session_id') || crypto.randomUUID();
    sessionStorage.setItem('session_id', sessionId);
    db.from('dkai_referral_clicks').insert({
      product_id: id,
      referral_code: ref,
      visitor_session: sessionId,
    }).then(({ error }) => { if (error) console.warn('ref log failed', error); });
  }, [searchParams, id]);


  const {
    data: product,
    isLoading,
  } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_products')
        .select('*')
        .eq('id', id!)
        .single();

      if (error) throw error;

      // Track product view
      if (data && id) {
        trackProductEvent(id, 'view', user?.id);
      }

      return data;
    },
    enabled: !!id,
  });

  // Fetch seller profile
  const { data: sellerProfile } = useQuery({
    queryKey: ['seller-profile', product?.seller_id],
    queryFn: async () => {
      if (!product?.seller_id) return null;
      
      const { data, error } = await db
        .from('dkai_profiles')
        .select('id, full_name, avatar_url, username, verified, seller_type')
        .eq('id', product.seller_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!product?.seller_id,
  });

  // Fetch product rating
  const { data: productRating } = useQuery({
    queryKey: ['product-rating', id],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_reviews')
        .select('rating')
        .eq('product_id', id!);

      if (error) throw error;
      
      if (!data || data.length === 0) {
        return { average: 0, count: 0 };
      }
      
      const average = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
      return { average, count: data.length };
    },
    enabled: !!id,
  });

  const handlePurchase = () => {
    // Guests are allowed to buy — go straight to checkout.
    if (id && user) {
      trackProductEvent(id, 'click', user.id, { action: 'purchase_intent' });
    }
    navigate(`/checkout?productId=${id}`);
  };

  const handleContactSeller = () => {
    if (id && user) {
      trackProductEvent(id, 'click', user.id, { action: 'contact_seller' });
    }
    const el = document.getElementById('product-qa');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!product) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="text-muted-foreground">Product not found</p>
              <Button asChild>
                <Link to="/marketplace">Back to Marketplace</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button asChild variant="ghost" className="mb-6">
            <Link to="/marketplace">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Link>
          </Button>

          <section className="grid gap-8 lg:grid-cols-2 items-start">
            {/* Left: Product Image + Sample */}
            <div>
              <ProductMediaGallery productId={product.id} fallbackImageUrl={product.image_url} />



              {(product.sample_preview_url || product.sample_output_text) && (
                <Card className="mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Preview / Sample</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {product.sample_preview_url && (() => {
                      const url: string = product.sample_preview_url;
                      const t =
                        product.sample_preview_type ||
                        (url.match(/\.(mp4|webm|mov)$/i) ? 'video' : url.match(/\.pdf$/i) ? 'pdf' : 'image');
                      if (t === 'video') {
                        return (
                          <video
                            src={url}
                            controls
                            className="rounded-md w-full max-h-80 bg-black"
                          />
                        );
                      }
                      if (t === 'pdf') {
                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary underline"
                          >
                            View PDF sample
                          </a>
                        );
                      }
                      return (
                        <img
                          src={url}
                          alt="Product sample preview"
                          className="rounded-md w-full max-h-80 object-contain bg-muted"
                        />
                      );
                    })()}
                    {product.sample_output_text && (
                      <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded-md max-h-48 overflow-auto">
                        {product.sample_output_text}
                      </pre>
                    )}
                    {product.sample_is_watermarked && (
                      <p className="text-xs text-muted-foreground">Watermarked sample — not the full deliverable.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: Basic Info */}
            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tight">{product.title}</h1>
              
              {/* Rating display */}
              {productRating && productRating.count > 0 && (
                <div className="flex items-center gap-2">
                  <RatingDisplay 
                    rating={productRating.average} 
                    count={productRating.count} 
                    size="md"
                  />
                </div>
              )}
              
              <h2 className="text-2xl font-semibold text-primary">
                ${product.price}
              </h2>

              {product.description && (
                <p className="text-base text-muted-foreground whitespace-pre-line">
                  {product.description}
                </p>
              )}

              {(() => {
                const qty = (product as any)?.available_quantity;
                const sold = (product as any)?.quantity_sold ?? 0;
                const soldOut = qty != null && sold >= qty;
                return (
                  <div className="pt-4 flex flex-wrap gap-3">
                    <Button size="lg" className="flex-1 sm:flex-initial" onClick={handlePurchase} disabled={soldOut}>
                      {soldOut ? 'Sold out' : 'Buy Now'}
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => user ? setReportOpen(true) : navigate('/login')} className="gap-2">
                      <Flag className="h-4 w-4" /> Report
                    </Button>
                  </div>
                );
              })()}

              {product?.id && (
                <ReportDialog
                  open={reportOpen}
                  onOpenChange={setReportOpen}
                  targetType="product"
                  targetId={product.id}
                  targetName={product.title}
                />
              )}

              {/* Refund / Return policy — buyer must see BEFORE buying */}
              <ReturnPolicyDisplay product={product as any} />

              {/* Seller Profile Card */}
              {sellerProfile && (
                <Card className="mt-6">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Link to={`/profile/${sellerProfile.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <Avatar className="h-12 w-12 cursor-pointer">
                          <AvatarImage src={sellerProfile.avatar_url || undefined} />
                          <AvatarFallback>
                            {sellerProfile.full_name?.[0] || sellerProfile.username?.[0] || 'S'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm text-muted-foreground">Seller</p>
                          <p className="font-semibold hover:underline inline-flex items-center gap-1">
                            {sellerProfile.full_name || sellerProfile.username || 'Unknown'}
                            <VerifiedBadge
                              verified={(sellerProfile as any).verified}
                              founding={(sellerProfile as any).seller_type === 'founding'}
                            />
                          </p>
                        </div>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleContactSeller}
                        className="gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Ask a question
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>

          {/* FAQ Section - Only show if product has FAQs */}
          {product.faqs && Array.isArray(product.faqs) && product.faqs.length > 0 && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <HelpCircle className="h-6 w-6" />
                  Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {(product.faqs as Array<{question: string; answer: string}>).map((faq, index) => (
                    <AccordionItem key={index} value={`faq-${index}`}>
                      <AccordionTrigger className="text-left text-lg font-medium text-muted-foreground hover:text-foreground">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-base leading-relaxed pt-2">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          <ProductQA productId={product.id} sellerId={product.seller_id} />

          {/* Reviews Section */}
          <div className="mt-8">
            <ProductReviews productId={product.id} sellerId={product.seller_id} />
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
