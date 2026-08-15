import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Loader2, User, Globe, MapPin, Calendar, Edit, MessageCircle, Flag,
  Users, ShieldX, CheckCircle2, Star, PackageOpen, MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { ReportUserModal } from '@/components/ReportUserModal';
import { toast } from 'sonner';
import { OnlineStatus } from '@/components/OnlineStatus';
import { BlockUserButton } from '@/components/BlockUserButton';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { format } from 'date-fns';
import { LinkedInVerifiedBadge } from '@/components/LinkedInVerifiedBadge';
import { Linkedin, Briefcase, GraduationCap } from 'lucide-react';
import { ProfileDetailSections } from '@/components/profile/ProfileDetailSections';
import { ProfileStatusFrame } from '@/components/profile/ProfileStatusFrame';
import { EducationItem, ExperienceItem, parseJsonArray } from '@/types/profile';
import { normalizeLinkedInUrl } from '@/lib/profileUrls';



interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  creator_name?: string | null;
  bio: string | null;
  expanded_bio?: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  country: string | null;
  created_at: string;
  is_verified?: boolean | null;
  is_founding_seller?: boolean | null;
  skills?: unknown;
  experience?: unknown;
  education?: unknown;
  headline?: string | null;
  is_linkedin_verified?: boolean | null;
  linkedin_url?: string | null;
  open_to_work?: boolean | null;
  open_to_roles?: string | null;
  is_hiring?: boolean | null;
  hiring_roles?: string | null;

}


interface Product {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  is_published: boolean;
  moderation_status: string;
  product_type?: string | null;
  description?: string | null;
}

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  product_id: string;
  user_id: string;
  reviewer?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

type TabKey = 'products' | 'reviews' | 'about';

