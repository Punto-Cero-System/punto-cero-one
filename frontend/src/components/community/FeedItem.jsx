import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, ExternalLink, Play, MapPin, Calendar, Briefcase } from 'lucide-react';
import AppIcon from './AppIcon';

const NAVY = '#0B1F3A';

/**
 * FeedItem — polymorphic feed card.
 * Supported `kind` values: 'post', 'update', 'news', 'video', 'event', 'job', 'company', 'podcast', 'slider', 'custom'.
 * For 'slider' or 'custom' kind, pass a `node` prop to render arbitrary content inside the card body.
 */
const kindMeta = {
  post: { label: 'Publicación', icon: 'community' },
  update: { label: 'Actualización', icon: 'home' },
  news: { label: 'Noticia', icon: 'news' },
  video: { label: 'Video', icon: 'video' },
  event: { label: 'Evento', icon: 'events' },
  job: { label: 'Empleo', icon: 'jobs' },
  company: { label: 'Empresa', icon: 'companies' },
  podcast: { label: 'Podcast', icon: 'podcast' },
  slider: { label: 'Historia', icon: 'legal' },
  custom: { label: 'Destacado', icon: 'ai' },
};

const FeedItem = ({
  kind = 'post',
  author,
  authorAvatar,
  timestamp,
  title,
  body,
  cover,
  cta,
  meta = {},
  node,
  className,
  padded = true,
}) => {
  const k = kindMeta[kind] || kindMeta.post;
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5 }}
      className={className}
      data-testid={`feed-item-${kind}`}
      style={{
        background: '#FFFFFF', borderRadius: 16,
        border: '1px solid rgba(11,31,58,0.06)',
        boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      {(author || timestamp) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.7rem',
          padding: '0.9rem 1.1rem 0.7rem',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: '#0A0F1C', color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
            overflow: 'hidden',
          }}>
            {authorAvatar ? (
              <img src={authorAvatar} alt={author} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : '0'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: NAVY }}>{author || 'Punto Cero One'}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                fontSize: '0.6rem', letterSpacing: '0.16em', fontWeight: 700,
                color: 'rgba(11,31,58,0.5)', padding: '0.15rem 0.5rem',
                borderRadius: 100, background: 'rgba(11,31,58,0.05)',
              }}>
                <AppIcon name={k.icon} size={12} /> {k.label.toUpperCase()}
              </span>
            </div>
            {timestamp && (
              <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.5)', marginTop: 2 }}>{timestamp}</div>
            )}
          </div>
        </div>
      )}

      {/* Title + body */}
      {(title || body) && padded && (
        <div style={{ padding: (author || timestamp) ? '0 1.1rem 0.9rem' : '1.1rem 1.1rem 0.9rem' }}>
          {title && (
            <h3 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3,
              color: NAVY, margin: 0, marginBottom: body ? '0.35rem' : 0,
              letterSpacing: '-0.01em',
            }}>{title}</h3>
          )}
          {body && (
            <p style={{
              fontSize: '0.88rem', lineHeight: 1.55, margin: 0,
              color: 'rgba(11,31,58,0.72)',
            }}>{body}</p>
          )}
        </div>
      )}

      {/* Cover image */}
      {cover && (
        <div style={{ position: 'relative', width: '100%', background: '#0A0F1C' }}>
          <img src={cover} alt={title || ''} style={{
            width: '100%', height: 'auto', maxHeight: 340, objectFit: 'cover', display: 'block',
          }} />
          {kind === 'video' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.15)',
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: 'rgba(255,255,255,0.94)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Play size={22} color={NAVY} fill={NAVY} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meta strip (event, job) */}
      {kind === 'event' && (meta.location || meta.date) && (
        <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 1.1rem', flexWrap: 'wrap', fontSize: '0.78rem', color: NAVY }}>
          {meta.date && <span><Calendar size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{meta.date}</span>}
          {meta.location && <span><MapPin size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{meta.location}</span>}
        </div>
      )}
      {kind === 'job' && (meta.company || meta.location) && (
        <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 1.1rem', flexWrap: 'wrap', fontSize: '0.78rem', color: NAVY }}>
          {meta.company && <span><Briefcase size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{meta.company}</span>}
          {meta.location && <span><MapPin size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{meta.location}</span>}
        </div>
      )}

      {/* Custom node slot (used for embedded sliders / rich content) */}
      {node && (padded
        ? <div style={{ padding: '0.5rem 1.1rem 1rem' }}>{node}</div>
        : <div>{node}</div>
      )}

      {/* CTA */}
      {cta && (
        <div style={{ padding: '0 1.1rem 1rem' }}>
          {cta.to ? (
            <Link
              to={cta.to}
              className="interactive"
              style={ctaStyle}
              data-testid={`feed-item-cta-${cta.testid || 'link'}`}
            >
              {cta.label} <ExternalLink size={12} />
            </Link>
          ) : (
            <a
              href={cta.href}
              target={cta.external ? '_blank' : undefined}
              rel={cta.external ? 'noopener noreferrer' : undefined}
              className="interactive"
              style={ctaStyle}
              data-testid={`feed-item-cta-${cta.testid || 'link'}`}
            >
              {cta.label} <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* Action row */}
      <div style={{
        display: 'flex', gap: '0.15rem', padding: '0.35rem 0.5rem',
        borderTop: '1px solid rgba(11,31,58,0.05)',
      }}>
        <Action icon={<Heart size={16} />} label="Me gusta" />
        <Action icon={<MessageCircle size={16} />} label="Comentar" />
        <Action icon={<Share2 size={16} />} label="Compartir" />
        <Action icon={<Bookmark size={16} />} label="Guardar" ml="auto" />
      </div>
    </motion.article>
  );
};

const ctaStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.5rem 0.9rem', borderRadius: 100,
  background: 'rgba(11,31,58,0.05)', color: NAVY,
  fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none',
  border: '1px solid rgba(11,31,58,0.08)',
};

const Action = ({ icon, label, ml }) => (
  <button className="interactive" style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.55rem 0.8rem', borderRadius: 10,
    border: 'none', background: 'transparent', cursor: 'pointer',
    color: 'rgba(11,31,58,0.65)', fontSize: '0.78rem', fontWeight: 600,
    marginLeft: ml || 0, transition: 'background 0.2s',
  }}
    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(11,31,58,0.05)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    {icon} <span className="feed-action-label">{label}</span>
  </button>
);

export default FeedItem;
