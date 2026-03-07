import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, MessageSquare, Pencil, Trash2, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface Conversation {
  userId: string;
  userName: string;
  userAvatar: string;
  lastMessage: string;
  unreadCount: number;
}

export function MessagesSidebar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (user) {
      loadConversations();

      const channel = supabase
        .channel('messages-sidebar')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages' },
          () => {
            loadConversations();
            if (selectedUserId) loadMessages(selectedUserId);
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user, selectedUserId]);

  const loadConversations = async () => {
    if (!user) return;
    try {
      const { data: blocks } = await db
        .from('dkai_user_blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

      const blockedIds = new Set<string>();
      blocks?.forEach(block => {
        if (block.blocker_id === user.id) blockedIds.add(block.blocked_id);
        else blockedIds.add(block.blocker_id);
      });

      const { data: messages, error } = await db
        .from('dkai_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const userIds = new Set<string>();
      messages?.forEach((msg) => {
        const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        if (!blockedIds.has(otherUserId)) userIds.add(otherUserId);
      });

      if (userIds.size === 0) { setConversations([]); setLoading(false); return; }

      const { data: profiles } = await db
        .from('dkai_profiles')
        .select('id, full_name, avatar_url')
        .in('id', Array.from(userIds));

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));
      const convMap = new Map<string, Conversation>();

      messages?.forEach((msg) => {
        const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        if (blockedIds.has(otherUserId)) return;
        const profile = profileMap.get(otherUserId);
        if (!convMap.has(otherUserId) && profile) {
          convMap.set(otherUserId, {
            userId: otherUserId,
            userName: profile.full_name || 'Unknown User',
            userAvatar: profile.avatar_url || '',
            lastMessage: msg.content,
            unreadCount: msg.recipient_id === user.id && !msg.is_read ? 1 : 0,
          });
        } else if (msg.recipient_id === user.id && !msg.is_read) {
          const conv = convMap.get(otherUserId);
          if (conv) conv.unreadCount++;
        }
      });

      setConversations(Array.from(convMap.values()).slice(0, 5));
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (otherUserId: string) => {
    if (!user) return;
    try {
      const { data, error } = await db
        .from('dkai_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      setMessages(data || []);
      await db.from('dkai_messages').update({ is_read: true }).eq('recipient_id', user.id).eq('sender_id', otherUserId);
    } catch (error: any) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedUserId || !newMessage.trim()) return;
    setSending(true);
    try {
      const { error } = await db.from('dkai_messages').insert({
        sender_id: user.id,
        recipient_id: selectedUserId,
        content: newMessage.trim(),
      });
      if (error) throw error;
      setNewMessage('');
      loadMessages(selectedUserId);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) return;
    try {
      const { error } = await db
        .from('dkai_messages')
        .update({ content: editContent.trim(), edited_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', user?.id);
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: editContent.trim() } : m));
      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to edit message', variant: 'destructive' });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.from('messages').delete().eq('id', messageId).eq('sender_id', user?.id);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast({ title: 'Message deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
    }
  };

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  return (
    <aside className="w-full h-full bg-card flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Messages</h3>
          </div>
          {totalUnread > 0 && (
            <Badge variant="default" className="rounded-full">{totalUnread}</Badge>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">No messages yet</p>
        </div>
      ) : selectedUserId ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 border-b bg-muted/30 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)} className="h-8 px-2">← Back</Button>
            <p className="font-medium text-base truncate">
              {conversations.find((c) => c.userId === selectedUserId)?.userName}
            </p>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`group relative max-w-[85%] rounded-lg p-3 ${
                    msg.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {editingMessageId === msg.id ? (
                      <div className="flex flex-col gap-2">
                        <Input value={editContent} onChange={(e) => setEditContent(e.target.value)} className="text-sm h-8 bg-background text-foreground" autoFocus />
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMessageId(null)}><X className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditMessage(msg.id)}><Check className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="break-words text-sm">{msg.content}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {msg.sender_id === user?.id && (
                          <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-0.5 bg-card rounded-md shadow-sm border">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteMessage(msg.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 border-t shrink-0">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !sending && sendMessage()}
                placeholder="Type a message..."
                className="text-sm"
              />
              <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="icon" className="shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {conversations.map((conv) => (
              <div
                key={conv.userId}
                onClick={() => { setSelectedUserId(conv.userId); loadMessages(conv.userId); }}
                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={conv.userAvatar} />
                    <AvatarFallback className="text-xs">{conv.userName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm truncate">{conv.userName}</p>
                      {conv.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 px-1.5 text-xs rounded-full">{conv.unreadCount}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </aside>
  );
}
