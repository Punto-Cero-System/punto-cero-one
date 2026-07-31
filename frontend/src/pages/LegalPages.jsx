import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';

/**
 * LegalPage — shared layout for Privacidad, Cookies, Términos, Acuerdo Profesional.
 * Content is a professional Spanish template that the team can refine — every
 * placeholder is scoped to Punto Cero One so it reads legit out of the box.
 */
const LegalPage = ({ testid, eyebrow, title, updated, sections }) => (
  <>
    <Header />
    <main data-testid={testid} style={{ paddingTop: '58px', background: '#F7F8FC', minHeight: '100vh' }}>
      <section style={{
        padding: '5rem 2rem 3.5rem',
        background: `linear-gradient(160deg, ${NAVY} 0%, #071527 100%)`,
        color: '#FFFFFF',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '0.8rem',
            marginBottom: '1.75rem', letterSpacing: '0.08em', fontWeight: 500,
          }}><ArrowLeft size={14} /> Volver</Link>
          <div style={{
            fontSize: '0.7rem', color: EMERALD, letterSpacing: '0.28em',
            fontWeight: 700, marginBottom: '1rem',
          }}>{eyebrow}</div>
          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 4.4vw, 3rem)', fontWeight: 300,
            lineHeight: 1.08, letterSpacing: '-0.03em', margin: 0, marginBottom: '1rem',
          }}>{title}</h1>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
            Última actualización: <b>{updated}</b>
          </div>
        </div>
      </section>

      <section style={{ padding: '4rem 2rem', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 22, padding: 'clamp(2rem, 4vw, 3rem)',
                      border: '1px solid rgba(11,31,58,0.06)', boxShadow: '0 20px 60px rgba(11,31,58,0.05)' }}>
          {sections.map((s, i) => (
            <div key={i} style={{ marginBottom: '2.5rem' }}>
              <h2 style={{
                fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.35rem',
                fontWeight: 700, color: NAVY, letterSpacing: '-0.02em',
                margin: 0, marginBottom: '1rem',
              }}>{s.h}</h2>
              {(Array.isArray(s.p) ? s.p : [s.p]).map((p, k) => (
                <p key={k} style={{ fontSize: '0.95rem', lineHeight: 1.75,
                                    color: 'rgba(11,31,58,0.72)', marginBottom: '0.85rem', fontWeight: 400 }}>
                  {p}
                </p>
              ))}
            </div>
          ))}
          <div style={{
            marginTop: '2rem', padding: '1.5rem 1.5rem', borderRadius: 16,
            background: 'rgba(11,31,58,0.04)', border: '1px solid rgba(11,31,58,0.08)',
            fontSize: '0.85rem', color: 'rgba(11,31,58,0.7)', lineHeight: 1.6,
          }}>
            ¿Dudas o solicitudes de derechos ARCO/GDPR? Escríbenos a{' '}
            <a href="mailto:puntocerosystem@gmail.com" style={{ color: EMERALD, fontWeight: 600, textDecoration: 'none' }}>
              puntocerosystem@gmail.com
            </a>. Responderemos en un plazo máximo de 30 días.
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </>
);

export const PrivacyPage = () => (
  <LegalPage testid="legal-privacy" eyebrow="LEGAL · PRIVACIDAD" title="Política de Privacidad"
    updated="Julio 2026"
    sections={[
      { h: '1. Responsable del tratamiento',
        p: 'Punto Cero One (en adelante, "la Plataforma") es responsable del tratamiento de los datos personales de sus usuarios registrados. La Plataforma opera desde Latinoamérica bajo estándares equivalentes a la GDPR europea y las leyes locales de protección de datos.' },
      { h: '2. Datos que recopilamos',
        p: [
          'Datos de identidad: nombre, correo electrónico, foto de perfil, país y ciudad — proporcionados directamente por el usuario o su proveedor de autenticación (Google).',
          'Datos profesionales: cargo, empresa, verticales de interés, portafolio, redes sociales — voluntarios y editables en cualquier momento desde el perfil.',
          'Datos técnicos: dirección IP, tipo de dispositivo, tiempos de sesión y eventos de uso — únicamente para métricas agregadas y prevención de fraude.',
        ] },
      { h: '3. Finalidad',
        p: 'Los datos se utilizan para operar el ecosistema (feed, mensajería, notificaciones), personalizar el contenido ("Para Ti"), garantizar la seguridad, cumplir obligaciones legales y comunicar novedades relevantes del ecosistema. Nunca vendemos datos personales a terceros.' },
      { h: '4. Base legal',
        p: 'El tratamiento se realiza bajo el consentimiento del usuario al registrarse y aceptar los presentes términos. El usuario puede retirar su consentimiento en cualquier momento eliminando su cuenta.' },
      { h: '5. Terceros y transferencias',
        p: 'Utilizamos proveedores como Google (autenticación), MongoDB Atlas (almacenamiento), Resend (correo transaccional), CoinGecko y proveedores RSS (contenido público). Estas transferencias se realizan bajo cláusulas contractuales tipo y con encriptación en tránsito y reposo.' },
      { h: '6. Derechos del usuario',
        p: 'Acceso, rectificación, cancelación, oposición, portabilidad y limitación del tratamiento. Puedes ejercerlos desde tu perfil o contactándonos por correo.' },
      { h: '7. Retención',
        p: 'Los datos se conservan mientras la cuenta esté activa. Al eliminar la cuenta, los datos personales se anonimizan o eliminan en un plazo máximo de 90 días, salvo obligaciones legales específicas.' },
    ]} />
);

