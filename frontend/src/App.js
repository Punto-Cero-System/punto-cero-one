import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Lenis from '@studio-freight/lenis';
import './App.css';
import HomePage from './pages/HomePage';
import InvestorRequestPage from './pages/InvestorRequestPage';
import InvestorRoomPreview from './pages/InvestorRoomPreview';
import InvestorPitchDeckPage from './pages/InvestorPitchDeckPage';
import ExecutiveSummaryPage from './pages/ExecutiveSummaryPage';
import CapitalStrategyPage from './pages/CapitalStrategyPage';
import CapitalHubPage from './pages/CapitalHubPage';
import InvestorSetupPage from './pages/InvestorSetupPage';
import InvestorPortalPage from './pages/InvestorPortalPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import ProtectedInvestorRoute from './components/ProtectedInvestorRoute';
import { AuthProvider } from './contexts/AuthContext';

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
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/investor-room" element={<InvestorRoomPreview />} />
            <Route path="/request-access" element={<InvestorRequestPage />} />
            <Route path="/investor-pitch-deck" element={<InvestorPitchDeckPage />} />
            <Route path="/executive-summary" element={<ExecutiveSummaryPage />} />
            <Route path="/capital-strategy" element={<CapitalStrategyPage />} />
            <Route path="/capital" element={<CapitalHubPage />} />
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
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
