import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Check, DollarSign, Search, ShoppingBag, Tag } from 'lucide-react';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { format } from 'date-fns';

interface SoldProduct {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price_paid: number;
  currency: string;
  category: string | null;
  image_url: string | null;
  image_url_2: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  seller: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

export default function SoldProducts() {
  const { user } = useAuth();
  const { formatCurrency } = useLocaleFormat();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: soldProducts, isLoading } = useQuery({
    queryKey: ['sold-products-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sold_products')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get seller profiles
      const sellerIds = [...new Set(data?.map(p => p.seller_id) || [])];
      const { data: sellers, error: sellersError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', sellerIds);

      if (sellersError) throw sellersError;

      return data?.map(product => ({
        ...product,
        seller: sellers?.find(s => s.id === product.seller_id)
      })) as SoldProduct[];
    }
  });

  // Get unique categories
  const categories = [...new Set(soldProducts?.map(p => p.category).filter(Boolean) || [])];

  const filteredProducts = soldProducts?.filter(product => {
    const matchesSearch = 
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.seller?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Already Sold Products</h1>
          <p className="text-muted-foreground">
            Browse completed projects and services delivered by our sellers. Get inspired and order similar work!
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sold products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts?.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sold products found</h3>
            <p className="text-muted-foreground">
              {searchQuery || categoryFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'Check back later for completed projects'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts?.map((product) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                {/* Image */}
                <div className="relative h-48 bg-muted overflow-hidden">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                  <Badge className="absolute top-3 right-3 bg-green-500">
                    <Check className="h-3 w-3 mr-1" />
                    {product.status === 'delivered' ? 'Delivered' : 'Completed'}
                  </Badge>
                </div>

                <CardHeader className="pb-2">
                  <h3 className="font-semibold text-lg line-clamp-1">{product.title}</h3>
                  {product.category && (
                    <Badge variant="outline" className="w-fit text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {product.category}
                    </Badge>
                  )}
                </CardHeader>

                <CardContent className="pb-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {product.description}
                  </p>

                  {/* Seller Info */}
                  {product.seller && (
                    <Link 
                      to={`/u/${product.seller.username}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={product.seller.avatar_url} />
                        <AvatarFallback>
                          {product.seller.full_name?.[0] || product.seller.username?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {product.seller.full_name || product.seller.username}
                        </p>
                        <p className="text-xs text-muted-foreground">Seller</p>
                      </div>
                    </Link>
                  )}

                  {/* Price & Date */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center text-sm font-medium text-green-600">
                      <DollarSign className="h-4 w-4 mr-1" />
                      {formatCurrency(product.price_paid, product.currency)}
                    </div>
                    {product.completed_at && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(new Date(product.completed_at), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-0">
                  <Button className="w-full" asChild>
                    <Link to={`/meetings?seller=${product.seller_id}`}>
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Buy Similar Service
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
