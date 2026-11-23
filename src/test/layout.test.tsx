import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { AuthProvider } from '../context/AuthContext';
import { PlayerProvider } from '../context/PlayerContext';

describe('Layout Components', () => {
  it('renders Sidebar with brand logo and all primary navigation links', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('PlaylistVault')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.getByText('Audio Library')).toBeInTheDocument();
    expect(screen.getByText('Match Studio')).toBeInTheDocument();
    expect(screen.getByText('Export Vault')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders TopBar with auth actions and history navigation buttons', () => {
    render(
      <AuthProvider>
        <PlayerProvider>
          <MemoryRouter>
            <TopBar />
          </MemoryRouter>
        </PlayerProvider>
      </AuthProvider>
    );

    expect(screen.getByTitle('Go back')).toBeInTheDocument();
    expect(screen.getByTitle('Go forward')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });
});
