import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/SellerSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { 
  Plus, Edit, Trash2, Eye, EyeOff, Calendar, Clock, DollarSign, Tag,
  Briefcase, ExternalLink, User, Video, ImageIcon, ShoppingBag, Import,
  CheckSquare, ArrowRight, ArrowLeft, Users, Shield, Share2, Upload, X, Loader2
} from 'lucide-react';

interface PortfolioProduct {
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
  is_public: boolean;
  show_seller_name: boolean;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
  customer_anonymous: boolean;
  price_display_mode: string;
  price_range_min: number | null;
  price_range_max: number | null;
  videos: string[];
  product_id: string | null;
}

interface SoldProduct {
  product_id: string;
  product_title: string;
  product_category: string;
  product_image: string | null;
  total_sold: number;
  total_revenue: number;
  currency: string;
  last_sold_at: string;
  buyers: string[];
}

const categories = [
  'Web Development', 'Mobile Development', 'Design', 'Marketing',
  'Consulting', 'Writing', 'Video Production', 'Audio Production',
  'Data Analysis', 'Other'
];

// ── Media Upload Component ──────────────────────────────────────
function MediaUploader({ 
  userId, 
  existingImages, 
  existingVideos,
  onImagesChange, 
  onVideosChange 
}: {
  userId: string;
  existingImages: string[];
  existingVideos: string[];
  onImagesChange: (urls: string[]) => void;
  onVideosChange: (urls: string[]) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideos, setUploadingVideos] = useState(false);

  const uploadFile = async (file: File, type: 'image' | 'video'): Promise<string | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${userId}/${type}s/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    
    const { error } = await supabase.storage
      .from('portfolio-media')
      .upload(path, file, { contentType: file.type });
    
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from('portfolio-media')
      .getPublicUrl(path);
    
    return urlData.publicUrl;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const remaining = 10 - existingImages.length;
    if (files.length > remaining) {
      toast.error(`You can only add ${remaining} more image(s) (max 10)`);
      return;
    }

    setUploadingImages(true);
    const urls: string[] = [];
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        continue;
      }
      const url = await uploadFile(file, 'image');
      if (url) urls.push(url);
    }
    if (urls.length > 0) {
      onImagesChange([...existingImages, ...urls]);
      toast.success(`${urls.length} image(s) uploaded`);
    }
    setUploadingImages(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = 3 - existingVideos.length;
    if (files.length > remaining) {
      toast.error(`You can only add ${remaining} more video(s) (max 3)`);
      return;
    }

    setUploadingVideos(true);
    const urls: string[] = [];
    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 100MB)`);
        continue;
      }
      // Check video duration
      const duration = await getVideoDuration(file);
      if (duration > 180) {
        toast.error(`${file.name} is longer than 3 minutes`);
        continue;
      }
      const url = await uploadFile(file, 'video');
      if (url) urls.push(url);
    }
    if (urls.length > 0) {
      onVideosChange([...existingVideos, ...urls]);
      toast.success(`${urls.length} video(s) uploaded`);
    }
    setUploadingVideos(false);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => resolve(0);
      video.src = URL.createObjectURL(file);
    });
  };

  const removeImage = (index: number) => {
    onImagesChange(existingImages.filter((_, i) => i !== index));
  };

  const removeVideo = (index: number) => {
    onVideosChange(existingVideos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border border-border">
      <h4 className="font-medium flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Media</h4>
      
      {/* Images */}
      <div className="space-y-2">
        <Label className="text-sm">Images (max 10, 20MB each)</Label>
        {existingImages.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {existingImages.map((url, i) => (
              <div key={i} className="relative group aspect-square rounded-md overflow-hidden border border-border bg-muted">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImages || existingImages.length >= 10}
          >
            {uploadingImages ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Upload Images
          </Button>
          <span className="text-xs text-muted-foreground self-center">{existingImages.length}/10</span>
        </div>
        <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
      </div>

      {/* Videos */}
      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-1"><Video className="h-3 w-3" /> Videos (max 3, 100MB each, 3min max)</Label>
        {existingVideos.length > 0 && (
          <div className="space-y-2">
            {existingVideos.map((url, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted">
                <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs truncate flex-1">{url.split('/').pop()}</span>
                <button type="button" onClick={() => removeVideo(i)} className="text-destructive hover:text-destructive/80">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => videoInputRef.current?.click()}
            disabled={uploadingVideos || existingVideos.length >= 3}
          >
            {uploadingVideos ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Upload Videos
          </Button>
          <span className="text-xs text-muted-foreground self-center">{existingVideos.length}/3</span>
        </div>
        <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" multiple className="hidden" onChange={handleVideoUpload} />
      </div>
    </div>
  );
}

// ── Sold Products Import Wizard ──────────────────────────────────────
interface WizardItem {
  sold: SoldProduct;
  showNames: boolean;
  priceDisplay: 'exact' | 'hidden' | 'range';
  isPublic: boolean;
}

function SoldProductsWizard({
  soldProducts,
  soldLoading,
  onImport,
}: {
  soldProducts: SoldProduct[];
  soldLoading: boolean;
  onImport: (items: WizardItem[]) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<Record<string, Omit<WizardItem, 'sold'>>>({});
  const [importing, setImporting] = useState(false);

  const totalSteps = 3;

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === soldProducts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(soldProducts.map((p) => p.product_id)));
  };

  const selectedProducts = soldProducts.filter((p) => selectedIds.has(p.product_id));

  const getConfig = (id: string) =>
    config[id] || { showNames: false, priceDisplay: 'exact' as const, isPublic: true };

  const updateConfig = (id: string, patch: Partial<Omit<WizardItem, 'sold'>>) => {
    setConfig((prev) => ({ ...prev, [id]: { ...getConfig(id), ...patch } }));
  };

  const applyToAll = (patch: Partial<Omit<WizardItem, 'sold'>>) => {
    setConfig((prev) => {
      const next = { ...prev };
      for (const p of selectedProducts) next[p.product_id] = { ...getConfig(p.product_id), ...patch };
      return next;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    const items: WizardItem[] = selectedProducts.map((sold) => ({ sold, ...getConfig(sold.product_id) }));
    await onImport(items);
    setImporting(false);
    setStep(1);
    setSelectedIds(new Set());
    setConfig({});
  };

  if (soldLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!soldProducts || soldProducts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No sold products yet</h3>
          <p className="text-muted-foreground">Once you complete sales, your products will appear here for easy portfolio import.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {step} of {totalSteps}</span>
          <span>{step === 1 && 'Select Products'}{step === 2 && 'Configure Display'}{step === 3 && 'Review & Import'}</span>
        </div>
        <Progress value={(step / totalSteps) * 100} className="h-2" />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Select Products to Showcase</h3>
              <p className="text-sm text-muted-foreground">Choose which sold products you want to add to your portfolio. Reviews and ratings will be shown automatically.</p>
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>
              <CheckSquare className="h-4 w-4 mr-2" />
              {selectedIds.size === soldProducts.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="grid gap-3">
            {soldProducts.map((sold) => {
              const selected = selectedIds.has(sold.product_id);
              return (
                <Card key={sold.product_id} className={`cursor-pointer transition-all ${selected ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`} onClick={() => toggleProduct(sold.product_id)}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <Checkbox checked={selected} onCheckedChange={() => toggleProduct(sold.product_id)} />
                    {sold.product_image && <img src={sold.product_image} alt={sold.product_title} className="w-16 h-16 object-cover rounded-md border" />}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{sold.product_title}</h4>
                      <p className="text-sm text-muted-foreground">{sold.product_category}</p>
                    </div>
                    <div className="flex items-center gap-6 text-sm shrink-0">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-muted-foreground"><ShoppingBag className="h-3 w-3" /> Sold</div>
                        <span className="font-bold text-lg">{sold.total_sold}x</span>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-muted-foreground"><DollarSign className="h-3 w-3" /> Revenue</div>
                        <span className="font-bold">{sold.currency} {sold.total_revenue.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={selectedIds.size === 0}>Next: Configure Display <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div><h3 className="text-lg font-semibold">Configure Display Settings</h3><p className="text-sm text-muted-foreground">Set how each product appears. Product reviews & ratings will be automatically displayed.</p></div>
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-3">Apply to all:</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => applyToAll({ showNames: false })}><Shield className="h-3 w-3 mr-1" /> All Anonymous</Button>
                <Button size="sm" variant="outline" onClick={() => applyToAll({ showNames: true })}><Users className="h-3 w-3 mr-1" /> Show Names</Button>
                <Button size="sm" variant="outline" onClick={() => applyToAll({ priceDisplay: 'exact' })}><DollarSign className="h-3 w-3 mr-1" /> Show Prices</Button>
                <Button size="sm" variant="outline" onClick={() => applyToAll({ priceDisplay: 'hidden' })}><EyeOff className="h-3 w-3 mr-1" /> Hide Prices</Button>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {selectedProducts.map((sold) => {
              const cfg = getConfig(sold.product_id);
              return (
                <Card key={sold.product_id}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      {sold.product_image && <img src={sold.product_image} alt={sold.product_title} className="w-12 h-12 object-cover rounded border" />}
                      <div className="flex-1 min-w-0"><h4 className="font-medium truncate">{sold.product_title}</h4><p className="text-xs text-muted-foreground">{sold.total_sold}x sold</p></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Client Display</Label>
                        <Select value={cfg.showNames ? 'named' : 'anonymous'} onValueChange={(v) => updateConfig(sold.product_id, { showNames: v === 'named' })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="anonymous">Anonymous</SelectItem><SelectItem value="named">Show Names</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Price Display</Label>
                        <Select value={cfg.priceDisplay} onValueChange={(v: any) => updateConfig(sold.product_id, { priceDisplay: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="exact">Show Revenue</SelectItem><SelectItem value="hidden">Hide Price</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Visibility</Label>
                        <Select value={cfg.isPublic ? 'public' : 'private'} onValueChange={(v) => updateConfig(sold.product_id, { isPublic: v === 'public' })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="private">Private</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button onClick={() => setStep(3)}>Next: Review <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div><h3 className="text-lg font-semibold">Review & Import</h3><p className="text-sm text-muted-foreground">Products will be linked so reviews, ratings and FAQ are shown automatically.</p></div>
          <div className="space-y-3">
            {selectedProducts.map((sold) => {
              const cfg = getConfig(sold.product_id);
              return (
                <Card key={sold.product_id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    {sold.product_image && <img src={sold.product_image} alt={sold.product_title} className="w-14 h-14 object-cover rounded border" />}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{sold.product_title}</h4>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                        <span>{sold.total_sold}x sold</span>
                        <span>{cfg.showNames ? 'Named' : 'Anonymous'}</span>
                        <span>{cfg.priceDisplay === 'exact' ? `${sold.currency} ${sold.total_revenue.toLocaleString()}` : 'Hidden'}</span>
                        <Badge variant={cfg.isPublic ? 'default' : 'secondary'} className="text-xs">{cfg.isPublic ? 'Public' : 'Private'}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : `Import ${selectedProducts.length} Product(s)`}
              <Import className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SellerPortfolio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PortfolioProduct | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price_paid: '',
    currency: 'USD',
    time_spent_hours: '',
    completed_date: '',
    tags: '',
    external_url: '',
    website_links: [{ label: '', url: '' }],
    is_public: true,
    show_seller_name: true,
    customer_name: '',
    customer_anonymous: true,
    price_display_mode: 'hidden',
    price_range_min: '',
    price_range_max: '',
  });

  const { data: portfolioProducts, isLoading } = useQuery({
    queryKey: ['seller-portfolio', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('portfolio_products')
        .select('*')
        .eq('seller_id', user.id)
        .order('completed_date', { ascending: false });
      if (error) throw error;
      return data as PortfolioProduct[];
    },
    enabled: !!user
  });

  const { data: soldProducts, isLoading: soldLoading } = useQuery({
    queryKey: ['seller-sold-products', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('orders')
        .select(`id, product_id, price, created_at, status, buyer_id, products (id, title, category_id, images, seller_id), profiles:buyer_id (username, full_name)`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const sellerOrders = (data || []).filter((o: any) => o.products?.seller_id === user.id);
      const grouped: Record<string, SoldProduct> = {};
      for (const order of sellerOrders) {
        const pid = order.product_id;
        if (!grouped[pid]) {
          const product = order.products as any;
          grouped[pid] = {
            product_id: pid,
            product_title: product?.title || 'Unknown Product',
            product_category: product?.category_id || 'Other',
            product_image: product?.images?.[0] || null,
            total_sold: 0, total_revenue: 0, currency: 'USD',
            last_sold_at: order.created_at, buyers: [],
          };
        }
        grouped[pid].total_sold += 1;
        grouped[pid].total_revenue += order.price || 0;
        const buyer = order.profiles as any;
        const buyerName = buyer?.full_name || buyer?.username || 'Anonymous';
        if (!grouped[pid].buyers.includes(buyerName)) grouped[pid].buyers.push(buyerName);
      }
      return Object.values(grouped);
    },
    enabled: !!user
  });

  const importToPortfolio = async (sold: SoldProduct, anonymous: boolean, priceDisplay: string = 'exact', isPublic: boolean = true) => {
    if (!user) return;
    const { error } = await supabase
      .from('portfolio_products')
      .insert({
        seller_id: user.id,
        title: sold.product_title,
        description: `Successfully sold ${sold.total_sold} time(s). Total revenue: ${sold.currency} ${sold.total_revenue.toLocaleString()}.`,
        category: sold.product_category,
        price_paid: sold.total_revenue,
        currency: sold.currency,
        completed_date: sold.last_sold_at.split('T')[0],
        images: sold.product_image ? [sold.product_image] : [],
        tags: [`${sold.total_sold}x sold`],
        is_public: isPublic,
        show_seller_name: true,
        customer_name: anonymous ? null : sold.buyers.join(', '),
        customer_anonymous: anonymous,
        price_display_mode: priceDisplay,
        price_range_min: null, price_range_max: null,
        videos: [],
        product_id: sold.product_id, // Link to actual product for reviews/ratings
      });
    if (error) toast.error('Failed to import', { description: error.message });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('portfolio_products')
        .insert({
          seller_id: user?.id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          price_paid: parseFloat(formData.price_paid) || 0,
          currency: formData.currency,
          time_spent_hours: formData.time_spent_hours ? parseFloat(formData.time_spent_hours) : null,
          completed_date: formData.completed_date,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          external_url: formData.external_url.trim() || null,
          website_links: formData.website_links.filter(l => l.url.trim()) as any,
          is_public: formData.is_public,
          show_seller_name: formData.show_seller_name,
          customer_name: formData.customer_name.trim() || null,
          customer_anonymous: formData.customer_anonymous,
          price_display_mode: formData.price_display_mode,
          price_range_min: formData.price_range_min ? parseFloat(formData.price_range_min) : null,
          price_range_max: formData.price_range_max ? parseFloat(formData.price_range_max) : null,
          images: uploadedImages,
          videos: uploadedVideos,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Portfolio item created!');
      setIsCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['seller-portfolio'] });
    },
    onError: (error: any) => toast.error('Failed to create', { description: error.message })
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('portfolio_products')
        .update({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          price_paid: parseFloat(formData.price_paid) || 0,
          currency: formData.currency,
          time_spent_hours: formData.time_spent_hours ? parseFloat(formData.time_spent_hours) : null,
          completed_date: formData.completed_date,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          external_url: formData.external_url.trim() || null,
          website_links: formData.website_links.filter(l => l.url.trim()) as any,
          is_public: formData.is_public,
          show_seller_name: formData.show_seller_name,
          customer_name: formData.customer_name.trim() || null,
          customer_anonymous: formData.customer_anonymous,
          price_display_mode: formData.price_display_mode,
          price_range_min: formData.price_range_min ? parseFloat(formData.price_range_min) : null,
          price_range_max: formData.price_range_max ? parseFloat(formData.price_range_max) : null,
          images: uploadedImages,
          videos: uploadedVideos,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Portfolio item updated!');
      setEditingProduct(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['seller-portfolio'] });
    },
    onError: (error: any) => toast.error('Failed to update', { description: error.message })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('portfolio_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Deleted!'); queryClient.invalidateQueries({ queryKey: ['seller-portfolio'] }); },
    onError: (error: any) => toast.error('Failed to delete', { description: error.message })
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, is_public }: { id: string; is_public: boolean }) => {
      const { error } = await supabase.from('portfolio_products').update({ is_public }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller-portfolio'] })
  });

  const shareToCommunity = async (product: PortfolioProduct) => {
    if (!user) return;
    const body = [
      `🎨 **${product.title}**`, '', product.description, '',
      `📁 Category: ${product.category}`,
      `📅 Completed: ${format(parseISO(product.completed_date), 'MMM d, yyyy')}`,
    ].filter(Boolean).join('\n');
    try {
      const { data, error } = await supabase.functions.invoke('create-community-post', {
        body: { title: `Portfolio: ${product.title}`, body, is_public: true, seller_id: user.id },
      });
      if (error) throw error;
      toast.success('Shared to community!');
      if (data?.id) navigate(`/community/${data.id}`);
    } catch (err: any) {
      toast.error('Failed to share', { description: err.message });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '', description: '', category: '', price_paid: '', currency: 'USD',
      time_spent_hours: '', completed_date: '', tags: '', external_url: '',
      website_links: [{ label: '', url: '' }], is_public: true, show_seller_name: true,
      customer_name: '', customer_anonymous: true, price_display_mode: 'hidden',
      price_range_min: '', price_range_max: '',
    });
    setUploadedImages([]);
    setUploadedVideos([]);
  };

  const openEditDialog = (product: PortfolioProduct) => {
    setEditingProduct(product);
    const links = (product as any).website_links;
    const parsedLinks = Array.isArray(links) && links.length > 0
      ? links.map((l: any) => ({ label: l.label || '', url: l.url || '' }))
      : [{ label: '', url: '' }];
    setFormData({
      title: product.title, description: product.description, category: product.category,
      price_paid: product.price_paid.toString(), currency: product.currency,
      time_spent_hours: product.time_spent_hours?.toString() || '', completed_date: product.completed_date,
      tags: (product.tags || []).join(', '), external_url: product.external_url || '',
      website_links: parsedLinks, is_public: product.is_public, show_seller_name: product.show_seller_name,
      customer_name: product.customer_name || '', customer_anonymous: product.customer_anonymous ?? true,
      price_display_mode: product.price_display_mode || 'hidden',
      price_range_min: product.price_range_min?.toString() || '',
      price_range_max: product.price_range_max?.toString() || '',
    });
    setUploadedImages(product.images || []);
    setUploadedVideos(product.videos || []);
  };

  const handleSubmit = () => {
    if (editingProduct) updateMutation.mutate({ id: editingProduct.id });
    else createMutation.mutate();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md"><CardHeader><CardTitle>Sign in required</CardTitle><CardDescription>Please sign in to manage your portfolio.</CardDescription></CardHeader></Card>
      </div>
    );
  }

  const renderPriceDisplay = (product: PortfolioProduct) => {
    if (product.price_display_mode === 'hidden') return null;
    if (product.price_display_mode === 'range' && product.price_range_min != null) {
      return <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span>{product.currency} {product.price_range_min.toLocaleString()} – {product.price_range_max?.toLocaleString() ?? '?'}</span></div>;
    }
    if (product.price_display_mode === 'exact' && product.price_paid > 0) {
      return <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span>{product.currency} {product.price_paid.toLocaleString()}</span></div>;
    }
    return null;
  };

  const renderPortfolioForm = () => (
    <div className="space-y-4">
      <div><Label>Title *</Label><Input value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g., E-commerce Website for Fashion Brand" /></div>
      <div><Label>Description *</Label><Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe the project, challenges, and results..." rows={4} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Category *</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>{categories.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div><Label>Completion Date *</Label><Input type="date" value={formData.completed_date} onChange={(e) => setFormData(prev => ({ ...prev, completed_date: e.target.value }))} /></div>
      </div>
      
      {/* Customer Info */}
      <div className="space-y-3 p-4 rounded-lg border border-border">
        <h4 className="font-medium flex items-center gap-2"><User className="h-4 w-4" /> Customer Info</h4>
        <div className="flex items-center justify-between">
          <div><Label>Anonymous Customer</Label><p className="text-xs text-muted-foreground">Hide customer name publicly</p></div>
          <Switch checked={formData.customer_anonymous} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, customer_anonymous: checked }))} />
        </div>
        {!formData.customer_anonymous && (
          <div><Label>Customer Name</Label><Input value={formData.customer_name} onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))} placeholder="e.g., John Doe" /></div>
        )}
      </div>

      {/* Price Display */}
      <div className="space-y-3 p-4 rounded-lg border border-border">
        <h4 className="font-medium flex items-center gap-2"><DollarSign className="h-4 w-4" /> Price Display</h4>
        <Select value={formData.price_display_mode} onValueChange={(value) => setFormData(prev => ({ ...prev, price_display_mode: value }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hidden">Don't show price</SelectItem>
            <SelectItem value="exact">Show exact price</SelectItem>
            <SelectItem value="range">Show price range</SelectItem>
          </SelectContent>
        </Select>
        {formData.price_display_mode === 'exact' && (
          <div className="flex gap-2">
            <div className="flex-1"><Label>Price</Label><Input type="number" value={formData.price_paid} onChange={(e) => setFormData(prev => ({ ...prev, price_paid: e.target.value }))} /></div>
            <div><Label>Currency</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData(prev => ({ ...prev, currency: v }))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem><SelectItem value="CHF">CHF</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        )}
        {formData.price_display_mode === 'range' && (
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Min</Label><Input type="number" value={formData.price_range_min} onChange={(e) => setFormData(prev => ({ ...prev, price_range_min: e.target.value }))} /></div>
            <div><Label>Max</Label><Input type="number" value={formData.price_range_max} onChange={(e) => setFormData(prev => ({ ...prev, price_range_max: e.target.value }))} /></div>
            <div><Label>Currency</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData(prev => ({ ...prev, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem><SelectItem value="CHF">CHF</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Media Upload */}
      <MediaUploader
        userId={user.id}
        existingImages={uploadedImages}
        existingVideos={uploadedVideos}
        onImagesChange={setUploadedImages}
        onVideosChange={setUploadedVideos}
      />

      {/* Time Spent */}
      <div><Label>Time Spent (hours)</Label><Input type="number" value={formData.time_spent_hours} onChange={(e) => setFormData(prev => ({ ...prev, time_spent_hours: e.target.value }))} placeholder="e.g., 40" /></div>
      
      {/* Tags */}
      <div><Label>Tags (comma-separated)</Label><Input value={formData.tags} onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))} placeholder="e.g., React, Node.js" /></div>
      
      {/* External Link */}
      <div><Label>External Link (optional)</Label><Input value={formData.external_url} onChange={(e) => setFormData(prev => ({ ...prev, external_url: e.target.value }))} placeholder="https://example.com" type="url" /></div>
      
      {/* Website Links */}
      <div className="space-y-3 p-4 rounded-lg border border-border">
        <h4 className="font-medium flex items-center gap-2"><ExternalLink className="h-4 w-4" /> Website Links</h4>
        {formData.website_links.map((link, idx) => (
          <div key={idx} className="flex gap-2">
            <Input value={link.label} onChange={(e) => { const u = [...formData.website_links]; u[idx] = { ...u[idx], label: e.target.value }; setFormData(prev => ({ ...prev, website_links: u })); }} placeholder="Label" className="w-1/3" />
            <Input value={link.url} onChange={(e) => { const u = [...formData.website_links]; u[idx] = { ...u[idx], url: e.target.value }; setFormData(prev => ({ ...prev, website_links: u })); }} placeholder="https://..." type="url" className="flex-1" />
            {formData.website_links.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => setFormData(prev => ({ ...prev, website_links: prev.website_links.filter((_, i) => i !== idx) }))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            )}
          </div>
        ))}
        {formData.website_links.length < 5 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setFormData(prev => ({ ...prev, website_links: [...prev.website_links, { label: '', url: '' }] }))}><Plus className="h-4 w-4 mr-1" /> Add Link</Button>
        )}
      </div>

      {/* Visibility */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <div><Label>Public Visibility</Label><p className="text-sm text-muted-foreground">Show in public portfolio</p></div>
          <Switch checked={formData.is_public} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))} />
        </div>
        <div className="flex items-center justify-between">
          <div><Label>Show Seller Name</Label><p className="text-sm text-muted-foreground">Display your name</p></div>
          <Switch checked={formData.show_seller_name} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_seller_name: checked }))} />
        </div>
      </div>
    </div>
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SellerSidebar />
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Portfolio Products</h1>
                <p className="text-muted-foreground">Showcase your completed work to attract new clients.</p>
              </div>
              <Dialog open={isCreateDialogOpen || !!editingProduct} onOpenChange={(open) => {
                if (!open) { setIsCreateDialogOpen(false); setEditingProduct(null); resetForm(); }
              }}>
                <DialogTrigger asChild>
                  <Button onClick={() => setIsCreateDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Create Portfolio Item</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? 'Edit Portfolio Item' : 'Create Portfolio Item'}</DialogTitle>
                    <DialogDescription>{editingProduct ? 'Update your work details.' : 'Add a completed project to showcase.'}</DialogDescription>
                  </DialogHeader>
                  {renderPortfolioForm()}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); setEditingProduct(null); resetForm(); }}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!formData.title || !formData.description || !formData.category || !formData.completed_date || createMutation.isPending || updateMutation.isPending}>
                      {editingProduct ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Items</CardTitle><Briefcase className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{portfolioProducts?.length || 0}</div></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Public Items</CardTitle><Eye className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{portfolioProducts?.filter(p => p.is_public).length || 0}</div></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Products Sold</CardTitle><ShoppingBag className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{soldProducts?.length || 0}</div></CardContent></Card>
            </div>

            <Tabs defaultValue="portfolio" className="space-y-6">
              <TabsList>
                <TabsTrigger value="portfolio"><Briefcase className="h-4 w-4 mr-2" /> Portfolio Items</TabsTrigger>
                <TabsTrigger value="sold"><ShoppingBag className="h-4 w-4 mr-2" /> Import from Sold Products</TabsTrigger>
              </TabsList>

              <TabsContent value="portfolio">
                {isLoading ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (<Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>))}
                  </div>
                ) : portfolioProducts?.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">No portfolio items yet</h3>
                      <p className="text-muted-foreground mb-4">Showcase your completed work to attract new clients.</p>
                      <Button onClick={() => setIsCreateDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Create Your First Item</Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {portfolioProducts?.map((product) => (
                      <Card key={product.id} className="flex flex-col">
                        {product.images && product.images.length > 0 && (
                          <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                            <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                        )}
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg truncate">{product.title}</CardTitle>
                              <CardDescription>{product.category}</CardDescription>
                            </div>
                            <div className="flex gap-1">
                              {product.product_id && <Badge variant="outline" className="text-xs shrink-0">Linked</Badge>}
                              <Badge variant={product.is_public ? 'default' : 'secondary'}>
                                {product.is_public ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                                {product.is_public ? 'Public' : 'Private'}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{product.description}</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span>{product.customer_anonymous ? 'Anonymous Customer' : (product.customer_name || 'Anonymous')}</span></div>
                            {renderPriceDisplay(product)}
                            {product.time_spent_hours && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>{product.time_spent_hours}h</span></div>}
                            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span>{format(parseISO(product.completed_date), 'MMM d, yyyy')}</span></div>
                            {((product.images?.length || 0) + (product.videos?.length || 0)) > 0 && (
                              <div className="flex items-center gap-3">
                                {product.images?.length > 0 && <span className="flex items-center gap-1 text-muted-foreground"><ImageIcon className="h-3 w-3" /> {product.images.length}</span>}
                                {product.videos?.length > 0 && <span className="flex items-center gap-1 text-muted-foreground"><Video className="h-3 w-3" /> {product.videos.length}</span>}
                              </div>
                            )}
                          </div>
                          {(product.tags || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-4">
                              {product.tags.slice(0, 3).map((tag) => (<Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>))}
                              {product.tags.length > 3 && <Badge variant="outline" className="text-xs">+{product.tags.length - 3}</Badge>}
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="flex gap-2 pt-4 border-t">
                          <Button size="sm" variant="ghost" onClick={() => toggleVisibilityMutation.mutate({ id: product.id, is_public: !product.is_public })} title={product.is_public ? 'Make Private' : 'Make Public'}>
                            {product.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(product)} title="Edit"><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => shareToCommunity(product)} title="Share to Community" className="text-primary hover:text-primary"><Share2 className="h-4 w-4" /></Button>
                          {product.product_id && <Button size="sm" variant="ghost" asChild title="View Product"><Link to={`/product/${product.product_id}`}><ExternalLink className="h-4 w-4" /></Link></Button>}
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Portfolio Item</AlertDialogTitle><AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(product.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sold">
                <SoldProductsWizard
                  soldProducts={soldProducts || []}
                  soldLoading={soldLoading}
                  onImport={async (items) => {
                    for (const item of items) {
                      await importToPortfolio(
                        { ...item.sold, buyers: item.showNames ? item.sold.buyers : [] },
                        !item.showNames, item.priceDisplay, item.isPublic
                      );
                    }
                    toast.success(`${items.length} product(s) imported to portfolio!`);
                    queryClient.invalidateQueries({ queryKey: ['seller-portfolio'] });
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
