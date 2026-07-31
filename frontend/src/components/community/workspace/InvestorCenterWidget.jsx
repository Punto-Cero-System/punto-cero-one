import React from 'react';
import { RightCard, CompanyRow } from './rightBlocks';

const InvestorCenterWidget = () => (
  <RightCard title="Investor Center" icon="capital" testid="workspace-widget-investor-center">
    <CompanyRow tag="Strategic growth · institucional" name="Punto Cero · Capital" to="/capital" />
  </RightCard>
);
export default InvestorCenterWidget;
