import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  format, 
  addDays, 
  startOfWeek, 
  isSameDay, 
  addWeeks, 
  subWeeks, 
  isBefore, 
  startOfToday,
  getYear,
  getMonth,
  setMonth,
  setYear,
  startOfMonth
} from 'date-fns';
import {
  Globe,
  Clock,
  DollarSign,
  Phone,
  Video,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Trophy,
  CheckCircle,
  Mail,
  User,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublicSellerData {
  seller_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  timezone: string;
  meeting_pitch: string;
  meeting_types: Array<{
    id: string;
    name: string;
    description: string;
    duration_minutes: number;
    is_paid: boolean;
    price: number;
    is_group: boolean;
    max_participants: number;
  }>;
  achievements: Array<{
    title: string;
    type: string;
    icon_url: string;
    earned_at: string;
  }>;
  availability: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
}

interface FormErrors {
  name?: string;
  email?: string;
  topic?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 32;

const MEETING_PLATFORMS = [
  { value: 'dk_ai_meeting', label: 'DK AI Meeting', icon: Video },
  { value: 'zoom', label: 'Zoom', icon: Video },
  { value: 'teams', label: 'MS Teams', icon: Video },
  { value: 'phone', label: 'Phone', icon: Phone },
] as const;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = Array.from({ length: 5 }, (_, i) => getYear(new Date()) + i);

export default function PublicBookingPage() {
  const { username } = useParams<{ username: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sellerData, setSellerData] = useState<PublicSellerData | null>(null);
  
  // Calendar state
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time: string } | null>(null);
  
  // Booking form state
  const [step, setStep] = useState<'select' | 'form' | 'success'>('select');
  const [selectedMeetingType, setSelectedMeetingType] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('dk_ai_meeting');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buyerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (username) {
      fetchSellerData();
    }
  }, [username]);

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-public-seller-booking', {
        body: { username }
      });

      if (error || !data || data.error) {
        setNotFound(true);
        return;
      }

      setSellerData(data);
    } catch (err) {
      console.error('Error fetching seller data:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const isSlotAvailable = (day: Date, hour: number): boolean => {
    if (!sellerData) return false;
    
    const dayOfWeek = day.getDay();
    const now = new Date();

    // Cannot book in the past
    if (isBefore(day, startOfToday())) return false;
    if (isSameDay(day, now) && hour <= now.getHours()) return false;

    // Check seller availability
    const dayAvailability = sellerData.availability.find(a => a.day_of_week === dayOfWeek);
    if (!dayAvailability) return false;

    const slotStart = hour;
    const availStart = parseInt(dayAvailability.start_time.split(':')[0]);
    const availEnd = parseInt(dayAvailability.end_time.split(':')[0]);
    
    return slotStart >= availStart && slotStart < availEnd;
  };

  const handleSlotClick = (day: Date, hour: number) => {
    if (!isSlotAvailable(day, hour)) return;
    
    setSelectedSlot({
      date: day,
      time: `${hour.toString().padStart(2, '0')}:00`
    });
  };

  const handleMonthYearChange = (month: number, year: number) => {
    const newDate = setYear(setMonth(currentWeekStart, month), year);
    setCurrentWeekStart(startOfWeek(startOfMonth(newDate), { weekStartsOn: 0 }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!topic.trim()) {
      newErrors.topic = 'Topic is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !selectedSlot || !sellerData || !selectedMeetingType) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-public-booking', {
        body: {
          seller_id: sellerData.seller_id,
          meeting_type_id: selectedMeetingType,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          requested_date: format(selectedSlot.date, 'yyyy-MM-dd'),
          requested_time: selectedSlot.time,
          topic: topic.trim(),
          description: description.trim() || undefined,
          timezone: buyerTimezone,
          meeting_method: selectedPlatform
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStep('success');
      toast.success('Verification email sent!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentMonth = getMonth(currentWeekStart);
  const currentYear = getYear(currentWeekStart);
  const selectedType = sellerData?.meeting_types.find(mt => mt.id === selectedMeetingType);

  // SEO structured data
  const structuredData = sellerData ? {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": sellerData.full_name || sellerData.username,
    "url": window.location.href,
    "image": sellerData.avatar_url,
    "description": sellerData.meeting_pitch,
    "makesOffer": sellerData.meeting_types.map(mt => ({
      "@type": "Offer",
      "name": mt.name,
      "description": mt.description,
      "price": mt.is_paid ? mt.price : 0,
      "priceCurrency": "USD"
    }))
  } : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Set page title dynamically
  useEffect(() => {
    if (notFound || !sellerData) {
      document.title = 'Booking Not Available - DK AI Marketplace';
    } else if (step === 'success') {
      document.title = 'Verify Your Booking - DK AI Marketplace';
    } else if (sellerData) {
      document.title = `Book a Meeting with ${sellerData.full_name || sellerData.username} | DK AI Marketplace`;
    }
  }, [notFound, sellerData, step]);

  // Add structured data to page
  useEffect(() => {
    if (!structuredData) return;
    
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
    
    return () => {
      document.head.removeChild(script);
    };
  }, [structuredData]);

  if (notFound || !sellerData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Booking Not Available</h1>
            <p className="text-muted-foreground mb-6">
              This seller hasn't enabled public booking or the profile doesn't exist.
            </p>
            <Button asChild>
              <Link to="/">Go to Marketplace</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Check Your Email</h1>
            <p className="text-muted-foreground mb-6">
              We've sent a verification link to <strong>{email}</strong>. 
              Click the link to complete your booking with {sellerData.full_name || sellerData.username}.
            </p>
            <p className="text-sm text-muted-foreground">
              The link expires in 30 minutes. Check your spam folder if you don't see it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to DK AI Marketplace
          </Link>
        </div>
      </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Seller Profile Card */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-6">
                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                  <AvatarImage src={sellerData.avatar_url} />
                  <AvatarFallback className="text-2xl">
                    {(sellerData.full_name || sellerData.username || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold">{sellerData.full_name || sellerData.username}</h1>
                    {sellerData.achievements.length > 0 && (
                      <div className="flex gap-1">
                        {sellerData.achievements.slice(0, 3).map((ach, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            <Trophy className="h-3 w-3 mr-1" />
                            {ach.title}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-muted-foreground flex items-center gap-1 mb-3">
                    <Globe className="h-4 w-4" />
                    {sellerData.timezone}
                  </p>
                  <p className="text-foreground">{sellerData.meeting_pitch}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Calendar Section */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Select Date & Time</CardTitle>
                  <CardDescription>Choose an available slot that works for you</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                      >
                        Today
                      </Button>
                      <div className="flex border rounded-md">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select 
                        value={currentMonth.toString()} 
                        onValueChange={(v) => handleMonthYearChange(parseInt(v), currentYear)}
                      >
                        <SelectTrigger className="w-[110px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((month, i) => (
                            <SelectItem key={i} value={i.toString()}>{month}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select 
                        value={currentYear.toString()} 
                        onValueChange={(v) => handleMonthYearChange(currentMonth, parseInt(v))}
                      >
                        <SelectTrigger className="w-[80px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {YEARS.map((year) => (
                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="border rounded-lg overflow-hidden">
                    {/* Day Headers */}
                    <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b bg-muted/50">
                      <div className="p-2 text-xs text-muted-foreground text-center border-r">Time</div>
                      {weekDays.map((day, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "p-2 text-center border-r last:border-r-0",
                            isSameDay(day, new Date()) && "bg-primary/10",
                            selectedSlot && isSameDay(day, selectedSlot.date) && "bg-primary/5"
                          )}
                        >
                          <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                          <div className={cn(
                            "text-sm font-semibold",
                            isSameDay(day, new Date()) && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center mx-auto"
                          )}>
                            {format(day, 'd')}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Time Grid */}
                    <div className="max-h-[400px] overflow-y-auto">
                      {HOURS.filter(h => h >= 8 && h <= 20).map((hour) => (
                        <div key={hour} className="grid grid-cols-[50px_repeat(7,1fr)] border-b last:border-b-0" style={{ height: `${HOUR_HEIGHT}px` }}>
                          <div className="text-xs text-muted-foreground text-right pr-2 border-r flex items-center justify-end">
                            {hour.toString().padStart(2, '0')}:00
                          </div>
                          {weekDays.map((day, i) => {
                            const available = isSlotAvailable(day, hour);
                            const isSelected = selectedSlot && isSameDay(day, selectedSlot.date) && parseInt(selectedSlot.time.split(':')[0]) === hour;
                            
                            return (
                              <div 
                                key={i} 
                                className={cn(
                                  "border-r last:border-r-0 transition-all cursor-pointer",
                                  available && !isSelected && "bg-primary/5 hover:bg-primary/15",
                                  !available && "bg-muted/30",
                                  isSelected && "bg-primary/20 ring-1 ring-primary/40"
                                )}
                                onClick={() => handleSlotClick(day, hour)}
                              >
                                {isSelected && (
                                  <div className="flex items-center justify-center h-full">
                                    <CheckCircle className="h-4 w-4 text-primary" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-primary/10 border border-primary/20" />
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-muted/30" />
                      <span>Unavailable</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Booking Form */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Book Meeting</CardTitle>
                  {selectedSlot && (
                    <div className="flex items-center gap-2 text-sm bg-primary/5 p-2 rounded-lg mt-2">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      <span>{format(selectedSlot.date, 'EEE, MMM d')}</span>
                      <Clock className="h-4 w-4 text-primary ml-2" />
                      <span>{selectedSlot.time}</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Meeting Type */}
                  <div className="space-y-2">
                    <Label>Meeting Type</Label>
                    <RadioGroup value={selectedMeetingType} onValueChange={setSelectedMeetingType}>
                      {sellerData.meeting_types.map((type) => (
                        <div 
                          key={type.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            selectedMeetingType === type.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          )}
                          onClick={() => setSelectedMeetingType(type.id)}
                        >
                          <RadioGroupItem value={type.id} id={type.id} />
                          <div className="flex-1 min-w-0">
                            <Label htmlFor={type.id} className="font-medium cursor-pointer">
                              {type.name}
                            </Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {type.duration_minutes}m
                              </Badge>
                              {type.is_paid ? (
                                <Badge className="text-xs">
                                  <DollarSign className="h-3 w-3" />
                                  {type.price}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Free</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Platform */}
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {MEETING_PLATFORMS.map((p) => {
                        const Icon = p.icon;
                        return (
                          <Button
                            key={p.value}
                            type="button"
                            variant={selectedPlatform === p.value ? "default" : "outline"}
                            size="sm"
                            className="justify-start"
                            onClick={() => setSelectedPlatform(p.value)}
                          >
                            <Icon className="h-3 w-3 mr-1" />
                            {p.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1">
                      <Label htmlFor="name">
                        <User className="h-3 w-3 inline mr-1" />
                        Name *
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
                        placeholder="Your name"
                        className={errors.name ? 'border-destructive' : ''}
                      />
                      {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="email">
                        <Mail className="h-3 w-3 inline mr-1" />
                        Email *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                        placeholder="your@email.com"
                        className={errors.email ? 'border-destructive' : ''}
                      />
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="phone">
                        <Phone className="h-3 w-3 inline mr-1" />
                        Phone (optional)
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 234 567 8900"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="topic">
                        <MessageSquare className="h-3 w-3 inline mr-1" />
                        Topic *
                      </Label>
                      <Input
                        id="topic"
                        value={topic}
                        onChange={(e) => { setTopic(e.target.value); setErrors(p => ({ ...p, topic: undefined })); }}
                        placeholder="What would you like to discuss?"
                        className={errors.topic ? 'border-destructive' : ''}
                      />
                      {errors.topic && <p className="text-xs text-destructive">{errors.topic}</p>}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="description">Details (optional)</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Additional details..."
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Price Summary */}
                  {selectedType?.is_paid && (
                    <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                      <span className="text-sm">Total</span>
                      <span className="font-bold">${selectedType.price}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <Button 
                    className="w-full" 
                    onClick={handleSubmit}
                    disabled={!selectedSlot || !selectedMeetingType || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Request Booking'
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    You'll receive a verification email to confirm your booking.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
    </div>
  );
}
