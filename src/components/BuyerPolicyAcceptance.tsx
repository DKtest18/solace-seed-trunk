import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle } from 'lucide-react';

interface BuyerPolicyAcceptanceProps {
  onAccept: () => void;
  isLoading?: boolean;
}

const buildPolicies = () => [
  "Refunds are only granted through DK AI Marketplace support review, for exactly two reasons: (1) the product was not delivered within the promised delivery time, or (2) the product is materially not as described.",
  "There are no unconditional returns, no self-service instant refunds, and no seller-set return windows or return fees.",
  "Refund requests must be filed within 14 days of purchase, with a description and any evidence (screenshots, logs). Approved refunds are for the FULL purchase price and are issued via Stripe to your original payment method, typically within 24–72 hours of approval.",
  "Abuse of the refund system (false claims, chargeback fraud) may result in account suspension.",
  "Upon a refund, your license to use the product ends immediately. Any further use, copying, or distribution of the delivered files is a breach of contract and a copyright infringement.",
  "Payments are processed by Stripe or PayPal and go directly to the seller's connected payment account. Any platform fee is deducted from the seller's payout and never added to your price. Stripe's standard payment processing fees apply and are borne by the seller.",
  "You must treat sellers fairly within the platform.",
  "The seller may send you up to 3 reminder notifications (in-app and by email) asking you to confirm receipt and leave a review. By purchasing, you consent to receiving these order-related communications.",
  "For any questions or problems, contact support@dkaimarketplace.com",
];

export function BuyerPolicyAcceptance({ onAccept, isLoading }: BuyerPolicyAcceptanceProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [withdrawalWaiver, setWithdrawalWaiver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const BUYER_POLICIES = buildPolicies();

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
                Payments are processed by Stripe or PayPal and go directly to the seller's connected payment account.{' '}
                Any platform fee is deducted from the seller's payout and is never added to your
                price.{' '}
                Stripe's standard payment processing fees apply and are borne by the seller.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold mb-2">Refunds</h4>
              <p className="text-sm text-muted-foreground">
                Refunds are only granted through DK AI Marketplace support review, for two
                reasons: the product was not delivered, or the product is materially not as
                described. Requests must be filed within 14 days of purchase. Approved refunds
                are for the full purchase price and are issued via Stripe to your original
                payment method, typically within 24–72 hours of approval.
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
            processed by Stripe or PayPal and goes directly to the seller, and that refunds are only
            granted through DK AI Marketplace support review for products that were not
            delivered or are materially not as described. I consent to receiving up to 3
            order-related reminder emails from the seller.
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
