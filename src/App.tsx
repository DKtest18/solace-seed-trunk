import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserSettingsProvider } from "@/contexts/UserSettingsContext";
import { MeetingInfoModalProvider } from "@/contexts/MeetingInfoModalContext";
import { Navbar } from "@/components/Navbar";
import { Chatbot } from "@/components/Chatbot";
import { CookieConsent } from "@/components/CookieConsent";
import '@/i18n';
import Index from "./pages/Index";
import Marketplace from "./pages/Marketplace";
import ProductDetail from "./pages/ProductDetail";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CheckEmail from "./pages/CheckEmail";
import EmailVerified from "./pages/EmailVerified";
import Feed from "./pages/Feed";
import CreateProduct from "./pages/CreateProduct";
import EditProduct from "./pages/EditProduct";
import MyProducts from "./pages/MyProducts";
import ProductCreationChecklist from "./pages/ProductCreationChecklist";
import ProductCreationBasic from "./pages/ProductCreationSteps/BasicInfoStep";
import ProductCreationImages from "./pages/ProductCreationSteps/ImagesStep";
import ProductCreationPricing from "./pages/ProductCreationSteps/PricingStep";
import ProductCreationPayment from "./pages/ProductCreationSteps/PaymentStep";
import ProductCreationReview from "./pages/ProductCreationSteps/ReviewStep";
import SellerDashboard from "./pages/SellerDashboard";
import SellerOrders from "./pages/SellerOrders";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTransactions from "./pages/AdminTransactions";
import PurchaseHistory from "./pages/PurchaseHistory";
import SellerEarnings from "./pages/SellerEarnings";
import SellerBalances from "./pages/SellerBalances";
import SellerOnboardingChecklist from "./pages/SellerOnboardingChecklist";
import SellerOnboardingIdentity from "./pages/SellerOnboardingIdentity";
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
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import AdminPaymentConfirmations from "./pages/AdminPaymentConfirmations";
import AdminRefundDisputes from "./pages/AdminRefundDisputes";
import AdminDisputes from "./pages/AdminDisputes";
import PayoutRequests from "./pages/PayoutRequests";
import Checkout from "./pages/Checkout";
import Achievements from "./pages/Achievements";
import SellerPaymentSettings from "./pages/SellerPaymentSettings";
import AdminPaymentSettings from "./pages/AdminPaymentSettings";
import Community from "./pages/Community";
import CommunityPost from "./pages/CommunityPost";
import NotFound from "./pages/NotFound";
import Legal from "./pages/Legal";
import LegalOverview from "./pages/LegalOverview";
import AdminReports from "./pages/AdminReports";
import AdminEmailLogs from "./pages/AdminEmailLogs";
import Invites from "./pages/Invites";

