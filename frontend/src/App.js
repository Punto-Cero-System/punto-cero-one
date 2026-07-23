import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Lenis from '@studio-freight/lenis';
import './App.css';
import HomePage from './pages/HomePage';
import InvestorRequestPage from './pages/InvestorRequestPage';
import InvestorRoomPreview from './pages/InvestorRoomPreview';
import InvestorPitchDeckPage from './pages/InvestorPitchDeckPage';

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
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/investor-room" element={<InvestorRoomPreview />} />
          <Route path="/request-access" element={<InvestorRequestPage />} />
          <Route path="/investor-pitch-deck" element={<InvestorPitchDeckPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
