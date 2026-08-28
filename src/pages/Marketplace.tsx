import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, PackageOpen, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { RatingDisplay } from '@/components/RatingDisplay';
import { useProductsWithRatings } from '@/hooks/useProductsWithRatings';
import { useAuth } from '@/contexts/AuthContext';
import { WishlistButton } from '@/components/WishlistButton';
import { trackProductClick } from '@/utils/analytics';
import { AppLayout } from '@/components/AppLayout';
import { formatMoney, subscriptionLabel } from '@/lib/money';
import { REVIEW_STATUS } from '@/lib/reviewStatus';
import { HourglassLoader } from '@/components/HourglassLoader';

type LicenseKey = 'personal' | 'commercial' | 'agency' | 'exclusive';

const LICENSE_OPTIONS: { key: LicenseKey; label: string; hint: string; chip: string; tooltip: string }[] = [
  { key: 'personal', label: 'Personal use', hint: 'Use it yourself or inside your company', chip: 'P', tooltip: 'Personal license available' },
  { key: 'commercial', label: 'Commercial use', hint: 'Multiple internal deployments', chip: 'C', tooltip: 'Commercial license available' },
  { key: 'agency', label: 'Agency / resell to clients', hint: 'Deploy and rebrand for your clients', chip: 'A', tooltip: 'Agency / White-Label license available' },
  { key: 'exclusive', label: 'Exclusive buyout available', hint: 'Buy the product outright — sole ownership', chip: 'E', tooltip: 'Exclusive buyout available' },
];

function productHasLicense(product: any, key: LicenseKey): boolean {
  if (key === 'personal') return true; // every product has a personal license by default
  if (key === 'commercial') return !!product.license_commercial_enabled;
  if (key === 'agency') return !!product.license_agency_enabled;
  if (key === 'exclusive') return !!product.license_exclusive_enabled;
  return false;
}

