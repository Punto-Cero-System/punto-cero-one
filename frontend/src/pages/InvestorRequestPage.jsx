import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock, CheckCircle, Shield } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const InvestorRequestPage = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    company: '',
    role: '',
    focus: '',
    country: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/investor-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join(' ')
          : (detail || 'No se pudo enviar la solicitud.');
        throw new Error(msg);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Error de red. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0B1F3A 0%, #071527 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{
            maxWidth: '600px',
            textAlign: 'center'
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.6, 0.05, 0.01, 0.9] }}
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 3rem',
              boxShadow: '0 20px 60px rgba(0, 200, 150, 0.4)'
            }}
          >
            <CheckCircle size={44} color="#FFFFFF" />
          </motion.div>

          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: '1.5rem',
            letterSpacing: '-0.02em'
          }}>
            Solicitud recibida
          </h1>

          <p style={{
            fontSize: '1.15rem',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '2rem',
            fontWeight: 300
          }}>
            Gracias por tu interés en Punto Cero System.
            Revisaremos tu solicitud y te contactaremos en los próximos días
            para iniciar una conversación estratégica.
          </p>

          <div style={{
            padding: '1.5rem',
            background: 'rgba(0, 200, 150, 0.05)',
            border: '1px solid rgba(0, 200, 150, 0.2)',
            borderRadius: '16px',
            marginBottom: '2rem'
          }}>
            <div style={{ fontSize: '0.8rem', color: '#00C896', fontWeight: 700, letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
              PRÓXIMO PASO
            </div>
            <div style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.85)' }}>
              Nuestro equipo revisará tu solicitud y coordinará una llamada estratégica preparada.
            </div>
          </div>

          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem 2rem',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '100px',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: 500
            }}
          >
            <ArrowLeft size={16} />
            Volver al inicio
          </Link>
        </motion.div>
      </div>
    );
  }

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
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, transparent 70%)',
        filter: 'blur(100px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '760px',
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
          style={{ marginBottom: '3rem' }}
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
              ACCESO PRIVADO
            </span>
          </div>

          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 300,
            color: '#FFFFFF',
            marginBottom: '1rem',
            lineHeight: 1.1,
            letterSpacing: '-0.03em'
          }}>
            Solicitar acceso al{' '}
            <span style={{ fontWeight: 700, background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Investor Room
            </span>
          </h1>

          <p style={{
            fontSize: '1.05rem',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.6)',
            fontWeight: 300
          }}>
            Un espacio privado con materiales estratégicos, arquitectura tecnológica,
            roadmap de expansión y conversaciones preparadas.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            padding: '3rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            backdropFilter: 'blur(12px)'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <FormField label="Nombre completo *" name="fullName" value={formData.fullName} onChange={handleChange} required />
            <FormField label="Email corporativo *" name="email" type="email" value={formData.email} onChange={handleChange} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <FormField label="Empresa / Fondo" name="company" value={formData.company} onChange={handleChange} />
            <FormField label="Rol" name="role" value={formData.role} onChange={handleChange} placeholder="Ej: Managing Partner, VC, Angel Investor" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <SelectField
              label="Enfoque de inversión"
              name="focus"
              value={formData.focus}
              onChange={handleChange}
              options={[
                'Seed / Pre-seed',
                'Series A',
                'Series B+',
                'Strategic / Corporate',
                'Family Office',
                'Otro'
              ]}
            />
            <FormField label="País" name="country" value={formData.country} onChange={handleChange} placeholder="Ej: Colombia, México, USA" />
          </div>

          <FormField
            label="Mensaje estratégico"
            name="message"
            value={formData.message}
            onChange={handleChange}
            type="textarea"
            placeholder="¿Qué te interesa explorar sobre Punto Cero System?"
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            background: 'rgba(212, 175, 55, 0.05)',
            border: '1px solid rgba(212, 175, 55, 0.15)',
            borderRadius: '12px',
            marginTop: '2rem',
            marginBottom: '2rem'
          }}>
            <Shield size={18} color="#D4AF37" />
            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.5 }}>
              Tu información será revisada por el equipo. El acceso al Investor Room es privado y autorizado individualmente.
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={submitting ? {} : { scale: 1.02, boxShadow: '0 20px 60px rgba(212, 175, 55, 0.4)' }}
            whileTap={submitting ? {} : { scale: 0.98 }}
            className="interactive"
            data-testid="investor-request-submit"
            style={{
              width: '100%',
              padding: '1.15rem 2rem',
              background: submitting
                ? 'rgba(212,175,55,0.4)'
                : 'linear-gradient(135deg, #D4AF37 0%, #b8942d 100%)',
              color: '#0B1F3A',
              border: 'none',
              borderRadius: '100px',
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              cursor: submitting ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              fontFamily: 'inherit'
            }}
          >
            {submitting ? 'Enviando…' : 'Enviar solicitud de acceso'}
            {!submitting && <ArrowRight size={18} />}
          </motion.button>

          {error && (
            <div
              data-testid="investor-request-error"
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                background: 'rgba(255,90,90,0.08)',
                border: '1px solid rgba(255,90,90,0.3)',
                borderRadius: '10px',
                color: '#ff9a9a',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}
        </motion.form>
      </div>
    </div>
  );
};

const FormField = ({ label, name, value, onChange, type = 'text', required, placeholder }) => (
  <div>
    <label style={{
      display: 'block',
      fontSize: '0.7rem',
      color: 'rgba(255, 255, 255, 0.5)',
      letterSpacing: '0.15em',
      fontWeight: 600,
      marginBottom: '0.6rem'
    }}>
      {label.toUpperCase()}
    </label>
    {type === 'textarea' ? (
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        rows={4}
        style={{
          width: '100%',
          padding: '1rem',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          color: '#FFFFFF',
          fontSize: '0.95rem',
          fontFamily: 'inherit',
          resize: 'vertical',
          outline: 'none',
          transition: 'border-color 0.3s ease'
        }}
        onFocus={(e) => e.target.style.borderColor = '#00C896'}
        onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
      />
    ) : (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.9rem 1rem',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          color: '#FFFFFF',
          fontSize: '0.95rem',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 0.3s ease'
        }}
        onFocus={(e) => e.target.style.borderColor = '#00C896'}
        onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
      />
    )}
  </div>
);

const SelectField = ({ label, name, value, onChange, options }) => (
  <div>
    <label style={{
      display: 'block',
      fontSize: '0.7rem',
      color: 'rgba(255, 255, 255, 0.5)',
      letterSpacing: '0.15em',
      fontWeight: 600,
      marginBottom: '0.6rem'
    }}>
      {label.toUpperCase()}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      style={{
        width: '100%',
        padding: '0.9rem 1rem',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: '#FFFFFF',
        fontSize: '0.95rem',
        fontFamily: 'inherit',
        outline: 'none',
        cursor: 'pointer'
      }}
    >
      <option value="" style={{ background: '#0B1F3A' }}>Seleccionar...</option>
      {options.map(opt => (
        <option key={opt} value={opt} style={{ background: '#0B1F3A' }}>{opt}</option>
      ))}
    </select>
  </div>
);

export default InvestorRequestPage;
