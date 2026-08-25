import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';

import { isSellerAgreementCurrent, useSellerRestrictions } from '@/hooks/useSellerRestrictions';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { BasicInfoStep } from '@/components/product-creation/BasicInfoStep';
import { useDeliveryFiles } from '@/hooks/useDeliveryFiles';
import { useProductMedia } from '@/hooks/useProductMedia';
import { ImagesStep } from '@/components/product-creation/ImagesStep';
import { PricingStep } from '@/components/product-creation/PricingStep';
import { FeaturesTagsStep } from '@/components/product-creation/FeaturesTagsStep';
import { PurposeAudienceStep } from '@/components/product-creation/PurposeAudienceStep';
import { AdditionalDetailsStep } from '@/components/product-creation/AdditionalDetailsStep';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FAQStep } from '@/components/product-creation/FAQStep';
import { DemoVideoStep, isValidDemoVideoUrl, parseDemoVideoPaths } from '@/components/product-creation/DemoVideoStep';

import { DeliveryFilesStep } from '@/components/product-creation/DeliveryFilesStep';
import { ReturnPolicyStep } from '@/components/product-creation/ReturnPolicyStep';
import { TermsAcceptanceStep } from '@/components/product-creation/TermsAcceptanceStep';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { fetchStripeConnectStatus, isStripeConnectedForOnboarding } from '@/lib/stripeConnectStatus';
import { fetchPayPalConnectStatus, isPayPalConnectedForOnboarding } from '@/lib/paypalConnectStatus';
import { DELIVERY_MODE, normalizeDeliveryMode, REVIEW_STATUS } from '@/lib/reviewStatus';
import { hasCurrentSellerAgreement } from '@/lib/sellerAgreement';
import { getSellerAgreementState } from '@/lib/sellerAgreementAccept';

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

