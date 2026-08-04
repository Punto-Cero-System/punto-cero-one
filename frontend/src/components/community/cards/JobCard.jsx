import React from 'react';
import { Briefcase, MapPin, Building2 } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#7C3AED';

const JobCard = ({ item }) => {
  const meta = item.metadata || {};
  const salary = meta.meta?.salary;
  const jobType = meta.meta?.job_type;
  const company = meta.author || meta.meta?.company_name || item.source;

  return (
    <BaseCard
      accent={ACCENT}
      badgeLabel="Empleo"
      badgeIcon={Briefcase}
      testid={`card-job-${item.id}`}
      title={item.title}
      description={item.description}
      meta={
        <>
          {company && <CardMeta><Building2 size={11} /> {company}</CardMeta>}
          {item.location && <CardMeta><MapPin size={11} /> {item.location}</CardMeta>}
          {item.country_label && !item.location && <CardMeta><MapPin size={11} /> {item.country_label}</CardMeta>}
          {jobType && <CardMeta>{jobType}</CardMeta>}
          {salary && <CardMeta>{salary}</CardMeta>}
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