export default function PublicProfile() {
  const { username } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('products');
  
  const { isBlocked, isBlockedByUser, hasBlockRelationship } = useUserBlocks();

  useEffect(() => {
    if (username) fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username || '');

      const { data: profileData, error } = isUUID
        ? await db.from('dkai_profiles').select('*').eq('id', username).single()
        : await db.from('dkai_profiles').select('*').eq('username', username).single();

      if (error) throw error;
      setProfile(profileData);

      const { data: productsData } = await db
        .from('dkai_products')
        .select('id, title, price, image_url, is_published, moderation_status, product_type, description')
        .eq('seller_id', profileData.id)
        .eq('is_published', true)
        .eq('review_status', 'approved');

      const list = (productsData || []) as Product[];
      setProducts(list);

      // Fetch reviews for this seller's products (read-only, for Reviews tab)
      const productIds = list.map(p => p.id);
      if (productIds.length > 0) {
        const { data: reviewData } = await db
          .from('dkai_reviews')
          .select('id, rating, comment, created_at, product_id, user_id')
          .in('product_id', productIds)
          .order('created_at', { ascending: false })
          .limit(50);
        const rows = (reviewData || []) as ReviewRow[];

        const reviewerIds = Array.from(new Set(rows.map(r => r.user_id)));
        let reviewerMap: Record<string, ReviewRow['reviewer']> = {};
        if (reviewerIds.length > 0) {
          const { data: reviewerProfiles } = await db
            .from('dkai_profiles')
            .select('id, full_name, username, avatar_url')
            .in('id', reviewerIds);
          (reviewerProfiles || []).forEach((p: any) => {
            reviewerMap[p.id] = { full_name: p.full_name, username: p.username, avatar_url: p.avatar_url };
          });
        }
        setReviews(rows.map(r => ({ ...r, reviewer: reviewerMap[r.user_id] || null })));
      } else {
        setReviews([]);
      }
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
    if (!user) return navigate('/login');
    if (hasBlockRelationship(profile?.id || '')) {
      toast.error('Cannot message this user');
      return;
    }
    if (profile?.id) navigate(`/messages?seller=${profile.id}`);
  };

  const handleReportUser = () => {
    if (!user) return navigate('/login');
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
            <h1 className="font-display text-2xl font-semibold mb-2 text-gray-900">Profile not found</h1>
            <p className="text-muted-foreground mb-4">This user doesn't exist</p>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const skills = parseJsonArray<string>(profile.skills);
  const experience = parseJsonArray<ExperienceItem>(profile.experience);
  const education = parseJsonArray<EducationItem>(profile.education);
  const currentRole = experience.find((e) => e.is_current_role) || experience[0];
  const latestSchool = education[0];
  const linkedInUrl = normalizeLinkedInUrl(profile.linkedin_url);


  const tabBtn = (key: TabKey, label: string, count?: number) => {
    const active = activeTab === key;
    return (
      <button
        key={key}
        onClick={() => setActiveTab(key)}
        className={`text-sm font-medium pb-3 -mb-px transition-colors ${
          active
            ? 'text-primary border-b-2 border-primary'
            : 'text-muted-foreground hover:text-gray-900'
        }`}
      >
        {label}{typeof count === 'number' && <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>}
      </button>
    );
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-6 pt-12 pb-16">
          {/* Hero card — LinkedIn style banner + overlapping avatar */}
          <Card className="rounded-2xl overflow-hidden">
            <div className="aspect-[4/1] w-full bg-background-soft">
              {profile.banner_url && (
                <img src={profile.banner_url} alt={`${profile.full_name || 'User'} banner`} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="px-6 sm:px-8 pb-8">
              <a
                href={`/profile/${profile.id}`}
                data-userid={profile.id}
                className="profile-link block w-fit -mt-14 sm:-mt-16 mb-4 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <ProfileStatusFrame
                  openToWork={profile.open_to_work}
                  openToRoles={profile.open_to_roles}
                  isHiring={profile.is_hiring}
                  hiringRoles={profile.hiring_roles}
                >
                  <Avatar className="w-28 h-28 sm:w-32 sm:h-32 border-4 border-background shadow-lg">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-background-soft">
                      <User className="h-12 w-12 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </ProfileStatusFrame>
              </a>



            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-3xl font-display font-semibold text-gray-900">
                      {profile.full_name || profile.creator_name || 'Anonymous User'}
                    </h1>
                    <OnlineStatus userId={profile.id} />
                    {profile.is_linkedin_verified && <LinkedInVerifiedBadge />}
                  </div>
                  <p className="text-muted-foreground mb-3">
                    {profile.headline || `@${profile.username || profile.id.slice(0, 8)}`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {linkedInUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="h-4 w-4 mr-2" /> Open LinkedIn
                      </a>
                    </Button>
                  )}
                  {isOwnProfile ? (
                    <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
                      <Edit className="h-4 w-4 mr-2" /> Edit profile
                    </Button>
                  ) : userBlockedMe ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-background-soft text-muted-foreground text-sm">
                      <ShieldX className="h-4 w-4" />
                      You cannot interact with this user
                    </div>
                  ) : (
                    <>
                      {!iBlockedUser && (
                        <Button variant="navCta" size="sm" onClick={handleSendMessage}>
                          <MessageCircle className="h-4 w-4 mr-2" /> Message
                        </Button>
                      )}
                      
                      <BlockUserButton userId={profile.id} userName={profile.full_name || profile.username || undefined} size="sm" />
                      <Button variant="outline" size="sm" onClick={handleReportUser}>
                        <Flag className="h-4 w-4 mr-2" /> Report
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {profile.bio ? (
                <p className="text-gray-700 mb-4 max-w-2xl whitespace-pre-wrap">{profile.bio}</p>
              ) : (
                <p className="text-muted-foreground italic mb-4">No description provided.</p>
              )}

              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {skills.map((skill) => (
                    <span key={skill} className="bg-primary-soft text-primary text-sm px-3 py-1 rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-4 items-center mt-4 text-sm">
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Member since {format(new Date(profile.created_at), 'MMM yyyy')}
                </span>
                {profile.is_verified && (
                  <span className="inline-flex items-center gap-1 bg-primary-soft text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Verified seller
                  </span>
                )}
                {profile.is_founding_seller && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-1 rounded-full">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Founding seller
                  </span>
                )}
                {linkedInUrl && (
                  <a
                    href={linkedInUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn profile"
                    className="inline-flex items-center gap-1 text-[#0A66C2] hover:underline"
                  >
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </a>
                )}
                {profile.country && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {profile.country}
                  </span>
                )}
                {profile.website_url && (
                  <a
                    href={profile.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" /> Website
                  </a>
                )}
              </div>

                {(currentRole || latestSchool) && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mt-5 pt-5 border-t border-border">
                    {currentRole && (
                      <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        {currentRole.company || currentRole.title}
                      </span>
                    )}
                    {latestSchool && (
                      <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        {latestSchool.school}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>


          {/* Tabs */}
          <div className="flex gap-6 border-b border-border mt-8">
            {tabBtn('products', 'Products', products.length)}
            {tabBtn('reviews', 'Reviews', reviews.length)}
            {tabBtn('about', 'About')}
          </div>

          {/* Tab content */}
          {activeTab === 'products' && (
            products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-8">
                {products.map((product) => (
                  <Card
                    key={product.id}
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="cursor-pointer overflow-hidden hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                  >
                    <div className="aspect-video w-full bg-background-soft overflow-hidden">
                      {product.image_url && (
                        <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      {product.product_type && (
                        <span className="inline-flex self-start bg-primary-soft text-primary text-xs font-medium px-2.5 py-1 rounded-full mb-3">
                          {product.product_type}
                        </span>
                      )}
                      <h3 className="font-display text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{product.title}</h3>
                      {product.description && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{product.description}</p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-border">
                        <span className="text-xl font-display font-semibold text-gray-900">${product.price}</span>
                        <Button variant="dark" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                          <Link to={`/product/${product.id}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <PackageOpen className="mx-auto mb-4 text-muted-foreground" size={48} />
                <h2 className="font-display text-xl font-semibold text-gray-900 mb-2">No products yet</h2>
                <p className="text-muted-foreground max-w-md mx-auto">This seller hasn't listed any products yet.</p>
              </div>
            )
          )}

          {activeTab === 'reviews' && (
            reviews.length > 0 ? (
              <div className="flex flex-col gap-4 py-8">
                {reviews.map((review) => (
                  <div key={review.id} className="p-5 rounded-xl border border-border bg-white">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={review.reviewer?.avatar_url || undefined} />
                        <AvatarFallback>
                          {review.reviewer?.full_name?.[0] || review.reviewer?.username?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {review.reviewer?.full_name || review.reviewer?.username || 'Anonymous'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(review.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-border'}`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-gray-700 text-sm leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <MessageSquare className="mx-auto mb-4 text-muted-foreground" size={48} />
                <h2 className="font-display text-xl font-semibold text-gray-900 mb-2">No reviews yet</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Be the first to leave one after a purchase or call.
                </p>
              </div>
            )
          )}

          {activeTab === 'about' && (
            <div className="py-8 space-y-6">
              <ProfileDetailSections
                about={profile.expanded_bio || profile.bio}
                experience={experience}
                education={education}
                skills={skills}
              />

              <Card className="p-6 sm:p-8 rounded-2xl">
                <h2 className="font-display text-xl font-semibold text-gray-900 mb-5">Details</h2>
                <ul className="space-y-2 text-gray-700">
                  <li>
                    <span className="text-muted-foreground">Member since:</span>{' '}
                    {format(new Date(profile.created_at), 'MMMM yyyy')}
                  </li>
                  {profile.country && (
                    <li><span className="text-muted-foreground">Country:</span> {profile.country}</li>
                  )}
                  {profile.website_url && (
                    <li>
                      <span className="text-muted-foreground">Website:</span>{' '}
                      <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {profile.website_url}
                      </a>
                    </li>
                  )}
                  {linkedInUrl && (
                    <li>
                      <span className="text-muted-foreground">LinkedIn:</span>{' '}
                      <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] hover:underline">
                        View profile
                      </a>
                    </li>
                  )}
                </ul>
              </Card>
            </div>
          )}

        </div>
      </div>

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
