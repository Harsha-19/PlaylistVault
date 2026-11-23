import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PlayerBar } from './PlayerBar';

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-spotify-neutral text-spotify-secondary">
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-8 py-6 focus:outline-none">
          <div className="max-w-7xl mx-auto space-y-8">
            <Outlet />
          </div>
        </main>
        <PlayerBar />
      </div>
    </div>
  );
}
