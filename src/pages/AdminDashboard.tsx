import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { AdminRouteGuard } from '@/components/AdminRouteGuard';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, Users, Package, DollarSign, CheckCircle, XCircle, MessageSquare, AlertTriangle, Flag, CreditCard, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole('admin');

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" />;
  }

  return (
    <AdminRouteGuard>
      <AdminDashboardContent 
        user={user!}
        isAdmin={isAdmin}
      />
    </AdminRouteGuard>
  );
}

function AdminDashboardContent({ user, isAdmin }: { user: any; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [moderationNotes, setModerationNotes] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);

  // Fetch platform analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const [productsRes, usersRes, purchasesRes, reviewsRes, disputesRes] = await Promise.all([
        db.from('dkai_products').select('*', { count: 'exact', head: true }),
        db.from('dkai_profiles').select('*', { count: 'exact', head: true }),
        db.from('dkai_purchases').select('amount').eq('status', 'completed'),
        db.from('dkai_reviews').select('*', { count: 'exact', head: true }),
        db.from('dkai_disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      ]);

      const totalRevenue = purchasesRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      return {
        totalProducts: productsRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalRevenue,
        totalReviews: reviewsRes.count || 0,
        openDisputes: disputesRes.count || 0,
      };
    },
    enabled: !!user && isAdmin,
  });

  // Fetch pending products for approval
  const { data: pendingProducts, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['admin-pending-products'],
    queryFn: async () => {
      console.log('Fetching pending products...');
      const { data, error } = await db
        .from('dkai_products')
        .select(`
          *,
          seller:profiles!products_seller_id_fkey (
            full_name,
            creator_name,
            username
          )
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending products:', error);
        throw error;
      }
      console.log('Pending products fetched:', data?.length);
      return data;
    },
    enabled: !!user && isAdmin,
  });

  // Fetch disputes
  const { data: disputes } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_disputes')
        .select(`
          *,
          dkai_products (
            title
          ),
          buyer:dkai_profiles!disputes_buyer_id_fkey (
            full_name,
            creator_name
          ),
          seller:dkai_profiles!disputes_seller_id_fkey (
            full_name,
            creator_name
          )
        `)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin && activeTab === 'disputes',
  });

  // Fetch seller applications
  const { data: sellerApplications } = useQuery({
    queryKey: ['admin-seller-applications'],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_seller_applications')
        .select('*')
        .eq('status', 'pending')
        .order('applied_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin && activeTab === 'seller-applications',
  });

  // Approve/reject product mutation
  const moderateProduct = useMutation({
    mutationFn: async ({ productId, status, notes }: { productId: string; status: 'approved' | 'rejected'; notes: string }) => {
      const { data: product, error: fetchError } = await db
        .from('dkai_products')
        .select('seller_id, title')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      const updateData: any = {
        approval_status: status,
        moderation_status: status,
        moderation_notes: notes,
        moderator_id: user?.id,
        moderated_at: new Date().toISOString(),
      };

      if (status === 'approved') {
        updateData.is_published = true;
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
        updateData.admin_rejection_reason = null;
      } else {
        updateData.is_published = false;
        updateData.admin_rejection_reason = notes;
        updateData.approved_at = null;
        updateData.approved_by = null;
      }

      const { error } = await db
        .from('dkai_products')
        .update(updateData)
        .eq('id', productId);

      if (error) throw error;

      // Send notification to seller
      await db.from('dkai_in_app_notifications').insert({
        user_id: product.seller_id,
        title: status === 'approved' ? 'Product Approved 🎉' : 'Product Rejected ❌',
        message: status === 'approved' 
          ? `Your product "${product.title}" is now visible to all buyers.`
          : `Your product "${product.title}" was rejected. Reason: ${notes || 'Please review our content guidelines'}. Please update and resubmit.`,
        type: status === 'approved' ? 'product_approved' : 'product_rejected',
        reference_id: productId,
      });

      return product;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-products'] });
      toast.success(variables.status === 'approved' ? 'Product approved successfully' : 'Product rejected');
      setSelectedProduct(null);
      setModerationNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Approve/reject seller application
  const moderateSellerApplication = useMutation({
    mutationFn: async ({ applicationId, userId, status, reason }: { applicationId: string; userId: string; status: 'approved' | 'rejected'; reason?: string }) => {
      // Update application
      const { error: appError } = await db
        .from('dkai_seller_applications')
        .update({
          status,
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', applicationId);

      if (appError) throw appError;

      if (status === 'approved') {
        // Add seller role
        const { error: roleError } = await db
          .from('dkai_user_roles')
          .insert({ user_id: userId, role: 'seller' });

        if (roleError && !roleError.message.includes('duplicate')) throw roleError;

        // Update profile
        const { error: profileError } = await db
          .from('dkai_profiles')
          .update({
            seller_verification_status: 'approved',
            seller_application_status: 'approved',
          })
          .eq('id', userId);

        if (profileError) throw profileError;

        // Add seller trophy/achievement
        await db
          .from('dkai_seller_achievements')
          .upsert({
            seller_id: userId,
            achievement_name: 'Seller Account Created',
            achievement_description: 'Congratulations! You created your seller account.',
            sales_count: 0,
            unlocked_at: new Date().toISOString(),
          }, { onConflict: 'seller_id,achievement_name' });

        // Send notification to seller
        await db.from('dkai_in_app_notifications').insert({
          user_id: userId,
          title: 'Achievement Unlocked 🏆',
          message: 'Congratulations! You created your seller account. You can now publish products and start selling!',
          type: 'achievement',
          reference_id: applicationId,
        });

        // Send approval notification
        await db.from('dkai_in_app_notifications').insert({
          user_id: userId,
          title: 'Seller Application Approved 🎉',
          message: 'Your seller application has been approved! You can now create and sell products on our marketplace.',
          type: 'seller_approved',
          reference_id: applicationId,
        });
      } else {
        // Update profile for rejection
        const { error: profileError } = await db
          .from('dkai_profiles')
          .update({
            seller_verification_status: 'rejected',
            seller_application_status: 'rejected',
            seller_rejection_reason: reason,
          })
          .eq('id', userId);

        if (profileError) throw profileError;

        // Send rejection notification
        await db.from('dkai_in_app_notifications').insert({
          user_id: userId,
          title: 'Seller Application Update',
          message: `Your seller application was not approved. Reason: ${reason || 'Please contact support for more information.'}`,
          type: 'seller_rejected',
          reference_id: applicationId,
        });
      }

      return { applicationId, status };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-seller-applications'] });
      toast.success(variables.status === 'approved' ? 'Seller approved and trophy awarded!' : 'Application rejected');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Resolve dispute mutation
  const resolveDispute = useMutation({
    mutationFn: async ({ disputeId, status, notes }: { disputeId: string; status: 'resolved' | 'closed'; notes: string }) => {
      const { error } = await supabase
        .from('disputes')
        .update({
          status,
          resolution_notes: notes,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      toast.success('Dispute resolved successfully');
      setSelectedDispute(null);
      setResolutionNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-2 mb-8">
        <ShieldCheck className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="moderation">
            Product Moderation
            {pendingProducts && pendingProducts.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingProducts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="seller-applications">
            Seller Applications
            {sellerApplications && sellerApplications.length > 0 && (
              <Badge variant="destructive" className="ml-2">{sellerApplications.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="disputes">
            Disputes
            {analytics?.openDisputes ? (
              <Badge variant="destructive" className="ml-2">{analytics.openDisputes}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalProducts || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalUsers || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${analytics?.totalRevenue.toFixed(2) || '0.00'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalReviews || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Open Disputes</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.openDisputes || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5 text-destructive" />
                  User Reports
                </CardTitle>
                <CardDescription>
                  View and manage user reports and conversations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/disputes">
                  <Button className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Reports & Conversations
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Settings
                </CardTitle>
                <CardDescription>
                  Configure platform payment settings and admin IBAN
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/payment-settings">
                  <Button className="w-full" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Payment Settings
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Refund Disputes
                </CardTitle>
                <CardDescription>
                  Review and process refund requests from buyers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/refund-disputes">
                  <Button className="w-full" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Refund Requests
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Product Moderation Tab */}
        <TabsContent value="moderation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Product Approvals</CardTitle>
              <CardDescription>Review and moderate products waiting for approval</CardDescription>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : productsError ? (
                <div className="text-center text-destructive py-8">
                  Error loading products: {(productsError as Error).message}
                </div>
              ) : pendingProducts && pendingProducts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingProducts.map((product: any) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.image_url && (
                              <img src={product.image_url} alt={product.title} className="w-10 h-10 rounded object-cover" />
                            )}
                            <span className="font-medium">{product.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>@{product.seller?.username || product.seller?.creator_name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.product_type}</Badge>
                        </TableCell>
                        <TableCell>${product.price}</TableCell>
                        <TableCell>{format(new Date(product.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setSelectedProduct(product)}>
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Review Product: {product.title}</DialogTitle>
                                <DialogDescription>
                                  Review all product details before approving or rejecting
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-6">
                                {/* Product Image */}
                                {product.image_url && (
                                  <div>
                                    <Label className="text-sm font-semibold">Product Image</Label>
                                    <img src={product.image_url} alt={product.title} className="w-full max-h-64 object-cover rounded-lg mt-2" />
                                  </div>
                                )}

                                {/* Basic Info */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-semibold">Title</Label>
                                    <p className="text-sm text-muted-foreground">{product.title}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-semibold">Type</Label>
                                    <p className="text-sm text-muted-foreground">{product.product_type}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-semibold">Price</Label>
                                    <p className="text-sm text-muted-foreground">${product.price} ({product.pricing_model})</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-semibold">Seller</Label>
                                    <Link to={`/profile/${product.seller_id}`} className="text-sm text-primary hover:underline">
                                      @{product.seller?.username || product.seller?.creator_name || 'Unknown'}
                                    </Link>
                                  </div>
                                </div>

                                {/* Description */}
                                <div>
                                  <Label className="text-sm font-semibold">Description</Label>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description || 'No description'}</p>
                                </div>

                                {/* Purpose & Value */}
                                <div className="grid grid-cols-2 gap-4">
                                  {product.purpose && (
                                    <div>
                                      <Label className="text-sm font-semibold">Purpose</Label>
                                      <p className="text-sm text-muted-foreground">{product.purpose}</p>
                                    </div>
                                  )}
                                  {product.target_audience && (
                                    <div>
                                      <Label className="text-sm font-semibold">Target Audience</Label>
                                      <p className="text-sm text-muted-foreground">{product.target_audience}</p>
                                    </div>
                                  )}
                                  {product.value_proposition && (
                                    <div>
                                      <Label className="text-sm font-semibold">Value Proposition</Label>
                                      <p className="text-sm text-muted-foreground">{product.value_proposition}</p>
                                    </div>
                                  )}
                                  {product.problem_solved && (
                                    <div>
                                      <Label className="text-sm font-semibold">Problem Solved</Label>
                                      <p className="text-sm text-muted-foreground">{product.problem_solved}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Features */}
                                {product.features && product.features.length > 0 && (
                                  <div>
                                    <Label className="text-sm font-semibold">Features</Label>
                                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                                      {product.features.map((f: string, i: number) => <li key={i}>{f}</li>)}
                                    </ul>
                                  </div>
                                )}

                                {/* Tags */}
                                {product.tags && product.tags.length > 0 && (
                                  <div>
                                    <Label className="text-sm font-semibold">Tags</Label>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {product.tags.map((t: string, i: number) => (
                                        <Badge key={i} variant="secondary">{t}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* FAQs */}
                                {product.faqs && product.faqs.length > 0 && (
                                  <div>
                                    <Label className="text-sm font-semibold">FAQs</Label>
                                    <div className="space-y-2 mt-1">
                                      {(product.faqs as any[]).map((faq: any, i: number) => (
                                        <div key={i} className="bg-muted/50 p-2 rounded">
                                          <p className="font-medium text-sm">{faq.question}</p>
                                          <p className="text-sm text-muted-foreground">{faq.answer}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* File Info */}
                                {product.file_storage_key && (
                                  <div>
                                    <Label className="text-sm font-semibold">Uploaded File</Label>
                                    <p className="text-sm text-muted-foreground">
                                      Size: {product.file_size_bytes ? `${(product.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}
                                      {' | '}Scan Status: <Badge variant={product.file_scan_status === 'clean' ? 'default' : 'destructive'}>{product.file_scan_status || 'pending'}</Badge>
                                    </p>
                                  </div>
                                )}

                                {/* Additional Details */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  {product.demo_url && (
                                    <div>
                                      <Label className="text-sm font-semibold">Demo URL</Label>
                                      <a href={product.demo_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{product.demo_url}</a>
                                    </div>
                                  )}
                                  {product.video_url && (
                                    <div>
                                      <Label className="text-sm font-semibold">Video URL</Label>
                                      <a href={product.video_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{product.video_url}</a>
                                    </div>
                                  )}
                                  {product.refund_policy && (
                                    <div className="col-span-2">
                                      <Label className="text-sm font-semibold">Refund Policy</Label>
                                      <p className="text-muted-foreground">{product.refund_policy}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Moderation Notes */}
                                <div>
                                  <Label htmlFor="moderation_notes" className="text-sm font-semibold">
                                    {selectedProduct?.id === product.id ? 'Rejection Reason (required for rejection)' : 'Moderation Notes'}
                                  </Label>
                                  <Textarea
                                    id="moderation_notes"
                                    placeholder="Enter rejection reason or notes..."
                                    value={moderationNotes}
                                    onChange={(e) => setModerationNotes(e.target.value)}
                                    rows={3}
                                  />
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                  <Button
                                    className="flex-1"
                                    onClick={() => moderateProduct.mutate({
                                      productId: product.id,
                                      status: 'approved',
                                      notes: moderationNotes
                                    })}
                                    disabled={moderateProduct.isPending}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Approve
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => {
                                      if (!moderationNotes.trim()) {
                                        toast.error('Please provide a rejection reason');
                                        return;
                                      }
                                      moderateProduct.mutate({
                                        productId: product.id,
                                        status: 'rejected',
                                        notes: moderationNotes
                                      });
                                    }}
                                    disabled={moderateProduct.isPending}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No pending products</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disputes Tab */}
        <TabsContent value="disputes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Open Disputes</CardTitle>
              <CardDescription>Mediate disputes between buyers and sellers</CardDescription>
            </CardHeader>
            <CardContent>
              {disputes && disputes.length > 0 ? (
                <div className="space-y-4">
                  {disputes.map((dispute: any) => (
                    <Card key={dispute.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{dispute.subject}</CardTitle>
                            <CardDescription>
                              Product: {dispute.products?.title}
                            </CardDescription>
                          </div>
                          <Badge>{dispute.status}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm"><strong>Buyer:</strong> {dispute.buyer?.creator_name || dispute.buyer?.full_name}</p>
                          <p className="text-sm"><strong>Seller:</strong> {dispute.seller?.creator_name || dispute.seller?.full_name}</p>
                          <p className="text-sm mt-2">{dispute.description}</p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button onClick={() => setSelectedDispute(dispute)}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Resolve Dispute
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Resolve Dispute</DialogTitle>
                              <DialogDescription>
                                Provide resolution notes and close the dispute
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="resolution_notes">Resolution Notes</Label>
                                <Textarea
                                  id="resolution_notes"
                                  placeholder="Explain your resolution decision..."
                                  value={resolutionNotes}
                                  onChange={(e) => setResolutionNotes(e.target.value)}
                                  rows={5}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  className="flex-1"
                                  onClick={() => resolveDispute.mutate({
                                    disputeId: dispute.id,
                                    status: 'resolved',
                                    notes: resolutionNotes
                                  })}
                                >
                                  Mark as Resolved
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => resolveDispute.mutate({
                                    disputeId: dispute.id,
                                    status: 'closed',
                                    notes: resolutionNotes
                                  })}
                                >
                                  Close Dispute
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No open disputes</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seller Applications Tab */}
        <TabsContent value="seller-applications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Seller Applications</CardTitle>
              <CardDescription>Review and approve/reject seller applications</CardDescription>
            </CardHeader>
            <CardContent>
              {sellerApplications && sellerApplications.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Creator Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellerApplications.map((application: any) => (
                      <TableRow key={application.id}>
                        <TableCell>
                          {application.first_name} {application.last_name}
                        </TableCell>
                        <TableCell>{application.creator_name}</TableCell>
                        <TableCell>{application.country}</TableCell>
                        <TableCell>
                          {format(new Date(application.applied_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">Review</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Review Seller Application</DialogTitle>
                                <DialogDescription>
                                  Review application details and approve or reject
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Full Name</Label>
                                    <p className="text-sm text-muted-foreground">
                                      {application.first_name} {application.last_name}
                                    </p>
                                  </div>
                                  <div>
                                    <Label>Creator Name</Label>
                                    <p className="text-sm text-muted-foreground">{application.creator_name}</p>
                                  </div>
                                  <div>
                                    <Label>Country</Label>
                                    <p className="text-sm text-muted-foreground">{application.country}</p>
                                  </div>
                                  <div>
                                    <Label>Applied</Label>
                                    <p className="text-sm text-muted-foreground">
                                      {format(new Date(application.applied_at), 'MMM dd, yyyy HH:mm')}
                                    </p>
                                  </div>
                                </div>
                                {application.bio && (
                                  <div>
                                    <Label>Bio</Label>
                                    <p className="text-sm text-muted-foreground">{application.bio}</p>
                                  </div>
                                )}
                                <div className="flex gap-2 pt-4">
                                  <Button
                                    className="flex-1"
                                    onClick={() => moderateSellerApplication.mutate({
                                      applicationId: application.id,
                                      userId: application.user_id,
                                      status: 'approved',
                                    })}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Approve Seller
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="destructive" className="flex-1">
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Reject
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Reject Application</DialogTitle>
                                        <DialogDescription>
                                          Please provide a reason for rejection
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div>
                                          <Label htmlFor="rejection_reason">Reason</Label>
                                          <Textarea
                                            id="rejection_reason"
                                            placeholder="Explain why this application is being rejected..."
                                            rows={3}
                                          />
                                        </div>
                                        <Button
                                          variant="destructive"
                                          className="w-full"
                                          onClick={() => {
                                            const reason = (document.getElementById('rejection_reason') as HTMLTextAreaElement)?.value;
                                            moderateSellerApplication.mutate({
                                              applicationId: application.id,
                                              userId: application.user_id,
                                              status: 'rejected',
                                              reason,
                                            });
                                          }}
                                        >
                                          Confirm Rejection
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No pending applications</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>View all registered users</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">User management coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
