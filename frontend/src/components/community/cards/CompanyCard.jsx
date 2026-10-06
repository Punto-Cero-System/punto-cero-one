import React from 'react';
import { Building2, MapPin, Users } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#0EA5E9';

const HeroBand = ({ image, accent }) => (
  <div style={{
    position: 'relative', height: 88,
    background: image
      ? `${accent} center / cover no-repeat url(${image})`
      : `linear-gradient(135deg, ${accent}, #0369A1)`,
  }}>
    <div aria-hidden style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.35) 100%)',
    }} />
  </div>
);

const CompanyLogo = ({ src, name, accent }) => (
  <div style={{
    width: 48, height: 48, borderRadius: 12,
    background: '#FFFFFF', border: '3px solid #FFFFFF',
    marginTop: -30, marginBottom: 4,
    boxShadow: '0 8px 20px rgba(11,31,58,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  }}>
    {src ? (
      <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#F4F6FB' }} />
    ) : (
      <span style={{
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 800, fontSize: '1.15rem', color: accent,
      }}>{(name || '·').charAt(0).toUpperCase()}</span>
    )}
  </div>
);

const CompanyCard = ({ item }) => {
  const meta = item.metadata || {};
  const banner = meta.meta?.banner_url || null;
  const followers = meta.meta?.followers_count || 0;

  return (
    <BaseCard
      accent={ACCENT}
      badgeLabel="Empresa"
      badgeIcon={Building2}
      testid={`card-company-${item.id}`}
      media={<HeroBand image={banner} accent={ACCENT} />}
      header={<CompanyLogo src={item.image} name={item.title} accent={ACCENT} />}
      title={item.title}
      description={item.description}
      meta={
        <>
          {item.category && <CardMeta>{item.category}</CardMeta>}
          {item.country_label && <CardMeta><MapPin size={11} /> {item.country_label}</CardMeta>}
          {followers > 0 && <CardMeta><Users size={11} /> {followers.toLocaleString('es')} seguidores</CardMeta>}
        </>
      }
      primaryAction={
        <CardCTA href={item.external_url} label="Ver empresa" color={ACCENT}
          testid={`card-company-open-${item.id}`} />
      }
    />
  );
};

export default CompanyCard;
