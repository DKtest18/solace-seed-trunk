import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileAudio,
  FileText,
  Sparkles,
  StickyNote,
  Download,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileDown,
  Settings,
  Trash2
} from 'lucide-react';

interface MeetingAssetsSectionProps {
  meetingId: string;
  isSeller?: boolean;
}

interface ProcessingJob {
  id: string;
  status: string;
  recording_started_at: string | null;
  processing_completed_at: string | null;
  last_error: string | null;
}

interface UserAsset {
  id: string;
  meeting_id: string;
  user_id: string;
  type: string;
  text_content: string | null;
  status: string;
}

export function MeetingAssetsSection({ meetingId, isSeller = false }: MeetingAssetsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [retentionDays, setRetentionDays] = useState<string>('');
  const [showRetentionDialog, setShowRetentionDialog] = useState(false);

  // Fetch processing job status
  const { data: processingJob, isLoading: jobLoading } = useQuery({
    queryKey: ['meeting-processing-job', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_processing_jobs')
        .select('*')
        .eq('meeting_id', meetingId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as ProcessingJob | null;
    },
    enabled: !!meetingId && !!user
  });

  // Fetch per-user summary from meeting_user_assets
  const { data: userSummary, isLoading: userSummaryLoading } = useQuery({
    queryKey: ['meeting-user-summary', meetingId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_user_assets')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('user_id', user!.id)
        .eq('type', 'summary')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as UserAsset | null;
    },
    enabled: !!meetingId && !!user
  });

  // Fallback to shared summary
  const { data: sharedSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['meeting-summary', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_summaries')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!meetingId && !!user && !userSummary
  });

  // Fetch transcripts
  const { data: transcripts, isLoading: transcriptsLoading } = useQuery({
    queryKey: ['meeting-transcripts', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('timestamp_ms', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!meetingId && !!user
  });

  // Fetch user's notes
  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ['meeting-notes', meetingId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_notes')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('user_id', user!.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!meetingId && !!user
  });

  // Fetch recording info
  const { data: recording, isLoading: recordingLoading } = useQuery({
    queryKey: ['meeting-recording', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_recordings')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!meetingId && !!user
  });

  // Fetch retention settings (seller only)
  const { data: retention, isLoading: retentionLoading } = useQuery({
    queryKey: ['meeting-retention', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_retention')
        .select('*')
        .eq('meeting_id', meetingId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!meetingId && !!user && isSeller
  });

  // Set retention mutation
  const setRetentionMutation = useMutation({
    mutationFn: async (days: number | null) => {
      const deleteAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;
      
      const { error } = await supabase
        .from('meeting_retention')
        .upsert({
          meeting_id: meetingId,
          retention_days: days,
          delete_at: deleteAt
        }, {
          onConflict: 'meeting_id'
        });
      
      if (error) throw error;

      // Log the retention configuration
      await supabase
        .from('meeting_audit_logs')
        .insert({
          meeting_id: meetingId,
          actor_user_id: user!.id,
          action: 'RETENTION_CONFIGURED',
          meta: { retention_days: days, delete_at: deleteAt }
        });
    },
    onSuccess: () => {
      toast.success('Retention settings updated');
      setShowRetentionDialog(false);
      queryClient.invalidateQueries({ queryKey: ['meeting-retention', meetingId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update retention settings');
    }
  });

  // Get signed URL for audio
  const getAudioUrl = async () => {
    if (!user) return;
    setIsLoadingAudio(true);
    
    try {
      const response = await supabase.functions.invoke('get-meeting-asset-url', {
        body: { meeting_id: meetingId, asset_type: 'audio' },
      });

      if (response.error) {
        toast.error('Failed to get audio URL');
        return;
      }

      setAudioUrl(response.data.signed_url);
      toast.success('Audio ready to play');
    } catch (error) {
      toast.error('Failed to load audio');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Export meeting data
  const handleExport = async (format: 'json' | 'markdown') => {
    if (!user) return;
    setIsExporting(true);
    
    try {
      const response = await supabase.functions.invoke('export-meeting-data', {
        body: { meeting_id: meetingId, format },
      });

      if (response.error) {
        toast.error('Failed to export meeting data');
        return;
      }

      const { data } = response;
      
      if (format === 'markdown') {
        // Download as .md file
        const blob = new Blob([data.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-export-${meetingId.slice(0, 8)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Download as .json file
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-export-${meetingId.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast.success(`Meeting exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Parse user summary content
  const parsedUserSummary = userSummary?.text_content 
    ? (() => {
        try {
          return JSON.parse(userSummary.text_content);
        } catch {
          return { summary: userSummary.text_content };
        }
      })()
    : null;

  // Use personal summary if available, otherwise shared
  const displaySummary = parsedUserSummary || sharedSummary;

  const isLoading = jobLoading || userSummaryLoading || summaryLoading || transcriptsLoading || notesLoading || recordingLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const hasAnyAssets = displaySummary || (transcripts && transcripts.length > 0) || notes || recording;
  const isProcessing = processingJob?.status === 'processing' || processingJob?.status === 'recording';
  const hasFailed = processingJob?.status === 'failed';

  // Show processing status
  if (isProcessing) {
    return (
      <Card className="border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">Processing meeting assets...</p>
              <p className="text-sm text-muted-foreground">
                This may take a few minutes. Recording, transcript, and summary will appear here when ready.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error status
  if (hasFailed) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium">Processing failed</p>
              <p className="text-sm text-muted-foreground">
                {processingJob?.last_error || 'An error occurred while processing the meeting assets.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasAnyAssets) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <p className="text-sm">
              No recording or summary available. This may be due to consent settings or the meeting type.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Export Button */}
      {hasAnyAssets && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2">
              <FileDown className="h-4 w-4" />
              Export Meeting Data
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5" />
                Export Meeting
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground">
                Export includes your personal summary, notes, transcript (if available), and audio link.
              </p>
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => handleExport('markdown')} 
                  disabled={isExporting}
                  className="w-full"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  Export as Markdown
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleExport('json')} 
                  disabled={isExporting}
                  className="w-full"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Export as JSON
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Retention Settings (Seller only) */}
      {isSeller && (
        <Dialog open={showRetentionDialog} onOpenChange={setShowRetentionDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Settings className="h-4 w-4" />
              Retention Settings
              {retention?.retention_days && (
                <Badge variant="secondary" className="ml-auto">
                  {retention.retention_days} days
                </Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Data Retention
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Set how long meeting assets (recording, transcript, summary) should be retained.
              </p>
              <div className="space-y-2">
                <Label>Retention Period</Label>
                <Select
                  value={retentionDays || (retention?.retention_days?.toString() || 'forever')}
                  onValueChange={setRetentionDays}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select retention period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forever">Keep Forever</SelectItem>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="180">180 Days</SelectItem>
                    <SelectItem value="365">1 Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {retention?.delete_at && (
                <p className="text-xs text-muted-foreground">
                  Scheduled deletion: {new Date(retention.delete_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRetentionDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const days = retentionDays === 'forever' ? null : parseInt(retentionDays);
                  setRetentionMutation.mutate(days);
                }}
                disabled={setRetentionMutation.isPending}
              >
                {setRetentionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Recording */}
      {recording && (
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => !audioUrl && getAudioUrl()}
            >
              <FileAudio className="h-4 w-4" />
              Audio Recording
              <Badge variant="secondary" className="ml-auto">
                {recording.duration_seconds ? `${Math.round(recording.duration_seconds / 60)} min` : 'Available'}
              </Badge>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileAudio className="h-5 w-5" />
                Audio Recording
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isLoadingAudio ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : audioUrl ? (
                <div className="space-y-3">
                  <audio 
                    controls 
                    className="w-full" 
                    src={audioUrl}
                  >
                    Your browser does not support the audio element.
                  </audio>
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => window.open(audioUrl, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                    Download Recording
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Button onClick={getAudioUrl} disabled={isLoadingAudio}>
                    <Play className="h-4 w-4 mr-2" />
                    Load Audio
                  </Button>
                </div>
              )}
              {recording.duration_seconds && (
                <p className="text-sm text-muted-foreground text-center">
                  Duration: {Math.floor(recording.duration_seconds / 60)}m {recording.duration_seconds % 60}s
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Personal AI Summary */}
      {displaySummary && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Sparkles className="h-4 w-4" />
              {parsedUserSummary ? 'My AI Summary' : 'AI Summary'}
              <CheckCircle className="h-4 w-4 ml-auto text-green-500" />
              {parsedUserSummary && (
                <Badge variant="outline" className="ml-1 text-xs">Personal</Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {parsedUserSummary ? 'My Personal AI Summary' : 'AI Meeting Summary'}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {parsedUserSummary && (
                  <Badge variant="secondary" className="text-xs">
                    This summary includes your personal notes
                  </Badge>
                )}
                <div>
                  <h4 className="font-medium mb-2">Summary</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {displaySummary.summary}
                  </p>
                </div>
                
                {displaySummary.keyPoints && Array.isArray(displaySummary.keyPoints) && displaySummary.keyPoints.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Key Points</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {displaySummary.keyPoints.map((point: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {displaySummary.key_points && Array.isArray(displaySummary.key_points) && displaySummary.key_points.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Key Points</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {(displaySummary.key_points as string[]).map((point: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {displaySummary.nextSteps && Array.isArray(displaySummary.nextSteps) && displaySummary.nextSteps.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Next Steps</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {displaySummary.nextSteps.map((step: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {displaySummary.next_steps && Array.isArray(displaySummary.next_steps) && displaySummary.next_steps.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Next Steps</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {(displaySummary.next_steps as string[]).map((step: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Transcript */}
      {transcripts && transcripts.length > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2">
              <FileText className="h-4 w-4" />
              Transcript
              <Badge variant="secondary" className="ml-auto">
                {transcripts.length} entries
              </Badge>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Meeting Transcript
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3 pr-4">
                {transcripts.map((entry) => (
                  <div key={entry.id} className="border-l-2 border-primary/20 pl-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium">{entry.speaker_name || 'Speaker'}</span>
                      {entry.timestamp_ms && (
                        <span className="text-xs">
                          {Math.floor(entry.timestamp_ms / 60000)}:{String(Math.floor((entry.timestamp_ms % 60000) / 1000)).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1">{entry.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Notes */}
      {notes && notes.content && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2">
              <StickyNote className="h-4 w-4" />
              My Notes
              <Badge variant="secondary" className="ml-auto">Private</Badge>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5" />
                My Meeting Notes
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <p className="text-sm whitespace-pre-wrap pr-4">
                {notes.content}
              </p>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
