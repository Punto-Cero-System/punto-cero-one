import React from 'react';
import { RightCard, CompanyRow } from './rightBlocks';

const CompaniesWidget = () => (
  <RightCard title="Empresas del ecosistema" icon="companies" testid="workspace-widget-companies">
    <CompanyRow tag="Legal · vertical" name="Punto Cero Legal" href="https://puntocerolegal.com" external />
  </RightCard>
);
export default CompaniesWidget;
