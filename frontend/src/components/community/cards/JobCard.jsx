import React from 'react';
import { Briefcase, MapPin, Building2 } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#7C3AED';

const HeroBand = ({ image, accent }) => (
  <div style={{
    position: 'relative', height: 96,
    background: image
      ? `${accent} center / cover no-repeat url(${image})`
      : `linear-gradient(135deg, ${accent} 0%, ${accent}66 100%)`,
  }}>
    {image && (
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(0deg, ${accent}66, transparent 55%)`,
      }} />
    )}
  </div>
);

const CompanyLogo = ({ src, name, accent }) => (
  <div style={{
    width: 44, height: 44, borderRadius: 10,
    background: '#FFFFFF', border: `2px solid #FFFFFF`,
    marginTop: -28, marginBottom: 4,
    boxShadow: '0 6px 18px rgba(11,31,58,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  }}>
    {src ? (
      <img src={src} alt="" referrerPolicy="no-referrer"
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#F4F6FB' }} />
    ) : (
      <span style={{
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 800, fontSize: '1.1rem', color: accent,
      }}>{(name || '·').charAt(0).toUpperCase()}</span>
    )}
  </div>
);

const JobCard = ({ item }) => {
  const meta = item.metadata || {};
  const salary = meta.meta?.salary;
  const jobType = meta.meta?.job_type || meta.meta?.modality;
  const company = meta.author || meta.meta?.company_name || item.source;
  const logo = item.image;
  const banner = meta.meta?.banner_url || null;
  const tags = meta.tags || [];

  return (
    <BaseCard
      accent={ACCENT}
      badgeLabel="Empleo"
      badgeIcon={Briefcase}
      testid={`card-job-${item.id}`}
      media={<HeroBand image={banner || logo} accent={ACCENT} />}
      header={<CompanyLogo src={logo} name={company} accent={ACCENT} />}
      title={item.title}
      description={item.description}
      meta={
        <>
          {company && <CardMeta><Building2 size={11} /> {company}</CardMeta>}
          {item.location && <CardMeta><MapPin size={11} /> {item.location}</CardMeta>}
          {item.country_label && !item.location && <CardMeta><MapPin size={11} /> {item.country_label}</CardMeta>}
          {jobType && <CardMeta>{jobType}</CardMeta>}
          {salary && <CardMeta style={{ color: '#00825E', fontWeight: 700 }}>{salary}</CardMeta>}
          {tags.slice(0, 2).map((t) => (
            <span key={t} style={{
              padding: '1px 7px', borderRadius: 6,
              background: 'rgba(124,58,237,0.10)', color: ACCENT,
              fontSize: '0.6rem', fontWeight: 700,
            }}>{t}</span>
          ))}
        </>
      }
      primaryAction={
        <CardCTA href={item.external_url} label="Aplicar" color={ACCENT}
          testid={`card-job-apply-${item.id}`} />
      }
    />
  );
};

export default JobCard;
