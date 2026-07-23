import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedAdminRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (user === null) {
    return (
      <div
        data-testid="admin-loading"
        style={{
          minHeight: '100vh',
          background: '#0B1F3A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.55)',
          fontFamily: '"Space Grotesk", sans-serif',
          letterSpacing: '0.2em',
          fontSize: '0.85rem',
        }}
      >
        VERIFICANDO SESIÓN…
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedAdminRoute;
