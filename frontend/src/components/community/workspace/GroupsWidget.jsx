import React from 'react';
import { SidebarBlock, GroupRow } from './blocks';

const GroupsWidget = () => (
  <SidebarBlock title="Grupos" testid="workspace-widget-groups">
    <GroupRow icon="legal" label="Legal Latam" hint="1.2k activos" />
    <GroupRow icon="capital" label="Fundadores & inversión" hint="Comunidad privada" />
    <GroupRow icon="ai" label="IA aplicada" hint="Nuevo · abierto" />
  </SidebarBlock>
);
export default GroupsWidget;
