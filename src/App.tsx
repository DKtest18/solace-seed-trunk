import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";


import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { CookieBanner } from "@/components/CookieBanner";
import { RouteSeo } from "@/components/RouteSeo";

import '@/i18n';
import Index from "./pages/Index";
import BlogTopAiAgentMarketplaces from "./pages/BlogTopAiAgentMarketplaces";
import Marketplace from "./pages/Marketplace";
import ProductDetail from "./pages/ProductDetail";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CheckEmail from "./pages/CheckEmail";
import EmailVerified from "./pages/EmailVerified";

import CreateProduct from "./pages/CreateProduct";
import EditProduct from "./pages/EditProduct";
import MyProducts from "./pages/MyProducts";
import SellerProducts from "./pages/SellerProducts";
import SellerDashboard from "./pages/SellerDashboard";
import SellerOrders from "./pages/SellerOrders";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTransactions from "./pages/AdminTransactions";
import PurchaseHistory from "./pages/PurchaseHistory";
import SellerEarnings from "./pages/SellerEarnings";
import SellerBalances from "./pages/SellerBalances";
import SellerOnboardingChecklist from "./pages/SellerOnboardingChecklist";
import SellerOnboardingIdentity from "./pages/SellerOnboardingIdentity";
import SellerOnboardingTerms from "./pages/SellerOnboardingTerms";
import SellerOnboardingPayment from "./pages/SellerOnboardingPayment";
import Wishlist from "./pages/Wishlist";
import Disputes from "./pages/Disputes";
import SellerProfile from "./pages/SellerProfile";
import ProfileSettings from "./pages/ProfileSettings";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import TopProducts from "./pages/TopProducts";
import TopSellers from "./pages/TopSellers";
import Statistics from "./pages/Statistics";

import ManualPayment from "./pages/ManualPayment";

import Notifications from "./pages/Notifications";
import AdminPaymentConfirmations from "./pages/AdminPaymentConfirmations";
import AdminRefundDisputes from "./pages/AdminRefundDisputes";
import AdminRefundRequests from "./pages/AdminRefundRequests";
import RefundRequest from "./pages/RefundRequest";
import AdminDisputes from "./pages/AdminDisputes";
import PayoutRequests from "./pages/PayoutRequests";
import Checkout from "./pages/Checkout";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import PayPalReturn from "./pages/PayPalReturn";

import SellerPaymentSettings from "./pages/SellerPaymentSettings";
import AdminPaymentSettings from "./pages/AdminPaymentSettings";
import NotFound from "./pages/NotFound";
import Legal from "./pages/Legal";
import LegalOverview from "./pages/LegalOverview";
import ContentPolicy from "./pages/ContentPolicy";
import LicenseTerms from "./pages/LicenseTerms";
import AdminReports from "./pages/AdminReports";
import AdminEmailLogs from "./pages/AdminEmailLogs";
import Invites from "./pages/Invites";

import MySubscriptions from "./pages/MySubscriptions";
import SellerSubscriptions from "./pages/SellerSubscriptions";
// EscrowManagement page retired — escrow flow disabled platform-wide
import AdminFeaturedProducts from "./pages/AdminFeaturedProducts";
import AdminDisputeManagement from "./pages/AdminDisputeManagement";
import DisputeDetail from "./pages/DisputeDetail";
import SoldProducts from "./pages/SoldProducts";
import SellerAnalytics from "./pages/SellerAnalytics";
import SellerCoupons from "./pages/SellerCoupons";
import SellerStorefrontSettings from "./pages/SellerStorefrontSettings";
import SellerProductQA from "./pages/SellerProductQA";
import { PayoutRouteGuard } from '@/components/PayoutRouteGuard';
import { Seller2FAGuard } from "@/components/Seller2FAGuard";
import { AdminRouteGuard } from "@/components/AdminRouteGuard";
import { WaitlistGuard } from "@/components/WaitlistGuard";

