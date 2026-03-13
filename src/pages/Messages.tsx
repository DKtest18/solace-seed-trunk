import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2, Paperclip, Download, Pencil, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from '@/components/AppLayout';
import { formatDistanceToNow } from 'date-fns';
import { FileAttachmentUpload } from '@/components/FileAttachmentUpload';
import { toast as sonnerToast } from 'sonner';

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  thread_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  attachment_storage_key: string | null;
  attachment_caption: string | null;
}

interface Thread {
  id: string;
  updated_at: string;
}

interface Conversation {
  threadId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{ id: string; name: string; avatar: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!newContent.trim()) return;
    
    try {
      const { error } = await supabase
        .from('dkai_messages')
        .update({ content: newContent.trim(), edited_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', user?.id);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, content: newContent.trim() } : msg
      ));
      setEditingMessageId(null);
      setEditingContent("");
      sonnerToast.success("Message updated");
    } catch (error) {
      console.error('Error editing message:', error);
      sonnerToast.error("Failed to edit message");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('dkai_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user?.id);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      sonnerToast.success("Message deleted");
    } catch (error) {
      console.error('Error deleting message:', error);
      sonnerToast.error("Failed to delete message");
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    loadConversations();
    
    // Check if we should create/open a thread with a specific user
    // Support both ?seller= and ?user= params for backward compatibility
    const sellerId = searchParams.get('seller') || searchParams.get('user');
    if (sellerId && sellerId !== user.id) {
      createOrOpenThread(sellerId);
    }
    
    // Subscribe to messages changes
    const messagesChannel = supabase
      .channel('messages-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
          if (selectedThreadId) {
            loadThreadMessages(selectedThreadId);
          }
        }
      )
      .subscribe();

    // Subscribe to threads changes
    const threadsChannel = supabase
      .channel('threads-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'threads',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(threadsChannel);
    };
  }, [user, selectedThreadId, searchParams]);

  const createOrOpenThread = async (recipientId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('create-message-thread', {
        body: { recipient_id: recipientId }
      });

      if (error) throw error;
      
      // Handle blocked user response (403)
      if (data?.error === "Cannot message this user") {
        toast({
          title: "Cannot Message User",
          description: "You cannot message this user.",
          variant: "destructive",
        });
        return;
      }

      const threadId = data.thread_id;
      setSelectedThreadId(threadId);
      setMessages(data.messages || []);

      // Load recipient profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', recipientId)
        .single();

      if (profile) {
        setSelectedUserProfile({
          id: profile.id,
          name: profile.full_name || 'Unknown User',
          avatar: profile.avatar_url || ''
        });
      }

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('thread_id', threadId)
        .eq('recipient_id', user.id);

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error: any) {
      console.error('Failed to create/open thread:', error);
      
      // Check for blocked user error
      if (error?.message?.includes('Cannot message') || error?.status === 403) {
        toast({
          title: "Cannot Message User",
          description: "You cannot message this user.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to open conversation",
        variant: "destructive",
      });
    }
  };

  const loadConversations = async (retryCount = 0) => {
    if (!user) return;

    const maxRetries = 3;
    const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 5000);

    try {
      // Get blocked user IDs for filtering
      const { data: blocks } = await supabase
        .from('user_blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

      const blockedIds = new Set<string>();
      blocks?.forEach(block => {
        if (block.blocker_id === user.id) {
          blockedIds.add(block.blocked_id);
        } else {
          blockedIds.add(block.blocker_id);
        }
      });

      // Get all threads user is participant in
      const { data: participations, error: partError } = await supabase
        .from('chat_participants')
        .select('thread_id')
        .eq('user_id', user.id);

      if (partError) throw partError;

      if (!participations || participations.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const threadIds = participations.map(p => p.thread_id);

      // Get threads with their latest update
      const { data: threads, error: threadsError } = await supabase
        .from('threads')
        .select('*')
        .in('id', threadIds)
        .order('updated_at', { ascending: false });

      if (threadsError) throw threadsError;

      // Get all participants for these threads
      const { data: allParticipants, error: allPartError } = await supabase
        .from('chat_participants')
        .select('thread_id, user_id')
        .in('thread_id', threadIds);

      if (allPartError) throw allPartError;

      // Get unique user IDs (excluding current user AND blocked users)
      const userIds = new Set<string>();
      allParticipants?.forEach(p => {
        if (p.user_id !== user.id && !blockedIds.has(p.user_id)) {
          userIds.add(p.user_id);
        }
      });

      if (userIds.size === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', Array.from(userIds));

      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      // Get last message for each thread
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('thread_id, content, created_at, is_read, recipient_id')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false });

      const lastMessageMap = new Map<string, { content: string; unread: number }>();
      lastMessages?.forEach(msg => {
        if (!lastMessageMap.has(msg.thread_id)) {
          const isUnread = msg.recipient_id === user.id && !msg.is_read;
          lastMessageMap.set(msg.thread_id, {
            content: msg.content,
            unread: isUnread ? 1 : 0
          });
        } else if (msg.recipient_id === user.id && !msg.is_read) {
          const existing = lastMessageMap.get(msg.thread_id)!;
          existing.unread++;
        }
      });

      // Build conversations (excluding blocked users)
      const convs: Conversation[] = [];
      threads?.forEach(thread => {
        // Find other participant
        const otherParticipant = allParticipants?.find(
          p => p.thread_id === thread.id && p.user_id !== user.id
        );

        if (otherParticipant && !blockedIds.has(otherParticipant.user_id)) {
          const profile = profileMap.get(otherParticipant.user_id);
          const lastMsg = lastMessageMap.get(thread.id);

          if (profile) {
            convs.push({
              threadId: thread.id,
              userId: otherParticipant.user_id,
              userName: profile.full_name || 'Unknown User',
              userAvatar: profile.avatar_url || '',
              lastMessage: lastMsg?.content || 'No messages yet',
              unreadCount: lastMsg?.unread || 0,
              updatedAt: thread.updated_at
            });
          }
        }
      });

      setConversations(convs);
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      
      // Retry with exponential backoff
      if (retryCount < maxRetries) {
        console.log(`Retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => loadConversations(retryCount + 1), backoffMs);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to load conversations. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadThreadMessages = async (threadId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('thread_id', threadId)
        .eq('recipient_id', user.id);

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error: any) {
      console.error('Failed to load messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !selectedThreadId || (!newMessage.trim() && !attachmentFile)) return;

    // Client-side content moderation - block before sending
    if (newMessage.trim()) {
      const { moderateContent } = await import('@/utils/strictModerationService');
      const result = moderateContent(newMessage.trim());
      if (result.blocked) {
        sonnerToast.error(result.reason || 'Your message contains words or content that are not allowed on this platform. Please remove any profanity, threats, sexual or illegal content.');
        return;
      }
    }

    setSending(true);
    let attachmentKey: string | undefined;

    // Upload attachment if present
    if (attachmentFile) {
      setUploadingAttachment(true);
      try {
        const fileExt = attachmentFile.name.split('.').pop();
        const filePath = `${user.id}/attachments/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(filePath, attachmentFile);

        if (uploadError) throw uploadError;

        attachmentKey = filePath;
      } catch (error: any) {
        sonnerToast.error('Failed to upload attachment');
        setUploadingAttachment(false);
        setSending(false);
        return;
      }
      setUploadingAttachment(false);
    }

    try {
      const { error } = await supabase.functions.invoke('send-thread-message', {
        body: {
          thread_id: selectedThreadId,
          content: newMessage.trim() || '(Attachment)',
          attachment_storage_key: attachmentKey,
          attachment_caption: attachmentFile?.name
        }
      });

      if (error) throw error;

      setNewMessage("");
      setAttachmentFile(null);
      loadThreadMessages(selectedThreadId);
      loadConversations(); // Refresh conversation list
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const downloadAttachment = async (storageKey: string, caption: string) => {
    try {
      // Get signed URL from storage bucket
      const { data, error } = await supabase.storage
        .from('message-attachments')
        .createSignedUrl(storageKey, 3600); // 1 hour expiry

      if (error) throw error;

      if (data.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error: any) {
      console.error('Failed to download attachment:', error);
      toast({
        title: "Error",
        description: "Failed to download attachment",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-65px)]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-65px)]">
        {/* Left Sidebar - Conversations */}
        <div className="w-[380px] border-r bg-card flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold">Messages</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <p className="text-muted-foreground">No conversations yet</p>
                <p className="text-sm text-muted-foreground mt-2">Start messaging sellers from product pages</p>
              </div>
            ) : (
              <div>
                {conversations.map((conv) => (
                  <div
                    key={conv.threadId}
                    onClick={() => {
                      setSelectedThreadId(conv.threadId);
                      setSelectedUserProfile({
                        id: conv.userId,
                        name: conv.userName,
                        avatar: conv.userAvatar
                      });
                      loadThreadMessages(conv.threadId);
                    }}
                    className={`p-4 cursor-pointer transition-colors border-b hover:bg-accent/50 ${
                      selectedThreadId === conv.threadId ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={conv.userAvatar} />
                          <AvatarFallback className="text-lg font-semibold">
                            {conv.userName[0]}
                          </AvatarFallback>
                        </Avatar>
                        {conv.unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                            {conv.unreadCount}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold truncate">{conv.userName}</p>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Side - Active Conversation */}
        <div className="flex-1 flex flex-col bg-background">
          {selectedThreadId && selectedUserProfile ? (
            <>
              {/* Header */}
              <div className="p-4 border-b bg-card flex items-center gap-3">
                <Link to={`/profile/${selectedUserProfile.id}`}>
                  <Avatar className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity">
                    <AvatarImage src={selectedUserProfile.avatar} />
                    <AvatarFallback>{selectedUserProfile.name[0]}</AvatarFallback>
                  </Avatar>
                </Link>
                <div>
                  <Link to={`/profile/${selectedUserProfile.id}`}>
                    <h3 className="font-semibold hover:underline cursor-pointer">{selectedUserProfile.name}</h3>
                  </Link>
                  <p className="text-xs text-muted-foreground">Active now</p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-4 max-w-4xl mx-auto">
                  {messages.map((msg) => {
                    const isSender = msg.sender_id === user?.id;
                    const isEditing = editingMessageId === msg.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 group ${isSender ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        {!isSender && (
                          <Link to={`/profile/${selectedUserProfile.id}`}>
                            <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                              <AvatarImage src={selectedUserProfile.avatar} />
                              <AvatarFallback className="text-xs">
                                {selectedUserProfile.name[0]}
                              </AvatarFallback>
                            </Avatar>
                          </Link>
                        )}
                        <div className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-center gap-1 ${isSender ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div
                              className={`max-w-md rounded-2xl px-4 py-2 ${
                                isSender
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    className="text-sm h-8 bg-background text-foreground"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleEditMessage(msg.id, editingContent);
                                      } else if (e.key === 'Escape') {
                                        setEditingMessageId(null);
                                        setEditingContent("");
                                      }
                                    }}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => handleEditMessage(msg.id, editingContent)}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      setEditingContent("");
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                              )}
                              {msg.attachment_storage_key && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-2 gap-2"
                                  onClick={() => downloadAttachment(msg.attachment_storage_key!, msg.attachment_caption || 'attachment')}
                                >
                                  <Download className="h-4 w-4" />
                                  <span className="text-xs">{msg.attachment_caption || 'Download Attachment'}</span>
                                </Button>
                              )}
                            </div>
                            {/* Edit/Delete buttons - only for sender's messages */}
                            {isSender && !isEditing && (
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setEditingMessageId(msg.id);
                                    setEditingContent(msg.content);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteMessage(msg.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 px-2">
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 border-t bg-card">
                <div className="max-w-4xl mx-auto space-y-3">
                  <FileAttachmentUpload
                    onFileSelect={setAttachmentFile}
                    onClear={() => setAttachmentFile(null)}
                    selectedFile={attachmentFile}
                    uploading={uploadingAttachment}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Message..."
                      className="rounded-full"
                    />
                    <Button 
                      onClick={sendMessage} 
                      disabled={sending || uploadingAttachment || (!newMessage.trim() && !attachmentFile)}
                      size="icon"
                      className="shrink-0 rounded-full"
                    >
                      {sending || uploadingAttachment ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Send className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-xl font-semibold mb-2">Your Messages</p>
                <p className="text-muted-foreground">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
