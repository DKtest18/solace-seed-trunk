import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BasicInfoStep } from '@/components/product-creation/BasicInfoStep';
import { useProductMedia } from '@/hooks/useProductMedia';
import { ImagesStep } from '@/components/product-creation/ImagesStep';
import { ProductDeliveryFilesManager } from '@/components/ProductDeliveryFilesManager';
import { DeliveryTierSelector } from '@/components/DeliveryTierSelector';
import { ProductReviewStatusCard, type ReviewStatus } from '@/components/ProductReviewStatusCard';
import type { DeliveryTier } from '@/lib/deliveryRecommendation';
import { PricingStep } from '@/components/product-creation/PricingStep';
import { FeaturesTagsStep } from '@/components/product-creation/FeaturesTagsStep';
import { PurposeAudienceStep } from '@/components/product-creation/PurposeAudienceStep';
import { AdditionalDetailsStep } from '@/components/product-creation/AdditionalDetailsStep';
import { FAQStep } from '@/components/product-creation/FAQStep';
import { useDeliveryFiles } from '@/hooks/useDeliveryFiles';
import { DeliveryFilesStep } from '@/components/product-creation/DeliveryFilesStep';
import { ReturnPolicyStep } from '@/components/product-creation/ReturnPolicyStep';
import { TermsAcceptanceStep } from '@/components/product-creation/TermsAcceptanceStep';
import { DemoVideoStep, parseDemoVideoPaths } from '@/components/product-creation/DemoVideoStep';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle, Trash2, Eye, EyeOff } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
  { id: 11, title: 'Demo Video', description: 'Required demo' },
];

