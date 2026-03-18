import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Star, StarOff, Search, TrendingUp, Clock, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { useTranslation } from 'react-i18next';

export default function AdminFeaturedProducts() {
  const { user } = useAuth();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole('admin');
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'trending' | 'sales' | 'rating'>('trending');

  // Fetch all products with rankings
  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products-featured', sortBy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, title, image_url, price, is_featured, trending_score, total_sales, 
          average_rating, recent_7day_sales, approval_status, is_published,
          seller_id, profiles!products_seller_id_fkey (id, full_name, username, creator_name)
        `)
        .eq('approval_status', 'approved')
        .order(
          sortBy === 'trending' ? 'trending_score' : 
          sortBy === 'sales' ? 'total_sales' : 'average_rating', 
          { ascending: false, nullsFirst: false }
        );

      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  // Fetch trending recalculation status
  const { data: lastRecalc } = useQuery({
    queryKey: ['trending-last-recalc'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_rankings')
        .select('last_calculated_at')
        .order('last_calculated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.last_calculated_at;
    },
    enabled: !!user && isAdmin,
  });

  // Toggle featured mutation
  const toggleFeatured = useMutation({
    mutationFn: async ({ productId, isFeatured }: { productId: string; isFeatured: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ is_featured: isFeatured })
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-featured'] });
      toast.success('Featured status updated');
    },
    onError: () => {
      toast.error('Failed to update featured status');
    },
  });

  // Manual recalculate trending
  const recalculateTrending = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('recalculate-trending');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products-featured'] });
      queryClient.invalidateQueries({ queryKey: ['trending-last-recalc'] });
      toast.success('Trending scores recalculated');
    },
    onError: () => {
      toast.error('Failed to recalculate trending scores');
    },
  });

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const filteredProducts = products?.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const featuredProducts = filteredProducts?.filter(p => p.is_featured);
  const trendingProducts = filteredProducts?.slice(0, 10);

  const getSellerName = (product: any) => {
    const profile = product.profiles;
    return profile?.creator_name || profile?.full_name || profile?.username || 'Unknown';
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Featured & Trending Products</h1>
            <p className="text-muted-foreground">Manage featured products and trending calculations</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => recalculateTrending.mutate()}
              disabled={recalculateTrending.isPending}
            >
              {recalculateTrending.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <TrendingUp className="h-4 w-4 mr-2" />
              )}
              Recalculate Trending
            </Button>
          </div>
        </div>

        {lastRecalc && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last trending recalculation: {new Date(lastRecalc).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="featured" className="space-y-6">
          <TabsList>
            <TabsTrigger value="featured">
              Featured ({featuredProducts?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="all">All Products</TabsTrigger>
            <TabsTrigger value="trending">Top Trending</TabsTrigger>
          </TabsList>

          {/* Search and Sort */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Button
                variant={sortBy === 'trending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('trending')}
              >
                Trending
              </Button>
              <Button
                variant={sortBy === 'sales' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('sales')}
              >
                Sales
              </Button>
              <Button
                variant={sortBy === 'rating' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('rating')}
              >
                Rating
              </Button>
            </div>
          </div>

          <TabsContent value="featured">
            <Card>
              <CardHeader>
                <CardTitle>Featured Products</CardTitle>
                <CardDescription>
                  These products appear in the homepage carousel slider
                </CardDescription>
              </CardHeader>
              <CardContent>
                {featuredProducts?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No featured products. Add products from the "All Products" tab.
                  </p>
                ) : (
                  <ProductTable 
                    products={featuredProducts || []} 
                    toggleFeatured={toggleFeatured}
                    getSellerName={getSellerName}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Approved Products</CardTitle>
                <CardDescription>
                  Click the star icon to feature/unfeature products
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ProductTable 
                    products={filteredProducts || []} 
                    toggleFeatured={toggleFeatured}
                    getSellerName={getSellerName}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trending">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Trending Products</CardTitle>
                <CardDescription>
                  Based on recent sales, ratings, and engagement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductTable 
                  products={trendingProducts || []} 
                  toggleFeatured={toggleFeatured}
                  getSellerName={getSellerName}
                  showRank
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ProductTable({ 
  products, 
  toggleFeatured, 
  getSellerName,
  showRank = false 
}: { 
  products: any[]; 
  toggleFeatured: any;
  getSellerName: (p: any) => string;
  showRank?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showRank && <TableHead className="w-16">#</TableHead>}
          <TableHead className="w-16">Image</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Seller</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Sales</TableHead>
          <TableHead className="text-right">7d Sales</TableHead>
          <TableHead className="text-right">Rating</TableHead>
          <TableHead className="text-right">Trending</TableHead>
          <TableHead className="w-24 text-center">Featured</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product, index) => (
          <TableRow key={product.id}>
            {showRank && (
              <TableCell>
                <Badge variant={index < 3 ? 'default' : 'secondary'}>
                  {index + 1}
                </Badge>
              </TableCell>
            )}
            <TableCell>
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.title}
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                  No img
                </div>
              )}
            </TableCell>
            <TableCell>
              <div className="font-medium">{product.title}</div>
              {!product.is_published && (
                <Badge variant="outline" className="text-xs">Unpublished</Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {getSellerName(product)}
            </TableCell>
            <TableCell className="text-right font-medium">
              ${product.price}
            </TableCell>
            <TableCell className="text-right">
              {product.total_sales || 0}
            </TableCell>
            <TableCell className="text-right">
              <Badge variant={product.recent_7day_sales > 0 ? 'default' : 'secondary'}>
                {product.recent_7day_sales || 0}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {product.average_rating ? product.average_rating.toFixed(1) : '-'}
            </TableCell>
            <TableCell className="text-right">
              {product.trending_score?.toFixed(0) || 0}
            </TableCell>
            <TableCell className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleFeatured.mutate({ 
                  productId: product.id, 
                  isFeatured: !product.is_featured 
                })}
                disabled={toggleFeatured.isPending}
              >
                {product.is_featured ? (
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                ) : (
                  <StarOff className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
