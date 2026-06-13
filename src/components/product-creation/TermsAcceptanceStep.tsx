import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePlatformFee } from '@/hooks/usePlatformFee';

interface TermsAcceptanceStepProps {
  data: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

export function TermsAcceptanceStep({ data, onChange, errors }: TermsAcceptanceStepProps) {
  const { feePct, sellerPct } = usePlatformFee();
  const { data: terms, isLoading } = useQuery({
    queryKey: ['seller-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_terms')
        .select('*')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Seller Terms & Conditions</h3>
        <p className="text-sm text-muted-foreground">
          Please review and accept the seller terms before publishing your product
        </p>
      </div>

      {terms && (
        <div className="border rounded-lg">
          <div className="bg-muted px-4 py-3 border-b flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <span className="font-medium">Version {terms.version}</span>
            <span className="text-sm text-muted-foreground ml-auto">
              Published {new Date(terms.published_at).toLocaleDateString()}
            </span>
          </div>
          <ScrollArea className="h-[400px] p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-sm">{terms.content}</div>
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-start space-x-2">
          <Checkbox 
            id="terms-accept" 
            checked={data.seller_accepted_terms}
            onCheckedChange={(checked) => onChange('seller_accepted_terms', checked)}
          />
          <div className="space-y-1">
            <Label htmlFor="terms-accept" className="text-sm font-medium cursor-pointer">
              I have read and accept the Seller Terms & Conditions
            </Label>
            <p className="text-xs text-muted-foreground">
              You must accept the terms to publish your product. By checking this box, you agree to:
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-4">
              <li>Platform holds all sale proceeds on Stripe until buyer confirms delivery</li>
              <li>Money is only released after the return window has fully expired</li>
              <li>10% platform fee on all sales (90% to seller via Stripe Connect)</li>
              <li>Buyers have a <strong>minimum 24-hour return window</strong> — this cannot be waived</li>
              <li>If buyer returns within the window, they receive 100% refund to original payment method</li>
              <li>You cannot refuse to deliver a purchased product — the product must match the listing</li>
              <li>No malware or illegal content in product files</li>
              <li>You must plan ahead: no payouts until return window expires, even if you have costs</li>
            </ul>
          </div>
        </div>

        {errors.seller_accepted_termsError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.seller_accepted_termsError}</AlertDescription>
          </Alert>
        )}

        {!data.seller_accepted_terms && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You must accept the seller terms to publish your product. If you have questions or concerns, please contact support at <strong>support@dkaimarketplace.com</strong>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}