import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, Star, Package, DollarSign } from 'lucide-react';
import { ProductRating } from '@/components/ProductRating';

export default function SellerProfile() {
  const { sellerId } = useParams();
  const navigate = useNavigate();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['seller-profile', sellerId],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_profiles')
        .select('*')
        .eq('id', sellerId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['seller-products', sellerId],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_products')
        .select('*')
        .eq('seller_id', sellerId)
        .eq('is_published', true)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ['seller-reviews', sellerId],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_reviews')
        .select(`
          *,
          dkai_products!inner (
            seller_id
          )
        `)
        .eq('dkai_products.seller_id', sellerId);

      if (error) throw error;
      return data;
    },
  });

  const { data: sales } = useQuery({
    queryKey: ['seller-sales', sellerId],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_orders')
        .select('*')
        .eq('seller_id', sellerId)
        .eq('status', 'completed');

      if (error) throw error;
      return data;
    },
  });

  if (profileLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Seller not found</h1>
        <Button onClick={() => navigate('/marketplace')}>Back to Marketplace</Button>
      </div>
    );
  }

  const avgRating = reviews && reviews.length > 0
    ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
    : 0;

  const totalSales = sales?.length || 0;
  const totalRevenue = sales?.reduce((sum: number, s: any) => sum + parseFloat(s.amount), 0) || 0;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Seller Header */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="w-24 h-24">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback>{profile.creator_name?.[0] || profile.full_name?.[0] || 'S'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold">{profile.creator_name || profile.full_name}</h1>
                {profile.seller_verification_status === 'verified' && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Verified Seller
                  </Badge>
                )}
              </div>
              {profile.bio && (
                <p className="text-muted-foreground mb-4">{profile.bio}</p>
              )}
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{avgRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({reviews?.length || 0} reviews)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  <span className="font-semibold">{products?.length || 0}</span>
                  <span className="text-muted-foreground">products</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-semibold">{totalSales}</span>
                  <span className="text-muted-foreground">sales</span>
                </div>
              </div>
            </div>
          </div>
          {profile.expanded_bio && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-sm text-muted-foreground">{profile.expanded_bio}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seller Content */}
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-6">
          {productsLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-32 bg-muted rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product: any) => (
                <Card key={product.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{product.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {product.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-full h-48 object-cover rounded-md mb-4"
                      />
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{product.product_type}</Badge>
                      <span className="text-2xl font-bold">${product.price}</span>
                    </div>
                    <ProductRating productId={product.id} />
                    <Button
                      className="w-full mt-4"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Product
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Products Yet</h3>
                <p className="text-muted-foreground">This seller hasn't listed any products</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          {reviews && reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review: any) => (
                <Card key={review.id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                  {review.comment && (
                    <CardContent>
                      <p className="text-sm">{review.comment}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Reviews Yet</h3>
                <p className="text-muted-foreground">This seller hasn't received any reviews</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
