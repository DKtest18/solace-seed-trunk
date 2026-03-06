import { Card } from './ui/card';
import { Button } from './ui/button';
import { MessageSquare } from 'lucide-react';
import { ClickableAvatar } from './ClickableAvatar';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SellerCardProps {
  sellerId: string;
  sellerName?: string | null;
  sellerUsername?: string | null;
  sellerAvatar?: string | null;
}

export function SellerCard({ sellerId, sellerName, sellerUsername, sellerAvatar }: SellerCardProps) {
  const navigate = useNavigate();

  const handleContactSeller = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-message-thread", {
        body: { recipient_id: sellerId }
      });

      if (error) throw error;

      if (data?.thread_id) {
        navigate(`/messages?thread=${data.thread_id}`);
      }
    } catch (error) {
      console.error("Error creating thread:", error);
      toast.error("Failed to start conversation");
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4 mb-4">
        <ClickableAvatar
          userId={sellerId}
          avatarUrl={sellerAvatar}
          username={sellerUsername || sellerName}
          size="lg"
        />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Sold by</p>
          <a 
            href={`/profile/${sellerId}`}
            className="font-semibold hover:underline"
            onClick={(e) => {
              e.preventDefault();
              navigate(`/profile/${sellerId}`);
            }}
          >
            {sellerName || sellerUsername || "Unknown Seller"}
          </a>
        </div>
      </div>
      <Button className="w-full" variant="outline" onClick={handleContactSeller}>
        <MessageSquare className="h-4 w-4 mr-2" />
        Message Seller
      </Button>
    </Card>
  );
}
