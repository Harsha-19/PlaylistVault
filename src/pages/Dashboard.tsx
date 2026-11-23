import { useNavigate } from 'react-router-dom';
import {
  ListMusic,
  AudioWaveform,
  Cpu,
  Archive,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-md bg-gradient-to-r from-spotify-surface to-spotify-surface-highlight border border-spotify-border/60 p-8">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="success" size="sm" className="gap-1.5 py-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Authorized & Compliance-First
            </Badge>
            <span className="text-xs text-spotify-on-surface">Spotify Web API Metadata</span>
          </div>

          <h1 className="text-3xl font-bold text-spotify-secondary tracking-tight">
            PlaylistVault Music Manager
          </h1>
          <p className="text-sm text-spotify-on-surface leading-relaxed">
            Import official Spotify playlist metadata, pair them with your own authorized audio files,
            organize by genre, and package them into independent, offline ZIP archives with CSV and JSON schemas.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="default"
              onClick={() => navigate('/playlists')}
              className="gap-2"
            >
              <ListMusic className="w-4 h-4" />
              Explore Playlists
            </Button>
            <Button
              variant="secondary"
              size="default"
              onClick={() => navigate('/audio')}
              className="gap-2"
            >
              <AudioWaveform className="w-4 h-4" />
              Upload Audio Files
            </Button>
          </div>
        </div>

        {/* Decorative background element */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-spotify-primary/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          variant="interactive"
          onClick={() => navigate('/playlists')}
          className="flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-spotify-on-surface mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Vaulted Playlists</span>
            <ListMusic className="w-4 h-4 text-spotify-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-spotify-secondary">0</div>
            <p className="text-[11px] text-spotify-on-surface mt-1">Imported via Spotify API</p>
          </div>
        </Card>

        <Card
          variant="interactive"
          onClick={() => navigate('/audio')}
          className="flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-spotify-on-surface mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Audio Library</span>
            <AudioWaveform className="w-4 h-4 text-spotify-secondary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-spotify-secondary">0 Files</div>
            <p className="text-[11px] text-spotify-on-surface mt-1">Verified local audio files</p>
          </div>
        </Card>

        <Card
          variant="interactive"
          onClick={() => navigate('/match')}
          className="flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-spotify-on-surface mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Match Readiness</span>
            <Cpu className="w-4 h-4 text-spotify-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-spotify-secondary">0%</div>
            <p className="text-[11px] text-spotify-on-surface mt-1">Tracks matched to audio</p>
          </div>
        </Card>

        <Card
          variant="interactive"
          onClick={() => navigate('/export')}
          className="flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-spotify-on-surface mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Offline Archives</span>
            <Archive className="w-4 h-4 text-spotify-secondary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-spotify-secondary">0 ZIPs</div>
            <p className="text-[11px] text-spotify-on-surface mt-1">Self-contained exports</p>
          </div>
        </Card>
      </div>

      {/* Workflow Step Progression */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-spotify-secondary">
            Development & Operational Workflow
          </h2>
          <span className="text-xs text-spotify-on-surface">Hierarchical Pipeline</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="flex flex-col justify-between p-5 space-y-4">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-spotify-surface-elevated text-spotify-primary flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="font-bold text-base text-spotify-secondary">1. Import Metadata</h3>
              <p className="text-xs text-spotify-on-surface leading-relaxed">
                Connect official Spotify public playlists. Retrieve clean track names, artists,
                album data, and ISRC tags without downloading copyrighted streams.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/playlists')}
              className="w-full justify-between"
            >
              <span>Go to Playlists</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Card>

          <Card className="flex flex-col justify-between p-5 space-y-4">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-spotify-surface-elevated text-spotify-primary flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="font-bold text-base text-spotify-secondary">2. Upload & Match Audio</h3>
              <p className="text-xs text-spotify-on-surface leading-relaxed">
                Upload your authorized local audio files. Extract ID3 tags via client-side workers,
                run automated fuzzy matching, and manually adjust pairings.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/match')}
              className="w-full justify-between"
            >
              <span>Open Match Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Card>

          <Card className="flex flex-col justify-between p-5 space-y-4">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-spotify-surface-elevated text-spotify-primary flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="font-bold text-base text-spotify-secondary">3. Export Offline Archive</h3>
              <p className="text-xs text-spotify-on-surface leading-relaxed">
                Package actual audio bytes alongside CSV and JSON metadata into a portable ZIP archive.
                Guaranteed to operate independently without internet access.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/export')}
              className="w-full justify-between"
            >
              <span>Export Archives</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Card>
        </div>
      </div>

      {/* Compliance & Security Guarantee Section */}
      <Card className="bg-spotify-surface border border-spotify-border/80 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-spotify-primary" />
              <h3 className="font-bold text-spotify-secondary text-sm">
                Legal & Security Architecture Standard
              </h3>
            </div>
            <p className="text-xs text-spotify-on-surface max-w-3xl leading-relaxed">
              PlaylistVault strictly enforces metadata-only Spotify integration. No stream ripping, DRM circumvention,
              or unofficial endpoints are implemented. User audio files are processed locally in-browser and protected by
              PostgreSQL Row Level Security (RLS).
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="success" size="sm" className="font-mono">
              RLS ENABLED
            </Badge>
            <Badge variant="neutral" size="sm" className="font-mono">
              STRICT METADATA
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
