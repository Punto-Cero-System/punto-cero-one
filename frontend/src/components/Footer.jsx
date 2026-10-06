import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Instagram, Music, Youtube, Facebook, Mail, MessageCircle, Twitter, Linkedin, Globe } from 'lucide-react';

const EMERALD = '#00C896';

/**
 * Footer — PUNTO CERO ONE branded.
 * 4 columns · social icons only with tooltips · "Hecho en Latinoamérica" animated.
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();

  const cols = [
    {
      title: 'PLATAFORMA',
      links: [
        { label: 'Inicio', to: '/' },
        { label: 'Feed', to: '/#feed' },
        { label: 'Comunidad', to: '/comunidad' },
        { label: 'Empresas', to: '/empresas' },
        { label: 'Verticales', to: '/#verticales' },
        { label: 'Investor Room', to: '/investor-room' },
      ],
    },
    {
      title: 'ECOSISTEMA',
      links: [
        { label: 'Punto Cero Legal', href: 'https://puntocerolegal.com', external: true, live: true },
        { label: 'Punto Cero Health', soon: true },
        { label: 'Punto Cero Contabilidad', soon: true },
        { label: 'Punto Cero Viajes', soon: true },
        { label: 'Punto Cero IA', soon: true },
      ],
    },
    {
      title: 'EMPRESA',
      links: [
        { label: 'Historia', to: '/nuestra-historia' },
        { label: 'Visión', to: '/nuestra-historia#vision' },
        { label: 'Misión', to: '/nuestra-historia#mision' },
        { label: 'Fundadores', to: '/nuestra-historia#founders' },
        { label: 'Contacto', href: 'mailto:puntocerosystem@gmail.com' },
      ],
    },
    {
      title: 'LEGAL',
      links: [
        { label: 'Política de Privacidad', to: '/legal/privacidad' },
        { label: 'Política de Cookies', to: '/legal/cookies' },
        { label: 'Términos y Condiciones', to: '/legal/terminos' },
        { label: 'Acuerdo Profesional', to: '/legal/acuerdo-profesional' },
      ],
    },
  ];

  // Icons only — the original URLs from the previous footer are preserved.
  const socials = [
    { name: 'Email',     Icon: Mail,          url: 'mailto:puntocerosystem@gmail.com' },
    { name: 'WhatsApp',  Icon: MessageCircle, url: 'https://wa.me/573025717944' },
    { name: 'LinkedIn',  Icon: Linkedin,      url: 'https://www.linkedin.com/company/puntocerosystem/' },
    { name: 'Instagram', Icon: Instagram,     url: 'https://www.instagram.com/puntocerosystem/' },
    { name: 'Facebook',  Icon: Facebook,      url: 'https://www.facebook.com/Punto7Cero7' },
    { name: 'X',         Icon: Twitter,       url: 'https://x.com/puntocerosystem' },
    { name: 'TikTok',    Icon: Music,         url: 'https://www.tiktok.com/@puntocerosystem' },
    { name: 'YouTube',   Icon: Youtube,       url: 'https://www.youtube.com/@puntocerosystem' },
  ];

  return (
    <footer data-testid="footer-punto-cero-one" style={{
      position: 'relative', background: '#050C1A',
      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      padding: '5rem 2rem 2.5rem', overflow: 'hidden',
    }}>
      {/* Ambient gradient */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 480,
        background: `radial-gradient(ellipse at top, ${EMERALD}0F 0%, transparent 68%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
        {/* Top grid: brand + 4 columns */}
        <div className="pcone-footer-top" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1.1fr) 3fr',
          gap: '3.5rem', marginBottom: '3rem', paddingBottom: '3rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.25rem' }}>
              <div style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '1.85rem', fontWeight: 700,
                letterSpacing: '-0.02em', lineHeight: 1,
              }}>
                <span style={{ color: '#FFFFFF' }}>PUNTO CERO</span>{' '}
                <span style={{ color: EMERALD }}>ONE</span>
              </div>
              <div style={{
                fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.28em', fontWeight: 500,
              }}>PLATFORM · ECOSYSTEM · LATAM</div>
            </div>

            <p style={{
              fontSize: '0.92rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.55)',
              marginBottom: '1.75rem', maxWidth: 320, fontWeight: 300,
            }}>
              El ecosistema tecnológico de Latinoamérica. Un núcleo, múltiples verticales,
              una comunidad viva.
            </p>

            {/* Social icons — no text, just glow + tooltip */}
            <div data-testid="footer-social-row" style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
              {socials.map(({ name, Icon, url }) => (
                <motion.a
                  key={name} href={url} target="_blank" rel="noopener noreferrer"
                  aria-label={name} title={name}
                  data-testid={`footer-social-${name.toLowerCase()}`}
                  whileHover={{ y: -3, borderColor: EMERALD, color: EMERALD, boxShadow: `0 6px 20px ${EMERALD}44` }}
                  transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                  style={{
                    position: 'relative',
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
                    transition: 'all 0.3s ease',
                  }}
                  className="pcone-social">
                  <Icon size={16} />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Navigation columns */}
          <div className="pcone-footer-cols" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '2rem',
          }}>
            {cols.map((c, idx) => (
              <motion.div key={c.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.6, delay: idx * 0.08 }}>
                <div style={{
                  fontSize: '0.68rem', fontWeight: 700,
                  color: EMERALD, letterSpacing: '0.26em', marginBottom: '1.25rem',
                }}>{c.title}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <FooterLink {...l} />
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '1.5rem',
        }}>
          <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.4)' }}>
            © {currentYear} <b style={{ color: 'rgba(255,255,255,0.6)' }}>Punto Cero One</b>. Todos los derechos reservados.
          </div>

          {/* Hecho en Latinoamérica */}
          <motion.div
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.45rem 0.95rem', borderRadius: 100,
              background: 'rgba(0,200,150,0.08)', border: `1px solid ${EMERALD}55`,
              fontSize: '0.78rem', fontWeight: 600, color: EMERALD,
            }} data-testid="footer-made-in-latam">
            <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-flex' }}>
              <Globe size={14} />
            </motion.span>
            Hecho en Latinoamérica
            <motion.span animate={{ y: [-1, 2, -1] }} transition={{ duration: 2.2, repeat: Infinity }}
              style={{ fontSize: '1rem', lineHeight: 1 }}>🌎</motion.span>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .pcone-footer-top { grid-template-columns: 1fr !important; gap: 2.5rem !important; }
        }
      `}</style>
    </footer>
  );
};

const FooterLink = ({ label, to, href, external, live, soon }) => {
  const base = {
    color: soon ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.65)',
    textDecoration: 'none', fontSize: '0.88rem', fontWeight: 400,
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    transition: 'color 0.3s ease',
    cursor: soon ? 'default' : 'pointer',
  };
  const content = (
    <>
      <span onMouseEnter={(e) => !soon && (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={(e) => !soon && (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}>
        {label}
      </span>
      {live && (
        <span style={{
          fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.14em',
          padding: '2px 6px', borderRadius: 100,
          background: `${EMERALD}22`, color: EMERALD, border: `1px solid ${EMERALD}55`,
        }}>LIVE</span>
      )}
      {soon && (
        <span style={{
          fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.14em',
          padding: '2px 6px', borderRadius: 100,
          background: 'rgba(212,175,55,0.12)', color: '#E6C86B', border: '1px solid rgba(212,175,55,0.35)',
        }}>PRONTO</span>
      )}
    </>
  );

  if (soon) return <span style={base}>{content}</span>;
  if (to) return <Link to={to} style={base}>{content}</Link>;
  return (
    <a href={href} style={base} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {content}
    </a>
  );
};

export default Footer;
