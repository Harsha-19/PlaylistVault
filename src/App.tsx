import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { SpotifyProvider } from './context/SpotifyContext';
import { AudioProvider } from './context/AudioContext';
import { MatchProvider } from './context/MatchContext';
import { CollectionProvider } from './context/CollectionContext';
import { ExportProvider } from './context/ExportContext';
import { PlayerProvider } from './context/PlayerContext';
import { AppLayout } from './components/layout/AppLayout';

// Route-level code splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Playlists = lazy(() => import('./pages/Playlists').then((m) => ({ default: m.Playlists })));
const PlaylistDetail = lazy(() => import('./pages/PlaylistDetail').then((m) => ({ default: m.PlaylistDetail })));
const AudioLibrary = lazy(() => import('./pages/AudioLibrary').then((m) => ({ default: m.AudioLibrary })));
const MatchStudio = lazy(() => import('./pages/MatchStudio').then((m) => ({ default: m.MatchStudio })));
const ExportVault = lazy(() => import('./pages/ExportVault').then((m) => ({ default: m.ExportVault })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const SpotifyCallback = lazy(() => import('./pages/SpotifyCallback').then((m) => ({ default: m.SpotifyCallback })));

const PageLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 rounded-full border-2 border-spotify-accent border-t-transparent animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SpotifyProvider>
          <AudioProvider>
            <MatchProvider>
              <CollectionProvider>
                <PlayerProvider>
                  <ExportProvider>
                    <BrowserRouter>
                      <Suspense fallback={<PageLoadingFallback />}>
                        <Routes>
                          <Route element={<AppLayout />}>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/playlists" element={<Playlists />} />
                            <Route path="/playlists/:id" element={<PlaylistDetail />} />
                            <Route path="/audio" element={<AudioLibrary />} />
                            <Route path="/match" element={<MatchStudio />} />
                            <Route path="/export" element={<ExportVault />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/callback" element={<SpotifyCallback />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Route>
                        </Routes>
                      </Suspense>
                    </BrowserRouter>
                  </ExportProvider>
                </PlayerProvider>
              </CollectionProvider>
            </MatchProvider>
          </AudioProvider>
        </SpotifyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
