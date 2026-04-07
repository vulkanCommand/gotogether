import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "./components/AppShell";
import BottomNav from "./components/BottomNav";
import HomeScreen from "./pages/HomeScreen";
import OnboardingScreen from "./pages/OnboardingScreen";
import LoginScreen from "./pages/LoginScreen";
import TripsScreen from "./pages/TripsScreen";
import LiveScreen from "./pages/LiveScreen";
import ExpensesScreen from "./pages/ExpensesScreen";
import ProfileScreen from "./pages/ProfileScreen";
import CreateGroupScreen from "./pages/CreateGroupScreen";
import TripCreateScreen from "./pages/TripCreateScreen";
import TripOverviewScreen from "./pages/TripOverviewScreen";
import ItineraryScreen from "./pages/ItineraryScreen";
import AddExpenseScreen from "./pages/AddExpenseScreen";
import TripCompletionScreen from "./pages/TripCompletionScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/onboarding" element={<OnboardingScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/trips" element={<TripsScreen />} />
            <Route path="/live" element={<LiveScreen />} />
            <Route path="/expenses" element={<ExpensesScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/create-group" element={<CreateGroupScreen />} />
            <Route path="/trip-create" element={<TripCreateScreen />} />
            <Route path="/trip-overview" element={<TripOverviewScreen />} />
            <Route path="/itinerary" element={<ItineraryScreen />} />
            <Route path="/add-expense" element={<AddExpenseScreen />} />
            <Route path="/trip-complete" element={<TripCompletionScreen />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </AppShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
