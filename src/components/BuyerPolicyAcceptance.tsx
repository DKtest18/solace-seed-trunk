import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle } from 'lucide-react';

interface BuyerPolicyAcceptanceProps {
  onAccept: () => void;
  isLoading?: boolean;
}

const BUYER_POLICIES = [
  "No refunds without valid reason - you must provide evidence if claiming product issues",
  "No abuse of the dispute system - false claims may result in account suspension",
  "Payment is held in escrow (on Stripe) until you confirm receipt of the product. 90% goes to the seller and 10% to the platform only after the return window expires.",
  "You must treat sellers fairly within the platform",
  "You must provide evidence (screenshots, logs) when claiming a product is defective",
  "The return window is set by the seller (minimum 24 hours, maximum 90 days). You can return the product within this period and receive a 100% refund to your original payment method.",
  "If you do not confirm receipt or take any action by the end of the return window, the payment is automatically released to the seller.",
  "The seller may send you up to 3 reminder notifications (in-app and by email) asking you to confirm receipt and leave a review. By purchasing, you consent to receiving these order-related communications.",
  "If the product is not as described, you have a mandatory minimum 24-hour return right regardless of the seller's return policy.",
  "For any questions or problems, contact support@dkaimarketplace.com"
];

export function BuyerPolicyAcceptance({ onAccept, isLoading }: BuyerPolicyAcceptanceProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
              <h4 className="font-semibold mb-2">Escrow Protection & Payment</h4>
              <p className="text-sm text-muted-foreground">
                Your payment is protected through Stripe escrow. Funds are held securely 
                and only released after the return window expires. The seller receives 90% and 
                10% goes to the platform. If you return within the valid window, you receive 
                a 100% refund to your original payment method.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold mb-2">Return Window & Auto-Release</h4>
              <p className="text-sm text-muted-foreground">
                Each product has a return window (min 24 hours, max 90 days) set by the seller. 
                If you do not confirm receipt or open a dispute before the return window ends, 
                payment is automatically released to the seller. The seller cannot access funds 
                until this period has passed.
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
              <h4 className="font-semibold mb-2">Support</h4>
              <p className="text-sm text-muted-foreground">
                For any questions or problems, contact{' '}
                <a href="mailto:support@dkaimarketplace.com" className="text-primary underline">
                  support@dkaimarketplace.com
                </a>
              </p>
            </div>

            <div className="h-4" /> {/* Spacer for scroll detection */}
          </div>
        </ScrollArea>

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
            I have read and agree to all buyer terms and conditions. I understand that my payment 
            will be held in escrow on Stripe and released after the return window expires. I consent 
            to receiving up to 3 order-related reminder emails from the seller requesting confirmation 
            and review.
          </label>
        </div>

        {!hasScrolledToBottom && (
          <p className="text-xs text-muted-foreground text-center">
            Scroll to the bottom to enable acceptance
          </p>
        )}

        <Button 
          onClick={onAccept} 
          disabled={!accepted || isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? 'Processing...' : 'Accept & Continue to Payment'}
        </Button>
      </CardContent>
    </Card>
  );
}