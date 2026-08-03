/**
 * workspaceRegistry — the SINGLE source of truth of every widget/module that
 * can be placed inside Mi Espacio (left panel, center feed area, right panel).
 *
 * Design principles
 * -----------------
 * - **No duplication**. Every entry points to an EXISTING component in the
 *   codebase (LeftSidebar blocks, RightWidgets blocks, LiveWidgets, etc.).
 * - New widgets = one more entry here, nothing else.
 * - IDs are stable strings persisted per-user in MongoDB. NEVER rename an
 *   existing ID without a migration; add a new one instead.
 * - `defaultPanel` decides where a widget lands the first time. Users can
 *   move any widget to any panel from Configuración.
 */

import React from 'react';
import {
  WeatherWidget, CalendarWidget, PodcastWidget, CompaniesShoutout,
  MarketsWidget, AIOfTheDayWidget, PollWidget,
  CoursesWidget, LaunchesWidget, MarketplaceWidget,
  InlineWidgetStrip,
} from '../components/community/Widgets';
import {
  CryptoLiveWidget, FxLiveWidget, WeatherLiveWidget, RssLiveWidget, YoutubeLiveWidget,
} from '../components/community/LiveWidgets';

// Lazy-imported (heavy) modules
import ProfileCardWidget from '../components/community/workspace/ProfileCardWidget';
import ActivityWidget from '../components/community/workspace/ActivityWidget';
import GroupsWidget from '../components/community/workspace/GroupsWidget';
import QuickLinksWidget from '../components/community/workspace/QuickLinksWidget';
import NuestraHistoriaWidget from '../components/community/workspace/NuestraHistoriaWidget';
import WelcomeBandWidget from '../components/community/workspace/WelcomeBandWidget';
import FeedWidget from '../components/community/workspace/FeedWidget';
import TrendingWidget from '../components/community/workspace/TrendingWidget';
import TrendingEditorialWidget from '../components/community/workspace/TrendingEditorialWidget';
import EventsWidget from '../components/community/workspace/EventsWidget';
import CompaniesWidget from '../components/community/workspace/CompaniesWidget';
import InvestorCenterWidget from '../components/community/workspace/InvestorCenterWidget';
import AiToolsWidget from '../components/community/workspace/AiToolsWidget';
import SuggestedPeopleWidget from '../components/community/workspace/SuggestedPeopleWidget';
import CapitalCtaWidget from '../components/community/workspace/CapitalCtaWidget';
import MessagesWidget from '../components/community/workspace/MessagesWidget';
import DiscoverEntitiesWidget from '../components/community/workspace/DiscoverEntitiesWidget';
import TrendingCompaniesWidget from '../components/community/workspace/TrendingCompaniesWidget';

/**
 * Small helpers to wrap the existing decorative widgets that live inside
 * `Widgets.jsx` / `LiveWidgets.jsx` — no visual changes, we just expose
 * them with a stable ID and title for the Widget Manager.
 */
const wrap = (Component, meta) => ({
  id: meta.id,
  title: meta.title,
  description: meta.description,
  category: meta.category,       // navigation · productivity · media · finance · community · capital
  defaultPanel: meta.defaultPanel, // left | center | right
  defaultOrder: meta.defaultOrder || 100,
  Component,
});