import MySubscriptions from "./pages/MySubscriptions";
import SellerSubscriptions from "./pages/SellerSubscriptions";
import EscrowManagement from "./pages/EscrowManagement";
import AdminFeaturedProducts from "./pages/AdminFeaturedProducts";
import AdminDisputeManagement from "./pages/AdminDisputeManagement";
import DisputeDetail from "./pages/DisputeDetail";
import Meetings from "./pages/Meetings";
import MyMeetings from "./pages/MyMeetings";
import SoldProducts from "./pages/SoldProducts";
import SellerMeetings from "./pages/SellerMeetings";
import SellerPortfolio from "./pages/SellerPortfolio";
import Portfolio from "./pages/Portfolio";
import MeetingRoomPage from "./pages/MeetingRoomPage";
import JoinMeetingPage from "./pages/JoinMeetingPage";
import JoinMeetingByCode from "./pages/JoinMeetingByCode";
import PublicBookingPage from "./pages/PublicBookingPage";
import MeetingInviteResponse from "./pages/MeetingInviteResponse";
import SellerAnalytics from "./pages/SellerAnalytics";
import { Seller2FAGuard } from "@/components/Seller2FAGuard";
import { AdminRouteGuard } from "@/components/AdminRouteGuard";
import { WaitlistGuard } from "@/components/WaitlistGuard";
import { Optional2FAPrompt } from "@/components/Optional2FAPrompt";
import Waitlist from "./pages/Waitlist";
import AdminWaitlist from "./pages/AdminWaitlist";
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
          <UserSettingsProvider>
            <MeetingInfoModalProvider>
              <Navbar />
              {/* AI Assistant deaktiviert – zum Aktivieren: <Chatbot /> einkommentieren */}
              {/* <Chatbot /> */}
              <CookieConsent />
              <Optional2FAPrompt />
              <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/waitlist" element={<Waitlist />} />
            <Route path="/marketplace" element={<WaitlistGuard><Marketplace /></WaitlistGuard>} />
            <Route path="/product/:id" element={<WaitlistGuard><ProductDetail /></WaitlistGuard>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/auth/check-email" element={<CheckEmail />} />
            <Route path="/auth/verified" element={<EmailVerified />} />
            <Route path="/feed" element={<WaitlistGuard><Feed /></WaitlistGuard>} />
            <Route path="/top-products" element={<WaitlistGuard><TopProducts /></WaitlistGuard>} />
            <Route path="/top-sellers" element={<WaitlistGuard><TopSellers /></WaitlistGuard>} />
            <Route path="/statistics" element={<WaitlistGuard><Statistics /></WaitlistGuard>} />
            <Route path="/admin/waitlist" element={<AdminRouteGuard><AdminWaitlist /></AdminRouteGuard>} />
            <Route path="/create-product" element={<Seller2FAGuard><ProductCreationChecklist /></Seller2FAGuard>} />
            <Route path="/create-product/basic" element={<Seller2FAGuard><ProductCreationBasic /></Seller2FAGuard>} />
            <Route path="/create-product/images" element={<Seller2FAGuard><ProductCreationImages /></Seller2FAGuard>} />
            <Route path="/create-product/pricing" element={<Seller2FAGuard><ProductCreationPricing /></Seller2FAGuard>} />
            <Route path="/create-product/payment" element={<Seller2FAGuard><ProductCreationPayment /></Seller2FAGuard>} />
            <Route path="/create-product/features" element={<Seller2FAGuard><CreateProduct /></Seller2FAGuard>} />
            <Route path="/create-product/details" element={<Seller2FAGuard><CreateProduct /></Seller2FAGuard>} />
            <Route path="/create-product/review" element={<Seller2FAGuard><ProductCreationReview /></Seller2FAGuard>} />
            <Route path="/edit-product/:id" element={<Seller2FAGuard><EditProduct /></Seller2FAGuard>} />
            <Route path="/seller-dashboard/products" element={<Seller2FAGuard><MyProducts /></Seller2FAGuard>} />
            <Route path="/seller-dashboard" element={<Seller2FAGuard><SellerDashboard /></Seller2FAGuard>} />
            <Route path="/seller-orders" element={<Seller2FAGuard><SellerOrders /></Seller2FAGuard>} />
            <Route path="/seller-dashboard/analytics" element={<Seller2FAGuard><SellerAnalytics /></Seller2FAGuard>} />
            <Route path="/admin" element={<AdminRouteGuard><AdminDashboard /></AdminRouteGuard>} />
            <Route path="/admin/transactions" element={<AdminRouteGuard><AdminTransactions /></AdminRouteGuard>} />
            <Route path="/purchases" element={<PurchaseHistory />} />
            <Route path="/earnings" element={<Seller2FAGuard><SellerEarnings /></Seller2FAGuard>} />
            <Route path="/balances" element={<Seller2FAGuard><SellerBalances /></Seller2FAGuard>} />
            <Route path="/seller-onboarding" element={<Seller2FAGuard><SellerOnboardingChecklist /></Seller2FAGuard>} />
            <Route path="/seller-onboarding/identity" element={<Seller2FAGuard><SellerOnboardingIdentity /></Seller2FAGuard>} />
            <Route path="/seller-onboarding/payment" element={<Seller2FAGuard><SellerOnboardingPayment /></Seller2FAGuard>} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/disputes" element={<Disputes />} />
            <Route path="/seller/:sellerId" element={<SellerProfile />} />
            <Route path="/settings" element={<ProfileSettings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/u/:username" element={<PublicProfile />} />

            <Route path="/manual-payment" element={<ManualPayment />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/admin/payment-confirmations" element={<AdminRouteGuard><AdminPaymentConfirmations /></AdminRouteGuard>} />
            <Route path="/admin/refund-disputes" element={<AdminRouteGuard><AdminRefundDisputes /></AdminRouteGuard>} />
            <Route path="/admin/disputes" element={<AdminRouteGuard><AdminDisputes /></AdminRouteGuard>} />
            <Route path="/payouts" element={<PayoutRequests />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/seller-dashboard/payment-settings" element={<Seller2FAGuard><SellerPaymentSettings /></Seller2FAGuard>} />
            <Route path="/seller-payment-settings" element={<Seller2FAGuard><SellerPaymentSettings /></Seller2FAGuard>} />
            <Route path="/admin/payment-settings" element={<AdminRouteGuard><AdminPaymentSettings /></AdminRouteGuard>} />
            <Route path="/community" element={<Community />} />
            <Route path="/community/:id" element={<CommunityPost />} />
            <Route path="/profile/:username" element={<PublicProfile />} />
            <Route path="/purchase-history" element={<PurchaseHistory />} />
            <Route path="/legal" element={<LegalOverview />} />
            <Route path="/legal/:type" element={<Legal />} />
            <Route path="/admin/reports" element={<AdminRouteGuard><AdminReports /></AdminRouteGuard>} />
            <Route path="/admin/email-logs" element={<AdminRouteGuard><AdminEmailLogs /></AdminRouteGuard>} />
            <Route path="/invites" element={<Invites />} />

            <Route path="/my-subscriptions" element={<MySubscriptions />} />
            <Route path="/seller-subscriptions" element={<Seller2FAGuard><SellerSubscriptions /></Seller2FAGuard>} />
            <Route path="/admin/escrow" element={<AdminRouteGuard><EscrowManagement /></AdminRouteGuard>} />
            <Route path="/admin/featured" element={<AdminRouteGuard><AdminFeaturedProducts /></AdminRouteGuard>} />
            <Route path="/admin/dispute-management" element={<AdminRouteGuard><AdminDisputeManagement /></AdminRouteGuard>} />
            <Route path="/dispute/:id" element={<DisputeDetail />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/meetings/join/:joinSlug" element={<JoinMeetingPage />} />
            <Route path="/join-meeting" element={<JoinMeetingByCode />} />
            <Route path="/my-meetings" element={<MyMeetings />} />
            <Route path="/meeting-room/:roomCode" element={<MeetingRoomPage />} />
            <Route path="/meeting-invite/:token" element={<MeetingInviteResponse />} />
            <Route path="/book/:username" element={<PublicBookingPage />} />
            <Route path="/sold-products" element={<Seller2FAGuard><SoldProducts /></Seller2FAGuard>} />
            <Route path="/portfolio" element={<Seller2FAGuard><Portfolio /></Seller2FAGuard>} />
            <Route path="/seller-dashboard/meetings" element={<Seller2FAGuard><SellerMeetings /></Seller2FAGuard>} />
            <Route path="/seller-dashboard/portfolio" element={<Seller2FAGuard><SellerPortfolio /></Seller2FAGuard>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </MeetingInfoModalProvider>
          </UserSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
