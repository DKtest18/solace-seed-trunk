import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { externalSupabase } from '@/lib/externalSupabase';
import { useAuth } from '@/contexts/AuthContext';
import { useMeetingInfoModal } from '@/contexts/MeetingInfoModalContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, Phone, Video, Send, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SellerInfo {
  seller_id: string;
  profile: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

interface OpenRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: SellerInfo;
}

const MEETING_METHODS = [
  { value: 'dk_ai_meeting', label: 'DK AI Meeting', icon: Video, requiresPhone: false, isHosted: true },
  { value: 'phone', label: 'Phone Call', icon: Phone, requiresPhone: true, isHosted: false },
  { value: 'zoom', label: 'Zoom', icon: Video, requiresPhone: false, isHosted: false },
  { value: 'teams', label: 'Microsoft Teams', icon: Video, requiresPhone: false, isHosted: false },
] as const;

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  topic?: string;
  description?: string;
  date?: string;
  time?: string;
  method?: string;
  consent?: string;
}

// Meeting code is now generated server-side via edge function

export function OpenRequestForm({ open, onOpenChange, seller }: OpenRequestFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showMeetingInfo } = useMeetingInfoModal();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [time, setTime] = useState('');
  const [meetingMethod, setMeetingMethod] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [consentToContact, setConsentToContact] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setEmail(user?.email || '');
      setPhone('');
      setTopic('');
      setDescription('');
      setSelectedDate(undefined);
      setTime('');
      setMeetingMethod('');
      setConsentToContact(false);
      setErrors({});
    }
  }, [open, user?.email]);

  const selectedMethod = MEETING_METHODS.find(m => m.value === meetingMethod);
  const phoneRequired = selectedMethod?.requiresPhone || false;

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (phoneRequired && !phone.trim()) {
      newErrors.phone = 'Phone number is required for phone call meetings';
    }

    if (!topic.trim()) {
      newErrors.topic = 'Topic is required - what would you like to discuss?';
    } else if (topic.trim().length < 5) {
      newErrors.topic = 'Please provide a more descriptive topic (minimum 5 characters)';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required - please explain what you need';
    } else if (description.trim().length < 20) {
      newErrors.description = 'Please provide more details (minimum 20 characters)';
    }

    if (!selectedDate) {
      newErrors.date = 'Please select a preferred date';
    }

    if (!time) {
      newErrors.time = 'Please select a preferred time';
    }

    if (!meetingMethod) {
      newErrors.method = 'Please select a meeting type';
    }

    if (!consentToContact) {
      newErrors.consent = 'You must consent to be contacted';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!validateForm()) throw new Error('Please fix the errors above');

      const isDkAiMeeting = meetingMethod === 'dk_ai_meeting';

      // Calculate scheduled start and end times
      const scheduledStart = new Date(`${format(selectedDate!, 'yyyy-MM-dd')}T${time}:00`);
      const scheduledEnd = new Date(scheduledStart.getTime() + 30 * 60 * 1000); // 30 min default

      let dkMeetingData = null;

      // For DK AI Meeting, use Edge Function with service role key for guaranteed insert
      if (isDkAiMeeting) {
        console.log('[OpenRequestForm] Creating DK AI Meeting via Edge Function...');
        console.log('[OpenRequestForm] Supabase URL:', import.meta.env.VITE_SUPABASE_URL?.split('.')[0] + '...');

        const { data: edgeFnData, error: edgeFnError } = await supabase.functions.invoke('create-meeting-request', {
          body: {
            buyer_name: name.trim(),
            buyer_id: user?.id || null,
            buyer_email: email.trim(),
            seller_id: seller.seller_id,
            seller_name: seller.profile.full_name || seller.profile.username,
            title: topic.trim(),
            description: description.trim(),
            scheduled_start: scheduledStart.toISOString(),
            scheduled_end: scheduledEnd.toISOString(),
          }
        });

        console.log('[OpenRequestForm] Edge Function response:', JSON.stringify(edgeFnData));

        if (edgeFnError) {
          console.error('[OpenRequestForm] Edge Function error:', edgeFnError);
          throw new Error(edgeFnError.message || 'Failed to create meeting');
        }

        if (!edgeFnData?.success || !edgeFnData?.meeting) {
          console.error('[OpenRequestForm] Edge Function returned failure:', edgeFnData);
          throw new Error(edgeFnData?.error || 'Meeting creation failed');
        }

        const meeting = edgeFnData.meeting;
        console.log('[OpenRequestForm] Meeting created:', meeting.id, meeting.meeting_code);

        // PROOF QUERY: Verify the row exists from client side using external Supabase
        console.log('[OpenRequestForm] Running proof query on external dk_meetings2...');
        const { data: proofData, error: proofError } = await externalSupabase
          .from('dk_meetings2')
          .select('meeting_id, meeting_cod')
          .eq('meeting_id', meeting.id)
          .eq('meeting_cod', meeting.meeting_code)
          .maybeSingle();

        console.log('[OpenRequestForm] Proof query result:', JSON.stringify(proofData), 'error:', proofError);

        if (proofError) {
          console.error('[OpenRequestForm] Proof query error:', proofError);
          throw new Error('Meeting created but verification failed: ' + proofError.message);
        }

        if (!proofData) {
          console.error('[OpenRequestForm] PROOF FAILED - Row not found in DB!');
          throw new Error('Meeting not persisted. DB write failed. Please try again.');
        }

        console.log('[OpenRequestForm] PROOF SUCCESS - Row confirmed in DB');
        dkMeetingData = { id: meeting.id, meeting_code: meeting.meeting_code };
      }

      // Also create a meeting_request for tracking (if user is logged in)
      if (user) {
        const { error: requestError } = await supabase
          .from('meeting_requests')
          .insert({
            seller_id: seller.seller_id,
            buyer_id: user.id,
            is_open_request: true,
            requested_date: format(selectedDate!, 'yyyy-MM-dd'),
            requested_time: time + ':00',
            buyer_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            meeting_method: meetingMethod,
            contact_name: name.trim(),
            contact_email: email.trim(),
            contact_phone: phone.trim() || null,
            contact_topic: topic.trim(),
            contact_description: description.trim(),
            buyer_message: `Topic: ${topic.trim()}\n\n${description.trim()}`,
            consent_to_contact: consentToContact,
            status: 'pending'
          });

        if (requestError) console.error('Failed to create meeting request:', requestError);
      }

      // Send notification to seller
      try {
        await supabase.from('in_app_notifications').insert({
          user_id: seller.seller_id,
          type: 'meeting_request',
          title: 'New Meeting Request',
          message: `${name.trim()} has requested a meeting: "${topic.trim()}" on ${format(selectedDate!, 'PPP')} at ${time}`,
          reference_id: dkMeetingData?.id || null
        });
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
      }

      return { dkMeeting: dkMeetingData };
    },
    onSuccess: (data) => {
      // For DK AI Meeting, show the meeting code popup immediately
      if (data?.dkMeeting?.id && data?.dkMeeting?.meeting_code) {
        showMeetingInfo(data.dkMeeting.id, data.dkMeeting.meeting_code);
      }
      
      toast.success('Meeting request submitted!', {
        description: data?.dkMeeting ? 'Save your Meeting Code!' : 'The seller will review your request.'
      });
      queryClient.invalidateQueries({ queryKey: ['my-meeting-requests'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error.message !== 'Please fix the errors above') {
        toast.error('Failed to submit request', { description: error.message });
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a Meeting with {seller.profile.full_name || seller.profile.username}</DialogTitle>
          <DialogDescription>
            Fill out all required fields. The seller will review your request and confirm availability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Meeting Type Selection */}
          <div className="space-y-2">
            <Label>Meeting Type *</Label>
            <div className="grid grid-cols-3 gap-2">
              {MEETING_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <Button
                    key={method.value}
                    type="button"
                    variant={meetingMethod === method.value ? "default" : "outline"}
                    className="justify-start h-auto py-3"
                    onClick={() => {
                      setMeetingMethod(method.value);
                      setErrors(prev => ({ ...prev, method: undefined }));
                    }}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {method.label}
                  </Button>
                );
              })}
            </div>
            {meetingMethod === 'dk_ai_meeting' && (
              <p className="text-sm text-muted-foreground p-2 bg-primary/5 rounded-md">
                This meeting will take place on DK AI System. A join link will be provided after the seller confirms.
              </p>
            )}
            {errors.method && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.method}
              </p>
            )}
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors(prev => ({ ...prev, name: undefined }));
                }}
                placeholder="Enter your full name"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors(prev => ({ ...prev, email: undefined }));
                }}
                placeholder="your@email.com"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone Number {phoneRequired ? '*' : '(optional)'}
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setErrors(prev => ({ ...prev, phone: undefined }));
                }}
                placeholder="+1 (555) 000-0000"
                className={errors.phone ? 'border-destructive' : ''}
              />
              {phoneRequired && (
                <p className="text-xs text-muted-foreground">Required for phone call meetings</p>
              )}
              {errors.phone && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.phone}
                </p>
              )}
            </div>
          </div>

          {/* Topic & Description */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic *</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setErrors(prev => ({ ...prev, topic: undefined }));
                }}
                placeholder="What would you like to discuss?"
                className={errors.topic ? 'border-destructive' : ''}
              />
              {errors.topic && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.topic}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description / What You Need *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setErrors(prev => ({ ...prev, description: undefined }));
                }}
                placeholder="Please describe in detail what you need help with, your goals, and any relevant background information..."
                rows={4}
                className={errors.description ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/20 characters minimum
              </p>
              {errors.description && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.description}
                </p>
              )}
            </div>
          </div>

          {/* Date & Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preferred Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground",
                      errors.date && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setErrors(prev => ({ ...prev, date: undefined }));
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.date && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.date}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Preferred Time *</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setErrors(prev => ({ ...prev, time: undefined }));
                }}
                className={errors.time ? 'border-destructive' : ''}
              />
              {errors.time && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.time}
                </p>
              )}
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className={cn(
            "flex items-start space-x-3 p-4 rounded-lg border",
            errors.consent ? "border-destructive bg-destructive/5" : "bg-muted/50"
          )}>
            <Checkbox
              id="consent"
              checked={consentToContact}
              onCheckedChange={(checked) => {
                setConsentToContact(checked === true);
                setErrors(prev => ({ ...prev, consent: undefined }));
              }}
            />
            <div>
              <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                I consent to be contacted regarding this meeting request. *
              </Label>
              {errors.consent && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> {errors.consent}
                </p>
              )}
            </div>
          </div>

          {/* Info Notice */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Date and time are subject to seller confirmation. The seller may propose an alternative time or meeting method.
            </AlertDescription>
          </Alert>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={() => createRequestMutation.mutate()}
            disabled={createRequestMutation.isPending}
          >
            {createRequestMutation.isPending ? 'Submitting...' : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Request Meeting
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