export const WORKSPACE_WIDGETS = [
  /* ============================ LEFT PANEL ============================ */
  wrap(ProfileCardWidget, {
    id: 'profile-card',
    title: 'Perfil',
    description: 'Tu tarjeta de perfil con avatar, nombre y acceso rápido.',
    category: 'community',
    defaultPanel: 'left',
    defaultOrder: 10,
  }),
  wrap(NuestraHistoriaWidget, {
    id: 'nuestra-historia',
    title: 'Nuestra Historia',
    description: 'Acceso premium a la sección institucional.',
    category: 'navigation',
    defaultPanel: 'left',
    defaultOrder: 20,
  }),
  wrap(ActivityWidget, {
    id: 'activity',
    title: 'Actividad',
    description: 'Métricas resumidas de tu presencia en la comunidad.',
    category: 'productivity',
    defaultPanel: 'left',
    defaultOrder: 30,
  }),
  wrap(GroupsWidget, {
    id: 'groups',
    title: 'Grupos',
    description: 'Comunidades y grupos temáticos destacados.',
    category: 'community',
    defaultPanel: 'left',
    defaultOrder: 40,
  }),
  wrap(QuickLinksWidget, {
    id: 'quick-links',
    title: 'Accesos rápidos',
    description: 'Atajos a las secciones clave del ecosistema.',
    category: 'navigation',
    defaultPanel: 'left',
    defaultOrder: 50,
  }),
  wrap(WeatherWidget, {
    id: 'weather-mini',
    title: 'Clima (mini)',
    description: 'Vista compacta del clima local.',
    category: 'productivity',
    defaultPanel: 'left',
    defaultOrder: 60,
  }),
  wrap(CalendarWidget, {
    id: 'calendar-mini',
    title: 'Calendario',
    description: 'Hoy y tus próximos compromisos.',
    category: 'productivity',
    defaultPanel: 'left',
    defaultOrder: 70,
  }),
  wrap(PodcastWidget, {
    id: 'podcast-mini',
    title: 'Podcast destacado',
    description: 'Episodio recomendado por Punto Cero One.',
    category: 'media',
    defaultPanel: 'left',
    defaultOrder: 80,
  }),

  /* ============================ CENTER ============================ */
  wrap(WelcomeBandWidget, {
    id: 'welcome-band',
    title: 'Barra de bienvenida',
    description: 'Saludo y latido del ecosistema.',
    category: 'community',
    defaultPanel: 'center',
    defaultOrder: 10,
  }),
  wrap(FeedWidget, {
    id: 'feed',
    title: 'Feed',
    description: 'Publicaciones del ecosistema (Últimos · Para Ti).',
    category: 'community',
    defaultPanel: 'center',
    defaultOrder: 20,
  }),
  wrap(InlineWidgetStrip, {
    id: 'inline-stats',
    title: 'Métricas rápidas',
    description: 'Tira compacta con empleos, eventos y prompts trending.',
    category: 'productivity',
    defaultPanel: 'center',
    defaultOrder: 30,
  }),

  /* ============================ RIGHT PANEL ============================ */
  wrap((props) => <RssLiveWidget feedKey="noticias" title="Noticias del ecosistema" {...props} />, {
    id: 'rss-news',
    title: 'Noticias en vivo',
    description: 'Feed RSS del ecosistema (BBC Mundo / configurable).',
    category: 'media',
    defaultPanel: 'right',
    defaultOrder: 10,
  }),
  wrap(TrendingWidget, {
    id: 'trending',
    title: 'Tendencias en vivo',
    description: 'Hashtags con más movimiento en 7 días.',
    category: 'community',
    defaultPanel: 'right',
    defaultOrder: 20,
  }),
  wrap(TrendingEditorialWidget, {
    id: 'trending-editorial',
    title: 'Tendencias editoriales',
    description: 'Selección curada del equipo de Punto Cero.',
    category: 'community',
    defaultPanel: 'right',
    defaultOrder: 30,
  }),
  wrap(EventsWidget, {
    id: 'events',
    title: 'Próximos eventos',
    description: 'Los siguientes encuentros del ecosistema.',
    category: 'navigation',
    defaultPanel: 'right',
    defaultOrder: 40,
  }),
  wrap(CompaniesWidget, {
    id: 'companies',
    title: 'Empresas del ecosistema',
    description: 'Empresas destacadas y verticales LIVE.',
    category: 'navigation',
    defaultPanel: 'right',
    defaultOrder: 50,
  }),
  wrap(InvestorCenterWidget, {
    id: 'investor-center',
    title: 'Investor Center',
    description: 'Acceso al Capital Hub y experiencia inversionista.',
    category: 'capital',
    defaultPanel: 'right',
    defaultOrder: 60,
  }),
  wrap(AiToolsWidget, {
    id: 'ai-tools',
    title: 'IA & Herramientas',
    description: 'Asistente Legal, Simulador de Capital, Academia.',
    category: 'productivity',
    defaultPanel: 'right',
    defaultOrder: 70,
  }),
  wrap(CryptoLiveWidget, {
    id: 'crypto-live',
    title: 'Cripto (LIVE)',
    description: 'Bitcoin, Ethereum y más — CoinGecko.',
    category: 'finance',
    defaultPanel: 'right',
    defaultOrder: 80,
  }),
  wrap(FxLiveWidget, {
    id: 'fx-live',
    title: 'Divisas (LIVE)',
    description: 'USD contra COP, MXN, ARS, CLP.',
    category: 'finance',
    defaultPanel: 'right',
    defaultOrder: 90,
  }),
  wrap(WeatherLiveWidget, {
    id: 'weather-live',
    title: 'Clima (LIVE)',
    description: 'Clima en vivo con OpenWeather (fallback demo).',
    category: 'productivity',
    defaultPanel: 'right',
    defaultOrder: 100,
  }),
  wrap(YoutubeLiveWidget, {
    id: 'youtube-live',
    title: 'Videos (LIVE)',
    description: 'Videos del canal configurado.',
    category: 'media',
    defaultPanel: 'right',
    defaultOrder: 110,
  }),
  wrap(MarketsWidget, {
    id: 'markets',
    title: 'Mercados',
    description: 'Índices y activos clave del día.',
    category: 'finance',
    defaultPanel: 'right',
    defaultOrder: 120,
  }),
  wrap(AIOfTheDayWidget, {
    id: 'ai-of-the-day',
    title: 'IA del día',
    description: 'Prompt destacado + insight.',
    category: 'productivity',
    defaultPanel: 'right',
    defaultOrder: 130,
  }),
  wrap(PollWidget, {
    id: 'poll',
    title: 'Encuesta comunidad',
    description: 'Votación editorial de la semana.',
    category: 'community',
    defaultPanel: 'right',
    defaultOrder: 140,
  }),
  wrap(LaunchesWidget, {
    id: 'launches',
    title: 'Próximos lanzamientos',
    description: 'Verticales en preparación.',
    category: 'navigation',
    defaultPanel: 'right',
    defaultOrder: 150,
  }),
  wrap(CoursesWidget, {
    id: 'courses',
    title: 'Cursos',
    description: 'Aprendizaje aplicado del ecosistema.',
    category: 'productivity',
    defaultPanel: 'right',
    defaultOrder: 160,
  }),
  wrap(MarketplaceWidget, {
    id: 'marketplace',
    title: 'Marketplace',
    description: 'Espacio reservado (habilitando fase 2).',
    category: 'navigation',
    defaultPanel: 'right',
    defaultOrder: 170,
  }),
  wrap(SuggestedPeopleWidget, {
    id: 'suggested-people',
    title: 'Personas sugeridas',
    description: 'Miembros activos del ecosistema con presencia en vivo.',
    category: 'community',
    defaultPanel: 'right',
    defaultOrder: 180,
  }),
  wrap(MessagesWidget, {
    id: 'messages',
    title: 'Mensajes directos',
    description: 'Últimas conversaciones con avatar, presencia y contador de no leídos.',
    category: 'community',
    defaultPanel: 'right',
    defaultOrder: 15,
  }),
  wrap(DiscoverEntitiesWidget, {
    id: 'discover-entities',
    title: 'Descubre entidades',
    description: 'Empresas y organizaciones del ecosistema Punto Cero para seguir.',
    category: 'navigation',
    defaultPanel: 'right',
    defaultOrder: 45,
  }),
  wrap(TrendingCompaniesWidget, {
    id: 'trending-companies',
    title: 'Empresas trending',
    description: 'Empresas activas hoy — ordenadas por menciones + posts + seguidores reales.',
    category: 'community',
    defaultPanel: 'right',
    defaultOrder: 30,
  }),
  wrap(CapitalCtaWidget, {
    id: 'capital-cta',
    title: 'CTA Capital',
    description: 'Banner premium hacia Investor Center.',
    category: 'capital',
    defaultPanel: 'right',
    defaultOrder: 190,
  }),
];

/** O(1) index by id. */
export const WORKSPACE_REGISTRY = Object.freeze(
  Object.fromEntries(WORKSPACE_WIDGETS.map((w) => [w.id, w])),
);

/** Widgets grouped by category — used by the Configuración page. */
export const workspaceCategories = () => {
  const buckets = {};
  for (const w of WORKSPACE_WIDGETS) {
    (buckets[w.category] ||= []).push(w);
  }
  return buckets;
};

export const getWidget = (id) => WORKSPACE_REGISTRY[id] || null;
