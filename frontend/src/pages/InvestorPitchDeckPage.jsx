import React, { useEffect, useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ExternalLink, Sparkles, Brain, Database, Lock, Zap,
  FileText, Users, BarChart, CreditCard, Layers, Globe, TrendingUp, Building2,
  Scale, Target, MessageCircle, Mail, Download
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const SLIDE_TITLES = {
  1: 'Cover', 2: 'The Opportunity', 3: 'The Vision', 4: 'Shared Technology Core',
  5: 'The First Vertical (Punto Cero Legal)', 6: '18-Country Opportunity',
  7: 'Why the Architecture Matters', 8: 'The Ecosystem', 9: 'The Roadmap',
  10: 'Business Model', 11: 'Current Stage', 12: 'The Conversation',
};

// Session id — persists per browser tab
const getSessionId = () => {
  const key = 'pcs_deck_session';
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = 'sess-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    sessionStorage.setItem(key, sid);
  }
  return sid;
};

const sendEvent = (payload) => {
  try {
    const body = JSON.stringify(payload);
    // Beacon survives page unload; fallback to fetch keepalive
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(`${API}/api/pitch-deck/events`, blob);
    } else {
      fetch(`${API}/api/pitch-deck/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  } catch (_) { /* silent */ }
};

// Hook: measures dwell time per .pitch-slide-track element and posts to backend.
const usePitchDeckAnalytics = () => {
  useEffect(() => {
    const sessionId = getSessionId();
    const ua = (navigator.userAgent || '').slice(0, 400);
    const active = new Map(); // element → entry-timestamp

    const flush = (el, forceCompleted = false) => {
      const started = active.get(el);
      if (!started) return;
      const duration_ms = Math.max(0, Math.round(performance.now() - started));
      active.delete(el);
      if (duration_ms < 400) return; // ignore quick scroll-throughs
      const slide_number = Number(el.dataset.slideNumber);
      const slide_title = el.dataset.slideTitle || '';
      sendEvent({
        session_id: sessionId,
        slide_number,
        slide_title,
        duration_ms,
        completed: forceCompleted || true,
        user_agent: ua,
      });
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          if (!active.has(entry.target)) {
            active.set(entry.target, performance.now());
          }
        } else {
          flush(entry.target);
        }
      });
    }, { threshold: [0, 0.35, 0.7] });

    const els = document.querySelectorAll('.pitch-slide-track');
    els.forEach((el) => observer.observe(el));

    const beforeUnload = () => {
      active.forEach((_, el) => flush(el, true));
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', beforeUnload);

    return () => {
      beforeUnload();
      observer.disconnect();
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', beforeUnload);
    };
  }, []);
};

// ============================================================
// SLIDE 01 — COVER
// ============================================================
const Slide01 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '10rem 2rem 6rem',
      background: 'radial-gradient(ellipse at center, #0d2543 0%, #0B1F3A 60%, #071527 100%)',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Orbital rings */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 180, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '900px',
          height: '900px',
          borderRadius: '50%',
          border: '1px dashed rgba(0, 200, 150, 0.08)',
          pointerEvents: 'none'
        }}
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 240, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '1300px',
          height: '1300px',
          borderRadius: '50%',
          border: '1px dashed rgba(212, 175, 55, 0.05)',
          pointerEvents: 'none'
        }}
      />

      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 1.25rem',
            background: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            borderRadius: '100px',
            marginBottom: '3rem'
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D4AF37' }}
          />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#D4AF37', letterSpacing: '0.25em' }}>
            SLIDE 01 · INVESTOR PITCH DECK
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1, delay: 0.2 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(3rem, 8vw, 7rem)',
            fontWeight: 700,
            lineHeight: 0.95,
            color: '#FFFFFF',
            marginBottom: '2rem',
            letterSpacing: '-0.04em'
          }}
        >
          Punto Cero
          <br />
          <span style={{
            background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            System
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 1, delay: 0.5 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2rem',
            marginBottom: '3rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00C896' }} />
            <span style={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 300 }}>
              Un núcleo
            </span>
          </div>
          <div style={{ width: '40px', height: '1px', background: 'rgba(0, 200, 150, 0.4)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(0, 200, 150, 0.6)' }} />
            <span style={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 300 }}>
              Múltiples verticales
            </span>
          </div>
          <div style={{ width: '40px', height: '1px', background: 'rgba(212, 175, 55, 0.4)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#D4AF37' }} />
            <span style={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 300 }}>
              Un ecosistema conectado
            </span>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          style={{
            fontSize: 'clamp(1.05rem, 1.6vw, 1.3rem)',
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.6)',
            maxWidth: '700px',
            fontWeight: 300
          }}
        >
          Construyendo la infraestructura tecnológica para profesionales,
          emprendedores y empresas en toda Latinoamérica.
        </motion.p>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 02 — LA OPORTUNIDAD (LIGHT)
// ============================================================
const Slide02 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: '#F5F7FA',
      color: '#1E1E1E',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <SlideNumber n="02" label="LA OPORTUNIDAD" color="#0B1F3A" />

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            fontWeight: 300,
            lineHeight: 1.05,
            color: '#0B1F3A',
            marginBottom: '2rem',
            letterSpacing: '-0.03em',
            maxWidth: '900px'
          }}
        >
          Latinoamérica no es un único mercado.
          <br />
          <span style={{ fontWeight: 700 }}>Es una red de contextos.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            fontSize: '1.15rem',
            lineHeight: 1.7,
            color: 'rgba(30, 30, 30, 0.65)',
            maxWidth: '760px',
            marginBottom: '4rem',
            fontWeight: 300
          }}
        >
          Diferentes países, culturas, monedas, regulaciones, industrias, profesionales,
          emprendedores y empresas. La oportunidad no está en construir otra aplicación
          aislada. Está en construir una infraestructura tecnológica capaz de adaptarse
          a múltiples mercados.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '2rem',
            marginBottom: '4rem'
          }}
        >
          {[
            { n: '18', label: 'Países latinoamericanos' },
            { n: '15+', label: 'Monedas locales' },
            { n: '650M', label: 'Habitantes en la región' },
            { n: '1', label: 'Ecosistema tecnológico' }
          ].map((stat, i) => (
            <div key={i}>
              <div style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '3.5rem',
                fontWeight: 300,
                color: '#0B1F3A',
                lineHeight: 1,
                letterSpacing: '-0.03em',
                marginBottom: '0.5rem'
              }}>
                {stat.n}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'rgba(30, 30, 30, 0.55)' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          style={{
            padding: '2rem 2.5rem',
            background: 'linear-gradient(135deg, #0B1F3A 0%, #071527 100%)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '2rem',
            maxWidth: '760px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '-0.01em'
          }}>
            Mercados fragmentados.
          </div>
          <ArrowRight size={20} color="#00C896" />
          <div style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '1.4rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.01em'
          }}>
            Oportunidad conectada.
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 03 — LA VISIÓN
// ============================================================
const Slide03 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: 'linear-gradient(180deg, #071527 0%, #0B1F3A 100%)',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', textAlign: 'center' }}>
        <SlideNumber n="03" label="LA VISIÓN" color="#00C896" light />

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
            fontWeight: 300,
            lineHeight: 1,
            color: 'rgba(255, 255, 255, 0.4)',
            marginBottom: '1rem',
            letterSpacing: '-0.03em'
          }}
        >
          Esto no es una aplicación.
        </motion.h2>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(3rem, 9vw, 7rem)',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Es una plataforma.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          style={{
            fontSize: 'clamp(1rem, 1.5vw, 1.2rem)',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.55)',
            maxWidth: '700px',
            margin: '4rem auto 0',
            fontWeight: 300
          }}
        >
          Punto Cero System está construyendo una plataforma tecnológica diseñada
          para soportar múltiples verticales industriales especializadas — un núcleo
          compartido que da soporte a industrias y mercados diversos.
        </motion.p>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 04 — SHARED TECHNOLOGY CORE
// ============================================================
const Slide04 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  const capabilities = [
    { icon: Brain, label: 'IA' },
    { icon: Users, label: 'CRM' },
    { icon: Zap, label: 'Automation' },
    { icon: FileText, label: 'Documents' },
    { icon: BarChart, label: 'Analytics' },
    { icon: Lock, label: 'Security' },
    { icon: Database, label: 'Data' },
    { icon: CreditCard, label: 'Billing' }
  ];

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: 'linear-gradient(180deg, #0B1F3A 0%, #071527 100%)',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <SlideNumber n="04" label="SHARED TECHNOLOGY CORE" color="#00C896" light />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '5rem',
          alignItems: 'center',
          marginTop: '3rem'
        }}>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.8 }}
          >
            <h2 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(1.8rem, 4vw, 3rem)',
              fontWeight: 300,
              lineHeight: 1.1,
              color: '#FFFFFF',
              marginBottom: '2rem',
              letterSpacing: '-0.03em'
            }}>
              Un núcleo tecnológico.
              <br />
              <span style={{ fontWeight: 700, color: '#00C896' }}>Ocho capacidades.</span>
              <br />
              Infraestructura reutilizable.
            </h2>
            <p style={{
              fontSize: '1.05rem',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.6)',
              fontWeight: 300,
              marginBottom: '2rem'
            }}>
              El core no es una lista de features. Es una arquitectura compartida
              que alimenta todas las verticales del ecosistema — reduciendo duplicación
              y acelerando el desarrollo de industrias futuras.
            </p>

            {/* Relationship arrow */}
            <div style={{
              padding: '1.5rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px'
            }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.75rem' }}>
                ARQUITECTURA
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.95rem' }}>
                <div style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Futuras verticales</div>
                <div style={{ color: '#00C896' }}>↓</div>
                <div style={{ color: '#FFFFFF', fontWeight: 600 }}>Núcleo tecnológico compartido</div>
                <div style={{ color: '#00C896' }}>↓</div>
                <div style={{ color: '#D4AF37', fontWeight: 600 }}>Punto Cero Legal · primer producto real</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{
              position: 'relative',
              aspectRatio: '1',
              maxWidth: '500px',
              margin: '0 auto',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Orbits */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '1px dashed rgba(0, 200, 150, 0.15)'
              }}
            />

            {/* Center */}
            <div style={{
              position: 'relative',
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0, 200, 150, 0.3) 0%, rgba(11, 31, 58, 0.9) 70%)',
              border: '2px solid #00C896',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 60px rgba(0, 200, 150, 0.4)',
              zIndex: 5
            }}>
              <div style={{ fontSize: '0.7rem', color: '#FFFFFF', letterSpacing: '0.15em', fontWeight: 600 }}>CORE</div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily: '"Space Grotesk", sans-serif',
                lineHeight: 1
              }}>
                0
              </div>
            </div>

            {/* Capability nodes */}
            {capabilities.map((cap, i) => {
              const angle = (i / capabilities.length) * Math.PI * 2 - Math.PI / 2;
              const x = Math.cos(angle) * 180;
              const y = Math.sin(angle) * 180;

              return (
                <motion.div
                  key={cap.label}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={inView ? { scale: 1, opacity: 1, x, y } : { scale: 0, opacity: 0 }}
                  transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
                  style={{
                    position: 'absolute',
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(11, 31, 58, 0.9)',
                    border: '1px solid rgba(0, 200, 150, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    backdropFilter: 'blur(12px)'
                  }}
                >
                  <cap.icon size={18} color="#00C896" />
                  <div style={{ fontSize: '0.55rem', color: '#FFFFFF', fontWeight: 600 }}>
                    {cap.label}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 05 — EL PRIMER PRODUCTO REAL (PUNTO CERO LEGAL)
// ============================================================
const Slide05 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: '#FFFFFF',
      color: '#1E1E1E',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '-200px',
        right: '-200px',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 200, 150, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', position: 'relative' }}>
        <SlideNumber n="05" label="EL PRIMER PRODUCTO REAL" color="#00C896" />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '5rem',
          alignItems: 'center',
          marginTop: '3rem'
        }}>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.8 }}
          >
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.1rem',
              background: 'rgba(0, 200, 150, 0.1)',
              border: '2px solid #00C896',
              borderRadius: '100px',
              marginBottom: '2rem'
            }}>
              <Sparkles size={14} color="#00C896" />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00C896', letterSpacing: '0.15em' }}>
                LIVE EN PRODUCCIÓN · PRIMER VERTICAL COMERCIAL
              </span>
            </div>

            <h2 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              fontWeight: 700,
              lineHeight: 1,
              color: '#0B1F3A',
              marginBottom: '1.5rem',
              letterSpacing: '-0.04em'
            }}>
              Punto Cero
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #00C896 0%, #0B1F3A 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Legal
              </span>
            </h2>

            <p style={{
              fontSize: '1.1rem',
              lineHeight: 1.7,
              color: 'rgba(30, 30, 30, 0.7)',
              marginBottom: '2rem',
              fontWeight: 300
            }}>
              Primera vertical. Primer producto real. Primera prueba comercial LIVE
              de la visión tecnológica de Punto Cero System.
            </p>

            {/* Status indicator */}
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.75rem'
              }}>
                <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', fontWeight: 700, color: '#0B1F3A' }}>
                  ESTADO OPERATIVO
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#00C896' }}>
                  LIVE
                </div>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'rgba(11, 31, 58, 0.08)',
                borderRadius: '100px',
                overflow: 'hidden'
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={inView ? { width: '100%' } : { width: 0 }}
                  transition={{ duration: 1.5, delay: 0.5, ease: [0.6, 0.05, 0.01, 0.9] }}
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #00C896 0%, #D4AF37 100%)',
                    borderRadius: '100px'
                  }}
                />
              </div>
              <div style={{
                fontSize: '0.85rem',
                color: 'rgba(30, 30, 30, 0.5)',
                marginTop: '0.75rem'
              }}>
                Objetivo inmediato: escalar la adquisición de clientes y validar la tesis comercial.
              </div>
            </div>

            {/* External CTA */}
            <motion.a
              href="https://puntocerolegal.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.03, boxShadow: '0 20px 60px rgba(0, 200, 150, 0.35)' }}
              whileTap={{ scale: 0.98 }}
              className="interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1.1rem 2rem',
                background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
                color: '#FFFFFF',
                textDecoration: 'none',
                borderRadius: '100px',
                fontSize: '1rem',
                fontWeight: 700
              }}
            >
              Explorar Punto Cero Legal
              <ExternalLink size={18} />
            </motion.a>
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'rgba(30, 30, 30, 0.45)' }}>
              puntocerolegal.com · sitio web oficial
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{
              position: 'relative',
              aspectRatio: '1',
              maxWidth: '500px',
              margin: '0 auto',
              width: '100%'
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: '-20px',
                borderRadius: '50%',
                border: '1px dashed rgba(0, 200, 150, 0.4)'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '-6px',
                left: '50%',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#00C896',
                boxShadow: '0 0 20px rgba(0, 200, 150, 0.8)',
                transform: 'translateX(-50%)'
              }} />
            </motion.div>

            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '3px solid #00C896',
              boxShadow: '0 30px 80px rgba(0, 200, 150, 0.2)',
              position: 'relative'
            }}>
              <img
                src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=900&auto=format&fit=crop&q=80"
                alt="Punto Cero Legal"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(11, 31, 58, 0.2) 0%, transparent 60%, rgba(0, 200, 150, 0.15) 100%)'
              }} />
              <div style={{
                position: 'absolute',
                bottom: '10%',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '0.6rem 1.25rem',
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '100px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Scale size={16} color="#0B1F3A" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0B1F3A', letterSpacing: '0.1em' }}>
                  LEGAL TECH
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 06 — 18-COUNTRY OPPORTUNITY
// ============================================================
const Slide06 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  const countries = ['México','Guatemala','Honduras','El Salvador','Nicaragua','Costa Rica','Panamá','Rep. Dominicana','Colombia','Venezuela','Ecuador','Perú','Brasil','Bolivia','Paraguay','Chile','Argentina','Uruguay'];

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: 'linear-gradient(180deg, #0B1F3A 0%, #071527 100%)',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <SlideNumber n="06" label="OPORTUNIDAD LATINOAMERICANA" color="#D4AF37" light />

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 300,
            lineHeight: 1.05,
            color: '#FFFFFF',
            marginBottom: '3rem',
            letterSpacing: '-0.03em',
            maxWidth: '900px'
          }}
        >
          <span style={{ fontWeight: 700, background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>18 países.</span>
          <br />
          Una arquitectura.
        </motion.h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '3rem',
          alignItems: 'flex-start'
        }}>
          {/* Countries grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            style={{
              gridColumn: '1 / -2',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '0.75rem'
            }}
          >
            {countries.map((c, i) => (
              <motion.div
                key={c}
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ delay: 0.4 + i * 0.03, duration: 0.4 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.75rem',
                  background: c === 'Colombia' ? 'rgba(0, 200, 150, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${c === 'Colombia' ? 'rgba(0, 200, 150, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                  borderRadius: '10px'
                }}
              >
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: c === 'Colombia' ? '#00C896' : 'rgba(212, 175, 55, 0.5)',
                  boxShadow: c === 'Colombia' ? '0 0 8px rgba(0, 200, 150, 0.8)' : 'none',
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '0.8rem',
                  color: c === 'Colombia' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: c === 'Colombia' ? 600 : 400
                }}>
                  {c}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Architecture flow */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            style={{
              padding: '2rem',
              background: 'linear-gradient(135deg, rgba(0, 200, 150, 0.05) 0%, rgba(212, 175, 55, 0.05) 100%)',
              border: '1px solid rgba(0, 200, 150, 0.15)',
              borderRadius: '20px'
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#00C896', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '1.5rem' }}>
              ARQUITECTURA REGIONAL
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '1rem' }}>Núcleo compartido</div>
              <div style={{ color: '#00C896', fontSize: '1rem' }}>↓</div>
              <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1rem' }}>Adaptación local</div>
              <div style={{ color: '#00C896', fontSize: '1rem' }}>↓</div>
              <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1rem' }}>Mercado nacional</div>
            </div>
            <div style={{
              marginTop: '1.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.55)',
              lineHeight: 1.5
            }}>
              La visión contempla los 18 países como oportunidad a largo plazo — no como operación actual.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 07 — WHY THE ARCHITECTURE MATTERS
// ============================================================
const Slide07 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  const steps = [
    { verb: 'Construir', obj: 'el core una vez' },
    { verb: 'Reutilizar', obj: 'la infraestructura' },
    { verb: 'Adaptar', obj: 'a las industrias' },
    { verb: 'Expandir', obj: 'a través de mercados' }
  ];

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: '#F5F7FA',
      color: '#1E1E1E',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <SlideNumber n="07" label="POR QUÉ LA ARQUITECTURA IMPORTA" color="#0B1F3A" />

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 300,
            lineHeight: 1.1,
            color: '#0B1F3A',
            marginBottom: '4rem',
            letterSpacing: '-0.03em',
            maxWidth: '800px'
          }}
        >
          El core se fortalece
          <br />
          <span style={{ fontWeight: 700 }}>a medida que crece el ecosistema.</span>
        </motion.h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.5rem'
        }}>
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ delay: 0.2 + i * 0.15, duration: 0.6 }}
              style={{
                padding: '2.5rem 2rem',
                background: '#FFFFFF',
                borderRadius: '20px',
                boxShadow: '0 10px 40px rgba(11, 31, 58, 0.04)',
                border: '1px solid rgba(11, 31, 58, 0.04)',
                position: 'relative'
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0, 200, 150, 0.15) 0%, transparent 70%)',
                border: '2px solid #00C896',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#00C896',
                marginBottom: '1.5rem'
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>

              <div style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#0B1F3A',
                marginBottom: '0.3rem',
                letterSpacing: '-0.02em'
              }}>
                {step.verb}
              </div>
              <div style={{
                fontSize: '0.95rem',
                color: 'rgba(30, 30, 30, 0.6)',
                lineHeight: 1.5
              }}>
                {step.obj}.
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 08 — EL ECOSISTEMA
// ============================================================
const Slide08 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  const actors = [
    'Profesionales', 'Emprendedores', 'Empresas',
    'Desarrolladores', 'Instituciones', 'Aliados',
    'Comunidades'
  ];

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: 'linear-gradient(180deg, #071527 0%, #0B1F3A 100%)',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', textAlign: 'center' }}>
        <SlideNumber n="08" label="EL ECOSISTEMA" color="#00C896" light center />

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 300,
            lineHeight: 1.1,
            color: '#FFFFFF',
            marginBottom: '4rem',
            letterSpacing: '-0.03em'
          }}
        >
          El objetivo no es vender software.
          <br />
          <span style={{ fontWeight: 700, background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Es construir un ecosistema.
          </span>
        </motion.h2>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
          {actors.map((actor, i) => (
            <motion.div
              key={actor}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
              whileHover={{ y: -5, borderColor: '#00C896' }}
              className="interactive"
              style={{
                padding: '1.1rem 1.75rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '100px',
                fontSize: '1rem',
                fontWeight: 500,
                color: '#FFFFFF',
                fontFamily: '"Space Grotesk", sans-serif',
                transition: 'all 0.3s ease'
              }}
            >
              {actor}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          style={{
            marginTop: '4rem',
            fontSize: '1.15rem',
            color: 'rgba(255, 255, 255, 0.55)',
            fontWeight: 300,
            maxWidth: '700px',
            margin: '4rem auto 0',
            lineHeight: 1.7
          }}
        >
          Un entorno donde los participantes interactúan, colaboran, acceden a tecnología
          y crean oportunidades — a través de industrias y mercados.
        </motion.div>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 09 — ROADMAP
// ============================================================
const Slide09 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  const phases = [
    { phase: 'AHORA', title: 'Completar Punto Cero Legal', color: '#00C896', active: true },
    { phase: 'SIGUIENTE', title: 'Lanzamiento y validación comercial', color: '#00C896' },
    { phase: 'EXPANSIÓN', title: 'Verticales adicionales', color: '#D4AF37' },
    { phase: 'FUTURO', title: 'Ecosistema regional conectado', color: 'rgba(255, 255, 255, 0.3)' }
  ];

  const flow = ['CAPITAL', 'DESARROLLO', 'PUNTO CERO LEGAL', 'VALIDACIÓN', 'CORE MÁS FUERTE', 'NUEVAS VERTICALES', 'ECOSISTEMA'];

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: 'linear-gradient(180deg, #0B1F3A 0%, #071527 100%)',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%' }}>
        <SlideNumber n="09" label="EL ROADMAP" color="#00C896" light />

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 300,
            lineHeight: 1.05,
            color: '#FFFFFF',
            marginBottom: '4rem',
            letterSpacing: '-0.03em',
            maxWidth: '800px'
          }}
        >
          <span style={{ fontWeight: 700, color: '#00C896' }}>Etapas estratégicas.</span> Sin fechas inventadas.
        </motion.h2>

        {/* Phases */}
        <div style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '2rem',
          marginBottom: '5rem'
        }}>
          <div style={{
            position: 'absolute',
            top: '30px',
            left: '5%',
            right: '5%',
            height: '1px',
            background: 'linear-gradient(90deg, #00C896 0%, rgba(212, 175, 55, 0.3) 60%, rgba(255, 255, 255, 0.1) 100%)'
          }} />

          {phases.map((p, i) => (
            <motion.div
              key={p.phase}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: 0.2 + i * 0.15, duration: 0.6 }}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}
            >
              <motion.div
                animate={p.active ? {
                  boxShadow: [
                    '0 0 20px rgba(0, 200, 150, 0.5)',
                    '0 0 40px rgba(0, 200, 150, 0.8)',
                    '0 0 20px rgba(0, 200, 150, 0.5)'
                  ]
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: p.active
                    ? 'linear-gradient(135deg, #00C896 0%, #00a077 100%)'
                    : 'rgba(11, 31, 58, 0.9)',
                  border: `2px solid ${p.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                <span style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: p.active ? '#FFFFFF' : p.color
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </motion.div>

              <div style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: p.color,
                letterSpacing: '0.2em',
                marginBottom: '0.75rem'
              }}>
                {p.phase}
              </div>
              <div style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#FFFFFF',
                lineHeight: 1.3,
                maxWidth: '200px'
              }}>
                {p.title}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Flow diagram */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          style={{
            padding: '2rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '20px'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '1.5rem' }}>
            FLUJO ESTRATÉGICO
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            {flow.map((f, i) => (
              <React.Fragment key={f}>
                <div style={{
                  padding: '0.4rem 0.9rem',
                  background: i === 2 ? 'rgba(0, 200, 150, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${i === 2 ? '#00C896' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: i === 2 ? '#00C896' : 'rgba(255, 255, 255, 0.65)',
                  fontWeight: 600,
                  letterSpacing: '0.08em'
                }}>
                  {f}
                </div>
                {i < flow.length - 1 && (
                  <ArrowRight size={14} color="rgba(255, 255, 255, 0.25)" />
                )}
              </React.Fragment>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 10 — MODELO DE NEGOCIO
// ============================================================
const Slide10 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  const models = [
    'Suscripciones SaaS', 'Planes Profesionales', 'Planes Empresariales',
    'Soluciones Enterprise', 'Integraciones', 'Alianzas Estratégicas',
    'Servicios del Ecosistema'
  ];

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: '#FFFFFF',
      color: '#1E1E1E',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <SlideNumber n="10" label="MODELO DE NEGOCIO" color="#0B1F3A" />

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 300,
            lineHeight: 1.1,
            color: '#0B1F3A',
            marginBottom: '2rem',
            letterSpacing: '-0.03em',
            maxWidth: '800px'
          }}
        >
          Componentes potenciales
          <br />
          <span style={{ fontWeight: 700 }}>del futuro modelo.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            fontSize: '1.05rem',
            color: 'rgba(30, 30, 30, 0.6)',
            marginBottom: '4rem',
            maxWidth: '700px',
            fontWeight: 300,
            lineHeight: 1.7
          }}
        >
          Sin proyecciones financieras inventadas. Sin ingresos ficticios. Sin KPIs fabricados.
          Solo la arquitectura potencial del modelo — a validar comercialmente.
        </motion.p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          {models.map((model, i) => (
            <motion.div
              key={model}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
              style={{
                padding: '1.5rem 1.75rem',
                background: '#F5F7FA',
                border: '1px solid rgba(11, 31, 58, 0.06)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0, 200, 150, 0.15) 0%, transparent 70%)',
                border: '1px solid #00C896',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#00C896',
                fontFamily: '"Space Grotesk", sans-serif',
                flexShrink: 0
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{
                fontSize: '1rem',
                color: '#0B1F3A',
                fontWeight: 600
              }}>
                {model}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 11 — ETAPA ACTUAL (TRANSPARENCIA)
// ============================================================
const Slide11 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  const needs = [
    'Capital', 'Desarrolladores', 'Diseñadores',
    'Profesionales especializados', 'Aliados estratégicos',
    'Validación comercial', 'Capacidad de ejecución'
  ];

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: 'linear-gradient(180deg, #071527 0%, #0B1F3A 100%)',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <SlideNumber n="11" label="ETAPA ACTUAL · TRANSPARENCIA" color="#D4AF37" light />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '4rem',
          marginTop: '3rem'
        }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            <h2 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
              fontWeight: 300,
              lineHeight: 1.15,
              color: '#FFFFFF',
              marginBottom: '2rem',
              letterSpacing: '-0.03em'
            }}>
              La visión es más grande
              <br />
              <span style={{ fontWeight: 700, color: '#D4AF37' }}>que los recursos actuales.</span>
            </h2>

            <p style={{
              fontSize: '1.05rem',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.65)',
              marginBottom: '2rem',
              fontWeight: 300
            }}>
              Punto Cero System es un proyecto en etapa temprana, desarrollado inicialmente
              por dos personas: el fundador y Alejandro, colaborador de largo plazo.
            </p>

            <p style={{
              fontSize: '1.05rem',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.65)',
              marginBottom: '2rem',
              fontWeight: 300
            }}>
              El proyecto ha requerido inversión personal, tiempo, trabajo y sacrificio.
              Punto Cero Legal está <strong style={{ color: '#00C896', fontWeight: 700 }}>LIVE en producción</strong> como primera vertical comercial.
              La principal limitación actual es el capital disponible para escalar comercialmente y expandir el ecosistema.
            </p>

            <div style={{
              padding: '1.5rem',
              background: 'rgba(0, 200, 150, 0.05)',
              border: '1px solid rgba(0, 200, 150, 0.2)',
              borderRadius: '16px'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#00C896', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.5rem' }}>
                MENSAJE CENTRAL
              </div>
              <div style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.4,
                letterSpacing: '-0.01em'
              }}>
                Etapa temprana. Gran ambición. Arquitectura escalable.
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div style={{ fontSize: '0.75rem', color: '#D4AF37', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '1.5rem' }}>
              LA SIGUIENTE ETAPA REQUIERE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {needs.map((need, i) => (
                <motion.div
                  key={need}
                  initial={{ opacity: 0, x: 20 }}
                  animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                  transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
                  style={{
                    padding: '1rem 1.5rem',
                    background: 'rgba(212, 175, 55, 0.05)',
                    border: '1px solid rgba(212, 175, 55, 0.15)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#D4AF37'
                  }} />
                  <span style={{
                    fontSize: '1rem',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: 500
                  }}>
                    {need}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// SLIDE 12 — LA CONVERSACIÓN
// ============================================================
const Slide12 = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.2 });

  const objectives = [
    'Completar Punto Cero Legal',
    'Prepararlo para el mercado',
    'Validar el producto',
    'Fortalecer el núcleo tecnológico',
    'Ampliar el equipo',
    'Construir la siguiente vertical'
  ];

  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      padding: '8rem 2rem',
      background: 'radial-gradient(ellipse at center, #0d2543 0%, #0B1F3A 60%, #071527 100%)',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 200, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '1200px',
          height: '1200px',
          borderRadius: '50%',
          border: '1px dashed rgba(212, 175, 55, 0.08)',
          pointerEvents: 'none'
        }}
      />

      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', position: 'relative' }}>
        <SlideNumber n="12" label="LA CONVERSACIÓN" color="#D4AF37" light />

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 300,
            lineHeight: 1.1,
            color: '#FFFFFF',
            marginBottom: '3rem',
            letterSpacing: '-0.03em',
            maxWidth: '900px'
          }}
        >
          No estamos construyendo
          <br />
          una colección de aplicaciones aisladas.
          <br />
          <span style={{ fontWeight: 700, background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Estamos construyendo infraestructura.
          </span>
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{ marginBottom: '4rem' }}
        >
          <div style={{ fontSize: '0.75rem', color: '#00C896', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '1.5rem' }}>
            OBJETIVO INMEDIATO
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}>
            {objectives.map((obj, i) => (
              <motion.div
                key={obj}
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
                style={{
                  padding: '1rem 1.25rem',
                  background: 'rgba(0, 200, 150, 0.05)',
                  border: '1px solid rgba(0, 200, 150, 0.2)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <Target size={14} color="#00C896" />
                <span style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>
                  {obj}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA block */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          style={{
            padding: '3rem',
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(0, 200, 150, 0.05) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            borderRadius: '24px',
            textAlign: 'center',
            backdropFilter: 'blur(12px)'
          }}
        >
          <h3 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: '1rem',
            letterSpacing: '-0.02em'
          }}>
            Iniciemos una conversación estratégica.
          </h3>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.65)',
            marginBottom: '2.5rem',
            maxWidth: '640px',
            margin: '0 auto 2.5rem',
            lineHeight: 1.7
          }}>
            Buscamos inversionistas, aliados y personas que comprendan la oportunidad
            de construir infraestructura tecnológica para Latinoamérica.
          </p>

          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/request-access"
                className="interactive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1.15rem 2rem',
                  background: 'linear-gradient(135deg, #D4AF37 0%, #b8942d 100%)',
                  color: '#0B1F3A',
                  textDecoration: 'none',
                  borderRadius: '100px',
                  fontSize: '0.95rem',
                  fontWeight: 700
                }}
              >
                Solicitar acceso para inversionistas
                <ArrowRight size={18} />
              </Link>
            </motion.div>

            <motion.a
              href="https://wa.me/573025717944?text=Hola,%20quiero%20iniciar%20una%20conversaci%C3%B3n%20estrat%C3%A9gica%20sobre%20Punto%20Cero%20System."
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05, borderColor: '#00C896' }}
              whileTap={{ scale: 0.98 }}
              className="interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1.15rem 2rem',
                background: 'transparent',
                color: '#FFFFFF',
                textDecoration: 'none',
                borderRadius: '100px',
                fontSize: '0.95rem',
                fontWeight: 600,
                border: '1px solid rgba(255, 255, 255, 0.25)'
              }}
            >
              <MessageCircle size={16} />
              Iniciar conversación por WhatsApp
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ============================================================
// Helper: SlideNumber
// ============================================================
const SlideNumber = ({ n, label, color = '#00C896', light = false, center = false }) => (
  <div style={{
    display: center ? 'flex' : 'inline-flex',
    justifyContent: center ? 'center' : 'flex-start',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '2rem'
  }}>
    <div style={{
      fontSize: '0.7rem',
      fontWeight: 700,
      color,
      letterSpacing: '0.25em'
    }}>
      SLIDE {n}
    </div>
    <div style={{
      width: '30px',
      height: '1px',
      background: light ? 'rgba(255, 255, 255, 0.15)' : 'rgba(11, 31, 58, 0.15)'
    }} />
    <div style={{
      fontSize: '0.7rem',
      fontWeight: 700,
      color: light ? 'rgba(255, 255, 255, 0.5)' : 'rgba(11, 31, 58, 0.6)',
      letterSpacing: '0.25em'
    }}>
      {label}
    </div>
  </div>
);

