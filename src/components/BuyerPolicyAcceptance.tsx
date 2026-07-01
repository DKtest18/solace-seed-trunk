import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle } from 'lucide-react';
import { usePlatformFee } from '@/hooks/usePlatformFee';

interface BuyerPolicyAcceptanceProps {
  onAccept: () => void;
  isLoading?: boolean;
}

const buildPolicies = (feePct: number, launchPromoActive: boolean) => [
  "After the seller's return window has expired, refunds are only possible with a valid reason and supporting evidence (e.g. defective or misrepresented product).",
  "No abuse of the dispute system - false claims may result in account suspension.",
  "Payments are processed by Stripe and go directly to the seller's Stripe account. " +
    (launchPromoActive
      ? "Platform fee: 0% during the launch promo (first 20 sales on the platform)."
      : `Platform fee: ${feePct}%.`) +
    " Stripe's standard payment processing fees apply and are borne by the seller.",
  "You must treat sellers fairly within the platform.",
  "You must provide evidence (screenshots, logs) when claiming a product is defective.",
  "The return window is set by the seller (minimum 24 hours, maximum 90 days). If you return the product within this period, you receive a full refund of the purchase price to your original payment method, issued via Stripe. This is your unconditional contractual return right within the window.",
  "The seller may send you up to 3 reminder notifications (in-app and by email) asking you to confirm receipt and leave a review. By purchasing, you consent to receiving these order-related communications.",
  "If the product is not as described, you have a mandatory minimum 24-hour return right regardless of the seller's return policy.",
  "For any questions or problems, contact support@dkaimarketplace.com",
];

export function BuyerPolicyAcceptance({ onAccept, isLoading }: BuyerPolicyAcceptanceProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [withdrawalWaiver, setWithdrawalWaiver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { feePct, launchPromoActive } = usePlatformFee();
  const BUYER_POLICIES = buildPolicies(feePct, launchPromoActive);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <CardTitle>Buyer Terms & Conditions</CardTitle>
        </div>
        <CardDescription>
          Please read and accept the following terms before completing your purchase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            You must scroll through and read all terms before accepting
          </p>
        </div>

        <ScrollArea
          className="h-64 border rounded-lg p-4"
          onScrollCapture={handleScroll}
        >
          <div className="space-y-4">
            <h3 className="font-semibold text-lg mb-4">Buyer Obligations & Rights</h3>
            <ol className="list-decimal list-inside space-y-3">
              {BUYER_POLICIES.map((policy, index) => (
                <li key={index} className="text-sm leading-relaxed">
                  {policy}
                </li>
              ))}
            </ol>

            <div className="mt-6 pt-4 border-t">
              <h4 className="font-semibold mb-2">Payment</h4>
              <p className="text-sm text-muted-foreground">
                Payments are processed by Stripe and go directly to the seller's Stripe account.{' '}
                {launchPromoActive
                  ? '0% platform fee during the launch promo (first 20 sales on the platform).'
                  : `Platform fee: ${feePct}%.`}{' '}
                Stripe's standard payment processing fees apply and are borne by the seller.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold mb-2">Returns & Refunds</h4>
              <p className="text-sm text-muted-foreground">
                Each product has a return window set by the seller (minimum 24 hours, maximum
                90 days). If you return the product within this window, you receive a full refund
                of the purchase price to your original payment method, issued via Stripe. After
                the return window has expired, refunds are only possible with a valid reason and
                supporting evidence.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold mb-2">Seller Reminders & Reviews</h4>
              <p className="text-sm text-muted-foreground">
                The seller may send you up to 3 reminders (in-app notification + email) asking
                you to confirm receipt and leave a review. By purchasing, you consent to receiving
                these order-related communications. Reviews help the community and improve seller quality.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold mb-2 text-primary">EU Right of Withdrawal (Widerrufsrecht)</h4>
              <p className="text-sm text-muted-foreground">
                Under EU Directive 2011/83/EU, consumers have a 14-day right of withdrawal for
                distance contracts. However, for <strong>digital content</strong> (software, AI agents,
                digital downloads), this right can be waived if you expressly consent to immediate
                delivery and acknowledge the loss of your right of withdrawal. By checking the
                withdrawal waiver below, you agree that delivery of digital content begins immediately
                upon purchase.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold mb-2">Support</h4>
              <p className="text-sm text-muted-foreground">
                For any questions or problems, contact{' '}
                <a href="mailto:support@dkaimarketplace.com" className="text-primary underline">
                  support@dkaimarketplace.com
                </a>
              </p>
            </div>

            <div className="h-4" />
          </div>
        </ScrollArea>

        <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Checkbox
            id="withdrawal-waiver"
            checked={withdrawalWaiver}
            onCheckedChange={(checked) => setWithdrawalWaiver(checked === true)}
            disabled={!hasScrolledToBottom}
          />
          <label
            htmlFor="withdrawal-waiver"
            className={`text-sm cursor-pointer ${!hasScrolledToBottom ? 'text-muted-foreground' : ''}`}
          >
            <span className="font-semibold">Waiver of Right of Withdrawal (EU):</span>{' '}
            I expressly consent to the immediate delivery of digital content and acknowledge
            that I lose my 14-day right of withdrawal once the digital content has been delivered
            (Art. 16(m) EU Directive 2011/83/EU, § 356 Abs. 5 BGB).
          </label>
        </div>

        <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
          <Checkbox
            id="accept-buyer-policy"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
            disabled={!hasScrolledToBottom}
          />
          <label
            htmlFor="accept-buyer-policy"
            className={`text-sm cursor-pointer ${!hasScrolledToBottom ? 'text-muted-foreground' : ''}`}
          >
            I have read and agree to all buyer terms and conditions. I understand that payment is
            processed by Stripe and goes directly to the seller, and that returns within the
            seller's return window are refunded in full to my original payment method via Stripe.
            I consent to receiving up to 3 order-related reminder emails from the seller.
          </label>
        </div>

        {!hasScrolledToBottom && (
          <p className="text-xs text-muted-foreground text-center">
            Scroll to the bottom to enable acceptance
          </p>
        )}

        <Button
          onClick={onAccept}
          disabled={!accepted || !withdrawalWaiver || isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? 'Processing...' : 'Accept & Continue to Payment'}
        </Button>
      </CardContent>
    </Card>
  );
}
