import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { useSellerProducts } from '@/hooks/useAnalytics';
import { useAllProductsAnalytics } from '@/hooks/useProductAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Eye, MousePointer, ShoppingCart, Pencil, Trash2, Plus, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/SellerSidebar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function MyProducts() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const navigate = useNavigate();

  const { data: products, isLoading: productsLoading, refetch } = useSellerProducts(user?.id);
  const { data: productsAnalytics, isLoading: productsAnalyticsLoading } = useAllProductsAnalytics(user?.id);

  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [togglingProductId, setTogglingProductId] = useState<string | null>(null);
  const [resubmittingProductId, setResubmittingProductId] = useState<string | null>(null);

  if (roleLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSeller && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Seller Access Required</CardTitle>
            <CardDescription>
              You need a seller account to access this page. Please contact an administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleTogglePublish = async (productId: string, currentStatus: boolean, approvalStatus: string) => {
    if (togglingProductId) return;
    
    // Can only toggle publish if approved
    if (approvalStatus !== 'approved') {
      toast.error('Product must be approved before publishing');
      return;
    }

    setTogglingProductId(productId);

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_published: !currentStatus })
        .eq('id', productId);

      if (error) throw error;

      toast.success(currentStatus ? 'Product unpublished' : 'Product published');
      refetch();
    } catch (error) {
      console.error('Error toggling publish status:', error);
      toast.error('Failed to update product status');
    } finally {
      setTogglingProductId(null);
    }
  };

  const handleResubmit = async (productId: string) => {
    if (resubmittingProductId) return;
    
    setResubmittingProductId(productId);

    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          approval_status: 'pending',
          admin_rejection_reason: null,
        })
        .eq('id', productId);

      if (error) throw error;

      toast.success('Product resubmitted for approval');
      refetch();
    } catch (error) {
      console.error('Error resubmitting product:', error);
      toast.error('Failed to resubmit product');
    } finally {
      setResubmittingProductId(null);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProductId) return;

    try {
      // Get product details to delete image
      const { data: product } = await supabase
        .from('products')
        .select('image_url')
        .eq('id', deletingProductId)
        .single();

      // Delete product image from storage if it exists
      if (product?.image_url) {
        const fileName = product.image_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('product-images').remove([fileName]);
        }
      }

      // Delete product (this will cascade delete related records)
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deletingProductId);

      if (error) throw error;

      toast.success('Product deleted successfully');
      setShowDeleteDialog(false);
      setDeletingProductId(null);
      refetch();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const isLoading = productsLoading || productsAnalyticsLoading;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <SellerSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center px-6 sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-xl font-bold">My Products</h1>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-6 py-8 max-w-7xl">
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold mb-2">My Products</h1>
                  <p className="text-muted-foreground">
                    Manage your products - edit, publish, unpublish, or delete
                  </p>
                </div>
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/create-product">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Product
                  </Link>
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : products && products.length > 0 ? (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>Your Products</CardTitle>
                    <CardDescription>
                      {products.length} product{products.length !== 1 ? 's' : ''} total
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Views</TableHead>
                            <TableHead>Clicks</TableHead>
                            <TableHead>Sales</TableHead>
                            <TableHead>Approval</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((product) => {
                            const analytics = productsAnalytics?.find(a => a.product_id === product.id);
                            const isToggling = togglingProductId === product.id;
                            const isResubmitting = resubmittingProductId === product.id;
                            const approvalStatus = (product as any).approval_status || 'pending';

                            return (
                              <TableRow key={product.id}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    {product.image_url && (
                                      <img
                                        src={product.image_url}
                                        alt={product.title}
                                        className="w-12 h-12 rounded-lg object-cover"
                                      />
                                    )}
                                    <div>
                                      <div className="font-medium max-w-[200px] truncate">
                                        {product.title}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        ID: {product.id.slice(0, 8)}...
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold">
                                  ${product.price}
                                  {product.pricing_model === 'monthly' && '/mo'}
                                  {product.pricing_model === 'yearly' && '/yr'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="rounded-full capitalize">
                                    {product.pricing_model.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                    {analytics?.total_views || 0}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <MousePointer className="h-3 w-3 text-muted-foreground" />
                                    {analytics?.total_clicks || 0}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                                    {analytics?.total_purchases || 0}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <TooltipProvider>
                                    <div className="flex flex-col gap-1">
                                      {approvalStatus === 'pending' && (
                                        <Badge variant="outline" className="rounded-full bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                          <Clock className="h-3 w-3 mr-1" />
                                          Pending Review
                                        </Badge>
                                      )}
                                      {approvalStatus === 'approved' && (
                                        <Badge variant="outline" className="rounded-full bg-green-500/10 text-green-600 border-green-500/30">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Approved
                                        </Badge>
                                      )}
                                      {approvalStatus === 'rejected' && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="flex flex-col gap-1">
                                              <Badge variant="outline" className="rounded-full bg-destructive/10 text-destructive border-destructive/30">
                                                <XCircle className="h-3 w-3 mr-1" />
                                                Rejected
                                              </Badge>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="rounded-full text-xs h-6"
                                                onClick={() => handleResubmit(product.id)}
                                                disabled={isResubmitting}
                                              >
                                                {isResubmitting ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <>
                                                    <RefreshCw className="h-3 w-3 mr-1" />
                                                    Resubmit
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                            <p className="font-semibold">Rejection Reason:</p>
                                            <p className="text-sm">{(product as any).admin_rejection_reason || 'No reason provided'}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={product.is_published}
                                      onCheckedChange={() => handleTogglePublish(product.id, product.is_published, approvalStatus)}
                                      disabled={isToggling || approvalStatus !== 'approved'}
                                    />
                                    <Badge
                                      variant={product.is_published ? 'default' : 'secondary'}
                                      className="rounded-full"
                                    >
                                      {product.is_published ? 'Published' : 'Unpublished'}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(product.updated_at), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      asChild
                                      variant="outline"
                                      size="sm"
                                      className="rounded-full"
                                    >
                                      <Link to={`/edit-product/${product.id}`}>
                                        <Pencil className="h-3 w-3 mr-1" />
                                        Edit
                                      </Link>
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="rounded-full"
                                      onClick={() => {
                                        setDeletingProductId(product.id);
                                        setShowDeleteDialog(true);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Delete
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-2xl">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <Plus className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-xl font-semibold">No products yet</h3>
                      <p className="text-muted-foreground max-w-md">
                        Start selling by creating your first product. Add details, images, and pricing to get started.
                      </p>
                      <Button asChild size="lg" className="rounded-full mt-4">
                        <Link to="/create-product">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Your First Product
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your product
              and remove all associated data including images, analytics, and tags.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingProductId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
