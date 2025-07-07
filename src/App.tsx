import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import { Episodes } from "./pages/Episodes";
import { ChannelOptimization } from "./pages/ChannelOptimization";
import { GlobalOptimization } from "./pages/GlobalOptimization";
import { Ideas } from "./pages/Ideas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/episodes/:channelId" element={<ProtectedRoute><Episodes /></ProtectedRoute>} />
            <Route path="/optimize" element={<ProtectedRoute><GlobalOptimization /></ProtectedRoute>} />
            <Route path="/optimize/:channelId" element={<ProtectedRoute><ChannelOptimization /></ProtectedRoute>} />
            <Route path="/ideas/:channelId" element={<ProtectedRoute><Ideas /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
