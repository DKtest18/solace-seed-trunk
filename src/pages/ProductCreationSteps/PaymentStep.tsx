import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle2, CreditCard, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ProductCreationPayment() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSave = () => {
    const stored = sessionStorage.getItem('product-draft');
    const draft = stored ? JSON.parse(stored) : {};
    sessionStorage.setItem('product-draft', JSON.stringify({ 
      ...draft, 
      payment_methods: ['card'],
    }));
    
    toast({
      title: 'Progress Saved',
      description: 'Payment option confirmed (Stripe only).',
    });
    
    navigate('/create-product');
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/create-product')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Checklist
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Payment Method</h1>
          <p className="text-muted-foreground">
            All payments are processed via Stripe
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Stripe Card Payments</CardTitle>
            <CardDescription>
              Secure payments processed via Stripe Connect
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-primary/5 border-primary/20">
              <CreditCard className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">Pay with Card</p>
                <p className="text-sm text-muted-foreground">
                  90% goes to you, 10% platform fee. No card data stored on this platform.
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>

            <Alert>
              <AlertDescription>
                Make sure you have connected your Stripe account in your seller payment settings before publishing products.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm & Continue
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/create-product')}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}