export default function Marketplace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [productType, setProductType] = useState<string>(searchParams.get('type') || 'all');
  const [pricingModel, setPricingModel] = useState<string>(searchParams.get('pricing') || 'all');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get('tag') ? [searchParams.get('tag') as string] : [],
  );
  const [selectedLicenses, setSelectedLicenses] = useState<LicenseKey[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('newest');

  // Deep links from the header navigation (?type=, ?tag=, ?pricing=, ?q=)
  const paramKey = searchParams.toString();
  useEffect(() => {
    setProductType(searchParams.get('type') || 'all');
    setPricingModel(searchParams.get('pricing') || 'all');
    setSelectedTags(searchParams.get('tag') ? [searchParams.get('tag') as string] : []);
    setSearchQuery(searchParams.get('q') || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  const { data: productsWithRatings, isLoading } = useProductsWithRatings();
  const products = productsWithRatings?.filter((product: any) => {
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (
        !product.title.toLowerCase().includes(searchLower) &&
        !product.description?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    if (productType !== 'all' && product.product_type !== productType) return false;
    if (pricingModel !== 'all' && product.pricing_model !== pricingModel) return false;
    if (selectedTags.length > 0) {
      if (!selectedTags.some((tag) => product.tags?.includes(tag))) return false;
    }
    if (selectedLicenses.length > 0) {
      // OR within license filter: match if product offers ANY of the selected tiers
      if (!selectedLicenses.some((k) => productHasLicense(product, k))) return false;
    }
    if (priceRange.min || priceRange.max) {
      const price = Number(product.price);
      const min = priceRange.min ? parseFloat(priceRange.min) : 0;
      const max = priceRange.max ? parseFloat(priceRange.max) : Infinity;
      if (price < min || price > max) return false;
    }
    if (minRating > 0 && product.rating.average < minRating) return false;
    return true;
  }).sort((a: any, b: any) => {
    switch (sortBy) {
      case 'highest-rated': return b.rating.average - a.rating.average;
      case 'most-reviewed': return b.rating.count - a.rating.count;
      case 'price-low': return Number(a.price) - Number(b.price);
      case 'price-high': return Number(b.price) - Number(a.price);
      case 'newest':
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const { data: allTags } = useQuery({
    queryKey: ['all-tags'],
    queryFn: async () => {
      try {
        const { data, error } = await db
          .from('dkai_products')
          .select('tags')
          .eq('review_status', REVIEW_STATUS.APPROVED)
          .eq('exclusive_locked', false);
        if (error) return [] as string[];
        const tags = new Set<string>();
        data?.forEach((product: any) => {
          product.tags?.forEach((tag: string) => tags.add(tag));
        });
        return Array.from(tags).sort();
      } catch {
        return [] as string[];
      }
    },
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };
  const toggleLicense = (k: LicenseKey) => {
    setSelectedLicenses((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setProductType('all');
    setPricingModel('all');
    setSelectedTags([]);
    setSelectedLicenses([]);
    setPriceRange({ min: '', max: '' });
    setMinRating(0);
    setSortBy('newest');
  };

  const hasActiveFilters =
    selectedTags.length > 0 ||
    selectedLicenses.length > 0 ||
    productType !== 'all' ||
    pricingModel !== 'all' ||
    priceRange.min !== '' ||
    priceRange.max !== '' ||
    minRating > 0;

  const FilterPill = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs flex items-center gap-1">
      {label}
      <button onClick={onRemove} className="hover:opacity-70" aria-label={`Remove ${label}`}>
        <X className="w-3 h-3" />
      </button>
    </Badge>
  );

  const FilterPanel = () => (
    <div>
      <div className="mb-8">
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-foreground">Product Type</h3>
        <Select value={productType} onValueChange={setProductType}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="agent">AI Agent</SelectItem>
            <SelectItem value="software">Software</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-foreground">License Type</h3>
        <div className="space-y-2">
          {LICENSE_OPTIONS.map((opt) => {
            const checked = selectedLicenses.includes(opt.key);
            return (
              <label key={opt.key} className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary"
                  checked={checked}
                  onChange={() => toggleLicense(opt.key)}
                />
                <div className="min-w-0">
                  <div className="text-sm text-foreground">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-foreground">Pricing Model</h3>
        <Select value={pricingModel} onValueChange={setPricingModel}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="All Models" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Models</SelectItem>
            <SelectItem value="one_time">One-time</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-foreground">Price Range</h3>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            placeholder="Min"
            value={priceRange.min}
            onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
            min="0"
            className="text-sm"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            placeholder="Max"
            value={priceRange.max}
            onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
            min="0"
            className="text-sm"
          />
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-foreground">Minimum Rating</h3>
        <Select value={minRating.toString()} onValueChange={(v) => setMinRating(Number(v))}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="Any Rating" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any Rating</SelectItem>
            <SelectItem value="1">1+ Stars</SelectItem>
            <SelectItem value="2">2+ Stars</SelectItem>
            <SelectItem value="3">3+ Stars</SelectItem>
            <SelectItem value="4">4+ Stars</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {allTags && allTags.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-foreground">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={
                    active
                      ? 'rounded-full px-3 py-1 text-xs bg-primary text-primary-foreground border border-primary'
                      : 'rounded-full px-3 py-1 text-xs bg-background border border-border text-foreground hover:border-primary/40 transition-colors'
                  }
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Button variant="outline" onClick={clearFilters} className="w-full">
        Clear Filters
      </Button>
    </div>
  );

  const LicenseChips = ({ product }: { product: any }) => {
    const chips = LICENSE_OPTIONS.filter((o) => productHasLicense(product, o.key));
    if (chips.length === 0) return null;
    return (
      <TooltipProvider delayDuration={100}>
        <div className="flex gap-1">
          {chips.map((o) => (
            <Tooltip key={o.key}>
              <TooltipTrigger asChild>
                <span
                  className={
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-[0.65rem] font-semibold border ' +
                    (o.key === 'exclusive'
                      ? 'bg-gradient-to-br from-primary to-purple-600 text-white border-transparent'
                      : 'bg-muted text-foreground border-border')
                  }
                >
                  {o.chip}
                </span>
              </TooltipTrigger>
              <TooltipContent>{o.tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    );
  };

  const SkeletonCard = () => (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <div className="p-5">
        <Skeleton className="h-5 w-20 mb-3 rounded-full" />
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3 mb-4" />
      </div>
    </Card>
  );

  return (
    <AppLayout>
      <div className="bg-background min-h-screen">
        <header className="max-w-7xl mx-auto px-6 pt-12 pb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-2">Marketplace</h1>
          <p className="text-muted-foreground text-lg">
            AI agents, automations, prompts and tools — built by verified sellers.
          </p>
        </header>

        <div className="max-w-7xl mx-auto px-6 pb-16 grid lg:grid-cols-[280px_1fr] gap-8">
          <aside className="hidden lg:block sticky top-24 self-start">
            <FilterPanel />
          </aside>

          <div className="min-w-0">
            <div className="mb-6 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-lg px-4 py-2.5 text-sm"
                />
              </div>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] rounded-lg px-4 py-2.5 text-sm">
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

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open filters">
                    <SlidersHorizontal className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>Refine your search with filters</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterPanel />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 items-center mb-6">
                {productType !== 'all' && (
                  <FilterPill label={`Type: ${productType}`} onRemove={() => setProductType('all')} />
                )}
                {pricingModel !== 'all' && (
                  <FilterPill label={`Pricing: ${pricingModel}`} onRemove={() => setPricingModel('all')} />
                )}
                {selectedLicenses.map((k) => (
                  <FilterPill
                    key={k}
                    label={LICENSE_OPTIONS.find((o) => o.key === k)!.label}
                    onRemove={() => toggleLicense(k)}
                  />
                ))}
                {(priceRange.min || priceRange.max) && (
                  <FilterPill
                    label={`${priceRange.min || '0'} – ${priceRange.max || '∞'}`}
                    onRemove={() => setPriceRange({ min: '', max: '' })}
                  />
                )}
                {minRating > 0 && (
                  <FilterPill label={`${minRating}+ Stars`} onRemove={() => setMinRating(0)} />
                )}
                {selectedTags.map((tag) => (
                  <FilterPill key={tag} label={tag} onRemove={() => toggleTag(tag)} />
                ))}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <HourglassLoader size={128} label />
              </div>
            ) : products && products.length > 0 ? (

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {products.map((product: any) => (
                  <Card
                    key={product.id}
                    onClick={() => {
                      trackProductClick(product.id, user?.id);
                      navigate(`/product/${product.id}`);
                    }}
                    className="cursor-pointer overflow-hidden hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/40 transition-all duration-200 flex flex-col"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-muted">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="secondary" className="text-xs font-medium">
                          {product.product_type}
                        </Badge>
                        <LicenseChips product={product} />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 line-clamp-2 text-foreground">
                        {product.title}
                      </h3>
                      <p className="text-sm mb-4 line-clamp-2 text-muted-foreground">
                        {product.description || 'No description available'}
                      </p>

                      {product.rating.count > 0 && (
                        <div className="mb-4">
                          <RatingDisplay rating={product.rating.average} count={product.rating.count} size="sm" />
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-border">
                        <div className="text-xl font-semibold text-foreground">
                          {formatMoney(product.price, (product as any).currency)}
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            {subscriptionLabel(product as any) || 'once'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <WishlistButton productId={product.id} />
                          <Button size="sm" asChild>
                            <Link to={`/product/${product.id}`}>View</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <PackageOpen className="mx-auto mb-4 text-muted-foreground" size={48} />
                <h2 className="text-xl font-semibold text-foreground mb-2">No products match your filters</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Try removing some filters or check back soon — we're pre-launch and adding new sellers daily.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Reset filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
