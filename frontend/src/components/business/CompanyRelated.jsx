/**
 * CompanyRelated — surfaces news/videos/repos/similar entities inside the
 * existing CompanyProfilePage. Reuses widget-style cards; NO new page.
 *
 * All data comes from GET /api/discovery/entity/{slug}/related which itself
 * reuses growth_items (news), the jobs/events collections, the public GitHub
 * REST API and the public YouTube channel RSS.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader, ExternalLink, Star, GitFork, Youtube, Newspaper, Briefcase, Calendar, Building2 } from 'lucide-react';
import { discoveryService } from '../../services/platformService';

const NAVY = '#0B1F3A';

const Card = ({ title, icon: Icon, children, testid }) => (
  <div data-testid={testid} style={{
    background: '#FFFFFF', borderRadius: 16,
    border: '1px solid rgba(11,31,58,0.06)',
    padding: '0.95rem 1rem 0.8rem',
    boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 800,
      color: 'rgba(11,31,58,0.55)', marginBottom: '0.65rem',
    }}>
      <Icon size={13} /> {title}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>{children}</div>
  </div>
);

const Row = ({ children, href, testid }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" data-testid={testid}
    style={{
      display: 'flex', gap: '0.55rem',
      padding: '0.5rem 0.15rem', textDecoration: 'none', color: NAVY,
      borderTop: '1px solid rgba(11,31,58,0.05)',
    }}>{children}</a>
);

const CompanyRelated = ({ slug }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    discoveryService.related(slug)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div data-testid="company-related-loading" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        color: 'rgba(11,31,58,0.5)', fontSize: '0.82rem', padding: '1rem',
      }}>
        <Loader size={14} className="pcone-spin" /> Descubriendo contenido relacionado…
      </div>
    );
  }
  if (!data) return null;

  const { news = [], repos = [], videos = [], jobs = [], events = [], similar = [] } = data;
  const anything = news.length + repos.length + videos.length + jobs.length + events.length + similar.length;
  if (anything === 0) return null;

  return (
    <div data-testid="company-related-section"
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {news.length > 0 && (
        <Card title="Noticias relacionadas" icon={Newspaper} testid="company-related-news">
          {news.slice(0, 5).map((n) => (
            <Row key={n.id} href={n.url} testid={`related-news-${n.id}`}>
              {n.image_url && (
                <img src={n.image_url} alt="" referrerPolicy="no-referrer"
                  style={{ width: 60, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                  WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{n.title}</div>
                <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)', marginTop: 2 }}>
                  {n.source_name} · {(n.country || '').replace('LATAM','LatAm')}
                </div>
              </div>
            </Row>
          ))}
        </Card>
      )}

      {videos.length > 0 && (
        <Card title="Videos oficiales" icon={Youtube} testid="company-related-videos">
          {videos.slice(0, 5).map((v) => (
            <Row key={v.id} href={v.url} testid={`related-video-${v.id}`}>
              {v.thumbnail && (
                <img src={v.thumbnail} alt="" referrerPolicy="no-referrer"
                  style={{ width: 74, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                  WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{v.title}</div>
                <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)', marginTop: 2 }}>
                  YouTube · {(v.published_at || '').slice(0, 10)}
                </div>
              </div>
            </Row>
          ))}
        </Card>
      )}

      {repos.length > 0 && (
        <Card title="Repositorios GitHub" icon={ExternalLink} testid="company-related-repos">
          {repos.slice(0, 6).map((r) => (
            <Row key={r.id} href={r.url} testid={`related-repo-${r.id}`}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: NAVY,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.full_name || r.name}
                </div>
                {r.description && (
                  <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.6)',
                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                    WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                    {r.description}
                  </div>
                )}
                <div style={{
                  display: 'flex', gap: '0.6rem', marginTop: 3,
                  fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)',
                }}>
                  {r.language && <span>{r.language}</span>}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <Star size={10} /> {r.stars.toLocaleString()}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <GitFork size={10} /> {r.forks.toLocaleString()}
                  </span>
                </div>
              </div>
            </Row>
          ))}
        </Card>
      )}

      {jobs.length > 0 && (
        <Card title="Empleos relacionados" icon={Briefcase} testid="company-related-jobs">
          {jobs.slice(0, 5).map((j) => (
            <Link key={j.id} to={`/empleos/${j.id}`} data-testid={`related-job-${j.id}`}
              style={{
                display: 'flex', padding: '0.5rem 0.15rem',
                textDecoration: 'none', color: NAVY,
                borderTop: '1px solid rgba(11,31,58,0.05)',
              }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{j.title}</div>
                <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)' }}>
                  {j.location || j.modality || 'Remoto'}
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}

      {events.length > 0 && (
        <Card title="Eventos relacionados" icon={Calendar} testid="company-related-events">
          {events.slice(0, 5).map((e) => (
            <Link key={e.id} to={`/eventos/${e.id}`} data-testid={`related-event-${e.id}`}
              style={{
                display: 'flex', padding: '0.5rem 0.15rem',
                textDecoration: 'none', color: NAVY,
                borderTop: '1px solid rgba(11,31,58,0.05)',
              }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{e.title}</div>
                <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)' }}>
                  {(e.starts_at || '').slice(0, 10)} · {e.location || e.modality || 'Online'}
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}

      {similar.length > 0 && (
        <Card title="Entidades relacionadas" icon={Building2} testid="company-related-similar">
          {similar.slice(0, 8).map((s) => (
            <Link key={s.slug} to={`/empresas/${s.slug}`} data-testid={`related-similar-${s.slug}`}
              style={{
                display: 'flex', gap: '0.55rem', alignItems: 'center',
                padding: '0.5rem 0.15rem', textDecoration: 'none', color: NAVY,
                borderTop: '1px solid rgba(11,31,58,0.05)',
              }}>
              {s.logo_url ? (
                <img src={s.logo_url} alt="" referrerPolicy="no-referrer"
                  style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#F0F2F7' }}
                  onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg, #0B1F3A, #7C3AED)',
                  color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '0.75rem',
                }}>{(s.name || 'M').charAt(0)}</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{s.name}</div>
                <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)' }}>
                  {s.tagline || s.vertical}
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}

      <style>{`
        @keyframes pcone-spin { to { transform: rotate(360deg); } }
        .pcone-spin { animation: pcone-spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default CompanyRelated;
