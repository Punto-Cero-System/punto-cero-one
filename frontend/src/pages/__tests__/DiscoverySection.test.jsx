import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>,
}), { virtual: true });

jest.mock('../../components/Header', () => ({
  NAV_ITEMS: [
    { key: 'community', label: 'Comunidad', to: '/comunidad', icon: 'community' },
    { key: 'news', label: 'Noticias', to: '/noticias', icon: 'news' },
    { key: 'companies', label: 'Empresas', to: '/empresas', icon: 'companies' },
  ],
}));

jest.mock('../../contexts/CommunityAuthContext', () => ({
  useCommunityAuth: () => ({ user: null }),
}));

import DiscoverySection from '../../components/community/DiscoverySection';

describe('DiscoverySection commercial entry', () => {
  it('explains the ecosystem relationship and points to solutions', () => {
    render(<DiscoverySection />);

    expect(screen.getByText(/Punto Cero One es la puerta de entrada a Punto Cero System/i)).toBeInTheDocument();
    expect(screen.getByTestId('discovery-next-step-cta')).toHaveAttribute('href', '/capital');
    expect(screen.getByTestId('discovery-next-step-cta')).toHaveTextContent('Explorar soluciones');
  });
});
