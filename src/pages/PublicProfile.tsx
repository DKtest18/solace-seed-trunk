import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, Globe, MapPin, Calendar, Edit, MessageCircle, Flag, Package, Users, ShieldX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { ReportUserModal } from '@/components/ReportUserModal';
import { toast } from 'sonner';
import { FollowButton } from '@/components/FollowButton';
import { useFollowers } from '@/hooks/useFollowers';
import { OnlineStatus } from '@/components/OnlineStatus';
import { BlockUserButton } from '@/components/BlockUserButton';
import { useUserBlocks } from '@/hooks/useUserBlocks';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  country: string | null;
  created_at: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  is_published: boolean;
  moderation_status: string;
}

export default function PublicProfile() {
  const { username } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const { followersCount, followingCount } = useFollowers(profile?.id);
  const { isBlocked, isBlockedByUser, hasBlockRelationship } = useUserBlocks();

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      // Fetch profile by username OR by ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username || '');
      
      const { data: profileData, error } = isUUID
        ? await db.from('dkai_profiles').select('*').eq('id', username).single()
        : await db.from('dkai_profiles').select('*').eq('username', username).single();

      if (error) throw error;
      setProfile(profileData);

      // Fetch user's products
      const { data: productsData } = await db
        .from('dkai_products')
        .select('id, title, price, image_url, is_published, moderation_status')
        .eq('seller_id', profileData.id)
        .eq('is_published', true)
        .eq('moderation_status', 'approved');

      setProducts(productsData || []);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast.error('Profile not found');
    } finally {
      setLoading(false);
    }
  };

  const isOwnProfile = user?.id === profile?.id;
  const userBlockedMe = profile?.id ? isBlockedByUser(profile.id) : false;
  const iBlockedUser = profile?.id ? isBlocked(profile.id) : false;

  const handleSendMessage = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (hasBlockRelationship(profile?.id || '')) {
      toast.error('Cannot message this user');
      return;
    }
    if (profile?.id) {
      navigate(`/messages?seller=${profile.id}`);
    }
  };

  const handleReportUser = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setReportModalOpen(true);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Profile not found</h1>
            <p className="text-muted-foreground mb-4">This user doesn't exist</p>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Banner */}
        <div 
          className="h-48 w-full bg-gradient-to-r from-primary/20 to-primary/10 relative"
          style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          <div className="absolute inset-0 bg-black/20" />
        </div>

        <div className="max-w-4xl mx-auto p-4 md:p-8 -mt-16 relative">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex flex-col items-center md:items-start -mt-20 md:-mt-24">
                  <a 
                    href={`/profile/${profile.id}`}
                    data-userid={profile.id}
                    className="profile-link cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="bg-muted">
                        <User className="h-16 w-16" />
                      </AvatarFallback>
                    </Avatar>
                  </a>
                  <div className="flex flex-col gap-2 mt-4">
                    {isOwnProfile ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/profile/edit')}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                    ) : userBlockedMe ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground">
                        <ShieldX className="h-4 w-4" />
                        <span className="text-sm">You cannot interact with this user</span>
                      </div>
                    ) : (
                      <>
                        {!iBlockedUser && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleSendMessage}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Message
                          </Button>
                        )}
                        <FollowButton userId={profile.id} size="sm" />
                        <BlockUserButton userId={profile.id} userName={profile.full_name || profile.username || undefined} size="sm" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReportUser}
                        >
                          <Flag className="h-4 w-4 mr-2" />
                          Report User
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-4 mt-4 md:mt-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-3xl font-bold">{profile.full_name || 'Anonymous User'}</h1>
                      <OnlineStatus userId={profile.id} />
                    </div>
                    <p className="text-muted-foreground">@{profile.username || profile.id.slice(0, 8)}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span className="font-semibold">{followersCount}</span>
                        <span className="text-muted-foreground">followers</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">{followingCount}</span>
                        <span className="text-muted-foreground">following</span>
                      </div>
                    </div>
                  </div>
                  

                  {profile.bio ? (
                    <p className="text-foreground whitespace-pre-wrap">{profile.bio}</p>
                  ) : (
                    <p className="text-muted-foreground italic">No description provided.</p>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {profile.country && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {profile.country}
                      </div>
                    )}
                    {profile.website_url && (
                      <a
                        href={profile.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <Globe className="h-4 w-4" />
                        Website
                      </a>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Joined {new Date(profile.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {products.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Products by {profile.full_name || profile.username}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product) => (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      {product.image_url && (
                        <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                          <img
                            src={product.image_url}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <h3 className="font-semibold truncate">{product.title}</h3>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="secondary">${product.price}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {profile && (
        <ReportUserModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          targetUserId={profile.id}
          targetUserName={profile.full_name || profile.username || undefined}
        />
      )}
    </AppLayout>
  );
}
