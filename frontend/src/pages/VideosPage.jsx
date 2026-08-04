import React from 'react';
import CategoryPage from '../components/CategoryPage';
import ExternalSourcesSection from '../components/community/ExternalSourcesSection';

/**
 * VideosPage — Wave 12: powered by the Content Sources System.
 * Zero-API-key. Curated YouTube channels categorized by topic. Users
 * click through to YouTube; we never scrape or store video content.
 */
const VideosPage = () => (
  <CategoryPage
    icon="video"
    eyebrow="Videos & Canales"
    title="Aprende de los mejores canales del ecosistema"
    subtitle="IA, Marketing, Negocios, Tecnología y Emprendimiento. Todos los enlaces abren en YouTube."
    testid="videos-page"
  >
    <ExternalSourcesSection
      type="videos"
      title="Canales recomendados"
      subtitle="Curación de canales educativos por categoría."
      limit={24}
      testid="videos-external-sources"
    />
  </CategoryPage>
);

export default VideosPage;