// ============================================================
// TOP NAVIGATION BAR
// ============================================================
const PitchDeckNav = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: 'rgba(11, 31, 58, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'rgba(255, 255, 255, 0.75)',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
            className="interactive"
          >
            <ArrowLeft size={14} />
            <span className="hide-mobile">Volver a</span> Punto Cero System
          </Link>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.85rem',
            background: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            borderRadius: '100px'
          }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#D4AF37' }} />
            <span style={{
              fontSize: '0.7rem',
              color: '#D4AF37',
              letterSpacing: '0.2em',
              fontWeight: 700
            }}>
              INVESTOR PITCH DECK
            </span>
          </div>

          <a
            href={`${API}/api/pitch-deck/download`}
            data-testid="deck-download-pdf"
            className="interactive hide-mobile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #D4AF37 0%, #b8942d 100%)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '100px',
              color: '#0B1F3A',
              textDecoration: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            <Download size={12} />
            Descargar PDF
          </a>

          <a
            href="https://puntocerolegal.com"
            target="_blank"
            rel="noopener noreferrer"
            className="interactive hide-mobile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'rgba(0, 200, 150, 0.1)',
              border: '1px solid rgba(0, 200, 150, 0.3)',
              borderRadius: '100px',
              color: '#00C896',
              textDecoration: 'none',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <ExternalLink size={12} />
            Punto Cero Legal
          </a>
        </div>

        {/* Progress bar */}
        <motion.div
          style={{
            scaleX,
            transformOrigin: 'left',
            height: '2px',
            background: 'linear-gradient(90deg, #00C896 0%, #D4AF37 100%)'
          }}
        />
      </div>
      <style>{`
        @media (max-width: 640px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </>
  );
};

// ============================================================
// MAIN PAGE
// ============================================================
const InvestorPitchDeckPage = () => {
  usePitchDeckAnalytics();
  const wrap = (n, Comp) => (
    <div
      className="pitch-slide-track"
      data-slide-number={n}
      data-slide-title={SLIDE_TITLES[n]}
      data-testid={`slide-track-${n}`}
      key={n}
    >
      <Comp />
    </div>
  );
  return (
    <div style={{ background: '#0B1F3A', minHeight: '100vh' }}>
      <PitchDeckNav />
      {wrap(1, Slide01)}
      {wrap(2, Slide02)}
      {wrap(3, Slide03)}
      {wrap(4, Slide04)}
      {wrap(5, Slide05)}
      {wrap(6, Slide06)}
      {wrap(7, Slide07)}
      {wrap(8, Slide08)}
      {wrap(9, Slide09)}
      {wrap(10, Slide10)}
      {wrap(11, Slide11)}
      {wrap(12, Slide12)}

      {/* Footer bridge back to main site */}
      <section style={{
        padding: '4rem 2rem',
        background: '#071527',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{
            fontSize: '0.7rem',
            color: 'rgba(255, 255, 255, 0.4)',
            letterSpacing: '0.25em',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>
            ECOSISTEMA CONECTADO
          </div>
          <h3 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 300,
            color: '#FFFFFF',
            marginBottom: '2rem',
            letterSpacing: '-0.02em'
          }}>
            Un punto cero desde el cual todo comienza.
          </h3>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <Link to="/" style={{
              padding: '0.9rem 1.75rem',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '100px',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }} className="interactive">
              <ArrowLeft size={14} />
              Punto Cero System
            </Link>
            <a href="https://puntocerolegal.com" target="_blank" rel="noopener noreferrer" style={{
              padding: '0.9rem 1.75rem',
              background: 'rgba(0, 200, 150, 0.1)',
              border: '1px solid #00C896',
              borderRadius: '100px',
              color: '#00C896',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }} className="interactive">
              Punto Cero Legal
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InvestorPitchDeckPage;