export default function EditProduct() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [productLoading, setProductLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    product_type: 'agent',
    demo_url: '',
    price: '',
    pricing_model: 'one_time',
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
    sample_output_text: '',
    sample_is_watermarked: false,
    payment_methods: ['card'] as string[],
    faqs: [] as Array<{ question: string; answer: string }>,
    is_published: false,
    delivery_mode: 'instant',
    delivery_time_hours: 24,
    currency: 'usd',
    billing_interval: 'month',
    billing_interval_count: 1,
    license_commercial_enabled: false,
    license_commercial_price: '',
    license_agency_enabled: false,
    license_agency_price: '',
    license_exclusive_enabled: false,
    license_exclusive_price: '',
    subscription_period_deliverables: '',
    subscription_cancellation_note: '',
    max_active_subscribers: '',
    license_personal_description: '',
    license_commercial_description: '',
    license_agency_description: '',
    license_exclusive_description: '',
    exclusive_source_files_description: '',
    requires_setup_credentials: false,
    setup_requirements: [] as any[],
    setup_access_window_hours: 48,
    setup_no_credentials: false,
    seller_ack_refund_policy: false,
    seller_ack_subscription: false,
    seller_ack_manual_delivery: false,
    seller_ack_setup_credentials: false,
    seller_ack_agency: false,
    seller_ack_exclusive: false,
    return_allowed: false,
    return_window_days: 1,
    return_fee_enabled: false,
    return_fee_percentage: 0,
    return_conditions: '',
    seller_accepted_terms: false,
    seller_rules_confirmed: false,
    demo_video_url: '',
    demo_video_storage_path: '',
    demo_video_paths: [] as string[],
  });

  const {
    media,
    load: loadMedia,
    addFile: addMediaFile,
    remove: removeMediaItem,
    reorder: reorderMedia,
  } = useProductMedia(user?.id);
  const {
    files: deliveryFiles,
    uploading: deliveryUploading,
    load: loadDeliveryFiles,
    addFile: addDeliveryFile,
    remove: removeDeliveryFile,
  } = useDeliveryFiles(async () => id ?? null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Delivery tier state
  const [deliveryTier, setDeliveryTier] = useState<DeliveryTier>('tier1');
  const [deliveryRecommended, setDeliveryRecommended] = useState<DeliveryTier>('tier1');
  const [deliveryOverridden, setDeliveryOverridden] = useState(false);
  const [overrideAck, setOverrideAck] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [maxSales, setMaxSales] = useState<number | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);

  // Review status state
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('draft');
  const [reviewNotes, setReviewNotes] = useState<string | null>(null);
  const [requiresAccessReview, setRequiresAccessReview] = useState(false);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);


  // Load product data
  useEffect(() => {
    if (!id || !user) return;

    const loadProduct = async () => {
      try {
        const { data: product, error } = await db
          .from('dkai_products')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        // Check if user owns this product
        if (product.seller_id !== user.id && !isAdmin) {
          toast.error('You do not have permission to edit this product');
          navigate('/seller-dashboard');
          return;
        }

        // Populate form with existing data
        setFormData({
          title: product.title || '',
          description: product.description || '',
          product_type: product.product_type || 'agent',
          demo_url: product.demo_url || '',
          price: product.price?.toString() || '',
          pricing_model: product.pricing_model || 'one_time',
          features: product.features || [],
          tags: product.tags || [],
          purpose: product.purpose || '',
          target_audience: product.target_audience || '',
          value_proposition: product.value_proposition || '',
          problem_solved: product.problem_solved || '',
          product_version: product.product_version || '',
          access_details: product.access_details || '',
          estimated_delivery: product.estimated_delivery || '',
          production_cost: product.production_cost?.toString() || '',
          available_quantity: product.available_quantity?.toString() || '',
          refund_policy: product.refund_policy || '',
          video_url: product.video_url || '',
          sample_preview_url: product.sample_preview_url || '',
          sample_output_text: product.sample_output_text || '',
          sample_is_watermarked: !!product.sample_is_watermarked,
          payment_methods: ['card'],
          faqs: Array.isArray(product.faqs) 
            ? product.faqs 
            : (product.faqs ? Object.values(product.faqs) : []),
          is_published: product.is_published || false,
          delivery_mode: product.delivery_mode || 'instant',
          delivery_time_hours: product.delivery_time_hours ?? 24,
          currency: product.currency || 'usd',
          billing_interval: product.billing_interval || 'month',
          billing_interval_count: product.billing_interval_count ?? 1,
          license_commercial_enabled: !!product.license_commercial_enabled,
          license_commercial_price: product.license_commercial_price != null ? String(product.license_commercial_price) : '',
          license_agency_enabled: !!product.license_agency_enabled,
          license_agency_price: product.license_agency_price != null ? String(product.license_agency_price) : '',
          license_exclusive_enabled: !!product.license_exclusive_enabled,
          license_exclusive_price: product.license_exclusive_price != null ? String(product.license_exclusive_price) : '',
          subscription_period_deliverables: product.subscription_period_deliverables ?? '',
          subscription_cancellation_note: product.subscription_cancellation_note ?? '',
          max_active_subscribers: product.max_active_subscribers != null ? String(product.max_active_subscribers) : '',
          license_personal_description: product.license_personal_description ?? '',
          license_commercial_description: product.license_commercial_description ?? '',
          license_agency_description: product.license_agency_description ?? '',
          license_exclusive_description: product.license_exclusive_description ?? '',
          exclusive_source_files_description: product.exclusive_source_files_description ?? '',
          requires_setup_credentials: !!product.requires_setup_credentials,
          setup_requirements: Array.isArray(product.setup_requirements) ? product.setup_requirements : [],
          setup_access_window_hours: product.setup_access_window_hours ?? 48,
          setup_no_credentials: !!product.setup_no_credentials,
          seller_ack_refund_policy: !!product.seller_ack_refund_policy,
          seller_ack_subscription: !!product.seller_ack_subscription,
          seller_ack_manual_delivery: !!product.seller_ack_manual_delivery,
          seller_ack_setup_credentials: !!product.seller_ack_setup_credentials,
          seller_ack_agency: !!product.seller_ack_agency,
          seller_ack_exclusive: !!product.seller_ack_exclusive,
          return_allowed: !!product.return_allowed,
          return_window_days: product.return_window_days ?? 1,
          return_fee_enabled: !!product.return_fee_enabled,
          return_fee_percentage: product.return_fee_percentage ?? 0,
          return_conditions: product.return_conditions || '',
          seller_accepted_terms: !!product.seller_accepted_terms,
          seller_rules_confirmed: !!product.seller_rules_confirmed,
          demo_video_url: product.demo_video_url || '',
          demo_video_storage_path: product.demo_video_storage_path || '',
          demo_video_paths: parseDemoVideoPaths(product.demo_video_paths ?? product.demo_video_storage_path),
        });

        if (product.image_url) {
          setExistingImageUrl(product.image_url);
        }

        if (id) {
          await loadMedia(id);
          try {
            await loadDeliveryFiles(id);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.error('Could not load delivery files', e);
            toast.error(`Could not load saved delivery files: ${message}`);
          }
        }

        // Delivery tier + related fields
        if (product.delivery_tier) setDeliveryTier(product.delivery_tier as DeliveryTier);
        if (product.delivery_tier_recommended)
          setDeliveryRecommended(product.delivery_tier_recommended as DeliveryTier);
        setDeliveryOverridden(!!product.delivery_tier_overridden);
        setOverrideAck(!!product.delivery_tier_overridden); // already saved => assume previously acknowledged
        setDeliveryNote(product.delivery_method_note || '');
        setMaxSales(
          product.max_sales != null
            ? Number(product.max_sales)
            : product.available_quantity != null
            ? Number(product.available_quantity)
            : null
        );
        setFileSizeBytes(Number(product.file_size_bytes) || 0);
        setReviewStatus((product.review_status as ReviewStatus) || 'draft');
        setReviewNotes(product.review_notes || null);
        setRequiresAccessReview(!!product.requires_access_review);

        setProductLoading(false);
      } catch (error: any) {
        console.error('Error loading product:', error);
        toast.error('Failed to load product');
        navigate('/seller-dashboard');
      }
    };

    loadProduct();
  }, [id, user, isAdmin, navigate, reviewRefreshKey]);

  const handleChange = (field: string, value: any) => {
    if (field.endsWith('Error')) {
      setErrors((prev) => ({ ...prev, [field]: value }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
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
        if (media.filter((m) => !m.uploading && !m.error).length === 0 && !existingImageUrl) {
          newErrors.imagesError = 'At least one product image is required';
        } else if (media.some((m) => m.uploading)) {
          newErrors.imagesError = 'Please wait until all media finished uploading';
        } else if (media.length > 10) {
          newErrors.imagesError = 'Maximum 10 media files allowed';
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

      case 10:
        if (!formData.seller_accepted_terms) {
          newErrors.seller_accepted_termsError = 'You must accept the seller terms to continue';
        }
        if (!formData.seller_rules_confirmed) {
          newErrors.seller_rules_confirmedError =
            'You must confirm this product complies with the Seller Rules & Obligations';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    } else {
      toast.error('Please fix the errors before continuing');
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleTogglePublish = async () => {
    if (!id) return;

    try {
      const newPublishStatus = !formData.is_published;

      const { error } = await db
        .from('dkai_products')
        .update({ is_published: newPublishStatus })
        .eq('id', id);

      if (error) throw error;

      setFormData((prev) => ({ ...prev, is_published: newPublishStatus }));
      toast.success(newPublishStatus ? 'Product published!' : 'Product unpublished');
    } catch (error: any) {
      console.error('Error toggling publish status:', error);
      toast.error('Failed to update publish status');
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);

    try {
      // Delete product image from storage if exists
      if (existingImageUrl) {
        const path = existingImageUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('product-images').remove([path]);
      }

      // Delete product
      const { error } = await db
        .from('dkai_products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Product deleted successfully');
      navigate('/seller-dashboard');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      toast.error('Please fix the errors before saving');
      return;
    }

    // Down-tier acknowledgement gate
    const rank = (t: DeliveryTier) => (t === 'tier3' ? 3 : t === 'tier2' ? 2 : 1);
    if (rank(deliveryTier) < rank(deliveryRecommended) && !overrideAck) {
      toast.error('Please acknowledge that you are choosing less protection than recommended.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Gallery media is uploaded and persisted immediately in dkai_product_media,
      // so we only refresh the legacy cover column here.
      const cover = media.find((m) => m.media_type === 'image' && !m.uploading && !m.error);
      const imageUrl = cover?.url ?? existingImageUrl;

      // Update product
      const { error } = await db
        .from('dkai_products')
        .update({
          title: formData.title,
          description: formData.description,
          product_type: formData.product_type,
          demo_url: formData.demo_url || null,
          price: parseFloat(formData.price),
          pricing_model: formData.pricing_model,
          features: formData.features,
          tags: formData.tags,
          purpose: formData.purpose,
          target_audience: formData.target_audience,
          value_proposition: formData.value_proposition,
          problem_solved: formData.problem_solved,
          product_version: formData.product_version || null,
          access_details: formData.access_details || null,
          estimated_delivery: formData.estimated_delivery || null,
          production_cost: formData.production_cost ? parseFloat(formData.production_cost) : null,
          available_quantity: formData.available_quantity ? parseInt(formData.available_quantity) : null,
          refund_policy: formData.refund_policy || null,
          video_url: formData.video_url || null,
          sample_preview_url: formData.sample_preview_url || null,
          sample_output_text: formData.sample_output_text || null,
          sample_is_watermarked: !!formData.sample_is_watermarked,
          image_url: imageUrl,
          payment_methods: formData.payment_methods,
          faqs: formData.faqs,
          is_published: formData.is_published,
          delivery_mode: formData.delivery_mode,
          delivery_time_hours:
            formData.delivery_mode === 'instant' ? null : (formData.delivery_time_hours ?? 24),
          currency: formData.currency,
          billing_interval: formData.pricing_model === 'recurring' ? formData.billing_interval : null,
          billing_interval_count: formData.pricing_model === 'recurring' ? (formData.billing_interval_count ?? 1) : null,
          license_personal_enabled: true,
          license_personal_price: parseFloat(formData.price) || 0,
          license_commercial_enabled: !!formData.license_commercial_enabled,
          license_commercial_price: formData.license_commercial_enabled && formData.license_commercial_price
            ? parseFloat(formData.license_commercial_price) : null,
          license_agency_enabled: !!formData.license_agency_enabled,
          license_agency_price: formData.license_agency_enabled && formData.license_agency_price
            ? parseFloat(formData.license_agency_price) : null,
          license_exclusive_enabled: !!formData.license_exclusive_enabled,
          license_exclusive_price: formData.license_exclusive_enabled && formData.license_exclusive_price
            ? parseFloat(formData.license_exclusive_price) : null,
          subscription_period_deliverables: formData.pricing_model === 'recurring'
            ? (formData.subscription_period_deliverables || null) : null,
          subscription_cancellation_note: formData.pricing_model === 'recurring'
            ? (formData.subscription_cancellation_note || null) : null,
          max_active_subscribers: formData.pricing_model === 'recurring' && formData.max_active_subscribers
            ? parseInt(formData.max_active_subscribers) : null,
          license_personal_description: formData.license_personal_description || null,
          license_commercial_description: formData.license_commercial_enabled ? (formData.license_commercial_description || null) : null,
          license_agency_description: formData.license_agency_enabled ? (formData.license_agency_description || null) : null,
          license_exclusive_description: formData.license_exclusive_enabled ? (formData.license_exclusive_description || null) : null,
          exclusive_source_files_description: formData.license_exclusive_enabled ? (formData.exclusive_source_files_description || null) : null,
          requires_setup_credentials: formData.delivery_mode === 'setup' && !formData.setup_no_credentials,
          setup_requirements: formData.delivery_mode === 'setup' && !formData.setup_no_credentials
            ? formData.setup_requirements : [],
          setup_access_window_hours: formData.delivery_mode === 'setup' ? formData.setup_access_window_hours : null,
          setup_no_credentials: formData.delivery_mode === 'setup' ? !!formData.setup_no_credentials : false,
          seller_ack_refund_policy: !!formData.seller_ack_refund_policy,
          seller_ack_subscription: !!formData.seller_ack_subscription,
          seller_ack_manual_delivery: !!formData.seller_ack_manual_delivery,
          seller_ack_setup_credentials: !!formData.seller_ack_setup_credentials,
          seller_ack_agency: !!formData.seller_ack_agency,
          seller_ack_exclusive: !!formData.seller_ack_exclusive,
          delivery_tier: deliveryTier,
          delivery_tier_recommended: deliveryRecommended,
          delivery_tier_overridden: deliveryTier !== deliveryRecommended,
          max_sales: maxSales,
          delivery_method_note: deliveryTier === 'tier3' ? deliveryNote : null,
          return_allowed: !!formData.return_allowed,
          return_window_days: formData.return_allowed ? formData.return_window_days : 1,
          return_fee_enabled: !!formData.return_fee_enabled,
          return_fee_percentage: formData.return_fee_enabled ? formData.return_fee_percentage : 0,
          return_conditions: formData.return_conditions || null,
          seller_accepted_terms: !!formData.seller_accepted_terms,
          seller_rules_confirmed: !!formData.seller_rules_confirmed,
          demo_video_url: formData.demo_video_url?.trim() || null,
          demo_video_storage_path:
            (formData.demo_video_paths?.[0] || formData.demo_video_storage_path || '').trim() || null,
          demo_video_paths: formData.demo_video_paths ?? [],
        })
        .eq('id', id);

      if (error) throw error;

      // Server-side recompute & enforcement (best-effort; non-blocking for save)
      try {
        await supabase.functions.invoke('compute-delivery-recommendation', {
          body: {
            product_id: id,
            delivery_tier: deliveryTier,
            override_acknowledged: overrideAck,
            delivery_method_note: deliveryNote,
            max_sales: maxSales,
            publish: formData.is_published,
          },
        });
      } catch (e) {
        console.warn('compute-delivery-recommendation failed (non-blocking)', e);
      }

      toast.success('Product updated successfully!');
      navigate('/seller-dashboard');
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast.error(error.message || 'Failed to update product');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (roleLoading || productLoading) {
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
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to edit products.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Edit Product</h1>
            <p className="text-muted-foreground">
              Update your product information
            </p>
          </div>
          <div className="flex items-center gap-4">
            {reviewStatus === 'approved' && (
              <div className="flex items-center gap-2">
                <Switch
                  id="publish-toggle"
                  checked={formData.is_published}
                  onCheckedChange={handleTogglePublish}
                />
                <Label htmlFor="publish-toggle" className="flex items-center gap-2 cursor-pointer">
                  {formData.is_published ? (
                    <>
                      <Eye className="h-4 w-4" />
                      Visible
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Hidden
                    </>
                  )}
                </Label>
              </div>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="mb-8">
              <div className="flex justify-between mb-2 overflow-x-auto pb-2">
                {STEPS.map((step) => (
                  <button
                    type="button"
                    key={step.id}
                    onClick={() => setCurrentStep(step.id)}
                    title={step.description}
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
                  </button>
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
                <div>
                  {existingImageUrl && media.length === 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">Current Image:</p>
                      <img
                        src={existingImageUrl}
                        alt="Current product"
                        className="w-32 h-32 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                  <ImagesStep
                    media={media}
                    onAddFile={async (file) => {
                      try {
                        await addMediaFile(file, async () => id ?? null);
                      } catch (e: any) {
                        toast.error(e?.message || 'Could not upload media');
                      }
                    }}
                    onRemove={removeMediaItem}
                    onReorder={reorderMedia}
                    errors={errors}
                  />
                </div>
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
                <DeliveryFilesStep
                  data={{
                    delivery_mode: formData.delivery_mode,
                    delivery_time_hours: formData.delivery_time_hours,
                    available_quantity: formData.available_quantity,
                    product_type: formData.product_type,
                    license_exclusive_enabled: formData.license_exclusive_enabled,
                    setup_requirements: formData.setup_requirements,
                    setup_access_window_hours: formData.setup_access_window_hours,
                    setup_no_credentials: formData.setup_no_credentials,
                  }}
                  onChange={handleChange}
                  deliveryFiles={deliveryFiles}
                  uploading={deliveryUploading}
                  onAddFile={async (file) => {
                    try {
                      const row = await addDeliveryFile(file);
                      setFileSizeBytes(Number(row.file_size) || 0);
                      toast.success(`${row.file_name} uploaded and saved to this product`);
                    } catch (e: any) {
                      toast.error(e?.message || 'Upload failed');
                    }
                  }}
                  onRemoveFile={async (fileId) => {
                    try {
                      await removeDeliveryFile(fileId);
                    } catch (e: any) {
                      toast.error(e?.message || 'Could not delete the file');
                    }
                  }}
                  errors={errors}
                />
              )}
              {currentStep === 9 && (
                <ReturnPolicyStep data={formData} onChange={handleChange} errors={errors} />
              )}
              {currentStep === 10 && (
                <TermsAcceptanceStep data={formData} onChange={handleChange} errors={errors} />
              )}
              {currentStep === 11 && (
                <DemoVideoStep
                  data={{
                    demo_video_url: formData.demo_video_url,
                    demo_video_storage_path: formData.demo_video_storage_path,
                    demo_video_paths: formData.demo_video_paths,
                  }}
                  onChange={handleChange}
                  errors={errors}
                />
              )}
            </div>

            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isSubmitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {currentStep < STEPS.length ? (
                <Button onClick={handleNext} disabled={isSubmitting}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {id && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Delivery Mode</CardTitle>
              <CardDescription>
                Choose how this product is delivered to buyers. We recommend a mode based on
                price, scarcity, and file size — you can override it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DeliveryTierSelector
                price={parseFloat(formData.price) || 0}
                maxSales={maxSales}
                fileSizeBytes={fileSizeBytes}
                value={deliveryTier}
                overrideAcknowledged={overrideAck}
                deliveryNote={deliveryNote}
                onChange={(next) => {
                  setDeliveryTier(next.delivery_tier);
                  setDeliveryRecommended(next.delivery_tier_recommended);
                  setDeliveryOverridden(next.delivery_tier_overridden);
                  setOverrideAck(next.override_acknowledged);
                  if (typeof next.delivery_method_note === 'string') {
                    setDeliveryNote(next.delivery_method_note);
                  }
                }}
              />

              {deliveryTier !== 'tier3' && (
                <div className="border-t pt-6">
                  <h3 className="text-base font-semibold mb-1">Delivery Files</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Private files buyers download after purchase. Virus-scanned automatically.
                    {' '}A clean delivery file is required before this product can be published.
                  </p>
                  <ProductDeliveryFilesManager productId={id} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {id && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Review &amp; Publish</CardTitle>
              <CardDescription>
                Every product is reviewed by our team before going live. Save your changes first,
                then submit for review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProductReviewStatusCard
                productId={id}
                reviewStatus={reviewStatus}
                requiresAccessReview={requiresAccessReview}
                reviewNotes={reviewNotes}
                deliveryTier={deliveryTier}
                onSubmitted={() => setReviewRefreshKey((k) => k + 1)}
              />
            </CardContent>
          </Card>
        )}




        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Product?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete this product? This action cannot be undone.
                All product data, images, and analytics will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Product
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
