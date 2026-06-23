import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Zap, Lock, HardDrive, ShieldCheck } from 'lucide-react';

// Local cache key — only used for instant UX. DB flag is the source of truth.
const LOCAL_CACHE_KEY = 'dkai_seller_guidelines_ack_v2';

/**
 * One-time orientation modal for new sellers. The acknowledgement is
 * persisted on dkai_profiles.has_seen_seller_orientation so it survives
 * across devices/browsers. localStorage is only a fast-path cache.
 */
export function SellerGuidelinesModal() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading } = useHasRole('seller');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading || !user || !isSeller) return;
    let cancelled = false;

    const cacheKey = `${LOCAL_CACHE_KEY}:${user.id}`;
    if (localStorage.getItem(cacheKey)) return; // already seen on this device

    (async () => {
      const { data, error } = await db
        .from('dkai_profiles')
        .select('has_seen_seller_orientation')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) return;
      if (data?.has_seen_seller_orientation) {
        localStorage.setItem(cacheKey, '1');
        return;
      }
      setOpen(true);
    })();

    return () => { cancelled = true; };
  }, [user, isSeller, isLoading]);

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
            Two things every seller should know before listing a product.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <h3 className="text-sm font-semibold mb-2">3 delivery modes</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Instant</strong> — hosted by us, auto-delivered on payment.</span>
              </li>
              <li className="flex gap-2">
                <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Protected</strong> — encrypted, unlocked after confirmation.</span>
              </li>
              <li className="flex gap-2">
                <HardDrive className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Direct</strong> — you keep the file, Stripe holds the money.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex gap-2">
            <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">
              <strong>Every product is reviewed</strong> by our team before going live —
              typically within 48 hours.
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
