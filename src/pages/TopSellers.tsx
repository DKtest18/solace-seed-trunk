import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Users, Star, Package, DollarSign, ShoppingBag, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { HourglassLoader } from '@/components/HourglassLoader';

type SortOption = 'highest-revenue' | 'most-sales' | 'best-rating';

interface SellerRanking {
  id: string;
  seller_id: string;
  total_sales: number;
  total_revenue: number;
  total_products: number;
  average_rating: number;
  dispute_rate: number;
  profile: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  } | null;
}

export default function TopSellers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('highest-revenue');

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['top-sellers', sortBy],
    queryFn: async () => {
      let query = supabase
        .from('seller_rankings')
        .select(`
          id,
          seller_id,
          total_sales,
          total_revenue,
          total_products,
          average_rating,
          dispute_rate,
          profile:profiles!seller_rankings_seller_id_fkey (
            id,
            username,
            full_name,
            avatar_url,
            bio
          )
        `);

      // Apply sorting
      switch (sortBy) {
        case 'highest-revenue':
          query = query.order('total_revenue', { ascending: false });
          break;
        case 'most-sales':
          query = query.order('total_sales', { ascending: false });
          break;
        case 'best-rating':
          query = query.order('average_rating', { ascending: false });
          break;
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data as unknown as SellerRanking[];
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <HourglassLoader size={128} label />
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
              <Users className="h-8 w-8 text-primary" />
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                {t('topSellers.title')}
              </h1>
            </div>
            <p className="text-lg text-foreground/70 max-w-3xl">
              {t('topSellers.subtitle')}
            </p>
          </div>

          {/* Sort Controls */}
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm text-muted-foreground">
              {sellers?.length || 0} {t('topSellers.title').toLowerCase()}
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('marketplace.sortBy.label')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="highest-revenue">{t('topSellers.sortBy.highestRevenue')}</SelectItem>
                <SelectItem value="most-sales">{t('topSellers.sortBy.mostSales')}</SelectItem>
                <SelectItem value="best-rating">{t('topSellers.sortBy.bestRating')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sellers Grid */}
          {sellers && sellers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sellers.map((seller, index) => (
                <Card 
                  key={seller.id}
                  className="flex flex-col hover:shadow-xl transition-all hover:scale-[1.02] duration-300 backdrop-blur-md bg-background/80 border-border/50 rounded-2xl overflow-hidden cursor-pointer relative"
                  onClick={() => navigate(`/seller/${seller.seller_id}`)}
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

                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={seller.profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {seller.profile?.full_name?.charAt(0) || seller.profile?.username?.charAt(0) || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="line-clamp-1">
                          {seller.profile?.full_name || seller.profile?.username || 'Unknown Seller'}
                        </CardTitle>
                        {seller.profile?.username && (
                          <CardDescription>@{seller.profile.username}</CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1">
                    {seller.profile?.bio && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {seller.profile.bio}
                      </p>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <Package className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-sm font-medium">{seller.total_products}</div>
                          <div className="text-xs text-muted-foreground">{t('topSellers.products')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <ShoppingBag className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-sm font-medium">{seller.total_sales}</div>
                          <div className="text-xs text-muted-foreground">{t('topSellers.sales')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-sm font-medium">${seller.total_revenue.toFixed(0)}</div>
                          <div className="text-xs text-muted-foreground">{t('topSellers.revenue')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <div>
                          <div className="text-sm font-medium">{seller.average_rating.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">{t('topSellers.rating')}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Dispute Rate - shown separately */}
                    <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <AlertTriangle className={`h-4 w-4 ${seller.dispute_rate < 5 ? 'text-green-500' : seller.dispute_rate < 15 ? 'text-yellow-500' : 'text-destructive'}`} />
                      <div>
                        <div className="text-sm font-medium">{seller.dispute_rate.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">{t('topSellers.disputeRate')}</div>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button className="w-full" onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/seller/${seller.seller_id}`);
                    }}>
                      {t('topSellers.viewSeller')}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12 backdrop-blur-md bg-background/80 border-border/50">
              <CardContent>
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">{t('topSellers.noSellers')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
