import React from 'react';
import { SidebarBlock, QuickLink } from './blocks';

const QuickLinksWidget = () => (
  <SidebarBlock title="Accesos rápidos" testid="workspace-widget-quick-links">
    <QuickLink icon="home" label="Mi Espacio" to="/" />
    <QuickLink icon="community" label="Comunidad" href="#feed" />
    <QuickLink icon="capital" label="Capital" to="/capital" />
    <QuickLink icon="legal" label="Punto Cero Legal" href="https://puntocerolegal.com" external />
    <QuickLink icon="jobs" label="Empleos" to="/empleos" />
    <QuickLink icon="events" label="Eventos" to="/eventos" />
    <QuickLink icon="companies" label="Empresas" to="/empresas" />
  </SidebarBlock>
);
export default QuickLinksWidget;
