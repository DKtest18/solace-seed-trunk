import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { db } from '@/lib/dkaiDb';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, Lock, HardDrive, ShieldCheck, CreditCard } from 'lucide-react';

const LOCAL_CACHE_KEY = 'dkai_seller_guidelines_ack_v2';

/**
 * One-time seller orientation. Shows exactly once, on the Seller Dashboard,
 * right after activation. Persisted on dkai_profiles.has_seen_seller_orientation.
 */
export function SellerGuidelinesModal() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading } = useHasRole('seller');
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only show on the seller dashboard — never on top of unrelated pages.
    if (isLoading || !user || !isSeller) return;
    if (location.pathname !== '/seller-dashboard') return;

    let cancelled = false;
    const cacheKey = `${LOCAL_CACHE_KEY}:${user.id}`;
    if (localStorage.getItem(cacheKey)) return;

    (async () => {
      const { data, error } = await db
        .from('dkai_profiles')
        .select('has_seen_seller_orientation')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled || error) return;
      if (data?.has_seen_seller_orientation) {
        localStorage.setItem(cacheKey, '1');
        return;
      }
      setOpen(true);
    })();

    return () => { cancelled = true; };
  }, [user, isSeller, isLoading, location.pathname]);

  const handleAck = async () => {
    setOpen(false);
    if (!user) return;
    localStorage.setItem(`${LOCAL_CACHE_KEY}:${user.id}`, '1');
    try {
      await db
        .from('dkai_profiles')
        .update({ has_seen_seller_orientation: true })
        .eq('id', user.id);
    } catch (e) {
      console.warn('Failed to persist seller orientation ack', e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleAck()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Welcome, seller — a quick orientation</DialogTitle>
          <DialogDescription>
            A few things worth knowing before you publish your first product.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <h3 className="text-sm font-semibold mb-2">Delivery modes you can choose from</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Instant delivery</strong> — you upload the file, we host it, and the buyer gets an automatic download link the moment payment succeeds.</span>
              </li>
              <li className="flex gap-2">
                <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Protected delivery</strong> — the file is stored encrypted; the buyer unlocks it via a signed link after the payment is confirmed.</span>
              </li>
              <li className="flex gap-2">
                <HardDrive className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Direct delivery</strong> — you keep the file yourself and deliver it to the buyer after payment (e.g. custom access, private link, or account provisioning).</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex gap-2">
            <CreditCard className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">
              Payments are processed by Stripe and go directly to your Stripe account. Stripe's standard payment processing fees apply. Platform fee is 0% for the first 20 platform sales (launch promo).
            </p>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex gap-2">
            <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">
              <strong>Every product is reviewed</strong> by our team before going live — typically within 48 hours.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Read the full{' '}
            <Link to="/seller-guidelines" className="text-primary hover:underline" onClick={handleAck}>
              Seller Guidelines
            </Link>{' '}
            for delivery recommendations, data storage, and your responsibilities.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={handleAck} className="w-full">Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
