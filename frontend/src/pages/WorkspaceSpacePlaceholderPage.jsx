import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Hammer } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import {
  getSpace,
  SPACE_STATUS,
  COMING_SOON_LABEL,
} from '../config/workspaceSpaces';

/**
 * WorkspaceSpacePlaceholderPage — pagina unica reutilizada por los espacios
 * del Workspace Gateway que todavia no tienen modulo interno.
 *
 * Se usa desde tres rutas (ver App.js):
 *   /workspace/legal  ·  /workspace/medical  ·  /workspace/empresa
 *
 * Alcance deliberadamente minimo: NO hace fetch, NO toca backend, NO toca
 * AuthContext y NO aplica presets. Solo comunica el estado del espacio y
 * ofrece el retorno al Gateway.
 *
 * FASE FUTURA: cada `spaceKey` tendra aqui su modulo real (Legal / Medical /
 * Empresa), enganchado al `presetId` y al `vertical` ya declarados en
 * `config/workspaceSpaces.js`.
 */
const WorkspaceSpacePlaceholderPage = ({ spaceKey }) => {
  const space = getSpace(spaceKey);
  const label = space ? space.label : spaceKey;
  const emoji = space ? space.emoji : '🧩';
  const isComingSoon = !!space && space.status === SPACE_STATUS.COMING_SOON;

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
      data-testid="workspace-space-placeholder"
      data-space={spaceKey}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          width: '100%',
          maxWidth: '520px',
          position: 'relative',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
          <BrandMark size={48} variant="full" />
        </div>

        <div
          aria-hidden="true"
          style={{ fontSize: '2.6rem', lineHeight: 1, marginBottom: '0.9rem' }}
        >
          {emoji}
        </div>

        <h1
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(1.7rem, 4vw, 2.4rem)',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: 0,
            marginBottom: '0.9rem',
            lineHeight: 1.15,
          }}
        >
          {label}
        </h1>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.5rem 1rem',
            borderRadius: '100px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            marginBottom: '1.25rem',
          }}
        >
          <Hammer size={14} color="#D4AF37" />
          <span
            data-testid="workspace-space-placeholder-status"
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            {isComingSoon ? COMING_SOON_LABEL : 'MÓDULO EN CONSTRUCCIÓN'}
          </span>
        </div>

        <p
          style={{
            fontSize: '0.88rem',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.6,
            margin: 0,
            marginBottom: '2rem',
          }}
        >
          {space?.description || 'Este espacio forma parte del ecosistema Punto Cero System.'}
          <br />
          El módulo interno se está construyendo. No hay datos, endpoints ni
          permisos activos todavía.
        </p>

        <Link
          to="/workspace"
          data-testid="workspace-space-back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.65rem 1.4rem',
            borderRadius: '100px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: 'rgba(255,255,255,0.85)',
            textDecoration: 'none',
            fontSize: '0.82rem',
            fontWeight: 700,
          }}
        >
          <ArrowLeft size={14} /> Volver al Gateway
        </Link>
      </motion.div>
    </div>
  );
};

export default WorkspaceSpacePlaceholderPage;
