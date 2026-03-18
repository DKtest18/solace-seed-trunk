import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Link, useNavigate } from 'react-router-dom';
import { trackProductClick } from '@/utils/analytics';
import Autoplay from 'embla-carousel-autoplay';
import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { TrendingUp } from 'lucide-react';

export function FeaturedProducts() {
  const plugin = useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true })
  );

  // Fetch featured products specifically (is_featured = true)
  const { data: products, isLoading } = useQuery({
    queryKey: ['featured-products-slider'],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_products')
        .select('*')
        .eq('is_featured', true)
        .eq('is_published', true)
        .eq('approval_status', 'approved')
        .order('trending_score', { ascending: false, nullsFirst: false })
        .limit(8);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !products || products.length === 0) {
    return null;
  }

  return (
    <section className="container mx-auto px-4 py-16 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">Featured Products</h2>
          <p className="text-muted-foreground">
            Discover the latest AI agents and software solutions
          </p>
        </div>

        <Carousel
          plugins={[plugin.current]}
          className="w-full"
          onMouseEnter={plugin.current.stop}
          onMouseLeave={plugin.current.reset}
        >
          <CarouselContent>
            {products.map((product) => (
              <CarouselItem key={product.id} className="md:basis-1/2 lg:basis-1/3">
                <div className="p-1">
                  <Card className="h-full flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02]">
                    {product.image_url && (
                      <div className="aspect-video bg-muted overflow-hidden rounded-t-lg">
                        <img
                          src={product.image_url}
                          alt={product.title}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-1 text-lg">
                          {product.title}
                        </CardTitle>
                        <Badge variant="secondary" className="shrink-0">
                          {product.product_type}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {product.description || 'No description available'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {(product.ratings_count || 0) > 0 && (
                        <div className="mb-4">
                          <RatingDisplay 
                            rating={product.average_rating || 0} 
                            count={product.ratings_count || 0} 
                            size="sm"
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {product.tags?.slice(0, 2).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-xl font-bold text-primary">
                        ${product.price}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          {product.pricing_model === 'one_time' && 'once'}
                          {product.pricing_model === 'monthly' && '/month'}
                          {product.pricing_model === 'yearly' && '/year'}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button asChild className="w-full" onClick={() => trackProductClick(product.id)}>
                        <Link to={`/product/${product.id}`}>View Details</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex" />
          <CarouselNext className="hidden md:flex" />
        </Carousel>

        <div className="text-center mt-8">
          <Button asChild variant="outline" size="lg">
            <Link to="/marketplace">View All Products</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
