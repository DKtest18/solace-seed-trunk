import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, parseISO, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Globe, 
  Lock, 
  Users,
  Eye,
  Link2,
  Unlink,
  Calendar as CalendarIcon,
  Check,
  AlertCircle
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  color: string;
  recurrence: string;
  recurrence_end_date: string | null;
  visibility: string;
  participant_emails: string[];
}

// Calendar connections removed - no Google/Outlook integration

interface ScheduledMeeting {
  id: string;
  seller_id: string;
  meeting_date: string;
  meeting_time: string;
  duration_minutes: number;
  status: string;
  meeting_type_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  meeting_type?: {
    name: string;
    description: string | null;
  };
  meeting_participants?: Array<{
    user_id: string;
    role: string;
    profiles?: {
      username: string | null;
      full_name: string | null;
    };
  }>;
}

// Dynamic hours - will be computed from seller availability
const DEFAULT_HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 28;
const COLORS = [
  { value: '#4285f4', label: 'Blue' },
  { value: '#ea4335', label: 'Red' },
  { value: '#fbbc04', label: 'Yellow' },
  { value: '#34a853', label: 'Green' },
  { value: '#9c27b0', label: 'Purple' },
  { value: '#ff6d01', label: 'Orange' },
  { value: '#607d8b', label: 'Gray' },
];

// Green color for accepted/scheduled meetings
const MEETING_COLOR = '#22c55e';
const MEETING_COLOR_BORDER = '#16a34a';

interface SellerCalendarProps {
  calendarVisibility: string;
  onVisibilityChange: (visibility: string) => void;
}

