/**
 * Mock data service — deliberate single source of truth for every
 * content-driven screen. When the backend is ready, swap these functions
 * for real fetch calls (same shape).  Keeping the boundary clean means
 * the visual layer never has to change.
 *
 * Signature contract (for the eventual real backend):
 *   listNews():        Promise<NewsItem[]>
 *   listVideos():      Promise<VideoItem[]>
 *   listJobs():        Promise<JobItem[]>
 *   listCompanies():   Promise<CompanyItem[]>
 *   listEvents():      Promise<EventItem[]>
 *   listAiTools():     Promise<AiToolItem[]>
 *   listGroups():      Promise<GroupItem[]>
 */
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export const NEWS = [
  {
    id: 'n1',
    title: 'Punto Cero Legal · LIVE en producción',
    excerpt: 'El primer vertical del ecosistema ya está operativo. Base tecnológica compartida validada por un producto real en 18 países.',
    tag: 'Producto',
    author: 'Punto Cero System',
    date: 'Hoy',
    cover: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&auto=format&fit=crop&q=80',
    href: 'https://puntocerolegal.com',
  },
  {
    id: 'n2',
    title: 'Founding team consolidado · Darwin & Jonathan',
    excerpt: 'La visión operativa y tecnológica del ecosistema queda anclada al equipo fundador con presencia comercial en LatAm.',
    tag: 'Equipo',
    author: 'Comunicaciones',
    date: 'Hace 2 días',
    cover: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'n3',
    title: 'Roadmap 2026 publicado — hacia 4 verticales',
    excerpt: 'Legal ya está live. Medicina y Contabilidad en 2026. Educación cierra el año. Todo bajo la misma base One.',
    tag: 'Roadmap',
    author: 'Investor Center',
    date: 'Esta semana',
    cover: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'n4',
    title: 'Investor Roundtable — Bogotá abre inscripciones',
    excerpt: 'Encuentro presencial con inversionistas, aliados y fundadores. Cupo limitado.',
    tag: 'Eventos',
    author: 'Investor Center',
    date: 'La próxima semana',
    cover: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  },
];

export const VIDEOS = [
  {
    id: 'v1', title: 'La visión detrás de Punto Cero One',
    channel: 'Punto Cero System', length: '4:12', views: '12.4k',
    cover: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'v2', title: 'Cómo estamos construyendo LatAm desde cero',
    channel: 'Founders Talk', length: '8:37', views: '5.1k',
    cover: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'v3', title: 'IA aplicada a legal — Punto Cero Legal en acción',
    channel: 'Product Demo', length: '3:04', views: '9.8k',
    cover: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'v4', title: 'Manifiesto Punto Cero — dónde empieza todo',
    channel: 'Manifesto', length: '2:18', views: '18.2k',
    cover: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80',
  },
];

export const JOBS = [
  {
    id: 'j1', title: 'Full-Stack Engineer (Senior)', company: 'Punto Cero System',
    location: 'Remoto · LatAm', modality: 'Remoto',
    tags: ['React', 'FastAPI', 'MongoDB', 'IA'],
    desc: 'Construye la infraestructura tecnológica que alimenta todos los verticales del ecosistema.',
  },
  {
    id: 'j2', title: 'Product Designer', company: 'Punto Cero Legal',
    location: 'Bogotá / Remoto', modality: 'Híbrido',
    tags: ['Figma', 'Design System', 'B2B'],
    desc: 'Diseña la experiencia de los profesionales legales que usan Punto Cero Legal a diario.',
  },
  {
    id: 'j3', title: 'Growth & Community Lead', company: 'Punto Cero One',
    location: 'Remoto · LatAm', modality: 'Remoto',
    tags: ['Comunidad', 'Content', 'Growth'],
    desc: 'Lidera la expansión de la comunidad Punto Cero One a lo largo de 18 países.',
  },
  {
    id: 'j4', title: 'AI Engineer', company: 'Punto Cero Labs',
    location: 'Remoto · LatAm', modality: 'Remoto',
    tags: ['LLMs', 'RAG', 'Python'],
    desc: 'Prototipa las capacidades IA que atraviesan legal, medicina, contabilidad y educación.',
  },
];

