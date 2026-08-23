import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/dkaiDb';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Loader2, TrendingUp, Star, Package, Flame, Award, Tag } from 'lucide-react';
import { RatingDisplay } from '@/components/RatingDisplay';
import { AppLayout } from '@/components/AppLayout';
import { REVIEW_STATUS } from '@/lib/reviewStatus';

type SortOption = 'most-sales' | 'highest-rated' | 'price-low' | 'price-high' | 'newest' | 'trending';

interface TopProduct {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  product_type: string;
  pricing_model: string;
  total_sales: number;
  trending_score: number;
  recent_7day_sales: number;
  is_featured: boolean;
  is_subscription: boolean;
  average_rating: number;
  ratings_count: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  seller_id: string;
  created_at: string;
}

export default function TopProducts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('most-sales');

  const { data: products, isLoading } = useQuery({
    queryKey: ['top-products', sortBy],
    queryFn: async () => {
      let query = db
        .from('dkai_products')
        .select(`
          id,
          title,
          description,
          price,
          image_url,
          product_type,
          pricing_model,
          total_sales,
          trending_score,
          recent_7day_sales,
          is_featured,
          is_subscription,
          average_rating,
          ratings_count,
          category_id,
          seller_id,
          created_at,
          product_categories (
            name,
            icon
          )
        `)
        .eq('is_published', true)
        .eq('review_status', REVIEW_STATUS.APPROVED);

      // Apply sorting
      switch (sortBy) {
        case 'most-sales':
          query = query.order('total_sales', { ascending: false });
          break;
        case 'highest-rated':
          query = query.order('average_rating', { ascending: false });
          break;
        case 'price-low':
          query = query.order('price', { ascending: true });
          break;
        case 'price-high':
          query = query.order('price', { ascending: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'trending':
          query = query.order('trending_score', { ascending: false });
          break;
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      
      // Transform data to include category info
      return data?.map((product: any) => ({
        ...product,
        category_name: (product as any).product_categories?.name || null,
        category_icon: (product as any).product_categories?.icon || null,
      })) as TopProduct[];
    },
    staleTime: 1000 * 60 * 5, // 5 minute cache
  });

  // Calculate top 10% for trending badge based on 7-day sales
  const sortedByRecent = [...(products || [])].sort((a, b) => 
    (b.recent_7day_sales || 0) - (a.recent_7day_sales || 0)
  );
  const top10PercentCount = Math.max(1, Math.ceil(sortedByRecent.length * 0.1));
  const trendingIds = new Set(sortedByRecent.slice(0, top10PercentCount).map(p => p.id));

  const isTrending = (productId: string) => trendingIds.has(productId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="container mx-auto px-6 py-10 max-w-[1600px]">
          {/* Header */}
          <div className="mb-10 p-6 rounded-2xl backdrop-blur-md bg-background/80 border border-border/50">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                {t('topProducts.title')}
              </h1>
            </div>
            <p className="text-lg text-foreground/70 max-w-3xl">
              {t('topProducts.subtitle')}
            </p>
          </div>

          {/* Sort Controls */}
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm text-muted-foreground">
              {products?.length || 0} {t('topProducts.title').toLowerCase()}
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('marketplace.sortBy.label')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="most-sales">{t('marketplace.sortBy.mostSales')}</SelectItem>
                <SelectItem value="trending">{t('marketplace.sortBy.trending')}</SelectItem>
                <SelectItem value="highest-rated">{t('marketplace.sortBy.highestRated')}</SelectItem>
                <SelectItem value="price-low">{t('marketplace.sortBy.priceLow')}</SelectItem>
                <SelectItem value="price-high">{t('marketplace.sortBy.priceHigh')}</SelectItem>
                <SelectItem value="newest">{t('marketplace.sortBy.newest')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Products Grid */}
          {products && products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product, index) => (
                <Card 
                  key={product.id}
                  className="flex flex-col hover:shadow-xl transition-all hover:scale-[1.02] duration-300 backdrop-blur-md bg-background/80 border-border/50 rounded-2xl overflow-hidden cursor-pointer relative"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  {/* Ranking Badge */}
                  {index < 3 && (
                    <div className="absolute top-3 left-3 z-10">
                      <Badge 
                        className={`text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : 
                          index === 1 ? 'bg-gray-400' : 
                          'bg-amber-600'
                        }`}
                      >
                        #{index + 1}
                      </Badge>
                    </div>
                  )}

                  {/* Badges Container */}
                  <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                    {product.is_featured && (
                      <Badge className="bg-primary text-primary-foreground gap-1">
                        <Star className="h-3 w-3" />
                        {t('badges.featured')}
                      </Badge>
                    )}
                    {isTrending(product.id) && (
                      <Badge className="bg-orange-500 text-white gap-1">
                        <Flame className="h-3 w-3" />
                        {t('badges.trending')}
                      </Badge>
                    )}
                    {product.is_subscription && (
                      <Badge variant="secondary" className="gap-1">
                        <Package className="h-3 w-3" />
                        {t('badges.subscription')}
                      </Badge>
                    )}
                  </div>

                  {/* Image */}
                  <div className="aspect-video bg-muted overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Package className="h-12 w-12" />
                      </div>
                    )}
                  </div>

                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-1">{product.title}</CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {product.description || t('topProducts.noProducts')}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1">
                    {/* Category */}
                    {product.category_name && (
                      <div className="mb-3">
                        <Badge variant="outline" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {product.category_icon} {product.category_name}
                        </Badge>
                      </div>
                    )}

                    {/* Rating */}
                    {product.ratings_count > 0 && (
                      <div className="mb-3">
                        <RatingDisplay 
                          rating={product.average_rating} 
                          count={product.ratings_count} 
                          size="sm"
                        />
                      </div>
                    )}

                    {/* Sales Badge */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge variant="outline" className="gap-1">
                        <Award className="h-3 w-3" />
                        {product.total_sales} {t('topProducts.sales')}
                      </Badge>
                      <Badge variant="secondary">
                        {product.product_type}
                      </Badge>
                    </div>

                    {/* Price */}
                    <div className="text-2xl font-bold text-primary">
                      ${product.price.toFixed(2)}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {product.pricing_model === 'one_time' && t('product.oneTime')}
                        {product.pricing_model === 'monthly' && t('product.monthly')}
                        {product.pricing_model === 'yearly' && t('product.yearly')}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button className="w-full" onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/product/${product.id}`);
                    }}>
                      {t('topProducts.viewProduct')}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12 backdrop-blur-md bg-background/80 border-border/50">
              <CardContent>
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">{t('topProducts.noProducts')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
