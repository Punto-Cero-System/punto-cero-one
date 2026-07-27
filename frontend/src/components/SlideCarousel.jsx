import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * SlideCarousel — reusable slider used by Punto Cero One home.
 *
 * Props:
 *  - slides: array of { key, node } — React nodes to render as slides.
 *  - autoplayMs: duration each slide is on screen (default 10000).
 *  - height: CSS height for the viewport (default 'clamp(560px, 78vh, 820px)').
 *  - showControls / showDots.
 *  - id: DOM id.
 *  - label: aria label.
 */
const SlideCarousel = ({
  slides = [],
  autoplayMs = 10000,
  height = 'clamp(560px, 78vh, 820px)',
  showControls = true,
  showDots = true,
  id,
  label = 'slider',
}) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(Date.now());
  const total = slides.length;

  const goTo = useCallback((i) => {
    setIndex(((i % total) + total) % total);
    startRef.current = Date.now();
    setProgress(0);
  }, [total]);

  const next = useCallback(() => goTo(index + 1), [index, goTo]);
  const prev = useCallback(() => goTo(index - 1), [index, goTo]);

  useEffect(() => {
    if (paused || total <= 1) return;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(1, elapsed / autoplayMs);
      setProgress(p);
      if (p >= 1) {
        setIndex((i) => (i + 1) % total);
        startRef.current = Date.now();
        setProgress(0);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused, total, autoplayMs, index]);

  // Keyboard navigation — only when the carousel is hovered/focused (avoids
  // multiple carousels on the same page reacting to the same arrow keys).
  useEffect(() => {
    if (!paused) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, next, prev]);

  if (!total) return null;

  return (
    <section
      id={id}
      aria-label={label}
      data-testid={id || 'slide-carousel'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        background: '#0A0F1C',
        isolation: 'isolate',
      }}
    >
      {/* Slides */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slides[index].key}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.8, ease: [0.6, 0.05, 0.01, 0.9] }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <div className="pc-slide-inner" style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'stretch', justifyContent: 'stretch',
            overflow: 'hidden',
          }}>
            {slides[index].node}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Fade edges for depth */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 60%, rgba(10,15,28,0.35) 100%)',
        zIndex: 3,
      }} />

      {/* Controls */}
      {showControls && total > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Anterior"
            data-testid={`${id || 'carousel'}-prev`}
            className="interactive"
            style={{
              position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)', color: '#FFFFFF', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 5, transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            aria-label="Siguiente"
            data-testid={`${id || 'carousel'}-next`}
            className="interactive"
            style={{
              position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)', color: '#FFFFFF', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 5, transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Progress + dots */}
      {showDots && total > 1 && (
        <div style={{
          position: 'absolute', bottom: '1.25rem', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: '0.5rem',
          zIndex: 5, padding: '0 1rem',
        }}>
          {slides.map((s, i) => (
            <button
              key={s.key}
              onClick={() => goTo(i)}
              aria-label={`Ir al slide ${i + 1}`}
              data-testid={`${id || 'carousel'}-dot-${i}`}
              className="interactive"
              style={{
                position: 'relative', width: i === index ? 40 : 10, height: 6,
                borderRadius: 100, border: 'none',
                background: i === index ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)',
                cursor: 'pointer', overflow: 'hidden',
                transition: 'width 0.4s ease',
              }}
            >
              {i === index && (
                <span style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${Math.round(progress * 100)}%`,
                  background: 'linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899)',
                  transition: 'width 0.1s linear',
                }} />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default SlideCarousel;
