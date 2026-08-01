/**
 * Workspace Presets — Punto Cero ecosystem-specific templates.
 *
 * Each preset defines an ideal layout for a specific use-case inside the
 * ecosystem. The user can apply a preset with one click, and every panel
 * is repopulated with the widgets that matter most for that role. They
 * remain free to modify the layout afterwards.
 *
 * All widget IDs used here MUST exist in `workspaceRegistry.jsx`.
 */
import {
  Scale, HeartPulse, Calculator, Building2, Rocket, Briefcase, Coins,
} from 'lucide-react';

const BASE_LEFT = ['profile-card', 'nuestra-historia', 'activity', 'quick-links'];

export const WORKSPACE_PRESETS = [
  {
    id: 'legal',
    label: 'Punto Cero Legal',
    Icon: Scale,
    accent: '#0EA5E9',
    description: 'Feed jurídico, IA legal, empresas del sector y agenda.',
    panels: {
      left: [...BASE_LEFT, 'calendar-mini', 'weather-mini'],
      center: ['welcome-band', 'feed', 'inline-stats'],
      right: [
        'messages', 'rss-news', 'trending', 'ai-tools',
        'companies', 'events', 'suggested-people', 'capital-cta',
      ],
    },
  },
  {
    id: 'health',
    label: 'Punto Cero Health',
    Icon: HeartPulse,
    accent: '#F472B6',
    description: 'Salud & bienestar: noticias, eventos y comunidad.',
    panels: {
      left: [...BASE_LEFT, 'calendar-mini', 'podcast-mini'],
      center: ['welcome-band', 'feed', 'inline-stats'],
      right: [
        'messages', 'rss-news', 'trending', 'events',
        'companies', 'ai-tools', 'suggested-people', 'weather-live',
      ],
    },
  },
  {
    id: 'contabilidad',
    label: 'Punto Cero Contabilidad',
    Icon: Calculator,
    accent: '#22D3EE',
    description: 'Cifras financieras, cursos, mercados y calendario.',
    panels: {
      left: [...BASE_LEFT, 'calendar-mini', 'groups'],
      center: ['welcome-band', 'feed', 'inline-stats'],
      right: [
        'messages', 'markets', 'fx-live', 'crypto-live',
        'rss-news', 'courses', 'companies', 'trending',
      ],
    },
  },
  {
    id: 'empresa',
    label: 'Empresa',
    Icon: Building2,
    accent: '#8B5CF6',
    description: 'Todo lo que una empresa activa necesita en un vistazo.',
    panels: {
      left: [...BASE_LEFT, 'groups', 'calendar-mini'],
      center: ['welcome-band', 'feed', 'inline-stats'],
      right: [
        'messages', 'companies', 'events', 'trending',
        'rss-news', 'ai-tools', 'suggested-people', 'launches',
        'capital-cta',
      ],
    },
  },
  {
    id: 'fundador',
    label: 'Fundador',
    Icon: Rocket,
    accent: '#F97316',
    description: 'Feed, IA, marketplace, empresas, Investor Center y capital.',
    panels: {
      left: [...BASE_LEFT, 'calendar-mini', 'podcast-mini'],
      center: ['welcome-band', 'feed', 'inline-stats'],
      right: [
        'messages', 'rss-news', 'ai-tools', 'ai-of-the-day',
        'marketplace', 'discover-entities', 'companies', 'investor-center', 'capital-cta',
        'courses', 'launches',
      ],
    },
  },
  {
    id: 'empleos',
    label: 'Empleos',
    Icon: Briefcase,
    accent: '#D4AF37',
    description: 'Búsqueda activa: empresas, empleos, IA y contactos.',
    panels: {
      left: [...BASE_LEFT, 'calendar-mini', 'groups'],
      center: ['welcome-band', 'feed', 'inline-stats'],
      right: [
        'messages', 'inline-stats', 'companies', 'events',
        'trending', 'rss-news', 'suggested-people', 'ai-tools',
        'courses',
      ],
    },
  },
  {
    id: 'capital',
    label: 'Capital',
    Icon: Coins,
    accent: '#D4AF37',
    description: 'Foco inversionista: mercados, capital y ecosistema.',
    panels: {
      left: [...BASE_LEFT, 'calendar-mini', 'weather-mini'],
      center: ['welcome-band', 'feed', 'inline-stats'],
      right: [
        'messages', 'capital-cta', 'investor-center', 'markets',
        'fx-live', 'crypto-live', 'rss-news', 'trending',
        'companies', 'launches',
      ],
    },
  },
];

export const getPreset = (id) => WORKSPACE_PRESETS.find((p) => p.id === id) || null;

/**
 * Build a full workspace payload from a preset. Widgets not listed in
 * any panel are simply removed from view; they can be re-added later.
 */
export const buildPayloadFromPreset = (preset, currentWidgets = {}) => ({
  layout_version: 1,
  panels: {
    left: [...preset.panels.left],
    center: [...preset.panels.center],
    right: [...preset.panels.right],
  },
  widgets: currentWidgets || {},
  theme: 'auto',
});
