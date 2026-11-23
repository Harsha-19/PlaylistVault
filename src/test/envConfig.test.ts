import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEnvironmentConfig, validateEnvironment } from '../lib/env';

describe('Phase 9 — Environment Configuration & Deployment Readiness', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly reads environment configuration from import.meta.env', () => {
    const config = getEnvironmentConfig();
    expect(config).toBeDefined();
    expect(typeof config.supabaseUrl).toBe('string');
    expect(typeof config.supabaseAnonKey).toBe('string');
    expect(typeof config.spotifyClientId).toBe('string');
    expect(['development', 'staging', 'production', 'test']).toContain(config.appEnv);
  });

  it('validates environment cleanly when no forbidden server secrets are present', () => {
    const report = validateEnvironment();
    expect(report.isValid).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.environment).toBeDefined();
    expect(report.configuredServices).toBeDefined();
  });

  it('flags critical security violation when a server secret key is injected into environment', () => {
    // Simulate accidental leak of SUPABASE_SERVICE_ROLE_KEY into import.meta.env
    try {
      (import.meta.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY = 'secret-key-that-must-not-leak';
      const report = validateEnvironment();
      expect(report.isValid).toBe(false);
      expect(report.errors.some((err) => err.includes('CRITICAL SECURITY VIOLATION'))).toBe(true);
      expect(report.errors.some((err) => err.includes('SERVICE_ROLE'))).toBe(true);
    } finally {
      delete (import.meta.env as any).VITE_SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it('flags warning when Supabase is unconfigured or placeholder', () => {
    const originalUrl = import.meta.env.VITE_SUPABASE_URL;
    try {
      (import.meta.env as any).VITE_SUPABASE_URL = 'https://placeholder.supabase.co';
      const report = validateEnvironment();
      expect(report.configuredServices.supabase).toBe(false);
      expect(report.warnings.some((w) => w.includes('Supabase credentials'))).toBe(true);
    } finally {
      (import.meta.env as any).VITE_SUPABASE_URL = originalUrl;
    }
  });
});
