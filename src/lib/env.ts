/**
 * Phase 9 — Production Environment Configuration & Validation Helper
 * 
 * Safely inspects and validates required and optional client-side environment variables,
 * ensuring no private server credentials or secrets can be bundled or accessed.
 */

export interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  spotifyClientId: string;
  spotifyRedirectUri?: string;
  appEnv: 'development' | 'staging' | 'production' | 'test';
  appBaseUrl?: string;
  isSupabaseConfigured: boolean;
  isSpotifyConfigured: boolean;
}

export interface EnvironmentValidationReport {
  isValid: boolean;
  environment: string;
  configuredServices: {
    supabase: boolean;
    spotify: boolean;
    customSpotifyRedirect: boolean;
  };
  warnings: string[];
  errors: string[];
}

/**
 * Parses and returns the typed client environment configuration.
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const env = import.meta.env;

  const supabaseUrl = (env.VITE_SUPABASE_URL || '').trim();
  const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();
  const spotifyClientId = (env.VITE_SPOTIFY_CLIENT_ID || '').trim();
  const spotifyRedirectUri = (env.VITE_SPOTIFY_REDIRECT_URI || '').trim() || undefined;
  const appEnvRaw = (env.VITE_APP_ENV || env.MODE || 'development').toLowerCase();
  const appBaseUrl = (env.VITE_APP_BASE_URL || '').trim() || undefined;

  const appEnv: EnvironmentConfig['appEnv'] =
    appEnvRaw === 'production'
      ? 'production'
      : appEnvRaw === 'staging'
      ? 'staging'
      : appEnvRaw === 'test'
      ? 'test'
      : 'development';

  const isSupabaseConfigured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder')
  );

  const isSpotifyConfigured = Boolean(
    spotifyClientId && !spotifyClientId.includes('placeholder')
  );

  return {
    supabaseUrl,
    supabaseAnonKey,
    spotifyClientId,
    spotifyRedirectUri,
    appEnv,
    appBaseUrl,
    isSupabaseConfigured,
    isSpotifyConfigured,
  };
}

/**
 * Validates the current client environment configuration and produces an audit report.
 */
export function validateEnvironment(): EnvironmentValidationReport {
  const config = getEnvironmentConfig();
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for accidentally leaked sensitive keys
  const metaEnvKeys = Object.keys(import.meta.env);
  const forbiddenPatterns = [
    /SERVICE_ROLE/i,
    /SECRET/i,
    /PRIVATE_KEY/i,
    /DATABASE_PASSWORD/i,
  ];

  metaEnvKeys.forEach((key) => {
    if (forbiddenPatterns.some((pattern) => pattern.test(key))) {
      errors.push(
        `CRITICAL SECURITY VIOLATION: Dangerous server secret key "${key}" detected in frontend environment variables. Remove it immediately from .env!`
      );
    }
  });

  if (!config.isSupabaseConfigured) {
    warnings.push(
      'Supabase credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are unconfigured or using placeholders. Application is operating in local-first resilient mode (IndexedDB & LocalStorage).'
    );
  }

  if (!config.isSpotifyConfigured) {
    warnings.push(
      'Spotify Client ID (VITE_SPOTIFY_CLIENT_ID) is not set in environment. Users must provide their Client ID in Settings to import Spotify playlists.'
    );
  }

  return {
    isValid: errors.length === 0,
    environment: config.appEnv,
    configuredServices: {
      supabase: config.isSupabaseConfigured,
      spotify: config.isSpotifyConfigured,
      customSpotifyRedirect: Boolean(config.spotifyRedirectUri),
    },
    warnings,
    errors,
  };
}
