import React from 'react';
import { motion } from 'framer-motion';
import LoginCardOne from '../components/LoginCardOne';

/**
 * LoginPage — Puerta de entrada del Workspace System (Punto Cero System).
 *
 * Esta página utiliza el componente portable LoginCardOne, que consume
 * el AuthContext existente (JWT admin) y tras login exitoso navega a
 * /workspace (WorkspaceGatewayPage).
 *
 * Ruta: /login
 * Auth: AuthContext (JWT) — POST /api/auth/login → localStorage["pcs_admin_token"]
 */
const LoginPage = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at center, #0d2543 0%, #0B1F3A 60%, #071527 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        position: 'relative',
        overflow: 'hidden',
      }}
      data-testid="workspace-login-page"
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
        style={{ width: '100%', maxWidth: '440px', position: 'relative' }}
      >
        <LoginCardOne
          redirectTo="/workspace"
          title="Acceso Workspace Punto Cero System"
          subtitle="Ingresa con tu cuenta para acceder al Workspace."
        />
      </motion.div>
    </div>
  );
};

export default LoginPage;
