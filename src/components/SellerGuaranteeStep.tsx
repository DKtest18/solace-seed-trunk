import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Shield, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface SellerGuaranteeStepProps {
  onComplete: () => void;
  onBack: () => void;
}

export function SellerGuaranteeStep({ onComplete, onBack }: SellerGuaranteeStepProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = async () => {
    if (!accepted) {
      toast.error(t('sellerOnboarding.guaranteeRequired', 'You must accept the seller guarantee'));
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('accept-seller-guarantee', {
        body: {
          guaranteeType: '6_month_functional',
          termsVersion: 1
        }
      });

      if (error) throw error;

      toast.success(t('sellerOnboarding.guaranteeAccepted', 'Seller guarantee accepted'));
      onComplete();
    } catch (error) {
      console.error('Error accepting guarantee:', error);
      toast.error(t('common.error', 'An error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          {t('sellerOnboarding.guaranteeTitle', '6-Month Seller Guarantee')}
        </CardTitle>
        <CardDescription>
          {t('sellerOnboarding.guaranteeDesc', 'As a seller, you must agree to provide a functional guarantee for your digital products')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ScrollArea className="h-[300px] border rounded-lg p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h3>{t('sellerOnboarding.guaranteeTermsTitle', 'Seller Guarantee Terms')}</h3>
            
            <h4>{t('sellerOnboarding.functionalGuarantee', '1. Functional Guarantee')}</h4>
            <p>
              {t('sellerOnboarding.functionalGuaranteeText', 
                'You guarantee that all digital products you sell will function as described for a minimum of 6 months from the date of purchase. This includes:'
              )}
            </p>
            <ul>
              <li>{t('sellerOnboarding.guarantee1', 'Software working as described in the product listing')}</li>
              <li>{t('sellerOnboarding.guarantee2', 'Files being accessible and downloadable')}</li>
              <li>{t('sellerOnboarding.guarantee3', 'Updates to fix critical bugs within the guarantee period')}</li>
              <li>{t('sellerOnboarding.guarantee4', 'Reasonable support for technical issues')}</li>
            </ul>

            <h4>{t('sellerOnboarding.buyerProtection', '2. Buyer Protection')}</h4>
            <p>
              {t('sellerOnboarding.buyerProtectionText',
                'If a product fails to function as described within the 6-month guarantee period, buyers are entitled to:'
              )}
            </p>
            <ul>
              <li>{t('sellerOnboarding.protection1', 'A working replacement or fix')}</li>
              <li>{t('sellerOnboarding.protection2', 'A full refund if the issue cannot be resolved')}</li>
              <li>{t('sellerOnboarding.protection3', 'Dispute resolution through our mediation process')}</li>
            </ul>

            <h4>{t('sellerOnboarding.sellerObligations', '3. Seller Obligations')}</h4>
            <p>{t('sellerOnboarding.obligationsText', 'As a seller, you agree to:')}</p>
            <ul>
              <li>{t('sellerOnboarding.obligation1', 'Respond to buyer inquiries within 48 hours')}</li>
              <li>{t('sellerOnboarding.obligation2', 'Respond to disputes within 7 days')}</li>
              <li>{t('sellerOnboarding.obligation3', 'Provide accurate product descriptions')}</li>
              <li>{t('sellerOnboarding.obligation4', 'Maintain product functionality throughout the guarantee period')}</li>
              <li>{t('sellerOnboarding.obligation5', 'Accept refund decisions made by platform administrators')}</li>
            </ul>

            <h4>{t('sellerOnboarding.consequences', '4. Consequences of Violation')}</h4>
            <p>
              {t('sellerOnboarding.consequencesText',
                'Failure to honor the guarantee may result in:'
              )}
            </p>
            <ul>
              <li>{t('sellerOnboarding.consequence1', 'Automatic refund to the buyer')}</li>
              <li>{t('sellerOnboarding.consequence2', 'Financial penalties deducted from your balance')}</li>
              <li>{t('sellerOnboarding.consequence3', 'Negative impact on your seller ranking')}</li>
              <li>{t('sellerOnboarding.consequence4', 'Account suspension or termination for repeated violations')}</li>
            </ul>

            <h4>{t('sellerOnboarding.disputeProcess', '5. Dispute Resolution Process')}</h4>
            <ol>
              <li>{t('sellerOnboarding.dispute1', 'Buyer opens a dispute within the guarantee period')}</li>
              <li>{t('sellerOnboarding.dispute2', 'Seller has 7 days to respond and resolve')}</li>
              <li>{t('sellerOnboarding.dispute3', 'If unresolved, admin mediation begins')}</li>
              <li>{t('sellerOnboarding.dispute4', 'Admin makes final decision on refund/resolution')}</li>
              <li>{t('sellerOnboarding.dispute5', 'Seller penalties applied if found in violation')}</li>
            </ol>
          </div>
        </ScrollArea>

        <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/50">
          <Checkbox
            id="acceptGuarantee"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked as boolean)}
          />
          <Label htmlFor="acceptGuarantee" className="text-sm leading-relaxed">
            {t('sellerOnboarding.acceptGuarantee',
              'I have read and agree to the 6-month seller guarantee terms. I understand that I am obligated to provide functional products and respond to disputes in a timely manner.'
            )}
          </Label>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back', 'Back')}
          </Button>
          <Button 
            onClick={handleAccept} 
            disabled={isLoading || !accepted}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.loading', 'Loading...')}
              </>
            ) : (
              <>
                {t('common.acceptContinue', 'Accept & Continue')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
