import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { externalSupabase } from '@/lib/externalSupabase';
import { useAuth } from '@/contexts/AuthContext';
import { useMeetingInfoModal } from '@/contexts/MeetingInfoModalContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, parseISO, isSameDay, addWeeks, subWeeks, isBefore, startOfToday, addMonths, subMonths, setMonth, setYear, getYear, getMonth, parse, isValid, startOfMonth, endOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Globe, Lock, Users, Clock, DollarSign, Phone, Video, Calendar as CalendarIcon, X, Check, AlertCircle, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Generate secure meeting code (8 alphanumeric chars)
const generateMeetingCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const length = 8;
  let code = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
};
interface SellerProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
}
interface MeetingType {
  id: string;
  name: string;
  description?: string;
  is_paid: boolean;
  price: number;
  duration_minutes: number;
  is_group: boolean;
  max_participants?: number;
}
interface SellerConfig {
  seller_id: string;
  timezone: string;
  calendar_visibility: string;
  booking_mode: 'calendar' | 'open_request';
}
interface BuyerCalendarViewProps {
  sellerId: string;
  sellerProfile: SellerProfile;
  sellerConfig: SellerConfig;
  meetingTypes: MeetingType[];
  onClose: () => void;
}
interface TimeSlot {
  slot_time: string;
  is_available: boolean;
}
interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  topic?: string;
  description?: string;
  platform?: string;
  date?: string;
  time?: string;
}
type CalendarViewMode = 'week' | 'month';
type VisibilityOption = 'everyone' | 'followers' | 'only_me';
const HOURS = Array.from({
  length: 24
}, (_, i) => i);
const HOUR_HEIGHT = 32;
const MINUTES = ['00', '15', '30', '45'];
const MEETING_PLATFORMS = [{
  value: 'dk_ai_meeting',
  label: 'DK AI Meeting (Hosted on DK AI System)',
  icon: Video,
  isHosted: true
}, {
  value: 'zoom',
  label: 'Zoom',
  icon: Video,
  isHosted: false
}, {
  value: 'teams',
  label: 'Microsoft Teams',
  icon: Video,
  isHosted: false
}, {
  value: 'phone',
  label: 'Phone Call',
  icon: Phone,
  isHosted: false
}] as const;
const VISIBILITY_OPTIONS = [{
  value: 'everyone',
  label: 'Everyone',
  icon: Globe
}, {
  value: 'followers',
  label: 'Followers Only',
  icon: Users
}, {
  value: 'only_me',
  label: 'Only Me',
  icon: Lock
}] as const;
const YEARS = Array.from({
  length: 10
}, (_, i) => getYear(new Date()) + i);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function BuyerCalendarView({
  sellerId,
  sellerProfile,
  sellerConfig,
  meetingTypes,
  onClose
}: BuyerCalendarViewProps) {
  const {
    user
  } = useAuth();
  const { showMeetingInfo } = useMeetingInfoModal();
  const timeGridRef = useRef<HTMLDivElement>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), {
    weekStartsOn: 0
  }));
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date;
    time: string;
  } | null>(null);
  const [selectedMeetingType, setSelectedMeetingType] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [visibility, setVisibility] = useState<VisibilityOption>('everyone');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editable date/time inputs
  const [dateInputValue, setDateInputValue] = useState('');
  const [startTimeInput, setStartTimeInput] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const buyerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const phoneRequired = selectedPlatform === 'phone';
  const selectedType = meetingTypes.find(mt => mt.id === selectedMeetingType);

  // Reset form when modal closes
  useEffect(() => {
    if (!bookingModalOpen) {
      setSelectedMeetingType('');
      setSelectedPlatform('');
      setName('');
      setEmail(user?.email || '');
      setPhone('');
      setTopic('');
      setDescription('');
      setErrors({});
      setVisibility(sellerConfig.calendar_visibility as VisibilityOption || 'everyone');
    }
  }, [bookingModalOpen, user?.email, sellerConfig.calendar_visibility]);

  // Update date/time inputs when slot is selected
  useEffect(() => {
    if (selectedSlot) {
      setDateInputValue(format(selectedSlot.date, 'dd.MM.yyyy'));
      setStartTimeInput(selectedSlot.time);
      const duration = selectedType?.duration_minutes || 30;
      const [hours, minutes] = selectedSlot.time.split(':').map(Number);
      const endMinutes = hours * 60 + minutes + duration;
      const endHours = Math.floor(endMinutes / 60) % 24;
      const endMins = endMinutes % 60;
      setEndTimeInput(`${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`);
    }
  }, [selectedSlot, selectedType]);

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (timeGridRef.current) {
      const currentHour = new Date().getHours();
      const scrollPosition = Math.max(0, (currentHour - 2) * HOUR_HEIGHT);
      timeGridRef.current.scrollTop = scrollPosition;
    }
  }, []);
  const weekDays = useMemo(() => {
    return Array.from({
      length: 7
    }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Fetch seller's availability
  const {
    data: availability
  } = useQuery({
    queryKey: ['seller-availability', sellerId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('seller_availability').select('*').eq('seller_id', sellerId).eq('is_available', true);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch blocked time slots
  const {
    data: blockedSlots
  } = useQuery({
    queryKey: ['blocked-slots', sellerId, currentWeekStart],
    queryFn: async () => {
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      const {
        data,
        error
      } = await supabase.from('blocked_time_slots').select('*').eq('seller_id', sellerId).gte('blocked_date', startDate).lte('blocked_date', endDate);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch existing meetings
  const {
    data: existingMeetings
  } = useQuery({
    queryKey: ['seller-meetings-public', sellerId, currentWeekStart],
    queryFn: async () => {
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      const {
        data,
        error
      } = await supabase.from('meetings').select('meeting_date, meeting_time, duration_minutes, status').eq('seller_id', sellerId).in('status', ['scheduled', 'in_progress']).gte('meeting_date', startDate).lte('meeting_date', endDate);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch external calendar events
  const {
    data: externalEvents
  } = useQuery({
    queryKey: ['external-calendar-events', sellerId, currentWeekStart],
    queryFn: async () => {
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      const {
        data,
        error
      } = await supabase.from('external_calendar_events').select('*').eq('seller_id', sellerId).gte('start_datetime', `${startDate}T00:00:00`).lte('start_datetime', `${endDate}T23:59:59`);
      if (error) throw error;
      return data || [];
    }
  });
  const isSlotAvailable = (day: Date, hour: number, minute: number = 0): boolean => {
    const dayOfWeek = day.getDay();
    const dateStr = format(day, 'yyyy-MM-dd');
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const now = new Date();

    // Cannot book in the past
    if (isBefore(day, startOfToday())) return false;
    if (isSameDay(day, now)) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const slotMinutes = hour * 60 + minute;
      if (slotMinutes <= currentMinutes) return false;
    }

    // Check seller availability for this day
    const dayAvailability = availability?.find(a => a.day_of_week === dayOfWeek);
    if (!dayAvailability) return false;
    const slotMinutes = hour * 60 + minute;
    const [availStartH, availStartM] = dayAvailability.start_time.split(':').map(Number);
    const [availEndH, availEndM] = dayAvailability.end_time.split(':').map(Number);
    const availStart = availStartH * 60 + availStartM;
    const availEnd = availEndH * 60 + availEndM;
    if (slotMinutes < availStart || slotMinutes >= availEnd) return false;

    // Check blocked slots
    const isBlocked = blockedSlots?.some(block => {
      if (block.blocked_date !== dateStr) return false;
      const [blockStartH, blockStartM] = block.start_time.split(':').map(Number);
      const [blockEndH, blockEndM] = block.end_time.split(':').map(Number);
      const blockStart = blockStartH * 60 + blockStartM;
      const blockEnd = blockEndH * 60 + blockEndM;
      return slotMinutes >= blockStart && slotMinutes < blockEnd;
    });
    if (isBlocked) return false;

    // Check existing meetings
    const hasExistingMeeting = existingMeetings?.some(meeting => {
      if (meeting.meeting_date !== dateStr) return false;
      const [meetingStartH, meetingStartM] = meeting.meeting_time.split(':').map(Number);
      const meetingStart = meetingStartH * 60 + meetingStartM;
      const meetingEnd = meetingStart + meeting.duration_minutes;
      return slotMinutes >= meetingStart && slotMinutes < meetingEnd;
    });
    if (hasExistingMeeting) return false;

    // Check external calendar events
    const hasExternalEvent = externalEvents?.some(event => {
      const eventStart = parseISO(event.start_datetime);
      const eventEnd = parseISO(event.end_datetime);
      const slotTime = new Date(day);
      slotTime.setHours(hour, minute, 0, 0);
      const slotEndTime = new Date(slotTime);
      slotEndTime.setMinutes(slotEndTime.getMinutes() + 30);
      return slotTime < eventEnd && slotEndTime > eventStart;
    });
    if (hasExternalEvent) return false;
    return true;
  };
  const handleSlotClick = (day: Date, hour: number) => {
    if (!isSlotAvailable(day, hour)) return;
    if (!user) {
      toast.error('Please sign in to book a meeting');
      return;
    }
    setSelectedSlot({
      date: day,
      time: `${hour.toString().padStart(2, '0')}:00`
    });
    setBookingModalOpen(true);
  };

  // Handle date input change
  const handleDateInputChange = (value: string) => {
    setDateInputValue(value);
    setErrors(prev => ({
      ...prev,
      date: undefined
    }));

    // Try to parse the date
    const parsed = parse(value, 'dd.MM.yyyy', new Date());
    if (isValid(parsed) && !isBefore(parsed, startOfToday())) {
      setSelectedSlot(prev => prev ? {
        ...prev,
        date: parsed
      } : {
        date: parsed,
        time: '09:00'
      });
      // Navigate calendar to that week
      setCurrentWeekStart(startOfWeek(parsed, {
        weekStartsOn: 0
      }));
    }
  };

  // Handle time input change with scroll support
  const handleTimeScroll = (direction: 'up' | 'down', isStart: boolean) => {
    const currentTime = isStart ? startTimeInput : endTimeInput;
    const [hours, minutes] = currentTime.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes;
    if (direction === 'up') {
      totalMinutes = Math.min(totalMinutes + 15, 23 * 60 + 45);
    } else {
      totalMinutes = Math.max(totalMinutes - 15, 0);
    }
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    const newTime = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    if (isStart) {
      setStartTimeInput(newTime);
      if (selectedSlot) {
        setSelectedSlot({
          ...selectedSlot,
          time: newTime
        });
      }
      // Update end time based on duration
      const duration = selectedType?.duration_minutes || 30;
      const endMinutes = totalMinutes + duration;
      const endHours = Math.floor(endMinutes / 60) % 24;
      const endMins = endMinutes % 60;
      setEndTimeInput(`${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`);
    } else {
      setEndTimeInput(newTime);
    }
  };

  // Handle wheel scroll on time inputs
  const handleTimeWheel = (e: React.WheelEvent, isStart: boolean) => {
    e.preventDefault();
    handleTimeScroll(e.deltaY > 0 ? 'down' : 'up', isStart);
  };

  // Navigate to specific month/year
  const handleMonthYearChange = (month: number, year: number) => {
    const newDate = setYear(setMonth(currentWeekStart, month), year);
    setCurrentWeekStart(startOfWeek(startOfMonth(newDate), {
      weekStartsOn: 0
    }));
  };
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!selectedMeetingType) {
      toast.error('Please select a meeting type');
      return false;
    }
    if (!selectedPlatform) {
      newErrors.platform = 'Please select a meeting platform';
    }
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

    // Validate date
    const parsed = parse(dateInputValue, 'dd.MM.yyyy', new Date());
    if (!isValid(parsed)) {
      newErrors.date = 'Please enter a valid date (DD.MM.YYYY)';
    } else if (isBefore(parsed, startOfToday())) {
      newErrors.date = 'Cannot book in the past';
    }

    // Validate time
    if (!startTimeInput || !/^\d{2}:\d{2}$/.test(startTimeInput)) {
      newErrors.time = 'Please enter a valid start time (HH:MM)';
    }

    // Validate slot availability
    if (selectedSlot && !isSlotAvailable(selectedSlot.date, parseInt(selectedSlot.time.split(':')[0]))) {
      newErrors.time = 'This time slot is not available';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleBookMeeting = async () => {
    if (!validateForm() || !selectedSlot || !user) return;
    setIsSubmitting(true);
    try {
      const isDkAiMeeting = selectedPlatform === 'dk_ai_meeting';
      const meetingCode = isDkAiMeeting ? generateMeetingCode() : null;
      
      // Calculate scheduled start and end times
      const duration = selectedType?.duration_minutes || 30;
      const scheduledStart = new Date(`${format(selectedSlot.date, 'yyyy-MM-dd')}T${selectedSlot.time}:00`);
      const scheduledEnd = new Date(scheduledStart.getTime() + duration * 60 * 1000);

      let dkMeetingData = null;

      // For DK AI Meeting, insert into external dk_meetings2 table
      if (isDkAiMeeting && meetingCode) {
        const { data: dkMeeting, error: dkMeetingError } = await externalSupabase
          .from('dk_meetings2')
          .insert({
            meeting_cod: meetingCode,
            buyer_name: name.trim(),
            seller_name: sellerProfile.full_name || sellerProfile.username,
            title: topic.trim(),
            description: description.trim(),
            start_time: scheduledStart.toISOString(),
            end_time: scheduledEnd.toISOString(),
            status: 'pending'
          })
          .select('meeting_id, meeting_cod')
          .single();

        if (dkMeetingError) throw dkMeetingError;
        dkMeetingData = dkMeeting ? { id: dkMeeting.meeting_id, meeting_code: dkMeeting.meeting_cod } : null;
      }

      // Also create meeting_request for tracking
      const { data, error } = await supabase.from('meeting_requests').insert({
        meeting_type_id: selectedMeetingType,
        seller_id: sellerId,
        buyer_id: user.id,
        requested_date: format(selectedSlot.date, 'yyyy-MM-dd'),
        requested_time: selectedSlot.time,
        buyer_timezone: buyerTimezone,
        meeting_method: selectedPlatform,
        contact_name: name.trim(),
        contact_email: email.trim(),
        contact_phone: phone.trim() || null,
        contact_topic: topic.trim(),
        contact_description: description.trim(),
        buyer_message: `Topic: ${topic.trim()}\n\n${description.trim()}`,
        status: 'pending'
      }).select().single();
      
      if (error) throw error;

      // If paid meeting, redirect to payment
      if (selectedType?.is_paid && selectedType.price > 0) {
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-meeting-payment', {
          body: {
            meeting_request_id: data.id,
            amount: selectedType.price,
            seller_id: sellerId
          }
        });
        if (paymentError) throw paymentError;
        if (paymentData?.url) {
          window.location.href = paymentData.url;
          return;
        }
      }

      // For DK AI Meeting, show the meeting code popup immediately
      if (dkMeetingData?.id && dkMeetingData?.meeting_code) {
        showMeetingInfo(dkMeetingData.id, dkMeetingData.meeting_code);
      }

      toast.success('Meeting request sent!', {
        description: dkMeetingData ? 'Save your Meeting Code!' : (selectedType?.is_paid ? 'Please complete payment to confirm your booking.' : 'The seller will review your request and confirm.')
      });
      setBookingModalOpen(false);
      onClose();
    } catch (error: any) {
      toast.error('Failed to create booking', {
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const currentMonth = getMonth(currentWeekStart);
  const currentYear = getYear(currentWeekStart);
  return <div className="flex flex-col h-full">
      {/* Sticky Header with Selected Date/Time */}
      {selectedSlot && <div className="sticky top-0 z-20 bg-primary/10 border-b border-primary/20 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span>{format(selectedSlot.date, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>{startTimeInput} – {endTimeInput}</span>
            </div>
          </div>
        </div>}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">
              Book a meeting with {sellerProfile.full_name || sellerProfile.username}
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {sellerConfig.timezone} • {buyerTimezone}
            </p>
          </div>
        </div>
        
        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), {
          weekStartsOn: 0
        }))}>
            Today
          </Button>
          
          <div className="flex items-center border rounded-md">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month Selector */}
          <Select value={currentMonth.toString()} onValueChange={v => handleMonthYearChange(parseInt(v), currentYear)}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, i) => <SelectItem key={i} value={i.toString()}>{month}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Year Selector */}
          <Select value={currentYear.toString()} onValueChange={v => handleMonthYearChange(currentMonth, parseInt(v))}>
            <SelectTrigger className="w-[80px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-md">
            <Button variant={viewMode === 'week' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-r-none" onClick={() => setViewMode('week')}>
              Week
            </Button>
            <Button variant={viewMode === 'month' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-l-none" onClick={() => setViewMode('month')}>
              Month
            </Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-background border border-primary/30 shadow-sm" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-muted/80 border border-border" />
          <span>Unavailable</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-destructive/10 border border-destructive/20" />
          <span>Blocked/Busy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-primary/20 border border-primary/40 shadow-md" />
          <span>Selected</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden">
        <div className="border rounded-lg overflow-hidden mx-4 my-2 h-full flex flex-col">
          {/* Day Headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/50 sticky top-0 z-10">
            <div className="p-2 text-xs text-muted-foreground text-center border-r">Time</div>
            {weekDays.map((day, i) => <div key={i} className={cn("p-2 text-center border-r last:border-r-0 transition-colors", isSameDay(day, new Date()) && "bg-primary/10", selectedSlot && isSameDay(day, selectedSlot.date) && "bg-primary/5")}>
                <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                <div className={cn("text-sm font-semibold", isSameDay(day, new Date()) && "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center mx-auto")}>
                  {format(day, 'd')}
                </div>
              </div>)}
          </div>

          {/* Time Grid with Scroll */}
          <div ref={timeGridRef} className="flex-1 overflow-y-auto">
            {HOURS.map(hour => <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0" style={{
            height: `${HOUR_HEIGHT}px`
          }}>
                <div className="text-xs text-muted-foreground text-right pr-2 border-r flex items-center justify-end">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {weekDays.map((day, i) => {
              const available = isSlotAvailable(day, hour);
              const isPastSlot = isBefore(day, startOfToday()) || isSameDay(day, new Date()) && hour <= new Date().getHours();
              const isSelected = selectedSlot && isSameDay(day, selectedSlot.date) && parseInt(selectedSlot.time.split(':')[0]) === hour;
              return <div key={i} className={cn("border-r last:border-r-0 relative transition-all duration-150",
              // Base styles - transparent/white background
              "bg-background/50",
              // Day highlight
              isSameDay(day, new Date()) && "bg-primary/5",
              // Availability states
              available && !isSelected && "hover:bg-primary/10 cursor-pointer border-primary/20", !available && !isPastSlot && "bg-destructive/5 border-destructive/10", isPastSlot && "bg-muted/30",
              // Selected state
              isSelected && "bg-primary/20 border-primary/40 shadow-inner ring-1 ring-primary/30")} onClick={() => available && handleSlotClick(day, hour)} title={available ? 'Click to book this slot' : 'Not available'}>
                      {available && !isSelected && <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <CalendarIcon className="h-3 w-3 text-primary" />
                        </div>}
                      {isSelected && <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary" />
                        </div>}
                    </div>;
            })}
              </div>)}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Meeting</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                {/* Sticky Selected Time Display */}
                <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{selectedSlot ? format(selectedSlot.date, 'EEE, MMM d, yyyy') : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium">{startTimeInput} – {endTimeInput}</span>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Editable Date/Time Inputs */}
            <div className="grid grid-cols-2 gap-4">
              {/* Date Input */}
              <div className="space-y-2">
                <Label>Date</Label>
                <div className="flex gap-2">
                  <Input value={dateInputValue} onChange={e => handleDateInputChange(e.target.value)} placeholder="DD.MM.YYYY" className={cn("flex-1", errors.date && "border-destructive")} />
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon">
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar mode="single" selected={selectedSlot?.date} onSelect={date => {
                      if (date) {
                        setSelectedSlot(prev => prev ? {
                          ...prev,
                          date
                        } : {
                          date,
                          time: '09:00'
                        });
                        setDateInputValue(format(date, 'dd.MM.yyyy'));
                        setCurrentWeekStart(startOfWeek(date, {
                          weekStartsOn: 0
                        }));
                      }
                      setDatePickerOpen(false);
                    }} disabled={date => isBefore(date, startOfToday())} initialFocus className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
              </div>

              {/* Time Input with Scroll */}
              <div className="space-y-2">
                <Label>Start Time</Label>
                <div className="flex items-center gap-1">
                  <div className="relative flex-1">
                    <Input value={startTimeInput} onChange={e => {
                    setStartTimeInput(e.target.value);
                    if (/^\d{2}:\d{2}$/.test(e.target.value) && selectedSlot) {
                      setSelectedSlot({
                        ...selectedSlot,
                        time: e.target.value
                      });
                    }
                  }} onWheel={e => handleTimeWheel(e, true)} placeholder="HH:MM" className={cn("pr-8", errors.time && "border-destructive")} />
                  </div>
                  <div className="flex flex-col">
                    <Button variant="outline" size="icon" className="h-5 w-8 rounded-b-none" onClick={() => handleTimeScroll('up', true)}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-5 w-8 rounded-t-none border-t-0" onClick={() => handleTimeScroll('down', true)}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {errors.time && <p className="text-sm text-destructive">{errors.time}</p>}
              </div>
            </div>

            {/* Meeting Type Selection */}
            <div className="space-y-2">
              <Label>Meeting Type *</Label>
              <RadioGroup value={selectedMeetingType} onValueChange={setSelectedMeetingType}>
                {meetingTypes.map(type => <div key={type.id} className={cn("flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors", selectedMeetingType === type.id ? "border-primary bg-primary/5" : "hover:bg-muted/50")} onClick={() => setSelectedMeetingType(type.id)}>
                    <RadioGroupItem value={type.id} id={type.id} />
                    <div className="flex-1">
                      <Label htmlFor={type.id} className="font-medium cursor-pointer">
                        {type.name}
                      </Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {type.duration_minutes} min
                        </Badge>
                        {type.is_paid ? <Badge variant="default" className="text-xs">
                            <DollarSign className="h-3 w-3 mr-1" />
                            ${type.price}
                          </Badge> : <Badge variant="secondary" className="text-xs">Free</Badge>}
                      </div>
                    </div>
                  </div>)}
              </RadioGroup>
            </div>

            {/* Meeting Platform */}
            <div className="space-y-2">
              <Label>Meeting Platform *</Label>
              <div className="grid grid-cols-2 gap-2">
                {MEETING_PLATFORMS.map(platform => {
                const Icon = platform.icon;
                const shortLabel = platform.value === 'dk_ai_meeting' ? 'DK AI Meeting' : platform.label;
                return <Button key={platform.value} type="button" variant={selectedPlatform === platform.value ? "default" : "outline"} className="justify-start h-auto py-2" onClick={() => {
                  setSelectedPlatform(platform.value);
                  setErrors(prev => ({
                    ...prev,
                    platform: undefined
                  }));
                }}>
                      <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{shortLabel}</span>
                    </Button>;
              })}
              </div>
              {selectedPlatform === 'dk_ai_meeting' && <p className="text-sm text-muted-foreground mt-2 p-2 bg-primary/5 rounded-md">This meeting will take place on DK AI Marketplace. Meeting Code and Meeting ID will be given directly after requesting the Meeting.</p>}
              {errors.platform && <p className="text-sm text-destructive">{errors.platform}</p>}
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={v => setVisibility(v as VisibilityOption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>;
                })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls who can see this meeting on your calendar
              </p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" value={name} onChange={e => {
              setName(e.target.value);
              setErrors(prev => ({
                ...prev,
                name: undefined
              }));
            }} placeholder="Your full name" className={errors.name ? 'border-destructive' : ''} />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input id="email" type="email" value={email} onChange={e => {
              setEmail(e.target.value);
              setErrors(prev => ({
                ...prev,
                email: undefined
              }));
            }} placeholder="your@email.com" className={errors.email ? 'border-destructive' : ''} />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number {phoneRequired ? '*' : '(optional)'}</Label>
              <Input id="phone" type="tel" value={phone} onChange={e => {
              setPhone(e.target.value);
              setErrors(prev => ({
                ...prev,
                phone: undefined
              }));
            }} placeholder="+1 (555) 000-0000" className={errors.phone ? 'border-destructive' : ''} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="topic">Topic *</Label>
              <Input id="topic" value={topic} onChange={e => {
              setTopic(e.target.value);
              setErrors(prev => ({
                ...prev,
                topic: undefined
              }));
            }} placeholder="What would you like to discuss?" className={errors.topic ? 'border-destructive' : ''} />
              {errors.topic && <p className="text-sm text-destructive">{errors.topic}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description / What You Need *</Label>
              <Textarea id="description" value={description} onChange={e => {
              setDescription(e.target.value);
              setErrors(prev => ({
                ...prev,
                description: undefined
              }));
            }} placeholder="Please describe in detail what you need help with..." rows={3} className={errors.description ? 'border-destructive' : ''} />
              {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
            </div>

            {/* Price Summary */}
            {selectedType?.is_paid && <div className="p-3 rounded-lg bg-muted flex items-center justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-bold">${selectedType.price}</span>
              </div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBookMeeting} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : selectedType?.is_paid ? 'Proceed to Payment' : 'Request Meeting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}