import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, addDays, isBefore, startOfToday } from 'date-fns';
import { Clock, DollarSign, Users, Check, AlertCircle, Phone, Video } from 'lucide-react';
import { MeetingBookingConfirmation } from './MeetingBookingConfirmation';
import { useMeetingInfoModal } from '@/contexts/MeetingInfoModalContext';

interface SellerWithMeetings {
  seller_id: string;
  timezone: string;
  profile: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  };
  meeting_types: {
    id: string;
    name: string;
    description?: string;
    is_paid: boolean;
    price: number;
    duration_minutes: number;
    is_group: boolean;
    max_participants?: number;
  }[];
}

interface MeetingBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: SellerWithMeetings;
}

type BookingStep = 'type' | 'date' | 'time' | 'details' | 'confirm';

const MEETING_PLATFORMS = [
  { value: 'dk_ai_meeting', label: 'DK AI Meeting', shortLabel: 'DK AI', icon: Video, isHosted: true },
  { value: 'google_meet', label: 'Google Meet', shortLabel: 'Meet', icon: Video, isHosted: false },
  { value: 'zoom', label: 'Zoom', shortLabel: 'Zoom', icon: Video, isHosted: false },
  { value: 'teams', label: 'Microsoft Teams', shortLabel: 'Teams', icon: Video, isHosted: false },
  { value: 'phone', label: 'Phone Call', shortLabel: 'Phone', icon: Phone, isHosted: false },
] as const;

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  topic?: string;
  description?: string;
  platform?: string;
}

// Separate component removed - button now inline with access to mutation

