import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RatingDisplay } from '@/components/RatingDisplay';
import { HalfStarRating } from '@/components/HalfStarRating';
import { 
  Search, Calendar, Clock, DollarSign, ExternalLink, Briefcase, Tag,
  User, Video, ImageIcon, Plus, ShoppingBag, Star, MessageSquare, ChevronLeft, ChevronRight
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface PortfolioItem {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  price_paid: number;
  currency: string;
  time_spent_hours: number | null;
  completed_date: string;
  images: string[];
  tags: string[];
  external_url: string | null;
  show_seller_name: boolean;
  customer_name: string | null;
  customer_anonymous: boolean;
  price_display_mode: string;
  price_range_min: number | null;
  price_range_max: number | null;
  videos: string[];
  product_id: string | null;
  seller: { id: string; username: string | null; full_name: string | null; avatar_url: string | null; } | null;
  product: { id: string; title: string; average_rating: number | null; total_sales: number | null; is_published: boolean; price: number; } | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string | null; username: string | null; avatar_url: string | null; } | null;
}

const categories = ['All Categories', 'Web Development', 'Mobile Development', 'Design', 'Marketing', 'Consulting', 'Writing', 'Video Production', 'Audio Production', 'Data Analysis', 'Other'];

export default function Portfolio() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);

  const { data: portfolioItems, isLoading } = useQuery({
    queryKey: ['public-portfolio'],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_portfolio_products')
        .select(`*`)
        .eq('is_public', true)
        .order('completed_date', { ascending: false });
      if (error) throw error;
      // Fetch seller profiles separately
      const items = data as any[];
      const sellerIds = [...new Set(items.map(i => i.seller_id))];
      const { data: sellers } = await db.from('dkai_profiles').select('id, username, full_name, avatar_url').in('id', sellerIds);
      const sellerMap: Record<string, any> = {};
      (sellers || []).forEach((s: any) => { sellerMap[s.id] = s; });
      return items.map(item => ({ ...item, seller: sellerMap[item.seller_id] || null, product: null })) as PortfolioItem[];
    }
  });

  // Fetch review counts for linked products
  const productIds = portfolioItems?.filter(i => i.product_id).map(i => i.product_id!) || [];
  const { data: reviewCounts } = useQuery({
    queryKey: ['portfolio-review-counts', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return {};
      const { data, error } = await db.from('dkai_reviews').select('product_id').in('product_id', productIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(r => { counts[r.product_id] = (counts[r.product_id] || 0) + 1; });
      return counts;
    },
    enabled: productIds.length > 0,
  });

  // Fetch reviews for the selected detail item
  const { data: selectedReviews } = useQuery({
    queryKey: ['portfolio-item-reviews', selectedItem?.product_id],
    queryFn: async () => {
      if (!selectedItem?.product_id) return [];
      const { data, error } = await db
        .from('dkai_reviews')
        .select('id, rating, comment, created_at, profiles:user_id (full_name, username, avatar_url)')
        .eq('product_id', selectedItem.product_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as unknown as Review[];
    },
    enabled: !!selectedItem?.product_id,
  });

  const filteredItems = portfolioItems?.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const renderPrice = (item: PortfolioItem) => {
    if (!item.price_display_mode || item.price_display_mode === 'hidden') return null;
    if (item.price_display_mode === 'range' && item.price_range_min != null) {
      return <div className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{item.currency} {item.price_range_min.toLocaleString()} – {item.price_range_max?.toLocaleString() ?? '?'}</div>;
    }
    if (item.price_display_mode === 'exact' && item.price_paid > 0) {
      return <div className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{item.currency} {item.price_paid.toLocaleString()}</div>;
    }
    return null;
  };

  const allMedia = selectedItem ? [...(selectedItem.images || []), ...(selectedItem.videos || [])] : [];
  const isVideoUrl = (url: string) => url.match(/\.(mp4|webm)/) || url.includes('video');

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-display font-semibold text-gray-900 mb-2">Portfolio Showcase</h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Real projects delivered by verified sellers — browse work, see results, and find the right builder for your next idea.
              </p>
            </div>
            {user && (
              <Button asChild variant="navCta">
                <Link to="/seller-dashboard/portfolio"><Plus className="h-4 w-4 mr-2" /> Create Portfolio</Link>
              </Button>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search portfolio items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-lg border border-border bg-white px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px] rounded-lg border border-border bg-white px-4 py-2.5 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{categories.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-video w-full" />
                  <div className="p-5">
                    <Skeleton className="h-5 w-20 mb-3 rounded-full" />
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredItems?.length === 0 ? (
            <div className="text-center py-20">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold text-gray-900 mb-2">No portfolio items match your filters</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery || categoryFilter !== 'All Categories'
                  ? 'Try removing some filters or search terms.'
                  : "We're pre-launch — sellers are uploading their work daily. Check back soon."}
              </p>
              {(searchQuery || categoryFilter !== 'All Categories') && (
                <Button variant="outline" onClick={() => { setSearchQuery(''); setCategoryFilter('All Categories'); }}>Reset filters</Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredItems?.map((item) => {
                const hasProduct = item.product_id && item.product;
                const isAvailable = hasProduct && item.product!.is_published;
                const rating = item.product?.average_rating || 0;
                const reviewCount = (item.product_id && reviewCounts?.[item.product_id]) || 0;

                return (
                  <Card key={item.id} className="overflow-hidden hover:-translate-y-0.5 transition-all duration-200 flex flex-col cursor-pointer" onClick={() => { setSelectedItem(item); setMediaIndex(0); }}>
                    {item.images && item.images.length > 0 && (
                      <div className="aspect-video w-full overflow-hidden bg-background-soft relative">
                        <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        {((item.images?.length || 0) + (item.videos?.length || 0)) > 1 && (
                          <div className="absolute bottom-2 right-2 flex gap-1">
                            {item.images.length > 1 && <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-gray-900 text-xs px-2 py-1 rounded-full"><ImageIcon className="h-3 w-3" /> {item.images.length}</span>}
                            {item.videos && item.videos.length > 0 && <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-gray-900 text-xs px-2 py-1 rounded-full"><Video className="h-3 w-3" /> {item.videos.length}</span>}
                          </div>
                        )}
                        {hasProduct && (
                          <div className="absolute top-2 left-2">
                            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${isAvailable ? 'bg-primary text-white' : 'bg-white/90 backdrop-blur-sm text-gray-900'}`}>
                              {isAvailable ? <><ShoppingBag className="h-3 w-3" /> Available</> : 'Custom Project'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-5 flex flex-col flex-1">
                      <span className="inline-flex self-start bg-primary-soft text-primary text-xs font-medium px-2.5 py-1 rounded-full mb-3">{item.category}</span>
                      <h3 className="font-display text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{item.title}</h3>
                      {rating > 0 && <div className="mb-3"><RatingDisplay rating={rating} count={reviewCount} size="sm" showCount /></div>}
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{item.description}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                        <div className="flex items-center gap-1"><User className="h-3 w-3" />{item.customer_anonymous ? 'Anonymous' : (item.customer_name || 'Anonymous')}</div>
                        <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(item.completed_date), 'MMM yyyy')}</div>
                        {renderPrice(item)}
                        {hasProduct && item.product!.total_sales != null && item.product!.total_sales > 0 && (
                          <div className="flex items-center gap-1"><ShoppingBag className="h-3 w-3" />{item.product!.total_sales} sold</div>
                        )}
                        {reviewCount > 0 && <div className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{reviewCount} review{reviewCount !== 1 ? 's' : ''}</div>}
                      </div>
                      {(item.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {item.tags.slice(0, 4).map((tag, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 rounded-full border border-border text-gray-700 text-xs px-2 py-0.5"><Tag className="h-2.5 w-2.5" />{tag}</span>
                          ))}
                          {item.tags.length > 4 && <span className="rounded-full border border-border text-gray-700 text-xs px-2 py-0.5">+{item.tags.length - 4}</span>}
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-border">
                        {item.show_seller_name && item.seller ? (
                          <Link to={`/u/${item.seller.username}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={item.seller.avatar_url || undefined} />
                              <AvatarFallback>{item.seller.full_name?.[0] || item.seller.username?.[0] || 'S'}</AvatarFallback>
                            </Avatar>
                            <p className="text-sm font-medium text-gray-900">{item.seller.full_name || item.seller.username || 'Anonymous'}</p>
                          </Link>
                        ) : <div />}
                        {hasProduct && isAvailable && (
                          <Button size="sm" variant="dark" asChild onClick={(e) => e.stopPropagation()}>
                            <Link to={`/product/${item.product_id}`}>View</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Dialog with media gallery + reviews */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedItem.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{selectedItem.category}</Badge>
                  {selectedItem.product && selectedItem.product.average_rating > 0 && (
                    <RatingDisplay rating={selectedItem.product.average_rating} count={(selectedItem.product_id && reviewCounts?.[selectedItem.product_id]) || 0} size="sm" showCount />
                  )}
                </div>
              </DialogHeader>

              {/* Media Gallery */}
              {allMedia.length > 0 && (
                <div className="relative">
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    {isVideoUrl(allMedia[mediaIndex]) ? (
                      <video src={allMedia[mediaIndex]} controls className="w-full h-full object-contain" />
                    ) : (
                      <img src={allMedia[mediaIndex]} alt="" className="w-full h-full object-contain" />
                    )}
                  </div>
                  {allMedia.length > 1 && (
                    <div className="flex items-center justify-between mt-2">
                      <Button variant="ghost" size="sm" onClick={() => setMediaIndex(Math.max(0, mediaIndex - 1))} disabled={mediaIndex === 0}><ChevronLeft className="h-4 w-4" /></Button>
                      <div className="flex gap-1">
                        {allMedia.map((_, i) => (
                          <button key={i} onClick={() => setMediaIndex(i)} className={`w-2 h-2 rounded-full transition-colors ${i === mediaIndex ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setMediaIndex(Math.min(allMedia.length - 1, mediaIndex + 1))} disabled={mediaIndex === allMedia.length - 1}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                  {/* Thumbnails */}
                  {allMedia.length > 1 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                      {allMedia.map((url, i) => (
                        <button key={i} onClick={() => setMediaIndex(i)} className={`shrink-0 w-16 h-12 rounded border overflow-hidden ${i === mediaIndex ? 'ring-2 ring-primary' : 'opacity-60 hover:opacity-100'}`}>
                          {isVideoUrl(url) ? (
                            <div className="w-full h-full bg-muted flex items-center justify-center"><Video className="h-4 w-4 text-muted-foreground" /></div>
                          ) : (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><User className="h-4 w-4" />{selectedItem.customer_anonymous ? 'Anonymous Client' : (selectedItem.customer_name || 'Anonymous')}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{format(parseISO(selectedItem.completed_date), 'MMM d, yyyy')}</span>
                  {selectedItem.time_spent_hours && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{selectedItem.time_spent_hours}h</span>}
                  {selectedItem.product && selectedItem.product.total_sales > 0 && <span className="flex items-center gap-1"><ShoppingBag className="h-4 w-4" />{selectedItem.product.total_sales} sold</span>}
                </div>
                {(selectedItem.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.tags.map((tag, idx) => (<Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>))}
                  </div>
                )}
              </div>

              {/* Buy button */}
              {selectedItem.product_id && selectedItem.product?.is_published && (
                <Button asChild className="w-full">
                  <Link to={`/product/${selectedItem.product_id}`}><ShoppingBag className="h-4 w-4 mr-2" /> View & Buy Product — ${selectedItem.product.price}</Link>
                </Button>
              )}

              {/* Reviews Section */}
              {selectedReviews && selectedReviews.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold flex items-center gap-2"><Star className="h-4 w-4" /> Reviews ({selectedReviews.length})</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedReviews.map((review) => (
                      <div key={review.id} className="flex gap-3 p-3 rounded-lg border border-border">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={review.profiles?.avatar_url || undefined} />
                          <AvatarFallback>{review.profiles?.full_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{review.profiles?.full_name || review.profiles?.username || 'Anonymous'}</p>
                            <span className="text-xs text-muted-foreground">{format(parseISO(review.created_at), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center gap-1 my-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-3 w-3 ${s <= review.rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`} />
                            ))}
                          </div>
                          {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No reviews but has product */}
              {selectedItem.product_id && (!selectedReviews || selectedReviews.length === 0) && (
                <div className="text-center py-4 border-t">
                  <p className="text-sm text-muted-foreground">No reviews yet for this product.</p>
                </div>
              )}

              {/* Seller info */}
              {selectedItem.show_seller_name && selectedItem.seller && (
                <div className="flex items-center gap-3 pt-4 border-t">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedItem.seller.avatar_url || undefined} />
                    <AvatarFallback>{selectedItem.seller.full_name?.[0] || 'S'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedItem.seller.full_name || selectedItem.seller.username}</p>
                    <p className="text-xs text-muted-foreground">@{selectedItem.seller.username}</p>
                  </div>
                  <Button variant="outline" size="sm" className="ml-auto" asChild>
                    <Link to={`/u/${selectedItem.seller.username}`}>View Profile</Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
