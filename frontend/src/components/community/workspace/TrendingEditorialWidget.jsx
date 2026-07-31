import React from 'react';
import { RightCard, TrendRow } from './rightBlocks';

const TrendingEditorialWidget = () => (
  <RightCard title="Tendencias editoriales" icon="ai" testid="workspace-widget-trending-editorial">
    <TrendRow n={1} label="#PuntoCeroLegal" meta="Producto LIVE" />
    <TrendRow n={2} label="#Latam18" meta="Ecosistema regional" />
    <TrendRow n={3} label="#StartFromZero" meta="Cultura fundadora" />
    <TrendRow n={4} label="#IAaplicada" meta="Casos reales" />
  </RightCard>
);
export default TrendingEditorialWidget;
