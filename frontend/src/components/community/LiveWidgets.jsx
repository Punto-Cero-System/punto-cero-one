/**
 * LiveWidgets — real external data (Crypto, FX, Weather, RSS, YouTube).
 *
 * Each widget is fully self-contained and safely renders in any status
 * (ACTIVE, MOCK, CONFIG_PENDING, ERROR). A small badge tells the user which
 * mode is currently active — this is critical for building trust while some
 * integrations are still awaiting API keys.
 */
import React, { useEffect, useState } from 'react';
import { Bitcoin, CloudSun, DollarSign, Newspaper, Youtube, RefreshCw } from 'lucide-react';
import AppIcon from './AppIcon';
import { widgetsService } from '../../services/widgetsService';

const NAVY = '#0B1F3A';

const STATUS_STYLE = {
  ACTIVE:         { bg: 'rgba(0,200,150,0.12)', color: '#00A277', label: 'LIVE' },
  MOCK:           { bg: 'rgba(11,31,58,0.08)',  color: 'rgba(11,31,58,0.6)', label: 'DEMO' },
  CONFIG_PENDING: { bg: 'rgba(245,158,11,0.14)', color: '#B45309', label: 'CONFIG' },
  ERROR:          { bg: 'rgba(239,68,68,0.12)',  color: '#B91C1C', label: 'ERROR' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.MOCK;
  return (
    <span data-testid={`widget-status-${status}`} style={{
      background: s.bg, color: s.color, fontSize: '0.55rem', fontWeight: 800,
      padding: '2px 6px', borderRadius: 100, letterSpacing: '0.14em',
    }}>{s.label}</span>
  );
};

const WidgetShell = ({ title, icon, status, testid, children }) => (
  <div data-testid={testid} style={{
    background: '#FFFFFF', borderRadius: 16,
    border: '1px solid rgba(11,31,58,0.06)',
    padding: '0.9rem 1rem 0.75rem',
    boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: '0.55rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700, color: 'rgba(11,31,58,0.55)',
      }}>
        {icon} <span>{title.toUpperCase()}</span>
      </div>
      {status && <StatusBadge status={status} />}
    </div>
    {children}
  </div>
);

const useWidget = (loader) => {
  const [state, setState] = useState({ loading: true, resp: null });
  useEffect(() => {
    let cancelled = false;
    loader().then((resp) => { if (!cancelled) setState({ loading: false, resp }); })
            .catch(() => { if (!cancelled) setState({ loading: false, resp: null }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
};


export const CryptoLiveWidget = () => {
  const { loading, resp } = useWidget(() => widgetsService.crypto());
  if (loading) return null;
  const d = resp?.data || {};
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—');
  return (
    <WidgetShell title="Cripto · Punto Cero" icon={<Bitcoin size={14} />} status={resp?.status} testid="live-widget-crypto">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <Row label="Bitcoin" value={`US$ ${fmt(d?.bitcoin?.usd)}`} testid="crypto-bitcoin" />
        <Row label="Ethereum" value={`US$ ${fmt(d?.ethereum?.usd)}`} testid="crypto-ethereum" />
      </div>
    </WidgetShell>
  );
};


export const FxLiveWidget = () => {
  const { loading, resp } = useWidget(() => widgetsService.fx({ targets: 'COP,MXN,ARS,CLP' }));
  if (loading) return null;
  const rates = resp?.data?.rates || {};
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('es-CO', { maximumFractionDigits: 0 }) : '—');
  return (
    <WidgetShell title="Divisas · USD" icon={<DollarSign size={14} />} status={resp?.status} testid="live-widget-fx">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
        {['COP', 'MXN', 'ARS', 'CLP'].map((c) => (
          <div key={c} data-testid={`fx-${c}`} style={{ padding: '0.35rem 0.5rem', borderRadius: 8, background: 'rgba(11,31,58,0.03)' }}>
            <div style={{ fontSize: '0.62rem', color: 'rgba(11,31,58,0.55)', fontWeight: 700 }}>{c}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>{fmt(rates[c])}</div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
};


export const WeatherLiveWidget = ({ city = 'Bogota,CO' }) => {
  const { loading, resp } = useWidget(() => widgetsService.weather(city));
  if (loading) return null;
  const d = resp?.data || {};
  const temp = d?.main?.temp;
  return (
    <WidgetShell title={`Clima · ${d?.name || city}`} icon={<CloudSun size={14} />} status={resp?.status} testid="live-widget-weather">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: NAVY }}>
          {typeof temp === 'number' ? `${Math.round(temp)}°` : '—'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.78rem', color: NAVY, fontWeight: 600, textTransform: 'capitalize' }}>
            {d?.weather?.[0]?.description || 'sin datos'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.55)' }}>
            humedad {d?.main?.humidity ?? '—'}% · viento {d?.wind?.speed ?? '—'} m/s
          </div>
        </div>
      </div>
    </WidgetShell>
  );
};


export const RssLiveWidget = ({ feedKey = 'noticias', title = 'Noticias en vivo' }) => {
  const { loading, resp } = useWidget(() => widgetsService.rss({ feed_key: feedKey, limit: 4 }));
  if (loading) return null;
  const items = resp?.data?.items || [];
  return (
    <WidgetShell title={title} icon={<Newspaper size={14} />} status={resp?.status} testid="live-widget-rss">
      {items.length === 0 && (
        <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)' }}>
          Sin ítems en el feed en este momento.
        </div>
      )}
      {items.map((it, i) => (
        <a key={`${it.link}-${i}`} href={it.link} target="_blank" rel="noopener noreferrer"
          data-testid={`rss-item-${i}`}
          style={{ display: 'block', padding: '0.4rem 0', textDecoration: 'none',
                   borderBottom: i < items.length - 1 ? '1px solid rgba(11,31,58,0.05)' : 'none' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: NAVY, lineHeight: 1.3,
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {it.title}
          </div>
          {it.published && (
            <div style={{ fontSize: '0.62rem', color: 'rgba(11,31,58,0.5)', marginTop: 2 }}>
              {it.published.slice(0, 16)}
            </div>
          )}
        </a>
      ))}
      {items.length > 0 && (
        <a href="/noticias" data-testid="rss-see-all"
          style={{
            display: 'block', textAlign: 'center', marginTop: '0.5rem',
            padding: '0.35rem 0', fontSize: '0.72rem', fontWeight: 700,
            color: '#00A277', textDecoration: 'none', letterSpacing: '0.06em',
          }}>Ver todas las noticias →</a>
      )}
    </WidgetShell>
  );
};


export const YoutubeLiveWidget = () => {
  const { loading, resp } = useWidget(() => widgetsService.youtube());
  if (loading) return null;
  const items = resp?.data?.items || [];
  return (
    <WidgetShell title="Videos" icon={<Youtube size={14} />} status={resp?.status} testid="live-widget-youtube">
      {items.length === 0 && (
        <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)' }}>
          Configura YOUTUBE_API_KEY y YOUTUBE_DEFAULT_CHANNEL_ID para ver videos reales.
        </div>
      )}
      {items.slice(0, 3).map((v, i) => (
        <a key={v.videoId || i} href={`https://www.youtube.com/watch?v=${v.videoId}`}
          target="_blank" rel="noopener noreferrer" data-testid={`yt-item-${i}`}
          style={{ display: 'flex', gap: '0.55rem', padding: '0.4rem 0', textDecoration: 'none' }}>
          <div style={{ width: 56, height: 40, borderRadius: 6, overflow: 'hidden',
                        background: NAVY, flexShrink: 0 }}>
            {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: NAVY, lineHeight: 1.25,
                          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {v.title}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(11,31,58,0.5)', marginTop: 1 }}>
              {v.channelTitle}
            </div>
          </div>
        </a>
      ))}
    </WidgetShell>
  );
};


const Row = ({ label, value, testid }) => (
  <div data-testid={testid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                     padding: '0.3rem 0', borderBottom: '1px solid rgba(11,31,58,0.05)' }}>
    <span style={{ fontSize: '0.78rem', color: NAVY, fontWeight: 600 }}>{label}</span>
    <span style={{ fontSize: '0.82rem', color: NAVY, fontWeight: 700 }}>{value}</span>
  </div>
);
