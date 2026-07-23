import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Lock, FileText, Layers, Map, TrendingUp, 
  Users, PlayCircle, Calendar, Newspaper, ChartBar, 
  Package, Building2, DollarSign, ArrowRight
} from 'lucide-react';

const modules = [
  { id: 'exec', icon: FileText, title: 'Executive Summary', desc: 'Resumen ejecutivo del proyecto', status: 'preparation' },
  { id: 'deck', icon: Layers, title: 'Investor Pitch Deck', desc: '12 slides estructurados', status: 'preparation' },
  { id: 'book', icon: FileText, title: 'Master Book', desc: 'Documentación institucional', status: 'coming' },
  { id: 'arch', icon: Building2, title: 'Technology Architecture', desc: 'Arquitectura del core compartido', status: 'preparation' },
  { id: 'legal', icon: Package, title: 'Punto Cero Legal', desc: 'Primer vertical activo', status: 'available' },
  { id: 'roadmap', icon: Map, title: 'Roadmap', desc: 'Timeline de desarrollo y expansión', status: 'preparation' },
  { id: 'latam', icon: Map, title: 'Latin America Expansion', desc: '18 países, mercados y monedas', status: 'preparation' },
  { id: 'model', icon: DollarSign, title: 'Business Model', desc: 'Modelo de negocio y componentes', status: 'coming' },
  { id: 'team', icon: Users, title: 'Team', desc: 'Equipo fundador y estratégico', status: 'coming' },
  { id: 'demo', icon: PlayCircle, title: 'Product Demo', desc: 'Demostración de plataforma', status: 'coming' },
  { id: 'docs', icon: FileText, title: 'Corporate Documents', desc: 'Documentación corporativa', status: 'restricted' },
  { id: 'kpi', icon: ChartBar, title: 'KPIs & Metrics', desc: 'Métricas del proyecto', status: 'restricted' },
  { id: 'finance', icon: TrendingUp, title: 'Financial Statements', desc: 'Información financiera', status: 'restricted' },
  { id: 'cal', icon: Calendar, title: 'Calendar', desc: 'Agenda de reuniones estratégicas', status: 'coming' },
  { id: 'news', icon: Newspaper, title: 'News & Updates', desc: 'Actualizaciones del proyecto', status: 'coming' }
];

const statusConfig = {
  available: { label: 'DISPONIBLE', color: '#00C896', bg: 'rgba(0, 200, 150, 0.1)' },
  preparation: { label: 'EN PREPARACIÓN', color: '#D4AF37', bg: 'rgba(212, 175, 55, 0.1)' },
  coming: { label: 'PRÓXIMAMENTE', color: 'rgba(255, 255, 255, 0.5)', bg: 'rgba(255, 255, 255, 0.05)' },
  restricted: { label: 'ACCESO RESTRINGIDO', color: 'rgba(255, 100, 100, 0.7)', bg: 'rgba(255, 100, 100, 0.05)' }
};

const InvestorRoomPreview = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #071527 0%, #0B1F3A 100%)',
      padding: '4rem 2rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Ambient background */}
      <div style={{
        position: 'absolute',
        top: '10%',
        right: '10%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, transparent 70%)',
        filter: 'blur(100px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Back link */}
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'rgba(255, 255, 255, 0.6)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            marginBottom: '3rem'
          }}
        >
          <ArrowLeft size={16} />
          Volver
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{ marginBottom: '4rem' }}
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.9rem',
            background: 'rgba(212, 175, 55, 0.12)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            borderRadius: '100px',
            marginBottom: '2rem'
          }}>
            <Lock size={12} color="#D4AF37" />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#D4AF37', letterSpacing: '0.15em' }}>
              PREVIEW · ACCESO PRIVADO
            </span>
          </div>

          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            fontWeight: 300,
            color: '#FFFFFF',
            marginBottom: '1rem',
            lineHeight: 1.05,
            letterSpacing: '-0.03em'
          }}>
            <span style={{ fontWeight: 700, background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Investor Room
            </span>
          </h1>

          <p style={{
            fontSize: '1.1rem',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.65)',
            fontWeight: 300,
            maxWidth: '700px'
          }}>
            Arquitectura preparada para el futuro portal privado de inversionistas.
            Cada módulo se activa progresivamente conforme el proyecto avanza.
          </p>
        </motion.div>

        {/* Modules grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem',
          marginBottom: '5rem'
        }}>
          {modules.map((module, index) => {
            const config = statusConfig[module.status];
            return (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05, duration: 0.5 }}
                whileHover={module.status === 'available' ? { y: -5, borderColor: '#00C896' } : { y: -3 }}
                className="interactive"
                style={{
                  padding: '1.75rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${module.status === 'available' ? 'rgba(0, 200, 150, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '20px',
                  cursor: module.status === 'available' ? 'pointer' : 'default',
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: module.status === 'available' 
                      ? 'linear-gradient(135deg, rgba(0, 200, 150, 0.2) 0%, transparent 100%)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${module.status === 'available' ? 'rgba(0, 200, 150, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <module.icon size={20} color={config.color} />
                  </div>

                  <div style={{
                    padding: '0.3rem 0.7rem',
                    background: config.bg,
                    borderRadius: '100px',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: config.color,
                    letterSpacing: '0.1em'
                  }}>
                    {config.label}
                  </div>
                </div>

                <h3 style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  marginBottom: '0.5rem'
                }}>
                  {module.title}
                </h3>

                <p style={{
                  fontSize: '0.85rem',
                  color: 'rgba(255, 255, 255, 0.5)',
                  lineHeight: 1.5,
                  margin: 0
                }}>
                  {module.desc}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          style={{
            padding: '3rem',
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(0, 200, 150, 0.05) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            borderRadius: '24px',
            textAlign: 'center'
          }}
        >
          <h3 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: '1rem',
            letterSpacing: '-0.02em'
          }}>
            ¿Listo para una conversación estratégica?
          </h3>

          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.65)',
            marginBottom: '2rem',
            maxWidth: '600px',
            margin: '0 auto 2rem',
            lineHeight: 1.6
          }}>
            Solicita acceso completo al Investor Room. Nuestro equipo revisará tu perfil
            y coordinará una conversación preparada.
          </p>

          <Link
            to="/request-access"
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
            Solicitar Acceso al Investor Room
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default InvestorRoomPreview;
