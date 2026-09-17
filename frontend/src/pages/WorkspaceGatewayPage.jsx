import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../contexts/AuthContext';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import {
  WORKSPACE_SPACES,
  SPACE_STATUS,
  COMING_SOON_LABEL,
} from '../config/workspaceSpaces';

/**
 * WorkspaceGatewayPage — puerta de entrada y SELECTOR UNIVERSAL del ecosistema
 * Punto Cero System.
 *
 * Lista los espacios disponibles ("Mis espacios") a partir del catálogo único
 * `config/workspaceSpaces.js`. Es una capa de navegación: no hace fetch, no
 * aplica presets y no accede a backend.
 *
 * Ruta: /workspace (pública — invita a /login si no hay sesión)
 * Auth: AuthContext (JWT) — GET /api/auth/me valida el token en localStorage
 */

const CARD_BASE = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '0.45rem',
  padding: '1.1rem 0.85rem',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.04)',
  textDecoration: 'none',
  color: '#FFFFFF',
  textAlign: 'center',
  boxSizing: 'border-box',
  height: '100%',
  minHeight: '128px',
};

const ACCENT_BY_STATUS = {
  [SPACE_STATUS.AVAILABLE]: '0,200,150',
  [SPACE_STATUS.EXTERNAL]: '212,175,55',
  [SPACE_STATUS.COMING_SOON]: '255,255,255',
};

/**
 * FASE 9 — Memoria visual local del Gateway (localStorage, no bloqueante).
 * Recuerda la última selección real del usuario sin backend, sin auth nueva,
 * sin presets y sin cambiar navegación. Reversible: el usuario puede limpiar
 * la memoria desde la propia UI.
 */
export const GATEWAY_LAST_SPACE_KEY = 'pcs_gateway_last_space';

const isValidSpaceKey = (key) => WORKSPACE_SPACES.some((s) => s.key === key);

export const readLastSpace = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(GATEWAY_LAST_SPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const key = parsed && typeof parsed.space === 'string' ? parsed.space : null;
    if (!key || !isValidSpaceKey(key)) return null;
    return {
      space: key,
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : null,
    };
  } catch (e) {
    return null;
  }
};

export const writeLastSpace = (spaceKey) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    if (!spaceKey || !isValidSpaceKey(spaceKey)) return null;
    const payload = { space: spaceKey, timestamp: new Date().toISOString() };
    window.localStorage.setItem(GATEWAY_LAST_SPACE_KEY, JSON.stringify(payload));
    return payload;
  } catch (e) {
    return null;
  }
};

export const clearLastSpace = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(GATEWAY_LAST_SPACE_KEY);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * FASE 10 — Tiempo relativo visual para la continuidad del Gateway.
 * Función pura: convierte un ISO en "hace X minutos/horas/días" o fecha
 * fallback. Nunca lanza: timestamp nulo, corrupto o futuro devuelve
 * "fecha no disponible". Solo presentación en español, sin backend.
 */
export const formatRelativeTime = (iso, nowMs = Date.now()) => {
  try {
    if (typeof iso !== 'string' || !iso.trim()) return 'fecha no disponible';
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return 'fecha no disponible';
    const diffMs = nowMs - then;
    if (diffMs < 0) return 'fecha no disponible';
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 1) return 'hace un momento';
    if (minutes < 60) return `hace ${minutes} minuto${minutes === 1 ? '' : 's'}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} hora${hours === 1 ? '' : 's'}`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `hace ${days} día${days === 1 ? '' : 's'}`;
    const d = new Date(then);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  } catch (e) {
    return 'fecha no disponible';
  }
};

/**
 * FASE 8 — Gateway inteligente visual (solo lectura, no bloqueante).
 * Función pura: recomienda un espacio a partir de datos YA disponibles en
 * memoria (communityUser/authUser). Sin fetch, sin backend, sin
 * system-context, sin redirección automática y sin cambiar navegación.
 * Devuelve { spaceKey, reason } o null cuando no hay señales suficientes.
 */
