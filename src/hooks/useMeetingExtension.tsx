import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExtensionResult {
  success: boolean;
  new_duration: number;
  new_end_time: string;
  extension_cost: number;
  will_be_invoiced: boolean;
  has_calendar_conflict: boolean;
  conflicting_meeting_time: string | null;
}

interface UseExtendMeetingOptions {
  onConflictDetected?: (conflictTime: string, extensionMinutes: number) => void;
  onSuccess?: (result: ExtensionResult) => void;
}

export function useMeetingExtension(options: UseExtendMeetingOptions = {}) {
  const queryClient = useQueryClient();
  const [pendingExtension, setPendingExtension] = useState<{
    meetingId: string;
    minutes: number;
    conflictTime: string;
  } | null>(null);

  // First check for conflicts before extending
  const checkAndExtendMutation = useMutation({
    mutationFn: async ({ meetingId, extensionMinutes }: { meetingId: string; extensionMinutes: number }) => {
      const { data, error } = await supabase.functions.invoke('extend-meeting', {
        body: { meeting_id: meetingId, extension_minutes: extensionMinutes }
      });

      if (error) throw error;
      return data as ExtensionResult;
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['meeting', variables.meetingId] });
        queryClient.invalidateQueries({ queryKey: ['my-meetings'] });
        
        toast.success('Meeting extended', {
          description: `Extended by ${variables.extensionMinutes} minutes`
        });

        options.onSuccess?.(result);
      }
    },
    onError: (error: any) => {
      toast.error('Failed to extend meeting', {
        description: error.message
      });
    }
  });

  // Pre-check for conflicts before calling extend
  const preCheckConflict = useMutation({
    mutationFn: async ({ meetingId, extensionMinutes }: { meetingId: string; extensionMinutes: number }) => {
      // Get meeting details first
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('seller_id, meeting_date, meeting_time, duration_minutes')
        .eq('id', meetingId)
        .single();

      if (meetingError || !meeting) throw new Error('Meeting not found');

      // Calculate proposed new end time
      const meetingDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_time}`);
      const currentEndTime = new Date(meetingDateTime.getTime() + meeting.duration_minutes * 60 * 1000);
      const proposedNewEndTime = new Date(currentEndTime.getTime() + extensionMinutes * 60 * 1000);
      const conflictCheckEnd = new Date(proposedNewEndTime.getTime() + 60 * 60 * 1000); // 60 min buffer

      // Check for upcoming meetings
      const { data: upcomingMeetings } = await supabase
        .from('meetings')
        .select('id, meeting_date, meeting_time')
        .eq('seller_id', meeting.seller_id)
        .neq('id', meetingId)
        .in('status', ['accepted', 'scheduled', 'confirmed'])
        .gte('meeting_date', meeting.meeting_date)
        .order('meeting_date', { ascending: true })
        .order('meeting_time', { ascending: true })
        .limit(5);

      // Find conflict
      if (upcomingMeetings && upcomingMeetings.length > 0) {
        for (const upcomingMeeting of upcomingMeetings) {
          const upcomingStart = new Date(`${upcomingMeeting.meeting_date}T${upcomingMeeting.meeting_time}`);
          
          if (upcomingStart > currentEndTime && upcomingStart <= conflictCheckEnd) {
            return {
              hasConflict: true,
              conflictTime: upcomingStart.toISOString()
            };
          }
        }
      }

      return { hasConflict: false, conflictTime: null };
    }
  });

  const extendMeeting = async (meetingId: string, extensionMinutes: number, skipConflictCheck = false) => {
    if (!skipConflictCheck) {
      // Pre-check for conflicts
      const result = await preCheckConflict.mutateAsync({ meetingId, extensionMinutes });
      
      if (result.hasConflict && result.conflictTime) {
        // Store pending extension and notify caller about conflict
        setPendingExtension({
          meetingId,
          minutes: extensionMinutes,
          conflictTime: result.conflictTime
        });
        options.onConflictDetected?.(result.conflictTime, extensionMinutes);
        return { needsConfirmation: true, conflictTime: result.conflictTime };
      }
    }

    // No conflict or skipped check - proceed with extension
    await checkAndExtendMutation.mutateAsync({ meetingId, extensionMinutes });
    setPendingExtension(null);
    return { needsConfirmation: false };
  };

  const confirmExtension = async () => {
    if (!pendingExtension) return;
    
    await checkAndExtendMutation.mutateAsync({
      meetingId: pendingExtension.meetingId,
      extensionMinutes: pendingExtension.minutes
    });
    setPendingExtension(null);
  };

  const cancelExtension = () => {
    setPendingExtension(null);
  };

  return {
    extendMeeting,
    confirmExtension,
    cancelExtension,
    pendingExtension,
    isExtending: checkAndExtendMutation.isPending || preCheckConflict.isPending,
    isCheckingConflict: preCheckConflict.isPending
  };
}
