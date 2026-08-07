/**
 * PreviewCard — compact "recommendation chip" used inside the social feed.
 *
 * Wave 12 Fase 7 filosofía: el Feed es social. Cuando aparece contenido
 * de otro módulo (noticias, empleos, eventos, videos, marketplace,
 * empresas, comunidades), lo mostramos como una preview compacta que
 * REDIRECCIONA a su página especializada — el Feed descubre, cada
 * módulo profundiza.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Newspaper, Briefcase, CalendarDays, Play, Building2, ShoppingBag,
  Users, Github, Database, Mic, ArrowRight,
} from 'lucide-react';

const NAVY = '#0B1F3A';

const KIND_MAP = {
  news:        { label: 'Noticia',        icon: Newspaper,    color: '#0369A1', route: '/noticias' },
  job:         { label: 'Empleo',         icon: Briefcase,    color: '#7C3AED', route: '/empleos' },
  event:       { label: 'Evento',         icon: CalendarDays, color: '#F59E0B', route: '/eventos' },
  video:       { label: 'Video',          icon: Play,         color: '#EF4444', route: '/videos' },
  company:     { label: 'Empresa',        icon: Building2,    color: '#0EA5E9', route: '/empresas' },
  marketplace: { label: 'Marketplace',    icon: ShoppingBag,  color: '#EC4899', route: '/marketplace' },
  community:   { label: 'Comunidad',      icon: Users,        color: '#059669', route: '/comunidad' },
  repo:        { label: 'Repositorio',    icon: Github,       color: '#334155', route: '/comunidad' },
  dataset:     { label: 'Dataset',        icon: Database,     color: '#14B8A6', route: '/noticias' },
  podcast:     { label: 'Podcast',        icon: Mic,          color: '#8B5CF6', route: '/videos' },
};

const PreviewCard = ({ item }) => {
  const meta = KIND_MAP[item.kind] || KIND_MAP.news;
  const Icon = meta.icon;

  return (
    <article data-testid={`card-preview-${item.kind}-${item.id}`}
      style={{
        display: 'flex', gap: '0.75rem', alignItems: 'center',
        padding: '0.9rem 1.05rem', background: '#FFFFFF',
        borderRadius: 14, border: '1px solid rgba(11,31,58,0.05)',
        boxShadow: '0 2px 12px rgba(11,31,58,0.03)',
      }}>
      {item.image ? (
        <img src={item.image} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async"
          style={{
            width: 52, height: 52, borderRadius: 10, objectFit: 'cover',
            flexShrink: 0, background: '#F4F6FB',
          }} />
      ) : (
        <div style={{
          width: 52, height: 52, borderRadius: 10,
          background: `linear-gradient(135deg, ${meta.color} 0%, ${meta.color}99 100%)`,
          color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={22} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '0.15rem 0.55rem', borderRadius: 100,
          background: `${meta.color}14`, color: meta.color,
          fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.14em',
          marginBottom: 4,
        }}>
          <Icon size={9} /> {meta.label.toUpperCase()}
        </div>
        <div style={{
          fontSize: '0.9rem', fontWeight: 700, color: NAVY,
          lineHeight: 1.35, letterSpacing: '-0.005em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.title}</div>
        {item.source && (
          <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)', marginTop: 1 }}>
            {item.source}
            {item.country_label && <> · {item.country_label}</>}
          </div>
        )}
      </div>
      <Link to={meta.route}
        data-testid={`card-preview-cta-${item.kind}-${item.id}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '0.45rem 0.85rem', borderRadius: 100,
          background: NAVY, color: '#FFFFFF', textDecoration: 'none',
          fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.01em',
          flexShrink: 0,
        }}>
        Ver más <ArrowRight size={12} />
      </Link>
    </article>
  );
};

// PreviewCards render dozens of times inside the Intelligent Feed and never
// change between renders unless their `item` prop changes. Memoize by id+kind
// so scrolling / feed remounts stay cheap.
export default React.memo(PreviewCard, (prev, next) => (
  prev.item?.id === next.item?.id && prev.item?.kind === next.item?.kind
));