export const CookiesPage = () => (
  <LegalPage testid="legal-cookies" eyebrow="LEGAL · COOKIES" title="Política de Cookies"
    updated="Julio 2026"
    sections={[
      { h: '1. ¿Qué son las cookies?',
        p: 'Son pequeños archivos que se guardan en tu dispositivo para reconocerte entre visitas, mantener tu sesión y medir el uso agregado de la plataforma.' },
      { h: '2. Tipos que utilizamos',
        p: [
          'Estrictamente necesarias: sesión, autenticación, seguridad. No se pueden desactivar sin romper la plataforma.',
          'Preferencias: idioma, tema visual, feed activo (Últimos vs. Para Ti).',
          'Analítica: métricas agregadas y anónimas para mejorar el producto. No incluyen identificadores personales.',
        ] },
      { h: '3. Cookies de terceros',
        p: 'Google (auth), proveedores de contenido embebido (YouTube, redes sociales). Sujetas a sus propias políticas.' },
      { h: '4. Control',
        p: 'Puedes borrar cookies desde tu navegador en cualquier momento. También puedes salir de tu cuenta para terminar la sesión inmediatamente.' },
    ]} />
);

export const TermsPage = () => (
  <LegalPage testid="legal-terms" eyebrow="LEGAL · TÉRMINOS" title="Términos y Condiciones"
    updated="Julio 2026"
    sections={[
      { h: '1. Aceptación',
        p: 'Al usar Punto Cero One aceptas estos términos. Si no estás de acuerdo, debes abstenerte de crear una cuenta.' },
      { h: '2. Uso permitido',
        p: 'El usuario se compromete a interactuar con respeto, no publicar contenido ilegal, no realizar scraping automatizado ni intentos de vulnerar la seguridad de la plataforma.' },
      { h: '3. Contenido del usuario',
        p: 'El usuario mantiene la titularidad de todo lo que publica. Al publicar, concede a la plataforma una licencia mundial, no exclusiva y gratuita para mostrar y distribuir dicho contenido dentro del ecosistema.' },
      { h: '4. Verticales y servicios',
        p: 'La plataforma opera múltiples verticales (Legal, Salud, Contabilidad…). Cada vertical puede tener sus propios términos específicos que complementan los generales.' },
      { h: '5. Suspensión',
        p: 'Nos reservamos el derecho de suspender cuentas que violen estos términos, incumplan la ley aplicable o comprometan la seguridad del ecosistema.' },
      { h: '6. Limitación de responsabilidad',
        p: 'La plataforma se ofrece "tal cual". No garantizamos ausencia de fallas o disponibilidad ininterrumpida. Nuestra responsabilidad se limita al máximo permitido por la ley aplicable.' },
      { h: '7. Ley aplicable',
        p: 'Estos términos se rigen por las leyes de la República de Colombia, sin perjuicio de derechos irrenunciables del consumidor en su país de residencia.' },
    ]} />
);

export const ProfessionalAgreementPage = () => (
  <LegalPage testid="legal-professional" eyebrow="LEGAL · ACUERDO" title="Acuerdo Profesional"
    updated="Julio 2026"
    sections={[
      { h: '1. Objeto',
        p: 'Este acuerdo regula la relación entre Punto Cero One y los profesionales, empresas y proveedores que utilizan la plataforma como canal para ofrecer servicios, vacantes o contenido comercial.' },
      { h: '2. Veracidad de la información',
        p: 'El profesional garantiza la veracidad de la información publicada (títulos, experiencia, certificaciones). La plataforma podrá verificar y suspender perfiles inexactos.' },
      { h: '3. Conducta profesional',
        p: 'Respeto, no discriminación, cumplimiento de códigos éticos aplicables al ejercicio profesional en cada vertical (Legal, Salud, Contabilidad, etc.).' },
      { h: '4. Publicidad y ofertas laborales',
        p: 'Las vacantes y anuncios deben cumplir la ley laboral aplicable. No se admiten ofertas discriminatorias, falsas o engañosas.' },
      { h: '5. Confidencialidad',
        p: 'La información recibida a través de la mensajería interna se considera confidencial. El uso indebido puede acarrear la baja del perfil y las acciones legales que correspondan.' },
      { h: '6. Comisiones y monetización',
        p: 'Cuando la plataforma facilite servicios pagados (marketplace, verticales premium), aplicarán condiciones económicas específicas que se comunicarán con transparencia antes de cada transacción.' },
    ]} />
);

export default LegalPage;
