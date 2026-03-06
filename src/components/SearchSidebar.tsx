import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function SearchSidebar() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/marketplace?search=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <aside className="w-full h-full bg-sidebar p-4 flex flex-col">
      <div className="space-y-4">
        <h3 className="font-semibold text-sidebar-foreground flex items-center gap-2">
          <Search className="h-4 w-4" />
          Quick Search
        </h3>
        <form onSubmit={handleSearch} className="space-y-2">
          <div className="relative">
            <Input
              placeholder="Search products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pr-8 bg-sidebar-accent"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button type="submit" size="sm" className="w-full">
            Search
          </Button>
        </form>
        <div className="text-xs text-muted-foreground">
          Search for products, sellers, or categories
        </div>
      </div>
    </aside>
  );
}
