import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Search, SlidersHorizontal, Heart } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { RatingDisplay } from '@/components/RatingDisplay';
import { useProductsWithRatings } from '@/hooks/useProductsWithRatings';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { WishlistButton } from '@/components/WishlistButton';
import { trackProductClick } from '@/utils/analytics';

import { AppLayout } from '@/components/AppLayout';

export default function Marketplace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [productType, setProductType] = useState<string>('all');
  const [pricingModel, setPricingModel] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('newest');

  const { data: productsWithRatings, isLoading } = useProductsWithRatings();

  // Filter and sort products
  const products = productsWithRatings?.filter((product) => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (
        !product.title.toLowerCase().includes(searchLower) &&
        !product.description?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Product type filter
    if (productType !== 'all' && product.product_type !== productType) {
      return false;
    }

    // Pricing model filter
    if (pricingModel !== 'all' && product.pricing_model !== pricingModel) {
      return false;
    }

    // Tags filter
    if (selectedTags.length > 0) {
      if (!selectedTags.some((tag) => product.tags?.includes(tag))) {
        return false;
      }
    }

    // Price range filter
    if (priceRange.min || priceRange.max) {
      const price = Number(product.price);
      const min = priceRange.min ? parseFloat(priceRange.min) : 0;
      const max = priceRange.max ? parseFloat(priceRange.max) : Infinity;
      if (price < min || price > max) {
        return false;
      }
    }

    // Rating filter
    if (minRating > 0 && product.rating.average < minRating) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    // Sorting logic
    switch (sortBy) {
      case 'highest-rated':
        return b.rating.average - a.rating.average;
      case 'most-reviewed':
        return b.rating.count - a.rating.count;
      case 'price-low':
        return Number(a.price) - Number(b.price);
      case 'price-high':
        return Number(b.price) - Number(a.price);
      case 'newest':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // Get all unique tags from all products
  const { data: allTags } = useQuery({
    queryKey: ['all-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('tags')
        .eq('is_published', true);

      if (error) throw error;

      const tags = new Set<string>();
      data?.forEach((product) => {
        product.tags?.forEach((tag: string) => tags.add(tag));
      });

      return Array.from(tags).sort();
    },
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setProductType('all');
    setPricingModel('all');
    setSelectedTags([]);
    setPriceRange({ min: '', max: '' });
    setMinRating(0);
    setSortBy('newest');
  };

  const FilterPanel = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Product Type</Label>
        <Select value={productType} onValueChange={setProductType}>
          <SelectTrigger>
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="agent">AI Agent</SelectItem>
            <SelectItem value="software">Software</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Pricing Model</Label>
        <Select value={pricingModel} onValueChange={setPricingModel}>
          <SelectTrigger>
            <SelectValue placeholder="All Models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Models</SelectItem>
            <SelectItem value="one_time">One-time</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Price Range</Label>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            placeholder="Min"
            value={priceRange.min}
            onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
            min="0"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Max"
            value={priceRange.max}
            onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
            min="0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Minimum Rating</Label>
        <Select value={minRating.toString()} onValueChange={(v) => setMinRating(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Any Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any Rating</SelectItem>
            <SelectItem value="1">⭐ 1+</SelectItem>
            <SelectItem value="1.5">⭐ 1.5+</SelectItem>
            <SelectItem value="2">⭐ 2+</SelectItem>
            <SelectItem value="2.5">⭐ 2.5+</SelectItem>
            <SelectItem value="3">⭐ 3+</SelectItem>
            <SelectItem value="3.5">⭐ 3.5+</SelectItem>
            <SelectItem value="4">⭐ 4+</SelectItem>
            <SelectItem value="4.5">⭐ 4.5+</SelectItem>
            <SelectItem value="5">⭐ 5</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {allTags && allTags.length > 0 && (
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" onClick={clearFilters} className="w-full">
        Clear Filters
      </Button>
    </div>
  );

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
          <div className="mb-10 p-6 rounded-2xl backdrop-blur-md bg-background/80 border border-border/50">
            <h1 className="text-4xl sm:text-5xl font-bold mb-3 tracking-tight text-foreground">
              AI Agent & Software Marketplace
            </h1>
            <p className="text-lg text-foreground/70 max-w-3xl">
              Discover powerful AI agents and software solutions to automate and enhance your workflow
            </p>
          </div>

          <div className="flex gap-6">
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <Card className="sticky top-4 backdrop-blur-md bg-background/80 border-border/50 rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <SlidersHorizontal className="w-5 h-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FilterPanel />
              </CardContent>
            </Card>
          </aside>

          {/* Middle Column: Main Content */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Search Bar and Sort */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] rounded-full">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="highest-rated">Highest Rated</SelectItem>
                  <SelectItem value="most-reviewed">Most Reviewed</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>

              {/* Mobile Filter Button */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden">
                    <SlidersHorizontal className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>
                      Refine your search with filters
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterPanel />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Active Filters */}
            {(selectedTags.length > 0 || productType !== 'all' || pricingModel !== 'all' || priceRange.min || priceRange.max) && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {productType !== 'all' && (
                  <Badge variant="secondary">
                    Type: {productType}
                  </Badge>
                )}
                {pricingModel !== 'all' && (
                  <Badge variant="secondary">
                    Pricing: {pricingModel}
                  </Badge>
                )}
                {(priceRange.min || priceRange.max) && (
                  <Badge variant="secondary">
                    ${priceRange.min || '0'} - ${priceRange.max || '∞'}
                  </Badge>
                )}
                {selectedTags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Products Grid */}
            {products && products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {products.map((product) => (
                  <div 
                    key={product.id}
                    className="cursor-pointer"
                    onClick={() => {
                      trackProductClick(product.id, user?.id);
                      navigate(`/product/${product.id}`);
                    }}
                  >
                    <Card 
                      className="flex flex-col hover:shadow-xl transition-all hover:scale-[1.02] duration-300 backdrop-blur-md bg-background/80 border-border/50 rounded-2xl overflow-hidden h-full"
                    >
                    {product.image_url && (
                      <div className="aspect-video bg-muted overflow-hidden rounded-t-lg">
                        <img
                          src={product.image_url}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-1">{product.title}</CardTitle>
                        <Badge variant="secondary" className="shrink-0">
                          {product.product_type}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {product.description || 'No description available'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {product.rating.count > 0 && (
                        <div className="mb-4">
                          <RatingDisplay 
                            rating={product.rating.average} 
                            count={product.rating.count} 
                            size="sm"
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {product.tags?.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        ${product.price}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          {product.pricing_model === 'one_time' && 'once'}
                          {product.pricing_model === 'monthly' && '/month'}
                          {product.pricing_model === 'yearly' && '/year'}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                      <div className="w-full" onClick={(e) => e.stopPropagation()}>
                        <WishlistButton productId={product.id} />
                      </div>
                    </CardFooter>
                  </Card>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 backdrop-blur-md bg-background/80 border-border/50">
                <CardContent>
                  <p className="text-muted-foreground mb-4">No products found matching your criteria</p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="hidden xl:block w-80 flex-shrink-0">
            <div className="sticky top-4 space-y-6">
              <Card className="backdrop-blur-md bg-background/80 border-border/50 rounded-2xl">
                <CardHeader>
                  <CardTitle>Marketplace Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Products</span>
                    <span className="font-bold text-lg">{products?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">AI Agents</span>
                    <span className="font-bold text-lg">
                      {products?.filter(p => p.product_type === 'agent').length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Software</span>
                    <span className="font-bold text-lg">
                      {products?.filter(p => p.product_type === 'software').length || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {allTags && allTags.length > 0 && (
                <Card className="backdrop-blur-md bg-background/80 border-border/50">
                  <CardHeader>
                    <CardTitle>Popular Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {allTags.slice(0, 10).map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleTag(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="backdrop-blur-md bg-background/80 border-border/50">
                <CardHeader>
                  <CardTitle>Become a Seller</CardTitle>
                  <CardDescription>
                    Start selling your AI agents and software on our marketplace
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link to="/create-product">Create Product</Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </aside>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
