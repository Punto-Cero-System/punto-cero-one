# Punto Cero System — PRD

## Original Problem Statement
Transformar el sitio de Punto Cero System en una experiencia tecnológica premium, cinematográfica e institucional para Latinoamérica. Debe transmitir la visión de una holding tecnológica en etapa temprana con:
- Landing corporativo estricto de 8 bloques narrativos.
- Diseño orgánico/circular/orbital (evitar cards SaaS cuadradas).
- Mapa interactivo multi-país (18 países LatAm).
- Arquitectura preparada para una Investor Room privada.
- Investor Pitch Deck interactivo de 12 secciones completamente conectado.

**Idioma:** Todo el contenido UI y las respuestas al usuario en **Español**.

## Personas
- Inversionistas early-stage
- Aliados estratégicos y ecosistema
- Profesionales, emprendedores y empresas en LatAm

## Core Requirements
- Paleta: Navy `#0B1F3A`, Emerald `#00C896`, Gold `#D4AF37`.
- Motion: Framer Motion + Lenis smooth scroll.
- Tipografía: Space Grotesk + system stack.
- Sin branding "Emergent" en UI/metadata.
- Punto Cero Legal siempre enlaza externamente a `puntocerolegal.com`.

## Arquitectura de Rutas (React Router)
- `/` — HomePage (8 bloques)
- `/investor-room` — InvestorRoomPreview (arquitectura, mockup)
- `/request-access` — Formulario solicitud (localStorage MOCKED)
- `/investor-pitch-deck` — Pitch Deck 12-slide (nuevo)

## Estructura de Componentes
```
/app/frontend/src/
├── App.js
├── components/
│   ├── Header.jsx, Footer.jsx
│   ├── HeroSection.jsx, VisionSection.jsx
│   ├── CircularCore.jsx, OrbitalEcosystem.jsx
│   ├── LatinAmericaBlock.jsx
│   ├── PeopleSection.jsx
│   ├── InvestorContactBlock.jsx
│   └── PitchDeckPreview.jsx
└── pages/
    ├── HomePage.jsx
    ├── InvestorRoomPreview.jsx
    ├── InvestorRequestPage.jsx
    └── InvestorPitchDeckPage.jsx
```

## Implementado (2026-02)
- ✅ Landing 8 bloques (Hero, Visión, Core, Ecosistema, LatAm, Comunidad, Pitch Preview, Contacto).
- ✅ Diseño circular/orbital + fotografía editorial (Unsplash).
- ✅ Mapa interactivo 18 países.
- ✅ Investor Room preview + Request Access form (MOCKED - localStorage).
- ✅ Lenis smooth scroll + Framer Motion.
- ✅ **Investor Pitch Deck (12 slides)** conectado por routing y CTAs:
  - Cover, La Oportunidad, La Visión, Shared Technology Core, Punto Cero Legal (80% dev), 18 Países, Por qué la arquitectura importa, El Ecosistema, Roadmap, Modelo de Negocio, Etapa Actual (transparencia), La Conversación.
  - Nav superior fijo con "Volver a Punto Cero System" + progress bar + link externo a Punto Cero Legal.
  - Footer bridge con ambos enlaces.
  - CTA dorada `Explorar Investor Pitch Deck` en el Home (PitchDeckPreview).

## Roadmap / Backlog
- **P1**: Backend real de Investor Room — auth, roles, servicio seguro de documentos (actualmente MOCKED).
- **P1**: Persistir Request Access en MongoDB (actualmente localStorage).
- **P2**: Panel administrativo para revisar solicitudes de acceso.
- **P2**: Analytics de scroll y engagement por slide del deck.
- **P3**: Descarga PDF del Pitch Deck.
- **P3**: Localización EN/PT para expansión regional.

## Integraciones (actuales)
- Unsplash (imágenes vía URL — sin key).
- WhatsApp deep link para contacto directo.

## Notas Técnicas Críticas
- **Directiva de usuario**: "Ejecutar directamente, sin preguntas adicionales."
- **Diseño**: Nada de cards cuadradas — usar círculos, órbitas, nodos pulsantes, whitespace generoso.
- **Enlaces externos**: `puntocerolegal.com` siempre externo (target=_blank).
- Todo texto UI en español.
