import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';

import { useRulesAcceptance } from '@/hooks/useRulesAcceptance';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { BasicInfoStep } from '@/components/product-creation/BasicInfoStep';
import { ImagesStep } from '@/components/product-creation/ImagesStep';
import { PricingStep } from '@/components/product-creation/PricingStep';
import { FeaturesTagsStep } from '@/components/product-creation/FeaturesTagsStep';
import { PurposeAudienceStep } from '@/components/product-creation/PurposeAudienceStep';
import { AdditionalDetailsStep } from '@/components/product-creation/AdditionalDetailsStep';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FAQStep } from '@/components/product-creation/FAQStep';

import { DeliveryFilesStep } from '@/components/product-creation/DeliveryFilesStep';
import { ReturnPolicyStep } from '@/components/product-creation/ReturnPolicyStep';
import { TermsAcceptanceStep } from '@/components/product-creation/TermsAcceptanceStep';
import { RulesAcceptanceStep } from '@/components/RulesAcceptanceStep';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Basic Info', description: 'Product details' },
  { id: 2, title: 'Purpose & Value', description: 'Target & benefits' },
  { id: 3, title: 'Images', description: 'Visual showcase' },
  { id: 4, title: 'Pricing', description: 'Set your price' },
  { id: 5, title: 'Features & Tags', description: 'Highlight benefits' },
  { id: 6, title: 'Details', description: 'Additional info' },
  { id: 7, title: 'FAQ', description: 'Common questions' },
  { id: 8, title: 'Delivery Files', description: 'Workflows, tutorials & files' },
  { id: 9, title: 'Return Policy', description: 'Return rules' },
  { id: 10, title: 'Terms', description: 'Accept seller terms' },
];