export function MeetingBookingDialog({ open, onOpenChange, seller }: MeetingBookingDialogProps) {
  const { user } = useAuth();
  const { showMeetingInfo } = useMeetingInfoModal();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<BookingStep>('type');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [buyerTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [errors, setErrors] = useState<FormErrors>({});
  
  // Note: Using global MeetingInfoModal via useMeetingInfoModal() for confirmation

  const selectedMeetingType = seller.meeting_types.find(mt => mt.id === selectedType);
  const phoneRequired = selectedPlatform === 'phone';

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('type');
      setSelectedType('');
      setSelectedDate(undefined);
      setSelectedTime('');
      setSelectedPlatform('');
      setName('');
      setEmail(user?.email || '');
      setPhone('');
      setTopic('');
      setDescription('');
      setErrors({});
    }
  }, [open, user?.email]);

  // Fetch available time slots for selected date
  const { data: availableSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ['available-slots', seller.seller_id, selectedDate, selectedType],
    queryFn: async () => {
      if (!selectedDate || !selectedType) return [];
      
      const duration = selectedMeetingType?.duration_minutes || 30;
      
      const { data, error } = await supabase.rpc('get_available_meeting_slots', {
        p_seller_id: seller.seller_id,
        p_date: format(selectedDate, 'yyyy-MM-dd'),
        p_duration_minutes: duration
      });

      if (error) throw error;
      return data?.filter((slot: any) => slot.is_available) || [];
    },
    enabled: !!selectedDate && !!selectedType && step === 'time'
  });

  const validateDetails = (): boolean => {
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
      newErrors.topic = 'Topic is required';
    }

    if (!description.trim() || description.trim().length < 10) {
      newErrors.description = 'Please provide a description (minimum 10 characters)';
    }

    if (!selectedPlatform) {
      newErrors.platform = 'Please select a meeting platform';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Generate secure meeting code (6-10 alphanumeric chars)
  const generateMeetingCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like 0/O, 1/I
    const length = 8;
    let code = '';
    const randomValues = crypto.getRandomValues(new Uint8Array(length));
    for (let i = 0; i < length; i++) {
      code += chars[randomValues[i] % chars.length];
    }
    return code;
  };

  // Create meeting request mutation
  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedDate || !selectedTime || !selectedType) {
        throw new Error('Missing required fields');
      }

      // Generate meeting code BEFORE insert
      const meetingCode = generateMeetingCode();
      console.log('Generated meeting code:', meetingCode);

      // First create the meeting request
      const { data: requestData, error: requestError } = await supabase
        .from('meeting_requests')
        .insert({
          meeting_type_id: selectedType,
          seller_id: seller.seller_id,
          buyer_id: user.id,
          requested_date: format(selectedDate, 'yyyy-MM-dd'),
          requested_time: selectedTime,
          buyer_timezone: buyerTimezone,
          meeting_method: selectedPlatform,
          contact_name: name.trim(),
          contact_email: email.trim(),
          contact_phone: phone.trim() || null,
          contact_topic: topic.trim(),
          contact_description: description.trim(),
          buyer_message: `Topic: ${topic.trim()}\n\n${description.trim()}`,
          status: 'pending'
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Create the meeting record with meeting_code
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          request_id: requestData.id,
          meeting_type_id: selectedType,
          seller_id: seller.seller_id,
          meeting_date: format(selectedDate, 'yyyy-MM-dd'),
          meeting_time: selectedTime,
          duration_minutes: selectedMeetingType?.duration_minutes || 30,
          meeting_platform: selectedPlatform,
          meeting_code: meetingCode,
          status: 'pending' // Will become 'accepted' when seller accepts
        })
        .select('id, meeting_code')
        .single();

      if (meetingError) throw meetingError;

      // Add buyer as participant
      await supabase.from('meeting_participants').insert([
        { meeting_id: meetingData.id, user_id: seller.seller_id, role: 'seller' },
        { meeting_id: meetingData.id, user_id: user.id, role: 'buyer' }
      ]);

      // Create audit log for meeting_requested
      await supabase.from('dkai_audit_logs').insert({
        user_id: user.id,
        action: 'MEETING_REQUESTED',
        table_name: 'meetings',
        record_id: meetingData.id,
        new_data: {
          meeting_id: meetingData.id,
          meeting_code: meetingData.meeting_code,
          seller_id: seller.seller_id,
          buyer_id: user.id,
          meeting_type_id: selectedType,
          meeting_date: format(selectedDate, 'yyyy-MM-dd'),
          meeting_time: selectedTime
        }
      });

      // If paid meeting, redirect to payment
      if (selectedMeetingType?.is_paid && selectedMeetingType.price > 0) {
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-meeting-payment', {
          body: {
            meeting_request_id: requestData.id,
            meeting_id: meetingData.id,
            amount: selectedMeetingType.price,
            seller_id: seller.seller_id
          }
        });

        if (paymentError) throw paymentError;
        
        if (paymentData?.url) {
          // Store meeting info before redirect so user can see it
          sessionStorage.setItem('pendingMeetingInfo', JSON.stringify({
            id: meetingData.id,
            code: meetingData.meeting_code
          }));
          window.location.href = paymentData.url;
          return { request: requestData, meeting: meetingData };
        }
      }

      return { request: requestData, meeting: meetingData };
    },
    onSuccess: (data) => {
      // CRITICAL: Show global modal with REAL ID and code from database
      if (data?.meeting?.id && data?.meeting?.meeting_code) {
        console.log('MEETING CREATED:', data.meeting.id, data.meeting.meeting_code);
        
        // Create audit log for confirmation shown
        supabase.from('audit_logs').insert({
          action: 'BUYER_CONFIRMATION_SHOWN',
          table_name: 'meetings',
          record_id: data.meeting.id,
          new_data: { shown_at: new Date().toISOString() }
        });
        
        // Show global portal modal IMMEDIATELY with real values
        showMeetingInfo(data.meeting.id, data.meeting.meeting_code);
        
        // Close booking dialog
        onOpenChange(false);
        
        toast.success('Meeting requested!', {
          description: 'Save your Meeting ID and Code to join later.'
        });
      } else {
        console.error('BOOKING FAILED: No meeting ID or code returned', data);
        toast.error('Booking error', {
          description: 'Meeting was not created properly. Please try again.'
        });
        onOpenChange(false);
      }
      
      queryClient.invalidateQueries({ queryKey: ['my-meeting-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-meetings'] });
    },
    onError: (error: any) => {
      console.error('Meeting booking error:', error);
      toast.error('Failed to create meeting', {
        description: error.message
      });
    }
  });

  const handleNext = () => {
    if (step === 'details' && !validateDetails()) {
      return;
    }
    
    const steps: BookingStep[] = ['type', 'date', 'time', 'details', 'confirm'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: BookingStep[] = ['type', 'date', 'time', 'details', 'confirm'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'type': return !!selectedType;
      case 'date': return !!selectedDate;
      case 'time': return !!selectedTime;
      case 'details': return true; // Validation on next
      case 'confirm': return true;
      default: return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'type':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select the type of meeting you'd like to book:</p>
            <RadioGroup value={selectedType} onValueChange={setSelectedType}>
              {seller.meeting_types.map((type) => (
                <div 
                  key={type.id}
                  className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedType === type.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedType(type.id)}
                >
                  <RadioGroupItem value={type.id} id={type.id} />
                  <div className="flex-1">
                    <Label htmlFor={type.id} className="font-medium cursor-pointer">
                      {type.name}
                    </Label>
                    {type.description && (
                      <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {type.duration_minutes} min
                      </Badge>
                      {type.is_paid ? (
                        <Badge variant="default" className="text-xs">
                          <DollarSign className="h-3 w-3 mr-1" />
                          ${type.price}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Free</Badge>
                      )}
                      {type.is_group && (
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          Group (max {type.max_participants})
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'date':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select a date for your meeting:</p>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => isBefore(date, startOfToday()) || isBefore(addDays(new Date(), 60), date)}
                className="rounded-md border"
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Seller's timezone: {seller.timezone}
            </p>
          </div>
        );

      case 'time':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a time slot for {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}:
            </p>
            {slotsLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {[...Array(9)].map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : availableSlots?.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No available slots for this date.</p>
                <Button variant="outline" onClick={handleBack} className="mt-4">
                  Choose another date
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                {availableSlots?.map((slot: any) => (
                  <Button
                    key={slot.slot_time}
                    variant={selectedTime === slot.slot_time ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTime(slot.slot_time)}
                    className="justify-center"
                  >
                    {slot.slot_time.slice(0, 5)}
                  </Button>
                ))}
              </div>
            )}
            <p className="text-xs text-center text-muted-foreground">
              Times shown in seller's timezone ({seller.timezone})
            </p>
          </div>
        );

      case 'details':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Please provide your details:</p>
            
            {/* Meeting Platform */}
            <div className="space-y-2">
              <Label>Meeting Platform *</Label>
              <div className="grid grid-cols-3 gap-2">
                {MEETING_PLATFORMS.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <Button
                      key={platform.value}
                      type="button"
                      variant={selectedPlatform === platform.value ? "default" : "outline"}
                      className="justify-start text-xs px-2"
                      onClick={() => {
                        setSelectedPlatform(platform.value);
                        setErrors(prev => ({ ...prev, platform: undefined }));
                      }}
                    >
                      <Icon className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span className="truncate">{platform.shortLabel}</span>
                    </Button>
                  );
                })}
              </div>
              {selectedPlatform === 'dk_ai_meeting' && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  This meeting will take place on DK AI System. A join link will be provided after booking.
                </p>
              )}
              {errors.platform && (
                <p className="text-sm text-destructive">{errors.platform}</p>
              )}
            </div>
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors(prev => ({ ...prev, name: undefined }));
                }}
                placeholder="Your full name"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            {/* Email */}
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
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            {/* Phone (required for phone calls) */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number {phoneRequired ? '*' : '(optional)'}</Label>
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
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>

            {/* Topic */}
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
              {errors.topic && <p className="text-sm text-destructive">{errors.topic}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description / What You Need *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setErrors(prev => ({ ...prev, description: undefined }));
                }}
                placeholder="Please describe in detail what you need help with..."
                rows={3}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Booking Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meeting Type:</span>
                  <span className="font-medium">{selectedMeetingType?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span>{selectedMeetingType?.duration_minutes} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time:</span>
                  <span>{selectedTime?.slice(0, 5)} ({seller.timezone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform:</span>
                  <span className="capitalize">{selectedPlatform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-medium">
                    {selectedMeetingType?.is_paid ? `$${selectedMeetingType.price}` : 'Free'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="border rounded-lg p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Your details:</p>
              <p className="text-sm"><strong>Name:</strong> {name}</p>
              <p className="text-sm"><strong>Email:</strong> {email}</p>
              {phone && <p className="text-sm"><strong>Phone:</strong> {phone}</p>}
              <p className="text-sm"><strong>Topic:</strong> {topic}</p>
            </div>

            {selectedMeetingType?.is_paid && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-sm text-primary dark:text-primary">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  You will be redirected to complete payment after submitting.
                </p>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Book a Meeting with {seller.profile.full_name || seller.profile.username}</DialogTitle>
            <DialogDescription>
              Step {['type', 'date', 'time', 'details', 'confirm'].indexOf(step) + 1} of 5
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {renderStep()}
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={step === 'type' ? () => onOpenChange(false) : handleBack}
            >
              {step === 'type' ? 'Cancel' : 'Back'}
            </Button>
            
            {step === 'confirm' ? (
              <Button 
                onClick={() => createRequestMutation.mutate()}
                disabled={createRequestMutation.isPending}
              >
                {createRequestMutation.isPending ? 'Submitting...' : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {selectedMeetingType?.is_paid ? 'Continue to Payment' : 'Request Meeting'}
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
