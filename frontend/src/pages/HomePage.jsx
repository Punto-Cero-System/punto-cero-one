import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CustomCursor from '../components/CustomCursor';

// Founders / people components — reused inside the SECONDARY slider (feed).
import FoundersSection from '../components/FoundersSection';
import PeopleSection from '../components/PeopleSection';
import CareersSection from '../components/CareersSection';

// Community layout & building blocks.
import CommunityLayout from '../components/community/CommunityLayout';
import LeftSidebar from '../components/community/LeftSidebar';
import RightWidgets from '../components/community/RightWidgets';
import FeedComposer from '../components/community/FeedComposer';
import FeedItem from '../components/community/FeedItem';
import { InlineWidgetStrip } from '../components/community/Widgets';
import SlideCarousel from '../components/SlideCarousel';

// Redesigned primary slider content (professional, feed-friendly).
import { PRIMARY_SLIDES } from '../components/PrimarySlides';

/**
 * HomePage — Punto Cero One community home.
 * ── Primary slider on top (redesigned, 6 modern slides, 12s autoplay).
 * ── 3-column community layout (left sidebar / feed / right widgets).
 * ── Feed alternates content with inline widget strips + a secondary embedded
 *    slider that reuses the founders / people / careers components.
 */
const SECONDARY_SLIDES = [
  { key: 'founders', node: <FoundersSection /> },
  { key: 'people', node: <PeopleSection /> },
  { key: 'careers', node: <CareersSection /> },
];

const HomePage = () => {
  return (
    <>
      <CustomCursor />
      <Header />

      <main id="top" style={{ paddingTop: '58px', background: '#F4F6FB', minHeight: '100vh' }}>
        <CommunityLayout
          top={
            <SlideCarousel
              id="pc-slider-primary"
              slides={PRIMARY_SLIDES}
              autoplayMs={12000}
              height="clamp(520px, 74vh, 720px)"
              label="Slider principal · visión Punto Cero One"
            />
          }
          left={<LeftSidebar />}
          center={
            <>
              <FeedComposer />

              <FeedItem
                kind="update"
                author="Punto Cero One"
                timestamp="Hace 5 min · Actualización oficial"
                title="Punto Cero Legal · LIVE en producción"
                body="El primer vertical comercial del ecosistema ya está operativo. La base tecnológica compartida validada por un producto real."
                cta={{ label: 'Ir a puntocerolegal.com', href: 'https://puntocerolegal.com', external: true, testid: 'legal-external' }}
              />

              <InlineWidgetStrip />

              <FeedItem
                kind="news"
                author="Investor Center"
                timestamp="Hoy"
                title="Nuevo Executive Summary + Pitch Deck disponibles"
                body="13 secciones editoriales y 12 slides cinematográficos con descarga en PDF. La narrativa de capital se reposiciona hacia crecimiento comercial."
                cta={{ label: 'Explorar Capital', to: '/capital', testid: 'capital-hub' }}
              />

              <FeedItem
                kind="video"
                author="Comunidad · Videos"
                timestamp="Trending"
                title="La visión detrás de Punto Cero One (video)"
                body="Introducción cinematográfica al ecosistema tecnológico latinoamericano."
                cover="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80"
              />

              {/* Secondary slider embedded as a feed item */}
              <FeedItem
                kind="slider"
                author="The Founding Team"
                timestamp="Historia del ecosistema"
                title="Las personas detrás de la visión → 18 países"
                body="Recorrido por el equipo fundador, la comunidad y la ambición regional para Latinoamérica."
                padded={false}
                node={
                  <SlideCarousel
                    id="pc-slider-team"
                    slides={SECONDARY_SLIDES}
                    autoplayMs={12000}
                    height="clamp(520px, 68vh, 720px)"
                    label="Slider equipo fundador y comunidad"
                  />
                }
              />

              <FeedItem
                kind="job"
                author="Empresas del ecosistema"
                timestamp="Nuevo"
                title="Buscamos desarrolladores full-stack (senior)"
                body="Únete al equipo que construye la infraestructura tecnológica de Latinoamérica. Stack: React · FastAPI · MongoDB · IA."
                meta={{ company: 'Punto Cero System', location: 'Remoto · LatAm' }}
                cta={{ label: 'Postular / conocer más', to: '/join', testid: 'jobs-apply' }}
              />

              <FeedItem
                kind="event"
                author="Eventos · Comunidad"
                timestamp="Próximo"
                title="Investor Roundtable · Bogotá"
                body="Encuentro presencial con inversionistas, aliados y fundadores. Cupo limitado por invitación."
                meta={{ date: '12 marzo 2026', location: 'Bogotá, Colombia' }}
                cta={{ label: 'Solicitar invitación', to: '/join', testid: 'event-request' }}
              />

              <InlineWidgetStrip />

              <FeedItem
                kind="company"
                author="Empresas"
                timestamp="Destacado"
                title="Punto Cero Legal está contratando aliados legales"
                body="Abogados y firmas interesadas en integrarse a la plataforma para servir clientes en Latinoamérica."
                cta={{ label: 'Escribir al equipo', href: 'mailto:puntocerosystem@gmail.com', testid: 'company-mail' }}
              />

              <FeedItem
                kind="post"
                author="Comunidad"
                timestamp="Trending"
                title="Empezar desde cero no es una desventaja"
                body="Es donde comienza la transformación. Comparte con la comunidad qué transformación estás construyendo desde tu propio Punto Cero."
              />
            </>
          }
          right={<RightWidgets />}
        />
      </main>

      <Footer />
    </>
  );
};

export default HomePage;
