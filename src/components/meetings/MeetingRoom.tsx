import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Users,
  Send,
  Circle,
  AlertTriangle,
  Loader2,
  FileText,
  StickyNote,
  Save,
  Lock,
  Clock,
  Plus
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  is_muted: boolean;
  is_video_on: boolean;
  is_screen_sharing: boolean;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at: string;
}

interface TranscriptEntry {
  id: string;
  content: string;
  speaker_name: string;
  timestamp_ms: number;
  created_at: string;
}

interface JoinData {
  room: {
    id: string;
    room_code: string;
    status: string;
    recording_enabled: boolean;
    transcription_enabled: boolean;
    ai_summary_enabled: boolean;
    host_id: string;
  };
  meeting: {
    id: string;
    seller_id: string;
    meeting_date: string;
    meeting_time: string;
    duration_minutes: number;
  };
  user: {
    id: string;
    display_name: string;
    is_host: boolean;
    avatar_url?: string;
  };
}

export function MeetingRoom() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Join state
  const [joinPhase, setJoinPhase] = useState<'loading' | 'consent' | 'joining' | 'connected' | 'error'>('loading');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinData, setJoinData] = useState<JoinData | null>(null);
  
  // Consent state
  const [wantsRecording, setWantsRecording] = useState(false);
  const [wantsTranscript, setWantsTranscript] = useState(false);
  const [wantsSummary, setWantsSummary] = useState(true);
  const [consentLocked, setConsentLocked] = useState(false);
  const [consentLockedAt, setConsentLockedAt] = useState<string | null>(null);
  const [effectiveConsent, setEffectiveConsent] = useState<{
    recording: boolean;
    transcript: boolean;
    summary: boolean;
  } | null>(null);
  
  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Notes state
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  
  // Extension state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extensionMinutes, setExtensionMinutes] = useState('15');
  const [isExtending, setIsExtending] = useState(false);
  const [meetingEndTime, setMeetingEndTime] = useState<Date | null>(null);
  const [showExtendButton, setShowExtendButton] = useState(false);
  
  // UI state
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  
  // Media refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Try to join the room
  const attemptJoin = useCallback(async () => {
    if (!roomCode || !user) return;
    
    try {
      setJoinPhase('loading');
      setJoinError(null);
      
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }
      
      const response = await supabase.functions.invoke('join-meeting-room', {
        body: { room_code: roomCode }
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to join room');
      }
      
      const data = response.data;
      
      if (data.error) {
        setJoinError(data.error);
        setJoinPhase('error');
        return;
      }
      
      setJoinData(data);
      
      // Load existing preferences if any
      const { data: existingPrefs } = await supabase
        .from('meeting_preferences')
        .select('*')
        .eq('meeting_id', data.meeting.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existingPrefs) {
        setWantsRecording(existingPrefs.wants_recording);
        setWantsTranscript(existingPrefs.wants_transcript);
        setWantsSummary(existingPrefs.wants_summary);
        
        // Check if consent is already locked
        if (existingPrefs.consent_locked) {
          setConsentLocked(true);
          setConsentLockedAt(existingPrefs.consent_locked_at);
        }
      }
      
      // Check if any preferences are locked (in case other participant already joined)
      const { data: allPrefs } = await supabase
        .from('meeting_preferences')
        .select('consent_locked, consent_locked_at')
        .eq('meeting_id', data.meeting.id)
        .limit(1);
      
      if (allPrefs?.some(p => p.consent_locked)) {
        setConsentLocked(true);
        setConsentLockedAt(allPrefs.find(p => p.consent_locked_at)?.consent_locked_at || null);
      }
      
      // Load existing notes if any
      const { data: existingNotes } = await supabase
        .from('meeting_notes')
        .select('content')
        .eq('meeting_id', data.meeting.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existingNotes) {
        setNotes(existingNotes.content || '');
      }
      
      setJoinPhase('consent');
    } catch (error: any) {
      console.error('Join error:', error);
      setJoinError(error.message || 'Failed to join meeting');
      setJoinPhase('error');
    }
  }, [roomCode, user]);

  // Save consent preferences and join
  const confirmJoin = useCallback(async () => {
    if (!joinData || !user) return;
    
    try {
      setJoinPhase('joining');
      
      // Save preferences first (only if not already locked)
      if (!consentLocked) {
        const { data: prefResponse, error: prefError } = await supabase.functions.invoke('update-meeting-preferences', {
          body: {
            meeting_id: joinData.meeting.id,
            wants_recording: wantsRecording,
            wants_transcript: wantsTranscript,
            wants_summary: wantsSummary
          }
        });
        
        // Check if consent was locked by another participant
        if (prefResponse?.consent_locked) {
          setConsentLocked(true);
          toast.info('Consent settings were locked by another participant');
        }
        
        if (prefError) {
          console.error('Preference save error:', prefError);
        }
      }
      
      // Lock consent when joining (if host or both participants are present)
      const { data: lockResponse } = await supabase.functions.invoke('lock-meeting-consent', {
        body: { meeting_id: joinData.meeting.id }
      });
      
      if (lockResponse?.consent_locked) {
        setConsentLocked(true);
        setConsentLockedAt(lockResponse.consent_locked_at);
      }
      
      // Store effective consent for display
      if (lockResponse?.effective_consent) {
        setEffectiveConsent(lockResponse.effective_consent);
      }
      
      // Initialize media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (mediaError: any) {
        console.error('Media access error:', mediaError);
        setConnectionError('Unable to access camera/microphone. Please grant permissions.');
      }
      
      setJoinPhase('connected');
    } catch (error: any) {
      console.error('Confirm join error:', error);
      setJoinError(error.message);
      setJoinPhase('error');
    }
  }, [joinData, user, wantsRecording, wantsTranscript, wantsSummary, consentLocked]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (user && joinData?.room.id) {
      await supabase
        .from('meeting_room_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('room_id', joinData.room.id)
        .eq('user_id', user.id);
    }
    
    navigate('/my-meetings');
  }, [navigate, user, joinData]);

  // End meeting
  const endMeeting = useCallback(async () => {
    if (!joinData?.room.id) return;
    
    try {
      await supabase.functions.invoke('end-meeting-room', {
        body: { room_id: joinData.room.id }
      });
      
      toast.success('Meeting ended');
      await leaveRoom();
    } catch (error: any) {
      toast.error('Failed to end meeting', { description: error.message });
    }
  }, [joinData, leaveRoom]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
        
        if (user && joinData?.room.id) {
          supabase
            .from('meeting_room_participants')
            .update({ is_muted: !isMuted })
            .eq('room_id', joinData.room.id)
            .eq('user_id', user.id);
        }
      }
    }
  }, [isMuted, user, joinData]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn;
        setIsVideoOn(!isVideoOn);
        
        if (user && joinData?.room.id) {
          supabase
            .from('meeting_room_participants')
            .update({ is_video_on: !isVideoOn })
            .eq('room_id', joinData.room.id)
            .eq('user_id', user.id);
        }
      }
    }
  }, [isVideoOn, user, joinData]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenStreamRef.current = stream;
        setIsScreenSharing(true);
        
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
        };
      } catch (error) {
        toast.error('Failed to share screen');
      }
    }
    
    if (user && joinData?.room.id) {
      supabase
        .from('meeting_room_participants')
        .update({ is_screen_sharing: !isScreenSharing })
        .eq('room_id', joinData.room.id)
        .eq('user_id', user.id);
    }
  }, [isScreenSharing, user, joinData]);

  // Send chat message
  const sendMessage = useCallback(async () => {
    if (!chatMessage.trim() || !user || !joinData) return;
    
    const { error } = await supabase
      .from('meeting_chat_messages')
      .insert({
        room_id: joinData.room.id,
        sender_id: user.id,
        sender_name: joinData.user.display_name,
        message: chatMessage.trim()
      });
    
    if (error) {
      toast.error('Failed to send message');
    } else {
      setChatMessage('');
    }
  }, [chatMessage, user, joinData]);

  // Save notes (auto-save with debounce)
  const saveNotes = useCallback(async () => {
    if (!joinData?.meeting.id || !user) return;
    
    try {
      await supabase
        .from('meeting_notes')
        .upsert({
          meeting_id: joinData.meeting.id,
          user_id: user.id,
          content: notes,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'meeting_id,user_id'
        });
      
      setNotesSaved(true);
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  }, [joinData, user, notes]);

  // State for calendar conflict warning
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictTime, setConflictTime] = useState<string | null>(null);
  const [pendingExtension, setPendingExtension] = useState(false);

  // Extend meeting - first checks for conflict, then confirms
  const extendMeeting = useCallback(async (forceExtend = false) => {
    if (!joinData?.meeting.id) return;
    
    setIsExtending(true);
    try {
      const { data, error } = await supabase.functions.invoke('extend-meeting', {
        body: {
          meeting_id: joinData.meeting.id,
          extension_minutes: parseInt(extensionMinutes)
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Check for calendar conflict warning
      if (data.has_calendar_conflict && !forceExtend) {
        setConflictTime(data.conflicting_meeting_time);
        setShowConflictWarning(true);
        setPendingExtension(true);
        setIsExtending(false);
        return;
      }

      if (data.success) {
        setMeetingEndTime(new Date(data.new_end_time));
        toast.success(`Meeting extended by ${extensionMinutes} minutes`);
        setShowExtendModal(false);
        setShowConflictWarning(false);
        setPendingExtension(false);
        
        if (data.will_be_invoiced) {
          toast.info('Extension time will be invoiced after the meeting');
        }
      }
    } catch (err: any) {
      toast.error('Failed to extend meeting', { description: err.message });
    } finally {
      setIsExtending(false);
    }
  }, [joinData, extensionMinutes]);

  // Handle confirm extend with conflict
  const confirmExtendWithConflict = useCallback(() => {
    setShowConflictWarning(false);
    extendMeeting(true);
  }, [extendMeeting]);

  // Check if we should show extend button (last 5 minutes)
  useEffect(() => {
    if (!joinData?.meeting || joinPhase !== 'connected') return;

    const checkExtendVisibility = () => {
      const endTime = meetingEndTime || new Date(
        new Date(`${joinData.meeting.meeting_date}T${joinData.meeting.meeting_time}`).getTime() +
        joinData.meeting.duration_minutes * 60 * 1000
      );
      const now = new Date();
      const timeUntilEnd = endTime.getTime() - now.getTime();
      const fiveMinutes = 5 * 60 * 1000;
      
      setShowExtendButton(timeUntilEnd > 0 && timeUntilEnd <= fiveMinutes);
    };

    checkExtendVisibility();
    const interval = setInterval(checkExtendVisibility, 10000);
    return () => clearInterval(interval);
  }, [joinData, joinPhase, meetingEndTime]);

  // Auto-save notes on change
  useEffect(() => {
    if (!joinData) return;
    
    setNotesSaved(false);
    
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }
    
    notesTimeoutRef.current = setTimeout(() => {
      saveNotes();
    }, 1500);
    
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, [notes, joinData, saveNotes]);

  // Initial join attempt
  useEffect(() => {
    if (user && roomCode) {
      attemptJoin();
    }
  }, [user, roomCode, attemptJoin]);

  // Subscribe to realtime updates when connected
  useEffect(() => {
    if (joinPhase !== 'connected' || !joinData) return;

    const participantsChannel = supabase
      .channel(`room-participants:${joinData.room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_room_participants',
          filter: `room_id=eq.${joinData.room.id}`
        },
        async () => {
          const { data } = await supabase
            .from('meeting_room_participants')
            .select('*')
            .eq('room_id', joinData.room.id)
            .is('left_at', null);
          
          setParticipants(data || []);
        }
      )
      .subscribe();

    const chatChannel = supabase
      .channel(`room-chat:${joinData.room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_chat_messages',
          filter: `room_id=eq.${joinData.room.id}`
        },
        (payload) => {
          setChatMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    // Initial data fetch
    const fetchInitialData = async () => {
      const [participantsRes, chatRes] = await Promise.all([
        supabase
          .from('meeting_room_participants')
          .select('*')
          .eq('room_id', joinData.room.id)
          .is('left_at', null),
        supabase
          .from('meeting_chat_messages')
          .select('*')
          .eq('room_id', joinData.room.id)
          .order('created_at', { ascending: true })
      ]);
      
      setParticipants(participantsRes.data || []);
      setChatMessages(chatRes.data || []);
    };
    
    fetchInitialData();

    return () => {
      participantsChannel.unsubscribe();
      chatChannel.unsubscribe();
    };
  }, [joinPhase, joinData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Loading state
  if (joinPhase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying meeting access...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (joinPhase === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Cannot Join Meeting</h2>
          <p className="text-muted-foreground mb-4">{joinError}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/my-meetings')}>
              Back to Meetings
            </Button>
            <Button onClick={attemptJoin}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Consent phase (pre-join lobby)
  if (joinPhase === 'consent') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-lg w-full">
          <h2 className="text-2xl font-semibold mb-2">Ready to Join?</h2>
          <p className="text-muted-foreground mb-6">
            Room: <span className="font-mono">{roomCode}</span>
          </p>
          
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Meeting Features</h3>
                {consentLocked && (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Consent Locked
                  </Badge>
                )}
              </div>
              
              {consentLocked ? (
                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-muted-foreground">
                    <Lock className="h-4 w-4 inline mr-2" />
                    Consent settings were locked when the meeting started. 
                    Your previously saved preferences will be used.
                  </p>
                  {consentLockedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Locked at: {new Date(consentLockedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Recording & transcript settings will be <strong>locked</strong> once you join the meeting.
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="recording"
                    checked={wantsRecording}
                    onCheckedChange={(checked) => setWantsRecording(checked as boolean)}
                    disabled={consentLocked}
                  />
                  <div>
                    <Label htmlFor="recording" className={`font-medium cursor-pointer ${consentLocked ? 'text-muted-foreground' : ''}`}>
                      Recording
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Record this meeting (requires all participants to agree)
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="transcript"
                    checked={wantsTranscript}
                    onCheckedChange={(checked) => setWantsTranscript(checked as boolean)}
                    disabled={consentLocked}
                  />
                  <div>
                    <Label htmlFor="transcript" className={`font-medium cursor-pointer ${consentLocked ? 'text-muted-foreground' : ''}`}>
                      Live Transcript
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Generate a transcript (requires all participants to agree)
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="summary"
                    checked={wantsSummary}
                    onCheckedChange={(checked) => setWantsSummary(checked as boolean)}
                    disabled={consentLocked}
                  />
                  <div>
                    <Label htmlFor="summary" className={`font-medium cursor-pointer ${consentLocked ? 'text-muted-foreground' : ''}`}>
                      AI Summary
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Generate an AI summary after the meeting
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/my-meetings')}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmJoin}>
                Join Meeting
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Joining state
  if (joinPhase === 'joining') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Joining meeting...</p>
        </div>
      </div>
    );
  }

  // Connected - main meeting room UI
  const isHost = joinData?.user.is_host;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-3">
          <Badge variant="default">
            <Circle className="h-2 w-2 mr-1 fill-current" />
            Live
          </Badge>
          <span className="font-medium">Meeting Room</span>
          <span className="text-sm text-muted-foreground font-mono">{roomCode}</span>
        </div>
        <div className="flex items-center gap-2">
          {consentLocked && (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          )}
          {effectiveConsent?.recording ? (
            <Badge variant="destructive">
              <Circle className="h-2 w-2 mr-1 fill-current animate-pulse" />
              Recording
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              No Recording
            </Badge>
          )}
          {effectiveConsent?.transcript ? (
            <Badge variant="outline">
              <FileText className="h-3 w-3 mr-1" />
              Transcript On
            </Badge>
          ) : null}
          {effectiveConsent?.summary && (
            <Badge variant="secondary">
              AI Summary
            </Badge>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        <div className="flex-1 p-4 flex flex-col">
          {connectionError ? (
            <div className="flex-1 flex items-center justify-center">
              <Card className="p-6 text-center">
                <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">{connectionError}</p>
                <Button onClick={confirmJoin}>Retry</Button>
              </Card>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Local video */}
              <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${!isVideoOn ? 'hidden' : ''}`}
                />
                {!isVideoOn && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={joinData?.user.avatar_url} />
                      <AvatarFallback className="text-2xl">
                        {joinData?.user.display_name?.[0] || 'Y'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    You {isHost && '(Host)'}
                  </Badge>
                  {isMuted && <MicOff className="h-4 w-4 text-destructive" />}
                </div>
              </div>

              {/* Remote video / Participants */}
              {participants.filter(p => p.user_id !== user?.id).length > 0 ? (
                participants.filter(p => p.user_id !== user?.id).map(participant => (
                  <div key={participant.id} className="relative bg-muted rounded-lg overflow-hidden aspect-video">
                    {participant.is_video_on ? (
                      <video
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Avatar className="h-20 w-20">
                          <AvatarFallback className="text-2xl">
                            {participant.display_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {participant.display_name}
                        {participant.role === 'host' && ' (Host)'}
                      </Badge>
                      {participant.is_muted && <MicOff className="h-4 w-4 text-destructive" />}
                      {participant.is_screen_sharing && <Monitor className="h-4 w-4 text-primary" />}
                    </div>
                  </div>
                ))
              ) : (
                <div className="relative bg-muted rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                  <p className="text-muted-foreground">Waiting for others to join...</p>
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
            <Button
              variant={isMuted ? 'destructive' : 'secondary'}
              size="lg"
              className="rounded-full h-12 w-12 p-0"
              onClick={toggleMute}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            
            <Button
              variant={isVideoOn ? 'secondary' : 'destructive'}
              size="lg"
              className="rounded-full h-12 w-12 p-0"
              onClick={toggleVideo}
            >
              {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
            
            <Button
              variant={isScreenSharing ? 'default' : 'secondary'}
              size="lg"
              className="rounded-full h-12 w-12 p-0"
              onClick={toggleScreenShare}
              title="Bildschirmübertragung"
            >
              {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </Button>
            
            <Separator orientation="vertical" className="h-8" />
            
            {/* Chat */}
            <Sheet open={chatOpen} onOpenChange={setChatOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="lg" className="rounded-full h-12 w-12 p-0">
                  <MessageSquare className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Chat</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-[calc(100vh-8rem)]">
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-3 py-4">
                      {chatMessages.map(msg => (
                        <div key={msg.id} className={`flex gap-2 ${msg.sender_id === user?.id ? 'justify-end' : ''}`}>
                          {msg.sender_id !== user?.id && (
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{msg.sender_name[0]}</AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`max-w-[70%] ${msg.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'} rounded-lg px-3 py-2`}>
                            {msg.sender_id !== user?.id && (
                              <p className="text-xs font-medium mb-1">{msg.sender_name}</p>
                            )}
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex gap-2 pt-4 border-t">
                    <Input
                      placeholder="Type a message..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <Button onClick={sendMessage} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            
            {/* Participants */}
            <Sheet open={participantsOpen} onOpenChange={setParticipantsOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="lg" className="rounded-full h-12 px-4 gap-2">
                  <Users className="h-5 w-5" />
                  <span>{participants.length}</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Participants ({participants.length})</SheetTitle>
                </SheetHeader>
                <div className="py-4 space-y-3">
                  {participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{p.display_name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{p.display_name}</p>
                          <Badge variant="outline" className="text-xs">
                            {p.role}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.is_muted && <MicOff className="h-4 w-4 text-muted-foreground" />}
                        {!p.is_video_on && <VideoOff className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            {/* Private Notes */}
            <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="lg" className="rounded-full h-12 w-12 p-0">
                  <StickyNote className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    Private Notes
                    {notesSaved ? (
                      <Badge variant="outline" className="text-xs">Saved</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Saving...</Badge>
                    )}
                  </SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Your notes are private and only visible to you.
                  </p>
                  <Textarea
                    placeholder="Take notes during the meeting..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[400px] resize-none"
                  />
                  <Button 
                    onClick={saveNotes} 
                    className="mt-4 w-full"
                    disabled={notesSaved}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Notes
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Transcript (if enabled) */}
            {joinData?.room.transcription_enabled && (
              <Sheet open={transcriptOpen} onOpenChange={setTranscriptOpen}>
                <SheetTrigger asChild>
                  <Button variant="secondary" size="lg" className="rounded-full h-12 w-12 p-0">
                    <FileText className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px]">
                  <SheetHeader>
                    <SheetTitle>Live Transcript</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
                    <div className="space-y-3 py-4">
                      {transcripts.map(t => (
                        <div key={t.id} className="border-l-2 border-primary pl-3">
                          <p className="text-xs text-muted-foreground font-medium">{t.speaker_name}</p>
                          <p className="text-sm">{t.content}</p>
                        </div>
                      ))}
                      {transcripts.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Transcript will appear here as participants speak...
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            )}

            {/* Extend Meeting Button - Host only, last 5 minutes */}
            {isHost && showExtendButton && (
              <Sheet open={showExtendModal} onOpenChange={setShowExtendModal}>
                <SheetTrigger asChild>
                  <Button variant="default" size="lg" className="rounded-full h-12 px-4 gap-2 animate-pulse">
                    <Plus className="h-5 w-5" />
                    <Clock className="h-4 w-4" />
                    Extend
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Extend Meeting</SheetTitle>
                  </SheetHeader>
                  <div className="py-6 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      How many minutes would you like to extend the meeting?
                    </p>
                    <Input
                      type="number"
                      min="5"
                      max="120"
                      value={extensionMinutes}
                      onChange={(e) => setExtensionMinutes(e.target.value)}
                      placeholder="15"
                    />
                    <p className="text-xs text-muted-foreground">
                      For paid meetings, extension time will be invoiced after the meeting ends.
                    </p>
                    <Button 
                      onClick={() => extendMeeting(false)} 
                      disabled={isExtending}
                      className="w-full"
                    >
                      {isExtending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Extend by {extensionMinutes} minutes
                    </Button>
                    
                    {/* Calendar Conflict Warning Modal */}
                    {showConflictWarning && conflictTime && (
                      <div className="mt-4 p-4 border border-yellow-500 bg-yellow-500/10 rounded-lg space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-700 dark:text-yellow-400">
                              Calendar Conflict Detected
                            </p>
                            <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
                              You have another meeting scheduled at{' '}
                              <strong>{new Date(conflictTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>.
                              Extending this meeting may cause you to be late.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowConflictWarning(false);
                              setPendingExtension(false);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={confirmExtendWithConflict}
                            disabled={isExtending}
                          >
                            {isExtending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Extend Anyway
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            )}
            
            <Separator orientation="vertical" className="h-8" />
            
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full h-12 w-12 p-0"
              onClick={isHost ? endMeeting : leaveRoom}
              title={isHost ? 'End Meeting' : 'Leave Meeting'}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
