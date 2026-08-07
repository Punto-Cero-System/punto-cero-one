import React from 'react';
import { RightCard, EventRow } from './rightBlocks';

const EventsWidget = () => (
  <RightCard title="Próximos eventos" icon="events" testid="workspace-widget-events"
    seeAllHref="/eventos" seeAllLabel="Ver todos los eventos">
    <EventRow month="MAR" day="12" title="Investor Roundtable" hint="Bogotá · Presencial" />
    <EventRow month="ABR" day="03" title="Legal Tech Latam" hint="Online · Gratis" />
  </RightCard>
);
export default EventsWidget;