export function SellerCalendar({ calendarVisibility, onVisibilityChange }: SellerCalendarProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_date: format(new Date(), 'yyyy-MM-dd'),
    end_time: '10:00',
    color: '#4285f4',
    recurrence: 'none',
    recurrence_end_date: '',
    visibility: 'private',
    participant_emails: ''
  });

  // Calendar connections removed

  // Fetch calendar events
  const { data: events, isLoading } = useQuery({
    queryKey: ['seller-calendar-events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('seller_calendar_events')
        .select('*')
        .eq('seller_id', user.id)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data as CalendarEvent[];
    },
    enabled: !!user
  });

  // Fetch scheduled meetings (accepted/scheduled status)
  const { data: meetings, isLoading: meetingsLoading } = useQuery({
    queryKey: ['seller-scheduled-meetings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          id,
          seller_id,
          meeting_date,
          meeting_time,
          duration_minutes,
          status,
          meeting_type_id,
          notes,
          created_at,
          updated_at,
          meeting_type:meeting_types(name, description),
          meeting_participants(user_id, role, profiles:profiles(username, full_name))
        `)
        .eq('seller_id', user.id)
        .in('status', ['scheduled', 'in_progress'])
        .order('meeting_date', { ascending: true });

      if (error) throw error;
      return data as ScheduledMeeting[];
    },
    enabled: !!user
  });

  // Fetch seller availability to compute visible hour range
  const { data: sellerAvailability } = useQuery({
    queryKey: ['seller-availability-hours', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('seller_availability')
        .select('start_time, end_time, is_available')
        .eq('seller_id', user.id)
        .eq('is_available', true);
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Compute visible hours from seller availability
  const visibleHours = useMemo(() => {
    if (!sellerAvailability || sellerAvailability.length === 0) return DEFAULT_HOURS;
    
    let earliestHour = 23;
    let latestHour = 0;
    
    sellerAvailability.forEach(slot => {
      const startH = parseInt(slot.start_time.split(':')[0], 10);
      const endH = parseInt(slot.end_time.split(':')[0], 10);
      // If end_time has minutes, round up
      const endMinutes = parseInt(slot.end_time.split(':')[1] || '0', 10);
      const effectiveEnd = endMinutes > 0 ? endH + 1 : endH;
      
      if (startH < earliestHour) earliestHour = startH;
      if (effectiveEnd > latestHour) latestHour = effectiveEnd;
    });
    
    // Add 1-hour padding on each side
    earliestHour = Math.max(0, earliestHour - 1);
    latestHour = Math.min(24, latestHour + 1);
    
    return Array.from({ length: latestHour - earliestHour }, (_, i) => earliestHour + i);
  }, [sellerAvailability]);

  // Track newly created meetings for animation (within last 30 seconds)
  const [animatedMeetingIds, setAnimatedMeetingIds] = useState<Set<string>>(new Set());
  
  // Mark new meetings for animation
  useEffect(() => {
    if (!meetings) return;
    const now = new Date();
    const newIds = meetings
      .filter(m => {
        const updatedAt = new Date(m.updated_at);
        const diffSeconds = (now.getTime() - updatedAt.getTime()) / 1000;
        return diffSeconds < 30 && !animatedMeetingIds.has(m.id);
      })
      .map(m => m.id);
    
    if (newIds.length > 0) {
      setAnimatedMeetingIds(prev => new Set([...prev, ...newIds]));
      // Remove animation flag after animation completes
      const timer = setTimeout(() => {
        setAnimatedMeetingIds(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.delete(id));
          return next;
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [meetings]);

  // Calendar connections removed - no Google/Outlook integration

  // Create event mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('seller_calendar_events')
        .insert({
          seller_id: user.id,
          title: data.title,
          description: data.description || null,
          start_date: data.start_date,
          start_time: data.start_time,
          end_date: data.end_date,
          end_time: data.end_time,
          color: data.color,
          recurrence: data.recurrence,
          recurrence_end_date: data.recurrence_end_date || null,
          visibility: data.visibility,
          participant_emails: data.participant_emails ? data.participant_emails.split(',').map(e => e.trim()) : []
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Event created!');
      setCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['seller-calendar-events'] });
    },
    onError: (error: any) => {
      toast.error('Failed to create event', { description: error.message });
    }
  });

  // Update event mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('seller_calendar_events')
        .update({
          title: data.title,
          description: data.description || null,
          start_date: data.start_date,
          start_time: data.start_time,
          end_date: data.end_date,
          end_time: data.end_time,
          color: data.color,
          recurrence: data.recurrence,
          recurrence_end_date: data.recurrence_end_date || null,
          visibility: data.visibility,
          participant_emails: data.participant_emails ? data.participant_emails.split(',').map(e => e.trim()) : []
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Event updated!');
      setEditingEvent(null);
      setCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['seller-calendar-events'] });
    },
    onError: (error: any) => {
      toast.error('Failed to update event', { description: error.message });
    }
  });

  // Delete event mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('seller_calendar_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Event deleted!');
      setEditingEvent(null);
      setCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['seller-calendar-events'] });
    },
    onError: (error: any) => {
      toast.error('Failed to delete event', { description: error.message });
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '09:00',
      end_date: format(new Date(), 'yyyy-MM-dd'),
      end_time: '10:00',
      color: '#4285f4',
      recurrence: 'none',
      recurrence_end_date: '',
      visibility: 'private',
      participant_emails: ''
    });
  };

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const getEventsForDayAndHour = (day: Date, hour: number) => {
    if (!events) return [];
    return events.filter(event => {
      const eventDate = parseISO(event.start_date);
      const eventHour = parseInt(event.start_time.split(':')[0]);
      return isSameDay(eventDate, day) && eventHour === hour;
    });
  };

  // Get scheduled meetings for a specific day and hour
  const getMeetingsForDayAndHour = (day: Date, hour: number) => {
    if (!meetings) return [];
    return meetings.filter(meeting => {
      const meetingDate = parseISO(meeting.meeting_date);
      const meetingHour = parseInt(meeting.meeting_time.split(':')[0]);
      return isSameDay(meetingDate, day) && meetingHour === hour;
    });
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      start_date: event.start_date,
      start_time: event.start_time,
      end_date: event.end_date,
      end_time: event.end_time,
      color: event.color,
      recurrence: event.recurrence,
      recurrence_end_date: event.recurrence_end_date || '',
      visibility: event.visibility,
      participant_emails: event.participant_emails?.join(', ') || ''
    });
    setCreateDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <Globe className="h-4 w-4" />;
      case 'followers':
        return <Users className="h-4 w-4" />;
      default:
        return <Lock className="h-4 w-4" />;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return 'Everyone';
      case 'followers':
        return 'Followers Only';
      default:
        return 'Only You';
    }
  };

  return (
    <Card className="p-4 h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">
            {format(currentWeekStart, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Visibility Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {getVisibilityIcon(calendarVisibility)}
                <span className="ml-2">{getVisibilityLabel(calendarVisibility)}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onVisibilityChange('public')}>
                <Globe className="h-4 w-4 mr-2" />
                Everyone
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onVisibilityChange('followers')}>
                <Users className="h-4 w-4 mr-2" />
                Followers Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onVisibilityChange('private')}>
                <Lock className="h-4 w-4 mr-2" />
                Only You
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Create Event Button */}
          <Button onClick={() => {
            resetForm();
            setEditingEvent(null);
            setCreateDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b bg-muted/50">
          <div className="p-1 text-[10px] text-muted-foreground text-center border-r">Time</div>
          {weekDays.map((day, i) => (
            <div 
              key={i} 
              className={`p-1 text-center border-r last:border-r-0 ${
                isSameDay(day, new Date()) ? 'bg-primary/10' : ''
              }`}
            >
              <div className="text-[10px] text-muted-foreground">{format(day, 'EEE')}</div>
              <div className={`text-sm font-semibold ${
                isSameDay(day, new Date()) 
                  ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center mx-auto text-xs' 
                  : ''
              }`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Time Grid - Dynamic hours from seller availability */}
        <div className="overflow-hidden">
          {visibleHours.map((hour) => (
            <div key={hour} className="grid grid-cols-[50px_repeat(7,1fr)] border-b last:border-b-0" style={{ height: `${HOUR_HEIGHT}px` }}>
              <div className="text-[10px] text-muted-foreground text-right pr-1 border-r flex items-center justify-end">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {weekDays.map((day, i) => {
                const dayEvents = getEventsForDayAndHour(day, hour);
                const dayMeetings = getMeetingsForDayAndHour(day, hour);
                return (
                  <div 
                    key={i} 
                    className={`border-r last:border-r-0 relative hover:bg-muted/30 cursor-pointer ${
                      isSameDay(day, new Date()) ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => {
                      resetForm();
                      setEditingEvent(null);
                      setFormData(prev => ({
                        ...prev,
                        start_date: format(day, 'yyyy-MM-dd'),
                        end_date: format(day, 'yyyy-MM-dd'),
                        start_time: `${hour.toString().padStart(2, '0')}:00`,
                        end_time: `${(hour + 1).toString().padStart(2, '0')}:00`
                      }));
                      setCreateDialogOpen(true);
                    }}
                  >
                    {/* Regular calendar events */}
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="absolute inset-x-0 mx-0.5 px-1 rounded text-[9px] text-white truncate cursor-pointer hover:opacity-90 leading-tight"
                        style={{ backgroundColor: event.color, top: '1px', bottom: '1px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {/* Scheduled meetings - green with ! icon and animation */}
                    {dayMeetings.map((meeting) => {
                      const isNew = animatedMeetingIds.has(meeting.id);
                      const buyerName = meeting.meeting_participants?.find(p => p.role === 'buyer')?.profiles?.full_name 
                        || meeting.meeting_participants?.find(p => p.role === 'buyer')?.profiles?.username 
                        || 'Buyer';
                      const meetingTitle = meeting.meeting_type?.name || 'Meeting';
                      return (
                        <div
                          key={`meeting-${meeting.id}`}
                          className={`absolute inset-x-0 mx-0.5 px-1 rounded text-[9px] text-white truncate cursor-pointer hover:opacity-90 leading-tight flex items-center gap-0.5 ${
                            isNew ? 'animate-scale-in' : ''
                          }`}
                          style={{ 
                            backgroundColor: MEETING_COLOR, 
                            borderLeft: `2px solid ${MEETING_COLOR_BORDER}`,
                            top: dayEvents.length > 0 ? `${HOUR_HEIGHT / 2 + 1}px` : '1px', 
                            bottom: '1px' 
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info(`Meeting: ${meetingTitle}`, {
                              description: `With ${buyerName} at ${meeting.meeting_time}`
                            });
                          }}
                          title={`Meeting: ${meetingTitle} with ${buyerName}`}
                        >
                          <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" />
                          <span className="truncate">{meetingTitle}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Create/Edit Event Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) {
          setEditingEvent(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
            <DialogDescription>
              {editingEvent ? 'Update the event details below.' : 'Add a new event to your calendar.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Event title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Event description (optional)"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: formData.color }} />
                      {COLORS.find(c => c.value === formData.color)?.label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: color.value }} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recurrence">Repeat</Label>
              <Select value={formData.recurrence} onValueChange={(value) => setFormData({ ...formData, recurrence: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Does not repeat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.recurrence !== 'none' && (
              <div>
                <Label htmlFor="recurrence_end_date">Repeat Until (optional)</Label>
                <Input
                  id="recurrence_end_date"
                  type="date"
                  value={formData.recurrence_end_date}
                  onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                />
              </div>
            )}

            <div>
              <Label htmlFor="visibility">Who can see this event?</Label>
              <Select value={formData.visibility} onValueChange={(value) => setFormData({ ...formData, visibility: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" /> Only You
                    </div>
                  </SelectItem>
                  <SelectItem value="followers">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" /> Followers Only
                    </div>
                  </SelectItem>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" /> Everyone
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="participant_emails">Invite Participants (optional)</Label>
              <Input
                id="participant_emails"
                value={formData.participant_emails}
                onChange={(e) => setFormData({ ...formData, participant_emails: e.target.value })}
                placeholder="email1@example.com, email2@example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">Separate multiple emails with commas</p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            {editingEvent && (
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(editingEvent.id)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingEvent ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