export const RECOMMENDATION_REASONS = {
  VERTICALS: 'Basado en tus verticales',
  PROFILE: 'Basado en tu perfil profesional',
  ROLE: 'Basado en tu rol',
};

const normalizeList = (value) => {
  const out = [];
  const pushText = (text) => {
    if (typeof text === 'string' && text.trim()) {
      // FASE 8: normaliza acentos ("médico" -> "medico") para el match visual.
      out.push(
        text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      );
    }
  };
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === 'string') pushText(item);
      else if (item && typeof item === 'object') {
        pushText(item.key || item.value || item.name || item.label);
      }
    });
  } else if (typeof value === 'string') {
    pushText(value);
  }
  return out;
};

const matchSpaceKey = (tokens) => {
  const joined = tokens.join(' | ');
  const has = (...needles) => needles.some((n) => joined.includes(n));
  if (has('legal', 'abogad', 'derecho', 'juridic', 'lawyer', 'attorney')) return 'legal';
  if (has('salud', 'medic', 'health', 'clinica', 'hospital', 'doctor', 'enfermer')) return 'medical';
  if (has('empresa', 'negocio', 'business', 'company', 'organizacion', 'organizaci', 'contabilidad', 'accounting')) return 'empresa';
  if (has('one', 'comunidad', 'community', 'miembro', 'member')) return 'comunidad';
  return null;
};

/**
 * FASE 11 — orden visual derivado: el espacio recomendado se muestra primero
 * en la grilla. Función pura: NO muta el catálogo `WORKSPACE_SPACES`, no
 * filtra espacios y sin recomendación conserva el orden original.
 */
export const orderSpacesForDisplay = (spaces, recommendedKey = null) => {
  if (!Array.isArray(spaces)) return [];
  if (!recommendedKey) return spaces;
  const recommended = spaces.find((s) => s && s.key === recommendedKey);
  if (!recommended) return spaces;
  return [recommended, ...spaces.filter((s) => s !== recommended)];
};

export const getRecommendedSpace = ({ authUser = null, communityUser = null } = {}) => {
  const verticals = normalizeList(communityUser?.verticals);
  if (verticals.length > 0) {
    const key = matchSpaceKey(verticals);
    if (key) return { spaceKey: key, reason: RECOMMENDATION_REASONS.VERTICALS };
  }
  const profileTokens = [
    ...normalizeList(communityUser?.specialties),
    ...normalizeList(communityUser?.skills),
    ...normalizeList(communityUser?.interests),
    ...normalizeList([communityUser?.headline, communityUser?.bio, communityUser?.current_title, communityUser?.current_company]),
  ];
  if (profileTokens.length > 0) {
    const key = matchSpaceKey(profileTokens);
    if (key) return { spaceKey: key, reason: RECOMMENDATION_REASONS.PROFILE };
  }
  const role = (authUser?.role || communityUser?.role || '').toLowerCase();
  if (role === 'admin') return { spaceKey: 'legal', reason: RECOMMENDATION_REASONS.ROLE };
  if (role === 'investor') return { spaceKey: 'empresa', reason: RECOMMENDATION_REASONS.ROLE };
  return null;
};

/**
 * Tarjeta de un espacio del ecosistema.
 * - available / external → navega (Legal y Comunidad One).
 * - coming_soon          → NO navega, muestra badge "PRÓXIMAMENTE".
 *
 * FASE 5 — Opción A (solo capa visual): sin fetch, sin presets, sin backend,
 * sin cambios de autenticación ni navegación.
 */
