import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle, MessageSquare, Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function Disputes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  // Fetch user's orders eligible for a dispute
  const { data: purchases } = useQuery({
    queryKey: ['user-orders-for-dispute', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dkai_orders')
        .select('id, seller_id, product_id, status, price, created_at, dkai_products:product_id (id, title)')
        .eq('buyer_id', user?.id)
        .in('status', ['paid', 'completed', 'delivered', 'released'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((o: any) => ({ ...o, products: o.dkai_products }));
    },
    enabled: !!user,
  });

  // Fetch user's disputes
  const { data: disputes, isLoading } = useQuery({
    queryKey: ['disputes', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dkai_disputes')
        .select('*, dkai_products:product_id (id, title)')
        .or(`buyer_id.eq.${user?.id},seller_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []).map((d: any) => ({ ...d, products: d.dkai_products }));
      const userIds = Array.from(new Set(rows.flatMap((d: any) => [d.buyer_id, d.seller_id]).filter(Boolean)));
      if (userIds.length) {
        const { data: profs } = await (supabase as any)
          .from('dkai_profiles')
          .select('id, full_name, creator_name')
          .in('id', userIds);
        const m = new Map((profs || []).map((p: any) => [p.id, p]));
        rows.forEach((d: any) => {
          d.buyer = m.get(d.buyer_id);
          d.seller = m.get(d.seller_id);
        });
      }
      return rows;
    },
    enabled: !!user,
  });

  const createDispute = useMutation({
    mutationFn: async () => {
      // Input validation
      if (!selectedPurchase || !subject.trim() || !description.trim()) {
        throw new Error('Please fill in all fields');
      }

      // Subject validation
      if (subject.trim().length < 5 || subject.trim().length > 200) {
        throw new Error('Subject must be between 5 and 200 characters');
      }

      // Description validation
      if (description.trim().length < 20 || description.trim().length > 5000) {
        throw new Error('Description must be between 20 and 5000 characters');
      }

      // Content moderation check
      const { moderateContent } = await import('@/utils/contentModeration');
      const subjectCheck = moderateContent(subject);
      const descCheck = moderateContent(description);
      
      if (!subjectCheck.isValid) {
        throw new Error(`Subject validation failed: ${subjectCheck.reason}`);
      }
      
      if (!descCheck.isValid) {
        throw new Error(`Description validation failed: ${descCheck.reason}`);
      }

      const purchase = purchases?.find((p: any) => p.id === selectedPurchase);
      if (!purchase) throw new Error('Order not found');

      const { error } = await (supabase as any)
        .from('dkai_disputes')
        .insert({
          order_id: selectedPurchase,
          buyer_id: user?.id,
          seller_id: purchase.seller_id,
          product_id: purchase.product_id,
          subject: subject.trim(),
          description: description.trim(),
          reason: subject.trim(),
          type: 'general',
          status: 'open',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      toast.success('Dispute created successfully');
      setDialogOpen(false);
      setSelectedPurchase(null);
      setSubject('');
      setDescription('');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'resolved':
        return 'outline';
      case 'closed':
        return 'outline';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">Disputes</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-1/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Disputes</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Dispute
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Dispute</DialogTitle>
              <DialogDescription>
                Report an issue with a purchase to resolve with the seller
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="purchase">Select Purchase</Label>
                <Select value={selectedPurchase || ''} onValueChange={setSelectedPurchase}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a purchase" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchases?.map((purchase: any) => (
                      <SelectItem key={purchase.id} value={purchase.id}>
                        {purchase.products?.title || 'Product'} — ${Number(purchase.price ?? 0).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Brief description of the issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  {subject.length}/200 characters (minimum 5 required)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Detailed Description</Label>
                <Textarea
                  id="description"
                  placeholder="Explain the issue in detail..."
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={5000}
                />
                <p className="text-xs text-muted-foreground">
                  {description.length}/5000 characters (minimum 20 required)
                </p>
              </div>
              <Button onClick={() => createDispute.mutate()} className="w-full">
                Submit Dispute
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!disputes || disputes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Disputes</h3>
            <p className="text-muted-foreground">You don't have any disputes at the moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute: any) => (
            <Card key={dispute.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {dispute.subject}
                      <Badge variant={getStatusColor(dispute.status)}>
                        {dispute.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Product: {dispute.products.title}
                    </CardDescription>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(dispute.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">{dispute.description}</p>
                {dispute.resolution_notes && (
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Resolution:</h4>
                    <p className="text-sm">{dispute.resolution_notes}</p>
                  </div>
                )}
                <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                  <span>Buyer: {dispute.buyer?.creator_name || dispute.buyer?.full_name}</span>
                  <span>Seller: {dispute.seller?.creator_name || dispute.seller?.full_name}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
