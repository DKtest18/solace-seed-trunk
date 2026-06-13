import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Clock, DollarSign, Globe, Plus, Save, Trash2, Users, Video, CalendarDays, MessageSquareText, AlertTriangle, CreditCard } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePlatformFee } from '@/hooks/usePlatformFee';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TIMEZONES = [
  'Europe/Zurich',
  'Europe/Berlin',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

interface MeetingConfig {
  id?: string;
  seller_id: string;
  meetings_enabled: boolean;
  booking_mode: 'calendar' | 'open_request';
  timezone: string;
  max_meetings_per_day: number;
  break_minutes: number;
  preferred_platform: string;
  zoom_link?: string;
  teams_link?: string;
  meeting_pitch?: string;
}

interface TimeSlot {
  start_time: string;
  end_time: string;
}

interface Availability {
  id?: string;
  seller_id: string;
  day_of_week: number;
  is_available: boolean;
  start_time: string;
  end_time: string;
  extra_slots?: TimeSlot[];
}

interface MeetingType {
  id?: string;
  seller_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  is_paid: boolean;
  price: number;
  currency: string;
  is_group: boolean;
  max_participants: number;
  is_active: boolean;
}

export function SellerMeetingsSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<MeetingConfig | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [newTypeDialogOpen, setNewTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<MeetingType | null>(null);

  // Fetch meeting config
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['seller-meeting-config', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('seller_meeting_configs')
        .select('*')
        .eq('seller_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user
  });

  // Fetch availability
  const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
    queryKey: ['seller-availability', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('seller_availability')
        .select('*')
        .eq('seller_id', user.id)
        .order('day_of_week');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  // Fetch meeting types
  const { data: typesData, isLoading: typesLoading } = useQuery({
    queryKey: ['seller-meeting-types', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('meeting_types')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  // Auto-detect browser timezone
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Initialize state from fetched data
  useEffect(() => {
    if (configData) {
      setConfig({
        ...configData,
        booking_mode: (configData.booking_mode as 'calendar' | 'open_request') || 'calendar'
      });
    } else if (user) {
      setConfig({
        seller_id: user.id,
        meetings_enabled: false,
        booking_mode: 'calendar',
        timezone: detectedTimezone || 'Europe/Zurich',
        max_meetings_per_day: 8,
        break_minutes: 15,
        preferred_platform: 'google_meet',
      });
    }
  }, [configData, user]);

  useEffect(() => {
    if (availabilityData && availabilityData.length > 0) {
      setAvailability(availabilityData.map((a: any) => ({
        ...a,
        extra_slots: a.extra_slots ? (typeof a.extra_slots === 'string' ? JSON.parse(a.extra_slots) : a.extra_slots) : [],
      })));
    } else if (user) {
      setAvailability(DAYS_OF_WEEK.map(day => ({
        seller_id: user.id,
        day_of_week: day.value,
        is_available: day.value >= 1 && day.value <= 5,
        start_time: '09:00',
        end_time: '17:00',
        extra_slots: [],
      })));
    }
  }, [availabilityData, user]);

  useEffect(() => {
    if (typesData) {
      setMeetingTypes(typesData);
    }
  }, [typesData]);

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (!user || !config) throw new Error('Not authenticated');

      // Upsert config
      const { error: configError } = await supabase
        .from('seller_meeting_configs')
        .upsert({
          ...config,
          seller_id: user.id,
        }, { onConflict: 'seller_id' });

      if (configError) throw configError;

      // Upsert availability
      for (const avail of availability) {
        const { error: availError } = await supabase
          .from('seller_availability')
          .upsert({
            ...avail,
            seller_id: user.id,
          }, { onConflict: 'seller_id,day_of_week' });

        if (availError) throw availError;
      }
    },
    onSuccess: () => {
      toast.success('Meeting settings saved!');
      queryClient.invalidateQueries({ queryKey: ['seller-meeting-config'] });
      queryClient.invalidateQueries({ queryKey: ['seller-availability'] });
    },
    onError: (error: any) => {
      toast.error('Failed to save settings', { description: error.message });
    }
  });

  // Save meeting type mutation
  const saveMeetingTypeMutation = useMutation({
    mutationFn: async (type: MeetingType) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('meeting_types')
        .upsert({
          ...type,
          seller_id: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Meeting type saved!');
      setNewTypeDialogOpen(false);
      setEditingType(null);
      queryClient.invalidateQueries({ queryKey: ['seller-meeting-types'] });
    },
    onError: (error: any) => {
      toast.error('Failed to save meeting type', { description: error.message });
    }
  });

  // Delete meeting type mutation
  const deleteMeetingTypeMutation = useMutation({
    mutationFn: async (typeId: string) => {
      const { error } = await supabase
        .from('meeting_types')
        .delete()
        .eq('id', typeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Meeting type deleted');
      queryClient.invalidateQueries({ queryKey: ['seller-meeting-types'] });
    },
    onError: (error: any) => {
      toast.error('Failed to delete meeting type', { description: error.message });
    }
  });

  const updateAvailability = (dayOfWeek: number, field: keyof Availability, value: any) => {
    setAvailability(prev => prev.map(a => 
      a.day_of_week === dayOfWeek ? { ...a, [field]: value } : a
    ));
  };

  const addTimeSlot = (dayOfWeek: number) => {
    setAvailability(prev => prev.map(a => {
      if (a.day_of_week !== dayOfWeek) return a;
      const slots = a.extra_slots || [];
      return { ...a, extra_slots: [...slots, { start_time: '13:00', end_time: '17:00' }] };
    }));
  };

  const removeTimeSlot = (dayOfWeek: number, index: number) => {
    setAvailability(prev => prev.map(a => {
      if (a.day_of_week !== dayOfWeek) return a;
      const slots = [...(a.extra_slots || [])];
      slots.splice(index, 1);
      return { ...a, extra_slots: slots };
    }));
  };

  const updateTimeSlot = (dayOfWeek: number, index: number, field: 'start_time' | 'end_time', value: string) => {
    setAvailability(prev => prev.map(a => {
      if (a.day_of_week !== dayOfWeek) return a;
      const slots = [...(a.extra_slots || [])];
      slots[index] = { ...slots[index], [field]: value };
      return { ...a, extra_slots: slots };
    }));
  };

  const isLoading = configLoading || availabilityLoading || typesLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable Meetings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Meetings & Availability
              </CardTitle>
              <CardDescription>
                Allow buyers to book meetings with you for consultations and project discussions.
              </CardDescription>
            </div>
            <Switch
              checked={config?.meetings_enabled || false}
              onCheckedChange={(checked) => setConfig(prev => prev ? { ...prev, meetings_enabled: checked } : null)}
            />
          </div>
        </CardHeader>
        
        {config?.meetings_enabled && (
          <CardContent className="space-y-6">
            {/* Booking Mode Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Meeting Booking Mode</Label>
              <RadioGroup 
                value={config.booking_mode} 
                onValueChange={(value: 'calendar' | 'open_request') => setConfig(prev => prev ? { ...prev, booking_mode: value } : null)}
                className="grid gap-4"
              >
                <div 
                  className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    config.booking_mode === 'calendar' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setConfig(prev => prev ? { ...prev, booking_mode: 'calendar' } : null)}
                >
                  <RadioGroupItem value="calendar" id="calendar" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="calendar" className="font-medium cursor-pointer flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Calendar-based booking
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Define your weekly availability and let buyers book specific time slots.
                    </p>
                  </div>
                </div>
                <div 
                  className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    config.booking_mode === 'open_request' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setConfig(prev => prev ? { ...prev, booking_mode: 'open_request' } : null)}
                >
                  <RadioGroupItem value="open_request" id="open_request" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="open_request" className="font-medium cursor-pointer flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4" />
                      Open request booking
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Buyers submit meeting requests that you review and confirm manually. No calendar needed.
                    </p>
                  </div>
                </div>
            </RadioGroup>
            </div>

            {/* Meeting Pitch - Required for public booking */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Your Booking Bio (Required)</Label>
              <p className="text-sm text-muted-foreground">
                Describe in 2 sentences what you can do for clients. This will be shown on your public booking card.
              </p>
              <Textarea
                placeholder="e.g., I help businesses build scalable web applications using modern technologies. Let's discuss your project requirements and how I can help you succeed."
                value={config.meeting_pitch || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, meeting_pitch: e.target.value } : null)}
                rows={3}
                maxLength={240}
                className={(!config.meeting_pitch || config.meeting_pitch.length < 40) ? 'border-amber-500' : ''}
              />
              <p className="text-xs text-muted-foreground">
                {config.meeting_pitch?.length || 0}/240 characters (minimum 40)
              </p>
              {(!config.meeting_pitch || config.meeting_pitch.length < 40) && (
                <Alert variant="default" className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Add a booking bio to help buyers understand what you offer.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Timezone - Always needed */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Your Timezone
              </Label>
              <Select 
                value={config.timezone} 
                onValueChange={(value) => setConfig(prev => prev ? { ...prev, timezone: value } : null)}
              >
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {detectedTimezone && detectedTimezone !== config.timezone && (
                <p className="text-xs text-muted-foreground">
                  Your browser detected: <strong>{detectedTimezone}</strong>.{' '}
                  <button 
                    type="button"
                    className="text-primary underline"
                    onClick={() => setConfig(prev => prev ? { ...prev, timezone: detectedTimezone } : null)}
                  >
                    Use detected timezone
                  </button>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Current time in your timezone: {new Date().toLocaleTimeString('en-US', { timeZone: config.timezone, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
              </p>
            </div>

            {/* Meeting Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Meetings Per Day</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={config.max_meetings_per_day}
                  onChange={(e) => setConfig(prev => prev ? { ...prev, max_meetings_per_day: parseInt(e.target.value) || 8 } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Break Between Meetings (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={config.break_minutes}
                  onChange={(e) => setConfig(prev => prev ? { ...prev, break_minutes: parseInt(e.target.value) || 0 } : null)}
                />
              </div>
            </div>

            {/* Preferred Platform */}
            <div className="space-y-2">
              <Label>Preferred Meeting Platform</Label>
              <Select 
                value={config.preferred_platform} 
                onValueChange={(value) => setConfig(prev => prev ? { ...prev, preferred_platform: value } : null)}
              >
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dk_ai_meeting">DK AI Meeting (Hosted on DK AI System)</SelectItem>
                  <SelectItem value="google_meet">Google Meet</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                </SelectContent>
              </Select>
              {config.preferred_platform === 'dk_ai_meeting' && (
                <p className="text-sm text-muted-foreground mt-2">
                  Meetings will be hosted directly on DK AI System. No external links required.
                </p>
              )}
            </div>

            {/* Platform Links - only for external platforms */}
            {config.preferred_platform === 'zoom' && (
              <div className="space-y-2">
                <Label>Zoom Meeting Link (optional)</Label>
                <Input
                  placeholder="https://zoom.us/j/..."
                  value={config.zoom_link || ''}
                  onChange={(e) => setConfig(prev => prev ? { ...prev, zoom_link: e.target.value } : null)}
                />
              </div>
            )}
            {config.preferred_platform === 'teams' && (
              <div className="space-y-2">
                <Label>Teams Meeting Link (optional)</Label>
                <Input
                  placeholder="https://teams.microsoft.com/..."
                  value={config.teams_link || ''}
                  onChange={(e) => setConfig(prev => prev ? { ...prev, teams_link: e.target.value } : null)}
                />
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Weekly Availability - Only for calendar mode */}
      {config?.meetings_enabled && config?.booking_mode === 'calendar' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Weekly Availability
            </CardTitle>
            <CardDescription>
              Set your available hours for each day of the week.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DAYS_OF_WEEK.map(day => {
                const avail = availability.find(a => a.day_of_week === day.value);
                return (
                  <div key={day.value} className="py-3 border-b last:border-0 space-y-2">
                    <div className="flex items-center gap-4">
                      <div className="w-28">
                        <Switch
                          checked={avail?.is_available || false}
                          onCheckedChange={(checked) => updateAvailability(day.value, 'is_available', checked)}
                        />
                      </div>
                      <span className="w-24 font-medium">{day.label}</span>
                      {avail?.is_available ? (
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          <Input
                            type="time"
                            value={avail.start_time}
                            onChange={(e) => updateAvailability(day.value, 'start_time', e.target.value)}
                            className="w-32"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={avail.end_time}
                            onChange={(e) => updateAvailability(day.value, 'end_time', e.target.value)}
                            className="w-32"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addTimeSlot(day.value)}
                            className="ml-2"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Slot
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unavailable</span>
                      )}
                    </div>
                    {/* Extra time slots */}
                    {avail?.is_available && avail.extra_slots && avail.extra_slots.length > 0 && (
                      <div className="ml-52 space-y-2">
                        {avail.extra_slots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={slot.start_time}
                              onChange={(e) => updateTimeSlot(day.value, idx, 'start_time', e.target.value)}
                              className="w-32"
                            />
                            <span className="text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={slot.end_time}
                              onChange={(e) => updateTimeSlot(day.value, idx, 'end_time', e.target.value)}
                              className="w-32"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeTimeSlot(day.value, idx)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open Request Mode Info */}
      {config?.meetings_enabled && config?.booking_mode === 'open_request' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" />
              Open Request Mode
            </CardTitle>
            <CardDescription>
              Buyers will submit meeting requests that you can accept, decline, or propose alternatives.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">How it works:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Buyers submit a request with their preferred date, time, and meeting type</li>
                <li>You receive notifications for new requests</li>
                <li>You can accept, decline, or propose an alternative time</li>
                <li>No calendar slots are blocked until you accept a request</li>
                <li>Ideal for flexible schedules or custom consulting</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meeting Types - Only for calendar mode */}
      {config?.meetings_enabled && config?.booking_mode === 'calendar' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Meeting Types</CardTitle>
                <CardDescription>
                  Define the types of meetings you offer (free consultations, paid sessions, etc.)
                </CardDescription>
              </div>
              <Dialog open={newTypeDialogOpen} onOpenChange={setNewTypeDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Meeting Type
                  </Button>
                </DialogTrigger>
                <MeetingTypeDialog
                  meetingType={editingType}
                  onSave={(type) => saveMeetingTypeMutation.mutate(type)}
                  onClose={() => {
                    setNewTypeDialogOpen(false);
                    setEditingType(null);
                  }}
                  isLoading={saveMeetingTypeMutation.isPending}
                />
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {meetingTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No meeting types defined yet.</p>
                <p className="text-sm">Add a meeting type to start accepting bookings.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {meetingTypes.map((type) => (
                  <div 
                    key={type.id} 
                    className={`flex items-center justify-between p-4 rounded-lg border ${!type.is_active ? 'opacity-50' : ''}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{type.name}</span>
                        {!type.is_active && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {type.duration_minutes} min
                        </span>
                        {type.is_paid ? (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${type.price}
                          </span>
                        ) : (
                          <Badge variant="secondary">Free</Badge>
                        )}
                        {type.is_group && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Group (max {type.max_participants})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditingType(type);
                          setNewTypeDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive"
                        onClick={() => type.id && deleteMeetingTypeMutation.mutate(type.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={() => saveConfigMutation.mutate()}
          disabled={saveConfigMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {saveConfigMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

// Meeting Type Dialog Component
function MeetingTypeDialog({ 
  meetingType, 
  onSave, 
  onClose,
  isLoading 
}: { 
  meetingType: MeetingType | null;
  onSave: (type: MeetingType) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const { user } = useAuth();
  const [type, setType] = useState<MeetingType>(() => meetingType || {
    seller_id: user?.id || '',
    name: '',
    description: '',
    duration_minutes: 30,
    is_paid: false,
    price: 0,
    currency: 'USD',
    is_group: false,
    max_participants: 1,
    is_active: true,
  });

  // Check Stripe connection status
  const { data: sellerPaymentConfig } = useQuery({
    queryKey: ['seller-payment-config-stripe', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from('dkai_seller_payment_configs')
        .select('stripe_account_id, stripe_onboarding_status')
        .eq('seller_id', user.id)
        .maybeSingle();
      if (error) return null;
      return data as { stripe_account_id: string | null; stripe_onboarding_status: string | null } | null;
    },
    enabled: !!user
  });

  const isStripeConnected = sellerPaymentConfig?.stripe_onboarding_status === 'connected';

  useEffect(() => {
    if (meetingType) {
      setType(meetingType);
    }
  }, [meetingType]);

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{meetingType ? 'Edit Meeting Type' : 'Add Meeting Type'}</DialogTitle>
        <DialogDescription>
          Define a type of meeting you offer to buyers.
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            placeholder="e.g., Initial Consultation"
            value={type.name}
            onChange={(e) => setType(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe what this meeting is for..."
            value={type.description}
            onChange={(e) => setType(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Duration</Label>
          <Select 
            value={type.duration_minutes.toString()} 
            onValueChange={(value) => setType(prev => ({ ...prev, duration_minutes: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="45">45 minutes</SelectItem>
              <SelectItem value="60">60 minutes</SelectItem>
              <SelectItem value="90">90 minutes</SelectItem>
              <SelectItem value="120">120 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label>Paid Meeting</Label>
            <p className="text-sm text-muted-foreground">Require payment to book</p>
          </div>
          <Switch
            checked={type.is_paid}
            onCheckedChange={(checked) => setType(prev => ({ ...prev, is_paid: checked, price: checked ? prev.price || 50 : 0 }))}
          />
        </div>

        {type.is_paid && (
          <>
            {!isStripeConnected && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Stripe Required</AlertTitle>
                <AlertDescription>
                  You must connect your Stripe account in Payment Settings before you can accept paid meetings.
                  90% goes to you, 10% is the platform fee.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={type.price}
                  onChange={(e) => setType(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select 
                  value={type.currency} 
                  onValueChange={(value) => setType(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              Buyer must pay before the meeting is confirmed
            </p>
          </>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label>Group Meeting</Label>
            <p className="text-sm text-muted-foreground">Allow multiple participants</p>
          </div>
          <Switch
            checked={type.is_group}
            onCheckedChange={(checked) => setType(prev => ({ ...prev, is_group: checked, max_participants: checked ? 5 : 1 }))}
          />
        </div>

        {type.is_group && (
          <div className="space-y-2">
            <Label>Max Participants</Label>
            <Input
              type="number"
              min={2}
              max={50}
              value={type.max_participants}
              onChange={(e) => setType(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 5 }))}
            />
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label>Active</Label>
            <p className="text-sm text-muted-foreground">Show this meeting type to buyers</p>
          </div>
          <Switch
            checked={type.is_active}
            onCheckedChange={(checked) => setType(prev => ({ ...prev, is_active: checked }))}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={() => onSave(type)}
          disabled={!type.name || isLoading || (type.is_paid && !isStripeConnected)}
        >
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