export default function CreateProduct() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  
  const { sellerRulesAccepted, loadingSellerRules, acceptRules, isAccepting } = useRulesAcceptance();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(() => {
    const stepParam = searchParams.get('step');
    return stepParam ? Math.min(Math.max(parseInt(stepParam, 10) || 1, 1), STEPS.length) : 1;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showSubmittedDialog, setShowSubmittedDialog] = useState(false);
  const [showSellerRules, setShowSellerRules] = useState(false);

  // Sync step from URL param
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const step = Math.min(Math.max(parseInt(stepParam, 10) || 1, 1), STEPS.length);
      setCurrentStep(step);
    }
  }, [searchParams]);

  // Check if seller rules need acceptance
  useEffect(() => {
    if (!loadingSellerRules && !sellerRulesAccepted && (isSeller || isAdmin)) {
      setShowSellerRules(true);
    }
  }, [loadingSellerRules, sellerRulesAccepted, isSeller, isAdmin]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    product_type: 'agent',
    demo_url: '',
    price: '',
    pricing_model: 'one_time',
    currency: 'usd',
    billing_interval: 'month',
    billing_interval_count: 1,
    features: [] as string[],
    tags: [] as string[],
    purpose: '',
    target_audience: '',
    value_proposition: '',
    problem_solved: '',
    product_version: '',
    access_details: '',
    estimated_delivery: '',
    production_cost: '',
    available_quantity: '',
    refund_policy: '',
    video_url: '',
    sample_preview_url: '',
    sample_preview_type: '',
    sample_output_text: '',
    sample_is_watermarked: false,
    payment_methods: ['stripe_manual', 'balance'] as string[],
    paypal_email: '',
    iban: '',
    iban_later: false,
    faqs: [] as Array<{ question: string; answer: string }>,
    delivery_mode: 'via_message' as string,
    seller_accepted_terms: false,
    return_allowed: false,
    return_window_days: 1,
    return_fee_enabled: false,
    return_fee_percentage: 0,
    return_conditions: '',
  });

  const [images, setImages] = useState<File[]>([]);
  const [deliveryFiles, setDeliveryFiles] = useState<Array<{ file: File; label: string }>>([]);

  
  const [productFile, setProductFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'scanning' | 'clean' | 'infected'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing draft (latest 'draft' row for this seller) on mount
  useEffect(() => {
    if (!user || draftLoaded) return;
    (async () => {
      try {
        const { data, error } = await db
          .from('dkai_products')
          .select('*')
          .eq('seller_id', user.id)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setDraftId(data.id);
          setFormData((prev) => ({
            ...prev,
            title: data.title ?? '',
            description: data.description ?? '',
            product_type: data.product_type ?? prev.product_type,
            demo_url: data.demo_url ?? '',
            price: data.price != null ? String(data.price) : '',
            pricing_model: data.pricing_model ?? prev.pricing_model,
            currency: data.currency ?? prev.currency,
            billing_interval: data.billing_interval ?? prev.billing_interval,
            billing_interval_count: data.billing_interval_count ?? prev.billing_interval_count,
            features: data.features ?? [],
            tags: data.tags ?? [],
            purpose: data.purpose ?? '',
            target_audience: data.target_audience ?? '',
            value_proposition: data.value_proposition ?? '',
            problem_solved: data.problem_solved ?? '',
            product_version: data.product_version ?? '',
            access_details: data.access_details ?? '',
            estimated_delivery: data.estimated_delivery ?? '',
            production_cost: data.production_cost != null ? String(data.production_cost) : '',
            available_quantity: data.available_quantity != null ? String(data.available_quantity) : '',
            refund_policy: data.refund_policy ?? '',
            video_url: data.video_url ?? '',
            sample_preview_url: data.sample_preview_url ?? '',
            sample_preview_type: data.sample_preview_type ?? '',
            sample_output_text: data.sample_output_text ?? '',
            sample_is_watermarked: !!data.sample_is_watermarked,
            payment_methods: data.payment_methods ?? prev.payment_methods,
            faqs: data.faqs ?? [],
            delivery_mode: data.delivery_mode ?? prev.delivery_mode,
            seller_accepted_terms: !!data.seller_accepted_terms,
            return_allowed: !!data.return_allowed,
            return_window_days: data.return_window_days ?? 1,
            return_fee_enabled: !!data.return_fee_enabled,
            return_fee_percentage: data.return_fee_percentage ?? 0,
            return_conditions: data.return_conditions ?? '',
          }));
          if (data.file_storage_key) {
            setUploadedFile({
              path: data.file_storage_key,
              name: data.file_storage_key.split('/').pop() ?? 'file',
              size: data.file_size_bytes ?? 0,
              scanStatus: data.file_scan_status ?? 'clean',
            });
            setUploadStatus(data.file_scan_status ?? 'clean');
          }
        }
      } catch (e) {
        console.error('Failed to load draft', e);
      } finally {
        setDraftLoaded(true);
      }
    })();
  }, [user, draftLoaded]);

  const buildDraftPayload = () => ({
    seller_id: user!.id,
    title: formData.title || 'Untitled draft',
    description: formData.description || '',
    product_type: formData.product_type,
    demo_url: formData.demo_url || null,
    price: formData.price ? parseFloat(formData.price) : 0,
    pricing_model: formData.pricing_model,
    currency: formData.currency || 'usd',
    billing_interval: formData.pricing_model === 'recurring' ? formData.billing_interval : null,
    billing_interval_count: formData.pricing_model === 'recurring' ? formData.billing_interval_count : null,
    features: formData.features,
    tags: formData.tags,
    purpose: formData.purpose || null,
    target_audience: formData.target_audience || null,
    value_proposition: formData.value_proposition || null,
    problem_solved: formData.problem_solved || null,
    product_version: formData.product_version || null,
    access_details: formData.access_details || null,
    estimated_delivery: formData.estimated_delivery || null,
    production_cost: formData.production_cost ? parseFloat(formData.production_cost) : null,
    available_quantity: formData.available_quantity ? parseInt(formData.available_quantity) : null,
    refund_policy: formData.refund_policy || null,
    video_url: formData.video_url || null,
    sample_preview_url: formData.sample_preview_url || null,
    sample_preview_type: formData.sample_preview_type || null,
    sample_output_text: formData.sample_output_text || null,
    sample_is_watermarked: !!formData.sample_is_watermarked,
    payment_methods: formData.payment_methods,
    faqs: formData.faqs,
    delivery_mode: formData.delivery_mode,
    file_storage_key: uploadedFile?.path || null,
    file_size_bytes: uploadedFile?.size || null,
    file_scan_status: uploadedFile?.scanStatus || null,
    seller_accepted_terms: formData.seller_accepted_terms,
    return_allowed: formData.return_allowed,
    return_window_days: formData.return_allowed ? formData.return_window_days : 1,
    return_fee_enabled: formData.return_fee_enabled,
    return_fee_percentage: formData.return_fee_enabled ? formData.return_fee_percentage : 0,
    return_conditions: formData.return_conditions || null,
    status: 'draft',
    is_published: false,
  });

  const persistDraft = async (): Promise<string | null> => {
    if (!user) return null;
    const payload = buildDraftPayload();
    try {
      if (draftId) {
        const { error } = await db.from('dkai_products').update(payload).eq('id', draftId);
        if (error) throw error;
        return draftId;
      } else {
        const { data, error } = await db
          .from('dkai_products')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        setDraftId(data.id);
        return data.id;
      }
    } catch (e: any) {
      console.error('Draft save failed', e);
      throw e;
    }
  };

  const handleSaveAndExit = async () => {
    setIsSavingDraft(true);
    try {
      await persistDraft();
      toast.success('Draft saved. You can resume anytime.');
      navigate('/seller-dashboard');
    } catch (e: any) {
      toast.error(e.message || 'Could not save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    if (field.endsWith('Error')) {
      setErrors((prev) => ({ ...prev, [field]: value }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error when user starts typing
      if (errors[field + 'Error']) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field + 'Error'];
          return newErrors;
        });
      }
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.title || formData.title.length < 3) {
          newErrors.titleError = 'Title must be at least 3 characters';
        }
        if (!formData.description || formData.description.length < 20) {
          newErrors.descriptionError = 'Description must be at least 20 characters';
        }
        break;

      case 2:
        if (!formData.purpose || formData.purpose.length < 20) {
          newErrors.purposeError = 'Please describe what the product can be used for (min 20 characters)';
        }
        if (!formData.target_audience || formData.target_audience.length < 10) {
          newErrors.targetAudienceError = 'Please describe your target audience (min 10 characters)';
        }
        if (!formData.problem_solved || formData.problem_solved.length < 20) {
          newErrors.problemSolvedError = 'Please describe the problem it solves (min 20 characters)';
        }
        if (!formData.value_proposition || formData.value_proposition.length < 20) {
          newErrors.valuePropositionError = 'Please describe your value proposition (min 20 characters)';
        }
        break;

      case 3:
        if (images.length === 0) {
          newErrors.imagesError = 'At least one product image is required';
        }
        if (images.length > 10) {
          newErrors.imagesError = 'Maximum 10 images allowed';
        }
        break;

      case 4:
        const price = parseFloat(formData.price);
        if (isNaN(price) || price < 1) {
          newErrors.priceError = 'Price must be at least $1';
        }
        if (price > 10000) {
          newErrors.priceError = 'Price cannot exceed $10,000';
        }
        break;

      case 5:
        if (formData.features.length < 3) {
          newErrors.featuresError = 'Add at least 3 features';
        }
        if (formData.tags.length < 3) {
          newErrors.tagsError = 'Add at least 3 tags';
        }
        break;

      case 7:
        // FAQ validation (optional step)
        break;

      case 8:
        // Delivery files - optional
        break;

      case 9:
        if (formData.return_allowed && formData.return_fee_enabled && (!formData.return_fee_percentage || formData.return_fee_percentage < 1 || formData.return_fee_percentage > 30)) {
          newErrors.returnPolicyError = 'Return fee must be between 1% and 30%';
        }
        break;

      case 10:
        if (!formData.seller_accepted_terms) {
          newErrors.seller_accepted_termsError = 'You must accept the seller terms to continue';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) {
      toast.error('Please fix the errors before continuing');
      return;
    }
    try {
      await persistDraft();
    } catch (e: any) {
      toast.error(e.message || 'Could not save progress');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFileSelect = async (file: File) => {
    setProductFile(file);
    setUploadStatus('uploading');

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setUploadStatus('scanning');

      // Call scan function
      const { data: scanData, error: scanError } = await supabase.functions.invoke('scan-product-file', {
        body: { filePath, fileName: file.name, fileSize: file.size },
      });

      if (scanError) throw scanError;

      setUploadedFile({ 
        path: filePath, 
        name: file.name, 
        size: file.size,
        scanStatus: scanData.scanStatus || 'clean'
      });
      setUploadStatus(scanData.scanStatus || 'clean');

      if (scanData.scanStatus === 'clean') {
        toast.success('File uploaded and scanned successfully');
      } else {
        toast.error('File failed security scan');
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Failed to upload file');
      setUploadStatus('idle');
    }
  };

  const handleSubmit = async () => {
    // Re-validate every required step before submitting
    for (let s = 1; s <= STEPS.length; s++) {
      if (!validateStep(s)) {
        setCurrentStep(s);
        toast.error(`Please complete step ${s} before submitting`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let imageUrl: string | null = null;
      const mediaRows: Array<{
        storage_path: string;
        media_type: 'image' | 'video';
        mime_type: string;
        size_bytes: number;
        sort_order: number;
        is_cover: boolean;
      }> = [];

      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const ext = file.name.split('.').pop();
        const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
        const isVideo = file.type.startsWith('video/');
        const bucket = isVideo ? 'product-media' : 'product-images';

        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;

        if (i === 0 && !isVideo) {
          imageUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
        }

        mediaRows.push({
          storage_path: `${bucket}/${path}`,
          media_type: isVideo ? 'video' : 'image',
          mime_type: file.type,
          size_bytes: file.size,
          sort_order: i,
          is_cover: i === 0,
        });
      }


      // Update seller profile with PayPal and IBAN if provided
      if (formData.paypal_email || formData.iban) {
        const profileUpdates: any = {};
        if (formData.paypal_email) {
          profileUpdates.paypal_email_verified = formData.paypal_email;
        }
        if (formData.iban) {
          profileUpdates.iban_for_withdrawal = formData.iban;
        }
        if (Object.keys(profileUpdates).length > 0) {
          await db.from('dkai_profiles').update(profileUpdates).eq('id', user!.id);
        }
      }

      // Ensure a draft row exists, then promote it to 'pending'
      const id = draftId ?? (await persistDraft());
      if (!id) throw new Error('Could not create product draft');

      const submitPayload: any = {
        ...buildDraftPayload(),
        status: 'pending',
        is_published: false,
        moderation_status: 'pending',
        approval_status: 'pending',
      };
      if (imageUrl) submitPayload.image_url = imageUrl;

      const { error } = await db.from('dkai_products').update(submitPayload).eq('id', id);
      if (error) throw error;

      if (mediaRows.length > 0) {
        await db.from('dkai_product_media').insert(
          mediaRows.map((m) => ({ ...m, product_id: id, seller_id: user!.id })),
        );
      }

      // Best-effort: create/update Stripe Price on seller's connected account.
      // Non-blocking — review submission must succeed even if Stripe is briefly unavailable.
      try {
        await supabase.functions.invoke('stripe-create-price', {
          body: {
            product_id: id,
            title: formData.title,
            description: formData.description,
            price: parseFloat(formData.price),
            currency: formData.currency || 'usd',
            pricing_model: formData.pricing_model,
            billing_interval: formData.pricing_model === 'recurring' ? formData.billing_interval : undefined,
            billing_interval_count: formData.pricing_model === 'recurring' ? formData.billing_interval_count : undefined,
          },
        });
      } catch (priceErr) {
        console.warn('stripe-create-price failed (non-fatal):', priceErr);
      }

      setShowSubmittedDialog(true);
    } catch (error: any) {
      console.error('Error submitting product:', error);
      toast.error(error.message || 'Failed to submit product');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (!isSeller && !isAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Seller Access Required</CardTitle>
            <CardDescription>
              You need to complete seller onboarding first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => navigate('/seller-onboarding')} className="w-full">
              Start Seller Onboarding
            </Button>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show seller rules acceptance if not yet accepted
  if (showSellerRules && !sellerRulesAccepted) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Accept Seller Rules</h1>
            <p className="text-muted-foreground">
              You must accept the seller rules before publishing products.
            </p>
          </div>
          <RulesAcceptanceStep
            ruleType="seller"
            loading={isAccepting}
            onAccept={async () => {
              try {
                await acceptRules({ ruleType: 'seller' });
                toast.success('Seller rules accepted!');
                setShowSellerRules(false);
              } catch (error) {
                toast.error('Failed to accept rules. Please try again.');
              }
            }}
            onBack={() => navigate('/seller-dashboard')}
          />
        </div>
      </div>
    );
  }

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-2">Create New Product</h1>
            <p className="text-muted-foreground">
              Required fields are marked with <span className="text-destructive">*</span>. Optional fields are labeled "(Optional)".
              Your progress is saved as a draft after each step — you can leave and come back anytime.
            </p>
          </div>
          {draftId && (
            <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground self-start">
              Draft saved
            </span>
          )}
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="mb-8">
              <div className="flex justify-between mb-2 overflow-x-auto pb-2">
                {STEPS.map((step) => (
                  <div
                    key={step.id}
                    className={`flex flex-col items-center min-w-[60px] ${
                      step.id === currentStep
                        ? 'text-primary'
                        : step.id < currentStep
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                        step.id === currentStep
                          ? 'bg-primary text-primary-foreground'
                          : step.id < currentStep
                          ? 'bg-green-600 text-white'
                          : 'bg-muted'
                      }`}
                    >
                      {step.id < currentStep ? <CheckCircle className="h-5 w-5" /> : step.id}
                    </div>
                    <span className="text-xs font-medium text-center">{step.title}</span>
                  </div>
                ))}
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="min-h-[400px]">
              {currentStep === 1 && (
                <BasicInfoStep data={formData} onChange={handleChange} errors={errors} />
              )}
              {currentStep === 2 && (
                <PurposeAudienceStep data={formData} onChange={handleChange} errors={errors} />
              )}
              {currentStep === 3 && (
                <ImagesStep
                  images={images}
                  onAddImage={(file) => setImages([...images, file])}
                  onRemoveImage={(index) => setImages(images.filter((_, i) => i !== index))}
                  onReorderImages={(newImages) => setImages(newImages)}
                  errors={errors}
                />
              )}
              {currentStep === 4 && (
                <PricingStep data={formData} onChange={handleChange} errors={errors} />
              )}
              {currentStep === 5 && (
                <FeaturesTagsStep data={formData} onChange={handleChange} errors={errors} />
              )}
              {currentStep === 6 && (
                <AdditionalDetailsStep data={formData} onChange={handleChange} errors={errors} />
              )}
              {currentStep === 7 && (
                <FAQStep data={formData} onChange={handleChange} errors={errors} />
              )}
              {currentStep === 8 && (
                <PaymentOptionsStep data={formData} onChange={handleChange} errors={errors} />
              )}
              {currentStep === 9 && (
                <DeliveryFilesStep
                  deliveryFiles={deliveryFiles}
                  onAddFile={(df) => setDeliveryFiles([...deliveryFiles, df])}
                  onRemoveFile={(index) => setDeliveryFiles(deliveryFiles.filter((_, i) => i !== index))}
                  errors={errors}
                />
              )}
              {currentStep === 10 && (
                <ReturnPolicyStep data={formData} onChange={handleChange} errors={errors} />
              )}
              {currentStep === 11 && (
                <TermsAcceptanceStep data={formData} onChange={handleChange} errors={errors} />
              )}
            </div>

            <div className="flex justify-between items-center mt-8 gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isSubmitting || isSavingDraft}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleSaveAndExit}
                  disabled={isSubmitting || isSavingDraft}
                >
                  {isSavingDraft && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save draft & exit
                </Button>

                {currentStep < STEPS.length ? (
                  <Button onClick={handleNext} disabled={isSubmitting || isSavingDraft}>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={isSubmitting || isSavingDraft}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit for Approval
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={showSubmittedDialog}
        onOpenChange={(open) => {
          setShowSubmittedDialog(open);
          if (!open) navigate('/seller-products?tab=in_review');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Product submitted for review
            </DialogTitle>
            <DialogDescription className="pt-2 text-base">
              Your product has been submitted for review. Our team will inspect it and,
              if approved, it will be published within <strong>0–24 hours</strong>.
              You'll be notified by email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowSubmittedDialog(false);
                navigate('/seller-products?tab=in_review');
              }}
            >
              Go to In Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
