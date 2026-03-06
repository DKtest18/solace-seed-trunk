import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { ShoppingBag, MessageSquare, Sparkles, Shield, Zap, Briefcase, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { HeroBackground } from '@/components/HeroBackground';
import { FeaturedProducts } from '@/components/FeaturedProducts';

export default function Index() {
  const { user } = useAuth();
  const { hasRole: isSeller } = useHasRole('seller');
  const feature1 = useScrollAnimation();
  const feature2 = useScrollAnimation();
  const feature3 = useScrollAnimation();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="animated-gradient-bg container mx-auto px-4 py-20 text-center relative overflow-hidden">
        <HeroBackground />
        <div className="max-w-4xl mx-auto space-y-6 relative z-10 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Welcome to <span className="text-primary">DK AI MARKETPLACE</span>
          </h1>
          <p className="text-lg italic text-muted-foreground/80 font-medium">
            "Made by AI made for AI. -DK"
          </p>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The ultimate marketplace for AI agents and software solutions. Buy, sell, and discover powerful tools to automate your workflow.
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-6">
            <Button asChild size="lg" className="text-lg px-8 rounded-full shadow-lg hover:shadow-xl transition-shadow">
              <Link to="/marketplace">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Explore Marketplace
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8 rounded-full">
              <Link to="/feed">
                <MessageSquare className="mr-2 h-5 w-5" />
                Join Community
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 bg-background">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div
            ref={feature1.ref}
            className={`transition-all duration-700 ${
              feature1.isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-10'
            }`}
            style={{ transitionDelay: '100ms' }}
          >
            <Card className="h-full hover-scale rounded-2xl border-2">
              <CardHeader>
                <Sparkles className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Powerful AI Solutions</CardTitle>
                <CardDescription>
                  Discover cutting-edge AI agents and software tools designed to enhance productivity and automate tasks
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div
            ref={feature2.ref}
            className={`transition-all duration-700 ${
              feature2.isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-10'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            <Card className="h-full hover-scale rounded-2xl border-2">
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Secure Payments</CardTitle>
                <CardDescription>
                  All transactions are protected with enterprise-grade security and encrypted payment processing
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div
            ref={feature3.ref}
            className={`transition-all duration-700 ${
              feature3.isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-10'
            }`}
            style={{ transitionDelay: '300ms' }}
          >
            <Card className="h-full hover-scale rounded-2xl border-2">
              <CardHeader>
                <Zap className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Active Community</CardTitle>
                <CardDescription>
                  Connect with other users, share insights, and stay updated with the latest AI innovations and releases
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Featured Products Carousel */}
      <FeaturedProducts />

      {/* Become a Seller CTA */}
      {user && !isSeller && (
        <section className="container mx-auto px-4 py-16 bg-background">
          <Card className="max-w-3xl mx-auto rounded-2xl border-2">
            <CardHeader className="text-center">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-primary" />
              <CardTitle className="text-3xl">Become a Seller</CardTitle>
              <CardDescription className="text-lg">
                Start selling your AI agents and software solutions on our marketplace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-600" />
                  <p className="font-semibold">Secure Payments</p>
                  <p className="text-muted-foreground">Get paid your way</p>
                </div>
                <div className="text-center">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-600" />
                  <p className="font-semibold">Global Reach</p>
                  <p className="text-muted-foreground">Sell to customers worldwide</p>
                </div>
                <div className="text-center">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-600" />
                  <p className="font-semibold">Easy Setup</p>
                  <p className="text-muted-foreground">Start in minutes</p>
                </div>
              </div>
              <Button asChild size="lg" className="w-full rounded-full">
                <Link to="/seller-onboarding">
                  <Briefcase className="mr-2 h-5 w-5" />
                  Start Selling Today
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* CTA Section */}
      {!user && (
        <section className="container mx-auto px-4 py-16 bg-background">
          <Card className="max-w-2xl mx-auto text-center rounded-2xl border-2">
            <CardHeader>
              <CardTitle className="text-3xl">Ready to Get Started?</CardTitle>
              <CardDescription className="text-lg">
                Join our community today and unlock access to premium AI tools
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4 justify-center">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/signup">Sign Up Free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/login">Log In</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
