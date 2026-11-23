import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ListMusic,
  AudioWaveform,
  Cpu,
  Archive,
  Settings,
  ShieldCheck,
  Disc3,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  { name: 'Playlists', to: '/playlists', icon: ListMusic },
  { name: 'Audio Library', to: '/audio', icon: AudioWaveform },
  { name: 'Match Studio', to: '/match', icon: Cpu },
  { name: 'Export Vault', to: '/export', icon: Archive },
  { name: 'Settings', to: '/settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-spotify-neutral border-r border-spotify-border/40 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-full bg-spotify-surface border border-spotify-primary/40 flex items-center justify-center text-spotify-primary group-hover:scale-105 transition-transform">
            <Disc3 className="w-5 h-5 animate-spin-slow text-spotify-primary" />
          </div>
          <div>
            <span className="font-bold text-base text-spotify-secondary tracking-tight block">
              PlaylistVault
            </span>
            <span className="text-[10px] uppercase font-semibold text-spotify-on-surface tracking-wider">
              Audio Organizer
            </span>
          </div>
        </NavLink>
        <div title="Authorized Metadata Only">
          <ShieldCheck className="w-4 h-4 text-spotify-primary" />
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="px-3 py-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3.5 px-3 py-2.5 rounded-md text-sm font-semibold transition-all duration-150',
                isActive
                  ? 'bg-spotify-surface text-spotify-secondary shadow-sm'
                  : 'text-spotify-on-surface hover:text-spotify-secondary hover:bg-spotify-surface/40'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'w-5 h-5 transition-colors',
                    isActive ? 'text-spotify-primary' : 'text-spotify-on-surface'
                  )}
                />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="text-[10px] bg-spotify-surface px-2 py-0.5 rounded-full text-spotify-secondary font-bold">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-4 my-3 border-t border-spotify-border/40" />

      {/* Quick Vault Status Banner */}
      <div className="px-3 py-2">
        <div className="p-3.5 rounded-md bg-spotify-surface/50 border border-spotify-border/50 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-spotify-secondary text-[11px] uppercase tracking-wider">
              Offline Standalone
            </span>
            <span className="w-2 h-2 rounded-full bg-spotify-primary inline-block" />
          </div>
          <p className="text-spotify-on-surface text-[11px] leading-relaxed">
            ZIP exports include self-contained bit-perfect audio and standalone metadata.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-auto p-4 border-t border-spotify-border/40">
        <div className="text-[11px] text-spotify-on-surface/80 flex items-center justify-between">
          <span>Design: Spotify Dark</span>
          <span className="font-mono text-[10px] bg-spotify-surface px-1.5 py-0.5 rounded text-spotify-primary">
            v1.0-Phase1
          </span>
        </div>
        <p className="text-[10px] text-spotify-on-surface/60 mt-1.5 flex items-center gap-1">
          Authorized Metadata & Files <ExternalLink className="w-2.5 h-2.5" />
        </p>
      </div>
    </aside>
  );
}
