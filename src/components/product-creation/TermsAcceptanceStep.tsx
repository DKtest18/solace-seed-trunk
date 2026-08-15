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

      {/* Allowed / Not allowed product types */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
          <h4 className="font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Allowed product types</h4>
          <ul className="text-xs space-y-1 list-disc list-inside text-foreground/80">
            <li>AI agents & autonomous workflows</li>
            <li>Automations (n8n, Make, Zapier, etc.)</li>
            <li>Prompt packs & prompt libraries</li>
            <li>Datasets (lawful, properly licensed)</li>
            <li>Templates (Notion, Figma, code, docs)</li>
            <li>Digital tools, scripts, SaaS starters</li>
            <li>Educational material & courses you own</li>
          </ul>
        </div>
        <div className="border rounded-lg p-4 bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900">
          <h4 className="font-semibold text-red-700 dark:text-red-300 mb-2">Not allowed</h4>
          <ul className="text-xs space-y-1 list-disc list-inside text-foreground/80">
            <li>Malware, spyware, exploits, credential stealers</li>
            <li>Illegal content of any kind</li>
            <li>Stolen, pirated, or infringing material</li>
            <li>Sexual, adult, or NSFW content</li>
            <li>Hate, harassment, violent extremism</li>
            <li>Personal data / scraped PII without consent</li>
            <li>Anything violating the Seller Rules</li>
          </ul>
        </div>
      </div>

      {/* Inspection notice */}
      <Alert className="border-amber-500/40 bg-amber-500/5">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs">
          <strong>Hosting &amp; liability notice</strong> <em className="text-muted-foreground">(subject to lawyer review)</em>.
          Product files and data are stored on third-party infrastructure (Supabase). Keep your own master copies.
          To the extent permitted by law, DK AI Marketplace is not liable for data loss, unauthorized access, or breaches
          of third-party infrastructure. Sellers and buyers are responsible for their own backups and for rotating any
          shared credentials after setup.
        </AlertDescription>
      </Alert>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>File inspection notice.</strong> DK AI Marketplace requires access to every
          uploaded product file and <strong>may open, scan, and inspect</strong> it (including
          automated malware scanning and manual review) to enforce these rules. Files that
          violate the rules may be removed and the listing may be rejected or taken down.
          DK AI Marketplace may also <strong>access, open, run, and test</strong> your uploaded
          product files to verify they work, are legal, and comply with our rules, so buyers
          receive what they paid for.
        </AlertDescription>
      </Alert>

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
              <li>Payments are processed by Stripe or PayPal and go directly to your connected payment account</li>
              <li>Platform fee: 0% during the launch promo (first 20 platform sales), {feePct}% after</li>
              <li>The payment provider's standard processing fees (Stripe or PayPal) apply and are borne by you as the seller</li>
              <li>Refunds are only granted through DK AI Marketplace support review, for two reasons: product not delivered, or product materially not as described</li>
              <li>Approved refunds are for the full purchase price, debited from your connected payment account balance (Stripe or PayPal), typically within 24–72 hours of approval</li>
              <li>You must respond to support inquiries about refund requests within 48 hours; no response means the case is decided in the buyer's favor and your listings may be deactivated or your account suspended</li>
              <li>You cannot refuse to deliver a purchased product — the product must match the listing</li>
              <li>No malware, illegal, infringing, sexual, or otherwise prohibited content</li>
              <li>DK AI Marketplace may access, open, run, test, and inspect your uploaded product files to verify they work, are legal, and comply with our rules</li>
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