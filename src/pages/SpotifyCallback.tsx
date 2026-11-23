import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleAuthCallback } from '../lib/spotify/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export function SpotifyCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const authError = searchParams.get('error');

    if (authError) {
      setIsProcessing(false);
      if (authError === 'access_denied') {
        setError('Authorization cancelled. You chose not to grant PlaylistVault access to your Spotify account.');
      } else {
        setError(`Spotify authorization failed: ${authError}`);
      }
      return;
    }

    if (!code || !state) {
      setIsProcessing(false);
      setError('Missing authorization code or state parameter in Spotify callback.');
      return;
    }

    async function processCode() {
      try {
        const { returnPath } = await handleAuthCallback(code!, state!);
        navigate(returnPath || '/playlists', { replace: true });
      } catch (err) {
        setIsProcessing(false);
        setError(err instanceof Error ? err.message : 'Failed to complete Spotify authorization.');
      }
    }

    processCode();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-5 bg-spotify-surface border border-spotify-border shadow-2xl">
        {isProcessing ? (
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-full bg-spotify-surface-elevated text-spotify-primary flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-spotify-secondary">
              Authorizing Spotify Account
            </h2>
            <p className="text-xs text-spotify-on-surface leading-relaxed">
              Exchanging PKCE cryptographic tokens securely with Spotify accounts service...
            </p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-full bg-spotify-error/15 text-spotify-error flex items-center justify-center mx-auto border border-spotify-error/30">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-spotify-secondary">
              Authorization Unsuccessful
            </h2>
            <p className="text-xs text-spotify-error bg-spotify-error/10 p-3 rounded-md border border-spotify-error/20 leading-relaxed">
              {error}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/settings')}
              >
                Go to Settings
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/playlists')}
              >
                Go to Playlists
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-full bg-spotify-primary/15 text-spotify-primary flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-spotify-secondary">
              Connected Successfully
            </h2>
            <p className="text-xs text-spotify-on-surface">Redirecting to your playlists...</p>
          </div>
        )}
      </Card>
    </div>
  );
}
