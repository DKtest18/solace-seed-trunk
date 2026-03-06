import { useNavigate, useSearchParams } from 'react-router-dom';
import CreateProduct from '@/pages/CreateProduct';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, ChevronRight, Loader2, Package } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface ProductCreationStep {
  id: string;
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
  wizardStep: number; // maps to CreateProduct step number
}

export default function ProductCreationChecklist() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If ?step param is present, render the wizard directly
  const stepParam = searchParams.get('step');
  if (stepParam) {
    return <CreateProduct />;
  }

  const getStoredData = () => {
    const stored = sessionStorage.getItem('product-draft');
    return stored ? JSON.parse(stored) : {};
  };

  const productDraft = getStoredData();

  const steps: ProductCreationStep[] = [
    {
      id: 'basic',
      title: 'Basic Information',
      description: 'Product name, type, and description',
      required: true,
      completed: !!(productDraft.title && productDraft.description && productDraft.product_type),
      wizardStep: 1,
    },
    {
      id: 'purpose',
      title: 'Purpose & Value',
      description: 'Target audience, problem solved, value proposition',
      required: true,
      completed: !!(productDraft.purpose && productDraft.target_audience && productDraft.problem_solved && productDraft.value_proposition),
      wizardStep: 2,
    },
    {
      id: 'images',
      title: 'Product Images & Videos',
      description: 'Upload photos and videos of your product',
      required: true,
      completed: !!(productDraft.images && productDraft.images.length > 0),
      wizardStep: 3,
    },
    {
      id: 'pricing',
      title: 'Pricing',
      description: 'Set your price and pricing model',
      required: true,
      completed: !!(productDraft.price && productDraft.pricing_model),
      wizardStep: 4,
    },
    {
      id: 'features',
      title: 'Features & Tags',
      description: 'Highlight key features and add tags',
      required: true,
      completed: !!(productDraft.features && productDraft.features.length >= 3),
      wizardStep: 5,
    },
    {
      id: 'details',
      title: 'Additional Details',
      description: 'Delivery, refunds, version, and more',
      required: false,
      completed: !!(productDraft.refund_policy || productDraft.access_details),
      wizardStep: 6,
    },
    {
      id: 'faq',
      title: 'FAQ',
      description: 'Common questions and answers about your product',
      required: false,
      completed: !!(productDraft.faqs && productDraft.faqs.length > 0),
      wizardStep: 7,
    },
    {
      id: 'payment',
      title: 'Payment Options',
      description: 'Payment methods via Stripe Connect',
      required: true,
      completed: !!(productDraft.payment_methods && productDraft.payment_methods.length > 0),
      wizardStep: 8,
    },
    {
      id: 'file',
      title: 'File Upload',
      description: 'Upload product files for instant download',
      required: false,
      completed: !!(productDraft.file_storage_key),
      wizardStep: 9,
    },
    {
      id: 'delivery',
      title: 'Delivery Files & Documentation',
      description: 'Tutorials, checklists, workflow files for buyers',
      required: false,
      completed: false, // tracked locally in wizard
      wizardStep: 10,
    },
    {
      id: 'return',
      title: 'Return Policy',
      description: 'Configure return window and conditions',
      required: true,
      completed: true, // always has defaults (mandatory 24h)
      wizardStep: 11,
    },
    {
      id: 'terms',
      title: 'Terms & Conditions',
      description: 'Accept seller terms before publishing',
      required: true,
      completed: !!(productDraft.seller_accepted_terms),
      wizardStep: 12,
    },
  ];

  const requiredSteps = steps.filter(s => s.required);
  const completedRequired = requiredSteps.filter(s => s.completed).length;
  const allRequiredComplete = requiredSteps.every(s => s.completed);
  const progress = Math.round((completedRequired / requiredSteps.length) * 100);

  if (!user) {
    navigate('/login');
    return null;
  }

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSeller && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Seller Access Required</CardTitle>
            <CardDescription>
              You need a seller account to create products. Complete seller onboarding first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/seller-onboarding')}>
              Start Seller Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleNavigateToStep = (wizardStep: number) => {
    navigate(`/create-product?step=${wizardStep}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">Create New Product</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Complete the steps below to list your product on the marketplace
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Creation Progress</CardTitle>
                <CardDescription>
                  {completedRequired} of {requiredSteps.length} required steps completed
                </CardDescription>
              </div>
              <Badge variant={allRequiredComplete ? 'default' : 'secondary'} className="text-lg px-4 py-2">
                {progress}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Creation Checklist</CardTitle>
            <CardDescription>
              Click on any step to fill it in. Required steps are marked with a badge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {steps.map((step, index) => (
              <div key={step.id}>
                <button
                  onClick={() => handleNavigateToStep(step.wizardStep)}
                  className="w-full group hover:bg-muted/50 rounded-lg p-4 transition-colors text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {step.completed ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-destructive/70" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                          {step.title}
                        </h3>
                        {step.required && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                        {step.completed && (
                          <Badge variant="default" className="text-xs bg-green-500">Complete</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                  </div>
                </button>
                {index < steps.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {allRequiredComplete && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Ready to Publish!</h3>
                  <p className="text-muted-foreground mb-4">
                    You've completed all required steps. Review and submit your product.
                  </p>
                </div>
                <Button size="lg" onClick={() => navigate('/create-product?step=12')} className="w-full md:w-auto">
                  <Package className="h-4 w-4 mr-2" />
                  Review & Submit Product
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              <p>Your progress is automatically saved. You can return anytime to continue where you left off.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
