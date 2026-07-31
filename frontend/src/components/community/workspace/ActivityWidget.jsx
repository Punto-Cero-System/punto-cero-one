import React from 'react';
import { SidebarBlock, ActivityRow } from './blocks';

const ActivityWidget = () => (
  <SidebarBlock title="Actividad" testid="workspace-widget-activity">
    <ActivityRow label="Publicaciones" value="—" />
    <ActivityRow label="Impresiones" value="—" />
    <ActivityRow label="Conexiones" value="—" />
  </SidebarBlock>
);
export default ActivityWidget;