export const COMPANIES = [
  {
    id: 'c1', name: 'Punto Cero Legal', vertical: 'Legal', status: 'LIVE',
    country: '18 países LatAm', href: 'https://puntocerolegal.com',
    desc: 'Primer vertical operativo del ecosistema. Legal-tech de alto rendimiento con IA aplicada.',
  },
  {
    id: 'c2', name: 'Punto Cero Medicina', vertical: 'Salud', status: 'Roadmap 2026',
    country: 'LatAm',
    desc: 'Plataforma clínica y administrativa para profesionales de salud independientes y consultorios.',
  },
  {
    id: 'c3', name: 'Punto Cero Contabilidad', vertical: 'Fintech', status: 'Roadmap 2026',
    country: 'LatAm',
    desc: 'Herramientas contables inteligentes para micro y pequeñas empresas de la región.',
  },
  {
    id: 'c4', name: 'Punto Cero Educación', vertical: 'EdTech', status: 'Roadmap 2026-2027',
    country: 'LatAm',
    desc: 'Ecosistema educativo continuo, formal y complementario.',
  },
];

export const EVENTS = [
  {
    id: 'e1', title: 'Investor Roundtable · Bogotá',
    date: '12 marzo 2026', location: 'Bogotá, Colombia', modality: 'Presencial · Por invitación',
    desc: 'Encuentro presencial con inversionistas, aliados y fundadores del ecosistema.',
  },
  {
    id: 'e2', title: 'Legal Tech Latam',
    date: '3 abril 2026', location: 'Online', modality: 'Virtual · Gratis',
    desc: 'Panel público sobre la nueva ola de tecnología legal en Latinoamérica.',
  },
  {
    id: 'e3', title: 'Punto Cero Product Demo Day',
    date: '22 abril 2026', location: 'Ciudad de México', modality: 'Presencial · Registro previo',
    desc: 'Demo Day de los verticales activos del ecosistema.',
  },
  {
    id: 'e4', title: 'Founders Community Mixer',
    date: '15 mayo 2026', location: 'Medellín, Colombia', modality: 'Presencial',
    desc: 'Networking abierto para fundadores, operadores y creadores de LatAm.',
  },
];

export const AI_TOOLS = [
  {
    id: 'a1', name: 'Asistente Legal', tag: 'Legal · Beta',
    desc: 'Redacción, revisión y análisis contractual asistido por IA. Live dentro de Punto Cero Legal.',
    status: 'beta',
  },
  {
    id: 'a2', name: 'Simulador de Capital', tag: 'Investor Center',
    desc: 'Escenarios de valoración, dilución y estructura de rondas para founders y aliados.',
    status: 'preview',
  },
  {
    id: 'a3', name: 'Academia Punto Cero', tag: 'Educación',
    desc: 'Cursos y sesiones cortas curadas por la comunidad. Próximamente.',
    status: 'soon',
  },
  {
    id: 'a4', name: 'Insights Regionales', tag: 'Data',
    desc: 'Series y mapas de crecimiento sectorial en 18 países. Próximamente.',
    status: 'soon',
  },
];

export const GROUPS = [
  { id: 'g1', name: 'Legal Latam', hint: '1.2k activos', tag: 'Comunidad · Legal' },
  { id: 'g2', name: 'Fundadores & Inversión', hint: 'Privado · Curado', tag: 'Capital' },
  { id: 'g3', name: 'IA aplicada', hint: 'Nuevo · Abierto', tag: 'Tecnología' },
  { id: 'g4', name: 'Regional LatAm', hint: '18 países', tag: 'Regional' },
  { id: 'g5', name: 'Product & Design', hint: 'Abierto', tag: 'Producto' },
  { id: 'g6', name: 'Empleos & Talento', hint: 'Abierto', tag: 'Talento' },
];

// Small API-shaped helpers so the eventual switch to a real backend is drop-in.
export const mockApi = {
  listNews: async () => { await wait(); return NEWS; },
  listVideos: async () => { await wait(); return VIDEOS; },
  listJobs: async () => { await wait(); return JOBS; },
  listCompanies: async () => { await wait(); return COMPANIES; },
  listEvents: async () => { await wait(); return EVENTS; },
  listAiTools: async () => { await wait(); return AI_TOOLS; },
  listGroups: async () => { await wait(); return GROUPS; },
};
