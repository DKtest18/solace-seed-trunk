import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { ShoppingBag, Briefcase, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { FeaturedProducts } from '@/components/FeaturedProducts';

export default function Index() {
  const { user } = useAuth();
  const { hasRole: isSeller } = useHasRole('seller');

  return (
    <div className="min-h-screen">
      {/* Pre-launch waitlist banner */}
      <div className="bg-primary-soft border-y border-primary/30 py-3 px-4 text-center">
        <p className="text-sm font-medium text-primary">
          DK AI Marketplace is in development — official launch later this year.
          Join the waitlist below to be among the first.
        </p>
      </div>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="eyebrow mb-6">FOUNDING SELLERS WANTED</div>
        <h1 className="text-5xl md:text-6xl font-display font-semibold tracking-tight text-gray-900 mb-6">
          The marketplace for AI{' '}
          <span className="text-primary">builders &amp; buyers</span>.
        </h1>
        <p className="text-lg text-slate-700 max-w-2xl mx-auto mb-3">
          Buy and sell AI agents, automations, prompts, and digital tools. Connect with verified experts.
        </p>
        <p className="accent-serif text-lg text-slate-600 mb-10">
          Made by AI, made for AI. — DK
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button asChild variant="hero">
            <Link to="/signup">
              <ShoppingBag className="mr-2 h-5 w-5" />
              Join the waitlist
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="bg-white border-primary text-primary rounded-full px-6 py-3 font-medium"
          >
            <Link to="/signup">Join as Founding Seller</Link>
          </Button>
        </div>
      </section>


      {/* Two-Column Value Prop Section */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-8">
            <h2 className="font-display text-2xl font-semibold mb-4">For Buyers</h2>
            <ul className="list-disc list-inside space-y-2 text-slate-700">
              <li>Browse AI agents, automations, prompts, and digital tools</li>
              <li>Buy directly from the builders who made them</li>
              <li>Secure checkout powered by Stripe</li>
              <li>Instant access to your purchases after payment</li>
            </ul>
          </Card>
          <Card className="p-8">
            <h2 className="font-display text-2xl font-semibold mb-4">For Sellers</h2>
            <ul className="list-disc list-inside space-y-2 text-slate-700">
              <li>0% platform fee on your first 20 platform sales — launch promo</li>
              <li>Payments go directly to your own Stripe account</li>
              <li>You keep everything except Stripe's standard payment processing fees</li>
              <li>Founding seller perks: priority placement, custom badge</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* Featured Products Carousel */}
      <FeaturedProducts />

      {/* Seller CTA: role-aware */}
      {user && (
        <section className="container mx-auto px-4 py-16 bg-background">
          <Card className="max-w-3xl mx-auto rounded-2xl border-2">
            <CardHeader className="text-center">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-primary" />
              <CardTitle className="text-3xl">
                {isSeller ? 'Create a New Listing' : 'Become a Seller'}
              </CardTitle>
              <CardDescription className="text-lg">
                {isSeller
                  ? 'List your next AI agent or software product on the marketplace'
                  : 'Start selling your AI agents and software solutions on our marketplace'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isSeller && (
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
              )}
              <Button asChild size="lg" className="w-full rounded-full">
                <Link to={isSeller ? '/create-product' : '/seller-onboarding'}>
                  <Briefcase className="mr-2 h-5 w-5" />
                  {isSeller ? 'Create Listing' : 'Start Selling Today'}
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

      {/* Closing Section */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-display font-semibold mb-4">
          Be one of the first 10 founding sellers.
        </h2>
        <p className="text-slate-700 mb-8">
          We&apos;re pre-launch. The first 20 sales on the whole platform are 100% fee-free for sellers, and founding sellers get a permanent badge on their profile.
        </p>
        <Button asChild variant="hero">
          <Link to="/signup">Apply as Founding Seller</Link>
        </Button>
      </section>
    </div>
  );
}