export default function CreateProduct() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  
  const {
    data: restrictions,
    isLoading: loadingRestrictions,
    error: restrictionsError,
  } = useSellerRestrictions();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(() => {
    const stepParam = searchParams.get('step');
    return stepParam ? Math.min(Math.max(parseInt(stepParam, 10) || 1, 1), STEPS.length) : 1;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const draftCreationRef = useRef<Promise<string | null> | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showSubmittedDialog, setShowSubmittedDialog] = useState(false);

  // Sync step from URL param
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const step = Math.min(Math.max(parseInt(stepParam, 10) || 1, 1), STEPS.length);
      setCurrentStep(step);
    }
  }, [searchParams]);

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
    delivery_mode: DELIVERY_MODE.INSTANT as string,
    delivery_time_hours: null as number | null,
    seller_accepted_terms: false,
    seller_rules_confirmed: false,

    return_allowed: false,
    return_window_days: 1,
    return_fee_enabled: false,
    return_fee_percentage: 0,
    return_conditions: '',
    license_commercial_enabled: false,
    license_commercial_price: '',
    license_agency_enabled: false,
    license_agency_price: '',
    license_exclusive_enabled: false,
    license_exclusive_price: '',
    // Adaptive fields
    subscription_period_deliverables: '',
    subscription_cancellation_note: '',
    max_active_subscribers: '',
    license_personal_description: '',
    license_commercial_description: '',
    license_agency_description: '',
    license_exclusive_description: '',
    exclusive_source_files_description: '',
    // Setup-by-seller
    requires_setup_credentials: false,
    setup_requirements: [] as any[],
    setup_access_window_hours: 48,
    setup_no_credentials: false,
    // Dynamic acknowledgements
    seller_ack_refund_policy: false,
    seller_ack_subscription: false,
    seller_ack_manual_delivery: false,
    seller_ack_setup_credentials: false,
    seller_ack_agency: false,
    seller_ack_exclusive: false,
    // Demo video (required before review)
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
  // Delivery-file uploads need the draft row to exist first; the concrete
  // helper is defined further down, so route through a ref.
  const ensureDraftRef = useRef<() => Promise<string | null>>(async () => null);
  const ensureDraftIdForUpload = () => ensureDraftRef.current();
  const {
    files: deliveryFiles,
    filesRef: deliveryFilesRef,
    uploading: deliveryUploading,
    load: loadDeliveryFiles,
    addFile: addDeliveryFile,
    remove: removeDeliveryFile,
  } = useDeliveryFiles(ensureDraftIdForUpload);

  
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
          draftIdRef.current = data.id;
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
            delivery_mode: normalizeDeliveryMode(data.delivery_mode ?? prev.delivery_mode),
            delivery_time_hours: data.delivery_time_hours ?? prev.delivery_time_hours,
            seller_accepted_terms: !!data.seller_accepted_terms,
            seller_rules_confirmed: !!data.seller_rules_confirmed,

            return_allowed: !!data.return_allowed,
            return_window_days: data.return_window_days ?? 1,
            return_fee_enabled: !!data.return_fee_enabled,
            return_fee_percentage: data.return_fee_percentage ?? 0,
            return_conditions: data.return_conditions ?? '',
            license_commercial_enabled: !!data.license_commercial_enabled,
            license_commercial_price: data.license_commercial_price != null ? String(data.license_commercial_price) : '',
            license_agency_enabled: !!data.license_agency_enabled,
            license_agency_price: data.license_agency_price != null ? String(data.license_agency_price) : '',
            license_exclusive_enabled: !!data.license_exclusive_enabled,
            license_exclusive_price: data.license_exclusive_price != null ? String(data.license_exclusive_price) : '',
            subscription_period_deliverables: data.subscription_period_deliverables ?? '',
            subscription_cancellation_note: data.subscription_cancellation_note ?? '',
            max_active_subscribers: data.max_active_subscribers != null ? String(data.max_active_subscribers) : '',
            license_personal_description: data.license_personal_description ?? '',
            license_commercial_description: data.license_commercial_description ?? '',
            license_agency_description: data.license_agency_description ?? '',
            license_exclusive_description: data.license_exclusive_description ?? '',
            exclusive_source_files_description: data.exclusive_source_files_description ?? '',
            requires_setup_credentials: !!data.requires_setup_credentials,
            setup_requirements: Array.isArray(data.setup_requirements) ? data.setup_requirements : [],
            setup_access_window_hours: data.setup_access_window_hours ?? 48,
            setup_no_credentials: !!data.setup_no_credentials,
            seller_ack_refund_policy: !!data.seller_ack_refund_policy,
            seller_ack_subscription: !!data.seller_ack_subscription,
            seller_ack_manual_delivery: !!data.seller_ack_manual_delivery,
            seller_ack_setup_credentials: !!data.seller_ack_setup_credentials,
            seller_ack_agency: !!data.seller_ack_agency,
            seller_ack_exclusive: !!data.seller_ack_exclusive,
            demo_video_url: data.demo_video_url ?? '',
            demo_video_storage_path: data.demo_video_storage_path ?? '',
            demo_video_paths: parseDemoVideoPaths(data.demo_video_paths ?? data.demo_video_storage_path),
          }));
          await loadMedia(data.id);
          try {
            await loadDeliveryFiles(data.id);
          } catch (e: any) {
            toast.error(`Could not load your delivery files: ${e?.message || e}`);
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
    billing_interval_count: formData.pricing_model === 'recurring' ? (formData.billing_interval_count ?? 1) : 1,
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
    delivery_mode: normalizeDeliveryMode(formData.delivery_mode),
    // Delivery time applies to manual delivery and seller setup; only instant
    // download has no window.
    delivery_time_hours:
      normalizeDeliveryMode(formData.delivery_mode) === DELIVERY_MODE.INSTANT ? null : (formData.delivery_time_hours ?? 24),
    seller_accepted_terms: formData.seller_accepted_terms,
    seller_rules_confirmed: !!formData.seller_rules_confirmed,
    seller_rules_confirmed_at: formData.seller_rules_confirmed ? new Date().toISOString() : null,

    return_allowed: formData.return_allowed,
    return_window_days: formData.return_allowed ? formData.return_window_days : 1,
    return_fee_enabled: formData.return_fee_enabled,
    return_fee_percentage: formData.return_fee_enabled ? formData.return_fee_percentage : 0,
    return_conditions: formData.return_conditions || null,
    seller_ack_refund_policy_at: formData.seller_ack_refund_policy ? new Date().toISOString() : null,
    // Tiered licenses (Personal = existing price/currency; higher tiers optional)
    license_personal_enabled: true,
    license_personal_price: formData.price ? parseFloat(formData.price) : 0,
    license_commercial_enabled: !!formData.license_commercial_enabled,
    license_commercial_price: formData.license_commercial_enabled && formData.license_commercial_price
      ? parseFloat(formData.license_commercial_price) : null,
    license_agency_enabled: !!formData.license_agency_enabled,
    license_agency_price: formData.license_agency_enabled && formData.license_agency_price
      ? parseFloat(formData.license_agency_price) : null,
    license_exclusive_enabled: !!formData.license_exclusive_enabled,
    license_exclusive_price: formData.license_exclusive_enabled && formData.license_exclusive_price
      ? parseFloat(formData.license_exclusive_price) : null,
    // Adaptive columns
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
    requires_setup_credentials: normalizeDeliveryMode(formData.delivery_mode) === DELIVERY_MODE.SETUP && !formData.setup_no_credentials,
    setup_requirements: normalizeDeliveryMode(formData.delivery_mode) === DELIVERY_MODE.SETUP && !formData.setup_no_credentials
      ? formData.setup_requirements : [],
    setup_access_window_hours: normalizeDeliveryMode(formData.delivery_mode) === DELIVERY_MODE.SETUP ? formData.setup_access_window_hours : null,
    setup_no_credentials: normalizeDeliveryMode(formData.delivery_mode) === DELIVERY_MODE.SETUP ? !!formData.setup_no_credentials : false,
    seller_ack_refund_policy: !!formData.seller_ack_refund_policy,
    seller_ack_subscription: !!formData.seller_ack_subscription,
    seller_ack_manual_delivery: !!formData.seller_ack_manual_delivery,
    seller_ack_setup_credentials: !!formData.seller_ack_setup_credentials,
    seller_ack_agency: !!formData.seller_ack_agency,
    seller_ack_exclusive: !!formData.seller_ack_exclusive,
    demo_video_url: formData.demo_video_url?.trim() || null,
    demo_video_storage_path: (formData.demo_video_paths?.[0] || formData.demo_video_storage_path || '').trim() || null,
    // The database column is NOT NULL; drafts without demo videos use an empty JSON array.
    demo_video_paths: formData.demo_video_paths ?? [],
    status: 'draft',
    is_published: false,
  });

  const persistDraft = async (): Promise<string | null> => {
    if (!user) return null;

    // Re-check the binding account-level acceptance immediately before every
    // draft write. Do not rely on a cached React Query result: media uploads
    // create the draft on demand and the database trigger is authoritative.
    const agreementProfile = await getSellerAgreementState(user.id);
    if (!hasCurrentSellerAgreement(agreementProfile)) {
      navigate('/seller-onboarding/terms');
      throw new Error('Please accept the current Seller Agreement before uploading product media.');
    }

    const payload = buildDraftPayload();
    try {
      const existingDraftId = draftIdRef.current;
      if (existingDraftId) {
        const { error } = await db.from('dkai_products').update(payload).eq('id', existingDraftId);
        if (error) throw error;
        return existingDraftId;
      } else {
        const { data, error } = await db
          .from('dkai_products')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        draftIdRef.current = data.id;
        setDraftId(data.id);
        return data.id;
      }
    } catch (e: any) {
      console.error('Draft save failed', e);
      throw e;
    }
  };

  const ensureDraftForMedia = async (): Promise<string | null> => {
    if (draftIdRef.current) return draftIdRef.current;
    if (draftCreationRef.current) return draftCreationRef.current;
    draftCreationRef.current = persistDraft();
    try {
      return await draftCreationRef.current;
    } finally {
      draftCreationRef.current = null;
    }
  };

  ensureDraftRef.current = ensureDraftForMedia;

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
        if (media.filter((m) => !m.uploading && !m.error).length === 0) {
          newErrors.imagesError = 'At least one product image is required';
        } else if (media.some((m) => m.uploading)) {
          newErrors.imagesError = 'Please wait until all media finished uploading';
        } else if (media.length > 10) {
          newErrors.imagesError = 'Maximum 10 media files allowed';
        }
        break;

      case 4: {
        const price = parseFloat(formData.price);
        if (isNaN(price) || price < 1) newErrors.priceError = 'Price must be at least $1';
        if (price > 10000) newErrors.priceError = 'Price cannot exceed $10,000';
        if (formData.pricing_model === 'recurring') {
          const limits: Record<string, number> = { day: 365, week: 52, month: 12, year: 1 };
          const iv = formData.billing_interval || 'month';
          const c = Number(formData.billing_interval_count ?? 1);
          const max = limits[iv] ?? 12;
          if (!Number.isFinite(c) || c < 1 || c > max) {
            newErrors.priceError = `For ${iv}s Stripe allows interval count 1 to ${max}.`;
          }
        }
        break;
      }

      case 6:
        if (formData.license_exclusive_enabled && !(formData.exclusive_source_files_description || '').trim()) {
          newErrors.exclusiveSourceFilesError = 'Describe the source files the exclusive buyer receives.';
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

      case 11: {
        const link = (formData.demo_video_url || '').trim();
        const uploaded = (formData.demo_video_paths?.[0] || formData.demo_video_storage_path || '').trim();
        if (!link && !uploaded) {
          newErrors.demoVideoUrlError = 'A demo video is required: paste a Loom/YouTube link or upload a file.';
        } else if (link && !isValidDemoVideoUrl(link)) {
          newErrors.demoVideoUrlError = 'Enter a valid loom.com/share/..., youtube.com/watch?v=... or youtu.be/... link.';
        }
        break;
      }

      case 8:
        if (!Object.values(DELIVERY_MODE).includes(normalizeDeliveryMode(formData.delivery_mode))) {
          newErrors.deliveryModeError = 'Choose Instant download, Manual delivery, or Setup by seller';
        }
        if (
          normalizeDeliveryMode(formData.delivery_mode) === DELIVERY_MODE.INSTANT &&
          deliveryFiles.filter((f) => !f.uploading && !f.error).length === 0
        ) {
          newErrors.deliveryFilesError = 'Instant download requires at least one uploaded file';
        }
        if (normalizeDeliveryMode(formData.delivery_mode) === DELIVERY_MODE.MANUAL) {
          const h = formData.delivery_time_hours ?? 0;
          if (![12, 24, 48].includes(h)) {
            newErrors.deliveryModeError = 'Pick 12, 24, or 48 hours (max 48h)';
          }
        }
        if (normalizeDeliveryMode(formData.delivery_mode) === DELIVERY_MODE.SETUP) {
          if (!formData.setup_no_credentials && (formData.setup_requirements?.length ?? 0) === 0) {
            newErrors.setupRequirementsError = 'Add at least one required item, or check "no credentials needed".';
          }
          if (!formData.setup_no_credentials) {
            for (const sp of formData.setup_requirements || []) {
              if (!sp.key?.trim() || !sp.label?.trim()) {
                newErrors.setupRequirementsError = 'Every setup item needs a key and a label.';
                break;
              }
            }
          }
        }
        if (formData.available_quantity && (parseInt(formData.available_quantity) < 1 || isNaN(parseInt(formData.available_quantity)))) {
          newErrors.deliveryFilesError = 'Available quantity must be a positive integer or empty';
        }
        break;

      case 9: {
        const isSubscription = formData.pricing_model === 'recurring';
        const isManual = normalizeDeliveryMode(formData.delivery_mode) === DELIVERY_MODE.MANUAL;
        const isSetup = normalizeDeliveryMode(formData.delivery_mode) === DELIVERY_MODE.SETUP;
        const hasSecretSpecs = isSetup && !formData.setup_no_credentials && (formData.setup_requirements?.length ?? 0) > 0;
        const missing: string[] = [];
        if (!formData.seller_ack_refund_policy) missing.push('refund policy');
        if (isSubscription && !formData.seller_ack_subscription) missing.push('subscription cancellation');
        if ((isManual || isSetup) && !formData.seller_ack_manual_delivery) missing.push('delivery commitment');
        if (hasSecretSpecs && !formData.seller_ack_setup_credentials) missing.push('credential handling');
        if (formData.license_agency_enabled && !formData.seller_ack_agency) missing.push('agency license');
        if (formData.license_exclusive_enabled && !formData.seller_ack_exclusive) missing.push('exclusive buyout');
        if (missing.length > 0) newErrors.returnPolicyError = `Please acknowledge: ${missing.join(', ')}.`;
        break;
      }

      case 10:
        if (!formData.seller_accepted_terms) {
          newErrors.seller_accepted_termsError = 'You must accept the seller terms to continue';
        }
        if (!formData.seller_rules_confirmed) {
          newErrors.seller_rules_confirmedError = 'You must confirm this product complies with the Seller Rules & Obligations';
        }
        break;

    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    // Free navigation: don't block on validation between steps.
    // Full validation only runs at final submit.
    try {
      await persistDraft();
    } catch (e) {
      console.warn('Draft save on next failed', e);
    }
    setErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleJumpToStep = async (target: number) => {
    if (target === currentStep || isSubmitting || isSavingDraft) return;
    // Save progress silently when jumping; skip validation so users can freely navigate.
    try {
      await persistDraft();
    } catch (e) {
      // non-fatal — still allow navigation
      console.warn('Draft save on jump failed', e);
    }
    setErrors({});
    setCurrentStep(Math.min(Math.max(target, 1), STEPS.length));
  };

  const hasDemoVideo =
    !!(formData.demo_video_url || '').trim() ||
    !!(formData.demo_video_paths?.length) ||
    !!(formData.demo_video_storage_path || '').trim();

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
      // Media is already uploaded and stored in dkai_product_media as the seller
      // picks files, so nothing to upload here. Just derive the cover image.
      const cover = media.find((m) => m.media_type === 'image' && !m.uploading && !m.error);
      const imageUrl: string | null = cover ? cover.url : null;

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
        // CRITICAL: admin queue filters on review_status. Without these the
        // submission never appears in /admin/waitlist.
        review_status: REVIEW_STATUS.SUBMITTED,
        submitted_at: new Date().toISOString(),
      };
      if (imageUrl) submitPayload.image_url = imageUrl;

      const { error } = await db.from('dkai_products').update(submitPayload).eq('id', id);
      if (error) throw error;

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

  if (restrictionsError) {
    const message = restrictionsError instanceof Error
      ? restrictionsError.message
      : String(restrictionsError);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertDescription className="break-words font-mono">{message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Account-level Seller Agreement is the binding acceptance. If it's missing or
  // outdated, route the seller to the account-level gate instead of showing the
  // full rules text again here.
  if (!loadingRestrictions && !isSellerAgreementCurrent(restrictions)) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Seller Agreement required</CardTitle>
              <CardDescription>
                Before creating a product you need to accept the current Seller Agreement &
                Seller Rules & Obligations on your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button onClick={() => navigate('/seller-onboarding/terms')} className="w-full">
                Review &amp; accept Seller Agreement
              </Button>
              <Button onClick={() => navigate('/seller-dashboard')} variant="outline" className="w-full">
                Back to dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }


  const progress = (currentStep / STEPS.length) * 100;

  // Inline notice only — Stripe connection lives on the account / Payment Settings page,
  // it is NOT a step in product creation anymore.
  const PayoutConnectionNotice = () => {
    const { data: stripeStatus } = useQuery({
      queryKey: ['stripe-connect-status', user?.id],
      queryFn: fetchStripeConnectStatus,
      enabled: !!user,
      staleTime: 60_000,
    });
    const { data: paypalStatus } = useQuery({
      queryKey: ['paypal-connect-status', user?.id],
      queryFn: fetchPayPalConnectStatus,
      enabled: !!user,
      staleTime: 60_000,
    });

    const stripeConnected = !!stripeStatus && isStripeConnectedForOnboarding(stripeStatus);
    const paypalConnected = !!paypalStatus && isPayPalConnectedForOnboarding(paypalStatus);
    if (stripeConnected || paypalConnected) return null;
    if (!stripeStatus && !paypalStatus) return null;

    return (
      <Alert className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No payout account connected yet (Stripe or PayPal). You can still submit this product for
          review and it will be shown in the marketplace to everyone — including visitors without an
          account — but it <strong>cannot be bought</strong> until you connect Stripe or PayPal.{' '}
          <Link to="/seller/payment-settings" className="underline font-medium">
            Open Payment Settings
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  };


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

        <PayoutConnectionNotice />

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="mb-8">
              <div className="flex justify-between mb-2 overflow-x-auto pb-2">
                {STEPS.map((step) => (
                  <button
                    type="button"
                    key={step.id}
                    onClick={() => handleJumpToStep(step.id)}
                    disabled={isSubmitting || isSavingDraft}
                    title={`Go to step ${step.id}: ${step.title}`}
                    className={`flex flex-col items-center min-w-[60px] cursor-pointer transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${
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
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary/40'
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
                <ImagesStep
                  media={media}
                  onAddFile={async (file) => {
                    try {
                      await addMediaFile(file, ensureDraftForMedia);
                    } catch (e: any) {
                      const message = String(e?.message || '');
                      if (message.includes('seller_agreement_not_accepted') || message.includes('Seller agreement')) {
                        navigate('/seller-onboarding/terms');
                      }
                      toast.error(e?.message || 'Could not upload media');
                    }
                  }}
                  onRemove={removeMediaItem}
                  onReorder={reorderMedia}
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
                <DeliveryFilesStep
                  data={{
                    delivery_mode: normalizeDeliveryMode(formData.delivery_mode),
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
                      toast.success(`${row.original_filename} uploaded and saved to this product`);
                    } catch (e: any) {
                      toast.error(e?.message || String(e));
                    }
                  }}
                  onRemoveFile={async (id) => {
                    try {
                      await removeDeliveryFile(id);
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
                  <Button onClick={handleSubmit} disabled={isSubmitting || isSavingDraft || !hasDemoVideo}>
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
