import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/dkaiDb';
import { Loader2, CheckCircle2, Package, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function ProductCreationReview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState<any>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('product-draft');
    if (!stored) {
      navigate('/create-product');
      return;
    }
    setProductData(JSON.parse(stored));
  }, [navigate]);

  const handlePublish = async () => {
    if (!user || !productData) return;

    setLoading(true);
    try {
      // Create product in database
      const { data: product, error: productError } = await db
        .from('dkai_products')
        .insert({
          seller_id: user.id,
          title: productData.title,
          description: productData.description,
          product_type: productData.product_type,
          price: parseFloat(productData.price),
          pricing_model: productData.pricing_model,
          demo_url: productData.demo_url || null,
          image_url: productData.images?.[0] || null,
          features: productData.features || [],
          tags: productData.tags || [],
          purpose: productData.purpose || null,
          target_audience: productData.target_audience || null,
          value_proposition: productData.value_proposition || null,
          problem_solved: productData.problem_solved || null,
          product_version: productData.product_version || null,
          access_details: productData.access_details || null,
          estimated_delivery: productData.estimated_delivery || null,
          production_cost: productData.production_cost ? parseFloat(productData.production_cost) : null,
          available_quantity: productData.available_quantity ? parseInt(productData.available_quantity) : null,
          refund_policy: productData.refund_policy || null,
          video_url: productData.video_url || null,
          payment_methods: JSON.stringify(productData.payment_methods || []),
          moderation_status: 'approved', // Auto-approve
          is_published: true, // Auto-publish
        })
        .select()
        .single();

      if (productError) throw productError;

      // Clear draft
      sessionStorage.removeItem('product-draft');

      toast({
        title: 'Product Published!',
        description: 'Your product is now live on the marketplace.',
      });

      navigate(`/product/${product.id}`);
    } catch (error: any) {
      console.error('Error publishing product:', error);
      toast({
        title: 'Publishing Failed',
        description: error.message || 'Failed to publish product',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!productData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/create-product')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Checklist
        </Button>

        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold">Review & Publish</h1>
          <p className="text-muted-foreground">
            Review your product details before publishing to the marketplace
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Preview
            </CardTitle>
            <CardDescription>
              This is how your product will appear to customers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Images */}
            {productData.images && productData.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {productData.images.map((url: string, i: number) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden border">
                    <img src={url} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">{productData.title}</h3>
              <div className="flex items-center gap-2">
                <Badge>{productData.product_type}</Badge>
                <Badge variant="outline">{productData.pricing_model}</Badge>
              </div>
              <p className="text-muted-foreground">{productData.description}</p>
            </div>

            <Separator />

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Price</p>
                <p className="text-2xl font-bold">${productData.price}</p>
              </div>
              {productData.available_quantity && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Available Quantity</p>
                  <p className="text-2xl font-bold">{productData.available_quantity}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Payment Methods */}
            <div>
              <p className="text-sm font-medium mb-2">Payment Methods</p>
              <div className="flex flex-wrap gap-2">
                {productData.payment_methods?.map((method: string) => (
                  <Badge key={method} variant="secondary">
                    {method.replace('_', ' ').toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Additional Details */}
            {(productData.purpose || productData.target_audience || productData.features?.length > 0) && (
              <>
                <Separator />
                <div className="space-y-4">
                  {productData.purpose && (
                    <div>
                      <p className="text-sm font-medium mb-1">Purpose</p>
                      <p className="text-sm text-muted-foreground">{productData.purpose}</p>
                    </div>
                  )}
                  {productData.target_audience && (
                    <div>
                      <p className="text-sm font-medium mb-1">Target Audience</p>
                      <p className="text-sm text-muted-foreground">{productData.target_audience}</p>
                    </div>
                  )}
                  {productData.features && productData.features.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Features</p>
                      <ul className="list-disc list-inside space-y-1">
                        {productData.features.map((feature: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground">{feature}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Publish Button */}
            <div className="flex gap-3">
              <Button onClick={handlePublish} disabled={loading} className="flex-1" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Publish to Marketplace
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/create-product')}
                disabled={loading}
              >
                Edit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
