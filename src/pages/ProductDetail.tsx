import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, MessageCircle, HelpCircle, Star } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ProductReviews } from '@/components/ProductReviews';
import { RatingDisplay } from '@/components/RatingDisplay';

// Track product analytics
const trackProductEvent = async (productId: string, eventType: 'view' | 'click', userId?: string, metadata?: any) => {
  try {
    const sessionId = sessionStorage.getItem('session_id') || crypto.randomUUID();
    sessionStorage.setItem('session_id', sessionId);

    await supabase.from('product_analytics').insert({
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

  const {
    data: product,
    isLoading,
  } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
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
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
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
      const { data, error } = await supabase
        .from('reviews')
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
    if (!user) {
      navigate('/login');
      return;
    }

    // Track purchase intent click
    if (id) {
      trackProductEvent(id, 'click', user.id, { action: 'purchase_intent' });
    }

    navigate(`/checkout?productId=${id}`);
  };

  const handleContactSeller = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!product?.seller_id) return;

    // Track contact seller click
    if (id) {
      trackProductEvent(id, 'click', user.id, { action: 'contact_seller' });
    }

    navigate(`/messages?seller=${product.seller_id}`);
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
            {/* Left: Product Image */}
            <div>
              {product.image_url ? (
                <div className="aspect-video bg-muted overflow-hidden rounded-lg">
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  No image available
                </div>
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

              <div className="pt-4 flex gap-3">
                <Button size="lg" className="flex-1 sm:flex-initial" onClick={handlePurchase}>
                  Buy Now
                </Button>
              </div>

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
                          <p className="font-semibold hover:underline">
                            {sellerProfile.full_name || sellerProfile.username || 'Unknown'}
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
                        Message
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

          {/* Reviews Section */}
          <div className="mt-8">
            <ProductReviews productId={product.id} sellerId={product.seller_id} />
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