import Waitlist from "./pages/Waitlist";
import AdminWaitlist from "./pages/AdminWaitlist";
import Impressum from "./pages/Impressum";
import RefundPolicy from "./pages/RefundPolicy";
import Privacy from "./pages/Privacy";
import TermsOfService from "./pages/TermsOfService";
import CookiePolicy from "./pages/CookiePolicy";
import CookieSettings from "./pages/CookieSettings";
import SellerGuidelines from "./pages/SellerGuidelines";
import About from "./pages/About";
import AdminDeliveryThresholds from "./pages/AdminDeliveryThresholds";
import AdminProductReview from "./pages/AdminProductReview";
import AdminUsers from "./pages/AdminUsers";
import { SellerLayout } from "@/components/SellerLayout";
import SellerSetupRequirements from "./pages/SellerSetupRequirements";
import BuyerHandoverCredentials from "./pages/BuyerHandoverCredentials";
import SellerCredentialAccess from "./pages/SellerCredentialAccess";
import AdminAccounts from "./pages/AdminAccounts";
import { MfaChallengeGate } from "@/components/MfaChallengeGate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min cache
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <MfaChallengeGate>
            <RouteSeo />
            <>

              <Navbar />
              {/* AI Assistant deaktiviert – zum Aktivieren: <Chatbot /> einkommentieren */}
              {/* <Chatbot /> */}
              <CookieBanner />
              <Routes>
            <Route path="/seller-guidelines" element={<SellerGuidelines />} />
            <Route path="/admin/delivery-thresholds" element={<AdminRouteGuard><AdminDeliveryThresholds /></AdminRouteGuard>} />
            <Route path="/admin/product-review" element={<AdminRouteGuard><AdminProductReview /></AdminRouteGuard>} />
            <Route path="/admin/products" element={<Navigate to="/admin/product-review" replace />} />
            <Route path="/admin/users" element={<AdminRouteGuard><AdminUsers /></AdminRouteGuard>} />
            <Route path="/admin/accounts" element={<AdminRouteGuard><AdminAccounts /></AdminRouteGuard>} />
            <Route path="/" element={<Index />} />
            <Route path="/waitlist" element={<Waitlist />} />
            {/* Blog temporarily disabled — visitors are redirected to the homepage */}
            <Route path="/blog/top-ai-agent-marketplaces" element={<Navigate to="/" replace />} />

            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/paypal-return" element={<PayPalReturn />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/datenschutz" element={<Privacy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/agb" element={<TermsOfService />} />
            <Route path="/cookies" element={<CookiePolicy />} />
            <Route path="/cookie-settings" element={<CookieSettings />} />
                <Route path="/auth/check-email" element={<CheckEmail />} />
                <Route path="/auth/verified" element={<EmailVerified />} />
                
            <Route path="/top-products" element={<TopProducts />} />
            <Route path="/top-sellers" element={<TopSellers />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/admin/waitlist" element={<AdminRouteGuard><AdminWaitlist /></AdminRouteGuard>} />
            <Route path="/create-product" element={<Seller2FAGuard><SellerLayout title="Create Product"><CreateProduct /></SellerLayout></Seller2FAGuard>} />
            <Route path="/edit-product/:id" element={<Seller2FAGuard><SellerLayout title="Edit Product"><EditProduct /></SellerLayout></Seller2FAGuard>} />

            <Route path="/seller-dashboard/products" element={<Seller2FAGuard><MyProducts /></Seller2FAGuard>} />
            <Route path="/seller-products" element={<Seller2FAGuard><SellerProducts /></Seller2FAGuard>} />
            <Route path="/seller-dashboard" element={<Seller2FAGuard><SellerDashboard /></Seller2FAGuard>} />
            <Route path="/seller-orders" element={<Seller2FAGuard><SellerOrders /></Seller2FAGuard>} />
            <Route path="/seller-dashboard/analytics" element={<Seller2FAGuard><SellerAnalytics /></Seller2FAGuard>} />
            <Route path="/seller-dashboard/coupons" element={<Seller2FAGuard><SellerCoupons /></Seller2FAGuard>} />
            <Route path="/seller-dashboard/storefront" element={<Seller2FAGuard><SellerStorefrontSettings /></Seller2FAGuard>} />
            <Route path="/admin" element={<AdminRouteGuard><AdminDashboard /></AdminRouteGuard>} />
            <Route path="/admin/transactions" element={<AdminRouteGuard><AdminTransactions /></AdminRouteGuard>} />
            <Route path="/purchases" element={<WaitlistGuard><PurchaseHistory /></WaitlistGuard>} />
            <Route path="/earnings" element={<Seller2FAGuard><PayoutRouteGuard><SellerLayout title="Earnings"><SellerEarnings /></SellerLayout></PayoutRouteGuard></Seller2FAGuard>} />
            <Route path="/balances" element={<Seller2FAGuard><SellerLayout title="Balances"><SellerBalances /></SellerLayout></Seller2FAGuard>} />
            <Route path="/seller-onboarding" element={<Seller2FAGuard><SellerLayout title="Seller Onboarding"><SellerOnboardingChecklist /></SellerLayout></Seller2FAGuard>} />
            <Route path="/seller-onboarding/identity" element={<Seller2FAGuard><SellerLayout title="Identity Verification"><SellerOnboardingIdentity /></SellerLayout></Seller2FAGuard>} />
            <Route path="/seller-onboarding/terms" element={<Seller2FAGuard><SellerLayout title="Seller Terms & Conditions"><SellerOnboardingTerms /></SellerLayout></Seller2FAGuard>} />
            <Route path="/seller-onboarding/payment" element={<Seller2FAGuard><PayoutRouteGuard><SellerLayout title="Payment Setup"><SellerOnboardingPayment /></SellerLayout></PayoutRouteGuard></Seller2FAGuard>} />

            <Route path="/wishlist" element={<WaitlistGuard><Wishlist /></WaitlistGuard>} />
            <Route path="/disputes" element={<WaitlistGuard><Disputes /></WaitlistGuard>} />
            {/* Own seller payment settings must stay above /seller/:sellerId so Stripe return URLs never hit the public seller profile lookup. */}
            <Route path="/seller/payment-settings" element={<Seller2FAGuard><PayoutRouteGuard><SellerLayout title="Payment Settings"><SellerPaymentSettings /></SellerLayout></PayoutRouteGuard></Seller2FAGuard>} />
            <Route path="/seller/:sellerId" element={<SellerProfile />} />
            <Route path="/settings" element={<WaitlistGuard><ProfileSettings /></WaitlistGuard>} />
            <Route path="/profile" element={<WaitlistGuard><Profile /></WaitlistGuard>} />
            <Route path="/u/:username" element={<PublicProfile />} />

            <Route path="/manual-payment" element={<WaitlistGuard><ManualPayment /></WaitlistGuard>} />
            
            <Route path="/notifications" element={<WaitlistGuard><Notifications /></WaitlistGuard>} />
            <Route path="/admin/payment-confirmations" element={<AdminRouteGuard><AdminPaymentConfirmations /></AdminRouteGuard>} />
            <Route path="/admin/refund-disputes" element={<AdminRouteGuard><AdminRefundDisputes /></AdminRouteGuard>} />
            <Route path="/admin/disputes" element={<AdminRouteGuard><AdminDisputes /></AdminRouteGuard>} />
            <Route path="/payouts" element={<Seller2FAGuard><PayoutRouteGuard><SellerLayout title="Payouts"><PayoutRequests /></SellerLayout></PayoutRouteGuard></Seller2FAGuard>} />
            
            
            <Route path="/seller-dashboard/payment-settings" element={<Seller2FAGuard><PayoutRouteGuard><SellerLayout title="Payment Settings"><SellerPaymentSettings /></SellerLayout></PayoutRouteGuard></Seller2FAGuard>} />
            <Route path="/seller-payment-settings" element={<Navigate to="/seller/payment-settings" replace />} />
            <Route path="/seller-dashboard/qa" element={<Seller2FAGuard><SellerLayout title="Product Q&A"><SellerProductQA /></SellerLayout></Seller2FAGuard>} />

            <Route path="/admin/payment-settings" element={<AdminRouteGuard><AdminPaymentSettings /></AdminRouteGuard>} />
            <Route path="/profile/:username" element={<PublicProfile />} />
            <Route path="/purchase-history" element={<WaitlistGuard><PurchaseHistory /></WaitlistGuard>} />
            <Route path="/content-policy" element={<ContentPolicy />} />
            <Route path="/legal/content-policy" element={<ContentPolicy />} />
            <Route path="/legal" element={<LegalOverview />} />

            <Route path="/legal/imprint" element={<Impressum />} />
            <Route path="/legal/licenses" element={<LicenseTerms />} />
            <Route path="/legal/refund" element={<RefundPolicy />} />
            <Route path="/legal/refund-policy" element={<RefundPolicy />} />
            <Route path="/legal/:type" element={<Legal />} />

            <Route path="/admin/reports" element={<AdminRouteGuard><AdminReports /></AdminRouteGuard>} />
            <Route path="/admin/email-logs" element={<AdminRouteGuard><AdminEmailLogs /></AdminRouteGuard>} />
            <Route path="/invites" element={<WaitlistGuard><Invites /></WaitlistGuard>} />

            <Route path="/my-subscriptions" element={<WaitlistGuard><MySubscriptions /></WaitlistGuard>} />
            <Route path="/seller-subscriptions" element={<Seller2FAGuard><SellerLayout title="My Subscribers"><SellerSubscriptions /></SellerLayout></Seller2FAGuard>} />
            {/* /admin/escrow route retired */}
            <Route path="/admin/featured" element={<AdminRouteGuard><AdminFeaturedProducts /></AdminRouteGuard>} />
            <Route path="/admin/dispute-management" element={<AdminRouteGuard><AdminDisputeManagement /></AdminRouteGuard>} />
            <Route path="/dispute/:id" element={<WaitlistGuard><DisputeDetail /></WaitlistGuard>} />
            <Route path="/sold-products" element={<Seller2FAGuard><SellerLayout title="Sold Products"><SoldProducts /></SellerLayout></Seller2FAGuard>} />
            <Route path="/refund-request/:orderId" element={<RefundRequest />} />
            <Route path="/admin/refund-requests" element={<AdminRouteGuard><AdminRefundRequests /></AdminRouteGuard>} />
            <Route path="/seller/product/:id/setup-requirements" element={<Seller2FAGuard><SellerLayout title="Setup Requirements"><SellerSetupRequirements /></SellerLayout></Seller2FAGuard>} />
            <Route path="/order/:orderId/handover" element={<WaitlistGuard><BuyerHandoverCredentials /></WaitlistGuard>} />
            <Route path="/seller/order/:orderId/credentials" element={<Seller2FAGuard><SellerLayout title="Buyer Credentials"><SellerCredentialAccess /></SellerLayout></Seller2FAGuard>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
              <Footer />
            </>

          </MfaChallengeGate>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