const SpaceCard = ({ space, recommended = false, onSelect }) => {
  const isComingSoon = space.status === SPACE_STATUS.COMING_SOON;
  const accent = ACCENT_BY_STATUS[space.status] || '255,255,255';
  // FASE 7 — solo visual: etiqueta informativa de estado/acceso por tarjeta.
  // No cambia rutas, navegación ni permisos.
  const accessInfo = isComingSoon
    ? { label: 'Estado: Próximamente · Acceso: No disponible todavía', testid: `workspace-space-${space.key}-access` }
    : space.status === SPACE_STATUS.EXTERNAL
      ? { label: 'Estado: Disponible · Acceso: Entrada externa', testid: `workspace-space-${space.key}-access` }
      : { label: 'Estado: Disponible · Acceso: Preparado', testid: `workspace-space-${space.key}-access` };

  const content = (
    <>
      <span aria-hidden="true" style={{ fontSize: '1.6rem', lineHeight: 1 }}>
        {space.emoji}
      </span>
      <span
        style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: '0.92rem',
          fontWeight: 700,
          letterSpacing: '-0.01em',
        }}
      >
        {space.label}
      </span>
      <span
        data-testid={accessInfo.testid}
        style={{
          fontSize: '0.6rem',
          lineHeight: 1.45,
          color: 'rgba(255,255,255,0.55)',
        }}
      >
        {accessInfo.label}
      </span>
      {recommended ? (
        <span
          data-testid={`workspace-space-${space.key}-recommended`}
          style={{
            fontSize: '0.53rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            padding: '0.22rem 0.5rem',
            borderRadius: 999,
            background: 'rgba(0,200,150,0.12)',
            border: '1px solid rgba(0,200,150,0.4)',
            color: '#00C896',
          }}
        >
          ⭐ RECOMENDADO
        </span>
      ) : null}
      {recommended ? (
        <span
          data-testid={`workspace-space-${space.key}-recommended-reason`}
          style={{
            fontSize: '0.6rem',
            fontStyle: 'italic',
            lineHeight: 1.4,
            color: '#00C896',
          }}
        >
          Sugerido según tu perfil
        </span>
      ) : null}
      {isComingSoon ? (
        <span
          data-testid={`workspace-space-${space.key}-badge`}
          style={{
            fontSize: '0.53rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            padding: '0.22rem 0.5rem',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          {COMING_SOON_LABEL}
        </span>
      ) : (
        <span
          style={{
            fontSize: '0.62rem',
            lineHeight: 1.4,
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          {space.description}
        </span>
      )}
    </>
  );

  if (isComingSoon) {
    return (
      <div
        aria-disabled="true"
        data-testid={`workspace-space-${space.key}`}
        style={{
          ...CARD_BASE,
          border: recommended
            ? '1px solid rgba(0,200,150,0.45)'
            : '1px solid rgba(255,255,255,0.06)',
          boxShadow: recommended ? '0 0 24px rgba(0,200,150,0.18)' : 'none',
          opacity: recommended ? 0.85 : 0.62,
          cursor: 'not-allowed',
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <motion.div whileHover={{ y: -3 }} style={{ display: 'flex' }}>
      <Link
        to={space.path}
        data-testid={`workspace-space-${space.key}`}
        onClick={() => {
          if (typeof onSelect === 'function') onSelect(space.key);
        }}
        style={{
          ...CARD_BASE,
          width: '100%',
          border: recommended
            ? '1px solid rgba(0,200,150,0.55)'
            : `1px solid rgba(${accent},0.35)`,
          boxShadow: recommended
            ? '0 0 28px rgba(0,200,150,0.22)'
            : `0 0 24px rgba(${accent},0.08)`,
        }}
      >
        {content}
      </Link>
    </motion.div>
  );
};

const WorkspaceGatewayPage = () => {
  const { user, token, logout } = useAuth();
  const isAuthed = !!user && typeof user === 'object';
  // FASE 7 — solo lectura visual: refleja el estado ya resuelto por
  // CommunityAuthContext (undefined = cargando, null = no vinculada,
  // objeto = conectada). Sin fetch, sin login nuevo y sin bloquear acceso.
  let communityUser = null;
  let communityState = 'unavailable';
  try {
    const community = useCommunityAuth();
    communityUser = community?.user ?? null;
    communityState = community?.user === undefined
      ? 'loading'
      : community?.user
        ? 'connected'
        : 'not_linked';
  } catch (e) {
    communityUser = null;
    communityState = 'unavailable';
  }
  // FASE 8 — recomendación visual no bloqueante calculada solo con datos
  // ya disponibles en memoria. No redirige, no filtra y no autoriza.
  // FASE 9 — memoria visual local: lee una vez al montar y re-renderiza
  // al seleccionar o limpiar. Solo localStorage, sin backend.
  const [lastSpace, setLastSpace] = useState(() => readLastSpace());
  const handleSelectSpace = (spaceKey) => {
    const saved = writeLastSpace(spaceKey);
    if (saved) setLastSpace(saved);
  };
  const handleClearLastSpace = () => {
    clearLastSpace();
    setLastSpace(null);
  };
  const lastSpaceDef = lastSpace ? WORKSPACE_SPACES.find((s) => s.key === lastSpace.space) || null : null;
  const lastVisitedLabel = lastSpaceDef ? formatRelativeTime(lastSpace.timestamp) : null;

  const recommendation = getRecommendedSpace({ authUser: user, communityUser });
  const recommendedSpace = recommendation
    ? WORKSPACE_SPACES.find((s) => s.key === recommendation.spaceKey) || null
    : null;
  // FASE 11 — orden visual derivado (recomendado primero, resto en orden de
  // catálogo). No muta WORKSPACE_SPACES ni cambia navegación.
  const orderedSpaces = orderSpacesForDisplay(WORKSPACE_SPACES, recommendedSpace ? recommendedSpace.key : null);

  const communityLabel = communityState === 'connected'
    ? `Comunidad conectada${communityUser?.name || communityUser?.email ? ` como ${communityUser.name || communityUser.email}` : ''}`
    : communityState === 'loading'
      ? 'Verificando comunidad…'
      : communityState === 'unavailable'
        ? 'Comunidad no disponible en este contexto'
        : 'Comunidad no vinculada';

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse at center, #0d2543 0%, #0B1F3A 60%, #071527 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        position: 'relative',
        overflow: 'hidden',
      }}
      data-testid="workspace-gateway-page"
    >
      {/* Ambient orbit */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 240, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '1100px',
          height: '1100px',
          borderRadius: '50%',
          border: '1px dashed rgba(212, 175, 55, 0.08)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        style={{ width: '100%', maxWidth: '760px', position: 'relative', textAlign: 'center' }}
      >
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
          <BrandMark size={56} variant="full" showTagline={true} />
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 300,
            color: '#FFFFFF',
            margin: 0,
            marginBottom: '1rem',
            lineHeight: 1.1,
          }}
        >
          Bienvenido a{' '}
          <span
            style={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00C896 0%, #06B6D4 50%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Punto Cero System
          </span>
        </motion.h1>

        {/*
         * FASE 5 - Opcion A: hero visual del Gateway.
         * Solo presentacion: identifica los tres espacios del ecosistema
         * (One / Legal / Medical). No cambia auth, rutas, catalogo ni
         * placeholders. Sin fetch, sin presets y sin backend.
         */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          data-testid="workspace-gateway-hero"
          aria-label="Punto Cero System Gateway"
          style={{
            margin: '0 auto 1.5rem',
            maxWidth: '620px',
            padding: '1.1rem 1.25rem',
            borderRadius: '18px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
          }}
        >
          <p
            data-testid="workspace-gateway-title"
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'rgba(212,175,55,0.9)',
              margin: 0,
              marginBottom: '0.65rem',
            }}
          >
            Punto Cero System Gateway
          </p>
          <p
            style={{
              fontSize: '0.9rem',
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.72)',
              margin: 0,
              marginBottom: '0.9rem',
            }}
          >
            Punto de entrada visual a los espacios del ecosistema.
            Selecciona un espacio disponible o descubre los que estan en camino.
          </p>
          <div
            data-testid="workspace-gateway-destinations"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {[
              { key: 'one', label: 'Punto Cero One' },
              { key: 'legal', label: 'Punto Cero Legal' },
              { key: 'medical', label: 'Punto Cero Medical' },
            ].map((destination) => (
              <span
                key={destination.key}
                data-testid={`workspace-gateway-destination-${destination.key}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.42rem 0.8rem',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.82)',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                }}
              >
                <Shield size={12} color="#00C896" />
                {destination.label}
              </span>
            ))}
          </div>
        </motion.section>

        {isAuthed ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '1rem 1.5rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(212,175,55,0.2)',
                borderRadius: '14px',
                marginBottom: '1.5rem',
              }}
            >
              <Shield size={20} color="#00C896" />
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>
                Autenticado como <strong>{user?.name || user?.email || 'Usuario'}</strong> · Rol: <strong>{user?.role || 'member'}</strong>
              </span>
            </div>

            {/*
             * FASE 7 — bloque visual "Identidad activa".
             * Solo informativo: muestra la sesión JWT ya resuelta por useAuth
             * y el estado ya resuelto por useCommunityAuth. No inicia sesión,
             * no valida tokens, no llama al backend y no bloquea el acceso.
             * Futuro enrutamiento usuario → workspace (documentado, no
             * implementado): Personal → One; Profesional Legal → Legal
             * Workspace; Profesional Medical → Medical Workspace;
             * Empresa/Organización → Organization Workspace.
             */}
            <motion.section
              data-testid="workspace-identity"
              aria-label="Identidad activa"
              style={{
                margin: '0 auto 1.5rem',
                maxWidth: '620px',
                padding: '1rem 1.25rem',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                textAlign: 'left',
              }}
            >
              <p
                data-testid="workspace-identity-title"
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'rgba(212,175,55,0.9)',
                  margin: 0,
                  marginBottom: '0.75rem',
                }}
              >
                Identidad activa
              </p>
              <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div data-testid="workspace-identity-user">
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Usuario: </span>
                  <strong style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {user?.name || user?.email || 'Usuario'}
                  </strong>
                </div>
                <div data-testid="workspace-identity-source">
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Fuente: </span>
                  <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Sesión Punto Cero / JWT</strong>
                </div>
                <div data-testid="workspace-identity-status">
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Estado: </span>
                  <strong style={{ color: '#00C896' }}>Autenticado</strong>
                </div>
                <div data-testid="workspace-identity-community">
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Comunidad: </span>
                  <strong style={{ color: communityState === 'connected' ? '#00C896' : 'rgba(255,255,255,0.75)' }}>
                    {communityLabel}
                  </strong>
                </div>
              </div>
            </motion.section>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={logout}
              data-testid="workspace-gateway-logout"
              style={{
                padding: '0.6rem 1.4rem',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '100px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '0.5rem',
              }}
            >
              Cerrar sesión
            </motion.button>
          </motion.div>
        ) : (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', marginBottom: '1.5rem' }}
          >
            No se detectó sesión activa. Accede desde{' '}
            <Link
              to="/login"
              style={{
                color: '#00C896',
                textDecoration: 'underline',
                fontWeight: 600,
              }}
            >
              /login <ArrowRight size={12} />
            </Link>
            .
          </motion.p>
        )}

        {lastSpaceDef ? (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.6 }}
            data-testid="workspace-continuity"
            aria-label="Continuidad de trabajo"
            id="workspace-continuity"
            style={{
              margin: '0 auto 1.5rem',
              maxWidth: '620px',
              padding: '1.1rem 1.25rem',
              borderRadius: '18px',
              background: 'rgba(0,200,150,0.07)',
              border: '1px solid rgba(0,200,150,0.28)',
              textAlign: 'left',
            }}
          >
            <p
              data-testid="workspace-continuity-title"
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: '#00C896',
                margin: 0,
                marginBottom: '0.6rem',
              }}
            >
              Continuidad de trabajo
            </p>
            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', margin: 0 }}>
              Último espacio:{' '}
              <strong data-testid="workspace-continuity-space" style={{ color: '#FFFFFF' }}>
                {lastSpaceDef.label}
              </strong>
            </p>
            <p
              data-testid="workspace-continuity-visited"
              style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', margin: '0.3rem 0 0' }}
            >
              Visitado: {lastVisitedLabel}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.9rem', alignItems: 'center' }}>
              <Link
                to={lastSpaceDef.path}
                data-testid="workspace-continuity-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1.1rem',
                  borderRadius: 999,
                  background: 'linear-gradient(135deg, #00C896, #06B6D4)',
                  color: '#0B1F3A',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                Continuar en {lastSpaceDef.label} <ArrowRight size={13} />
              </Link>
              <a
                href="#workspace-spaces"
                data-testid="workspace-continuity-explore"
                style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}
              >
                Explorar otros espacios
              </a>
            </div>
          </motion.section>
        ) : null}

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          data-testid="workspace-spaces"
          id="workspace-spaces"
          style={{ marginTop: '1.75rem' }}
        >
          <h2
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)',
              margin: 0,
              marginBottom: '0.9rem',
            }}
          >
            Mis espacios
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {recommendedSpace ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                data-testid="workspace-recommendation"
                aria-label="Espacio recomendado para ti"
                style={{
                  marginBottom: '1rem',
                  padding: '0.9rem 1.1rem',
                  borderRadius: '16px',
                  background: 'rgba(0,200,150,0.08)',
                  border: '1px solid rgba(0,200,150,0.3)',
                  textAlign: 'left',
                }}
              >
                <p
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: '#00C896',
                    margin: 0,
                    marginBottom: '0.4rem',
                  }}
                >
                  ⭐ Espacio recomendado para ti
                </p>
                <p
                  data-testid="workspace-recommendation-space"
                  style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}
                >
                  {recommendedSpace.label}
                </p>
                <p
                  data-testid="workspace-recommendation-reason"
                  style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', margin: '0.25rem 0 0' }}
                >
                  {recommendation.reason}
                </p>
              </motion.div>
            ) : null}
            {lastSpaceDef ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                data-testid="workspace-last-space"
                aria-label="Último espacio utilizado"
                style={{
                  marginBottom: '1rem',
                  padding: '0.9rem 1.1rem',
                  borderRadius: '16px',
                  background: 'rgba(212,175,55,0.08)',
                  border: '1px solid rgba(212,175,55,0.3)',
                  textAlign: 'left',
                }}
              >
                <p
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(212,175,55,0.9)',
                    margin: 0,
                    marginBottom: '0.4rem',
                  }}
                >
                  Último espacio utilizado
                </p>
                <p
                  data-testid="workspace-last-space-name"
                  style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}
                >
                  {lastSpaceDef.label}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'center' }}>
                  <Link
                    to={lastSpaceDef.path}
                    data-testid="workspace-last-space-link"
                    style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00C896', textDecoration: 'underline' }}
                  >
                    Volver a {lastSpaceDef.label} <ArrowRight size={12} />
                  </Link>
                  <button
                    type="button"
                    data-testid="workspace-last-space-clear"
                    onClick={handleClearLastSpace}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                      color: 'rgba(255,255,255,0.55)',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Olvidar
                  </button>
                </div>
              </motion.div>
            ) : null}
            {orderedSpaces.map((space) => (
              <SpaceCard
                key={space.key}
                space={space}
                recommended={!!recommendedSpace && recommendedSpace.key === space.key}
                onSelect={handleSelectSpace}
              />
            ))}
          </div>
        </motion.section>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          style={{
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.35)',
            marginTop: '1.5rem',
            fontStyle: 'italic',
          }}
        >
          Universal Launcher de Punto Cero System. Los módulos internos de cada
          espacio se están construyendo.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default WorkspaceGatewayPage;

