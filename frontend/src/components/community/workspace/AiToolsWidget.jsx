import React from 'react';
import { RightCard, ToolRow } from './rightBlocks';

const AiToolsWidget = () => (
  <RightCard title="IA & Herramientas" icon="ai" testid="workspace-widget-ai-tools">
    <ToolRow icon="ai" label="Asistente Legal (beta)" hint="Punto Cero Legal" />
    <ToolRow icon="capital" label="Simulador de Capital" hint="Escenarios financieros" />
    <ToolRow icon="learn" label="Academia" hint="Próximamente" />
  </RightCard>
);
export default AiToolsWidget;
