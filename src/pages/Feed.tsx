import { useState } from 'react';
import { CreatePost } from '@/components/CreatePost';
import { PostsFeed } from '@/components/PostsFeed';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Search } from 'lucide-react';

export default function Feed() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Community Feed</h1>
            <p className="text-muted-foreground">
              Share updates, news, and insights about AI agents and software
            </p>
          </div>

          {user ? (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search posts, users, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <CreatePost />
              <PostsFeed searchQuery={searchQuery} />
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg mb-4">Please log in to view and create posts</p>
              <Button asChild>
                <Link to="/login">Log In</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
