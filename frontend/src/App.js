import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Lenis from '@studio-freight/lenis';
import './App.css';
import HomePage from './pages/HomePage';
import InvestorRequestPage from './pages/InvestorRequestPage';
import InvestorRoomPreview from './pages/InvestorRoomPreview';
import InvestorPitchDeckPage from './pages/InvestorPitchDeckPage';
import ExecutiveSummaryPage from './pages/ExecutiveSummaryPage';
import CapitalStrategyPage from './pages/CapitalStrategyPage';
import CapitalHubPage from './pages/CapitalHubPage';
import JoinPage from './pages/JoinPage';
import InvestorSetupPage from './pages/InvestorSetupPage';
import InvestorPortalPage from './pages/InvestorPortalPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminDocumentsPage from './pages/AdminDocumentsPage';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import ProtectedInvestorRoute from './components/ProtectedInvestorRoute';
import AuthCallback from './components/AuthCallback';
import NewsPage from './pages/NewsPage';
import VideosPage from './pages/VideosPage';
import JobsPage from './pages/JobsPage';
import CompaniesPage from './pages/CompaniesPage';
import EventsPage from './pages/EventsPage';
import AiPage from './pages/AiPage';
import CommunityPage from './pages/CommunityPage';
import ProfilePage from './pages/ProfilePage';
import { AuthProvider } from './contexts/AuthContext';
import { CommunityAuthProvider } from './contexts/CommunityAuthContext';

function App() {
  useEffect(() => {
    // Initialize Lenis smooth scrolling
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <CommunityAuthProvider>
            <AppRouter />
          </CommunityAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

/**
 * AppRouter — synchronously reads the URL fragment to detect an OAuth callback
 * (`#session_id=...`) BEFORE any protected route runs. This avoids the race
 * where ProtectedRoute would kick the user to /admin/login prior to session
 * exchange.  Uses `useLocation().hash` (reactive) — never window.location.hash.
 */
function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/investor-room" element={<InvestorRoomPreview />} />
      <Route path="/request-access" element={<InvestorRequestPage />} />
      <Route path="/investor-pitch-deck" element={<InvestorPitchDeckPage />} />
      <Route path="/executive-summary" element={<ExecutiveSummaryPage />} />
      <Route path="/capital-strategy" element={<CapitalStrategyPage />} />
      <Route path="/capital" element={<CapitalHubPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/noticias" element={<NewsPage />} />
      <Route path="/videos" element={<VideosPage />} />
      <Route path="/empleos" element={<JobsPage />} />
      <Route path="/empresas" element={<CompaniesPage />} />
      <Route path="/eventos" element={<EventsPage />} />
      <Route path="/ia" element={<AiPage />} />
      <Route path="/comunidad" element={<CommunityPage />} />
      <Route path="/perfil" element={<ProfilePage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/investor/setup" element={<InvestorSetupPage />} />
      <Route
        path="/investor-portal"
        element={
          <ProtectedInvestorRoute>
            <InvestorPortalPage />
          </ProtectedInvestorRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedAdminRoute>
            <AdminDashboardPage />
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/admin/documents"
        element={
          <ProtectedAdminRoute>
            <AdminDocumentsPage />
          </ProtectedAdminRoute>
        }
      />
    </Routes>
  );
}

export default App;
