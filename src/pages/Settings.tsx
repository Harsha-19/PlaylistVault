/**
 * Phase 7 — Settings & Data Management
 * 
 * Central hub for:
 * 1. API Integrations & OAuth PKCE credentials
 * 2. Local Storage Management (browser quotas, persistent storage, orphan cleanup)
 * 3. Application Metadata Backup, Restore, and Data Portability
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Key,
  ShieldCheck,
  CheckCircle,
  Database,
  Link2,
  Unlink,
  User as UserIcon,
  Copy,
  Check,
  HardDrive,
  FileJson,
  UploadCloud,
  Download,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { isSupabaseConfigured } from '../lib/supabase';
import { useSpotify } from '../context/SpotifyContext';
import { useAuth } from '../context/AuthContext';
import { getSpotifyRedirectUri } from '../lib/spotify/auth';
import {
  LocalStorageManager,
  StorageQuotaInfo,
  StorageBreakdownInfo,
  OrphanInspectionResult,
} from '../lib/storage/localStorageManager';
import {
  MetadataBackupService,
  BackupValidationResult,
} from '../lib/storage/metadataBackupService';
import { formatBytes } from '../lib/utils';

export function Settings() {
  const {
    isConnected,
    spotifyUser,
    connectSpotify,
    disconnectSpotify,
    isLoading: isSpotifyLoading,
  } = useSpotify();
  const { user } = useAuth();
  const userId = user?.id || 'local-user';

  // Active view tab: 'general', 'storage', or 'backup'
  const [activeTab, setActiveTab] = useState<'general' | 'storage' | 'backup'>('general');

  // Spotify Settings State
  const [spotifyClientId, setSpotifyClientId] = useState(
    localStorage.getItem('pv_custom_spotify_client_id') ||
      import.meta.env.VITE_SPOTIFY_CLIENT_ID ||
      ''
  );
  const [supabaseUrl] = useState(
    import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
  );
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Storage Quota State
  const [quotaInfo, setQuotaInfo] = useState<StorageQuotaInfo | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdownInfo | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);

  // Orphan Audit State
  const [orphanAudit, setOrphanAudit] = useState<OrphanInspectionResult | null>(null);
  const [isAuditingOrphans, setIsAuditingOrphans] = useState(false);
  const [isCleaningOrphans, setIsCleaningOrphans] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Metadata Backup & Restore State
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [restoreStrategy, setRestoreStrategy] = useState<'merge' | 'overwrite'>('merge');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const redirectUri = getSpotifyRedirectUri();

  // Load storage quota and breakdown
  const refreshStorageData = useCallback(async () => {
    setIsLoadingQuota(true);
    try {
      const quota = await LocalStorageManager.getStorageQuota();
      const bdown = await LocalStorageManager.getStorageBreakdown(userId);
      setQuotaInfo(quota);
      setBreakdown(bdown);
    } catch (err) {
      console.warn('[PlaylistVault] Failed to load storage quota:', err);
    } finally {
      setIsLoadingQuota(false);
    }
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'storage') {
      refreshStorageData();
    }
  }, [activeTab, refreshStorageData]);

  // Request Persistent Storage
  const handleRequestPersist = async () => {
    setIsRequestingPersist(true);
    try {
      const persisted = await LocalStorageManager.requestPersistentStorage();
      if (quotaInfo) {
        setQuotaInfo({ ...quotaInfo, isPersistent: persisted });
      }
    } finally {
      setIsRequestingPersist(false);
    }
  };

  // Inspect Orphaned Records
  const handleInspectOrphans = async () => {
    setIsAuditingOrphans(true);
    setCleanupMessage(null);
    try {
      const result = await LocalStorageManager.inspectOrphanedRecords(userId);
      setOrphanAudit(result);
    } finally {
      setIsAuditingOrphans(false);
    }
  };

  // Clean Orphaned Records
  const handleCleanupOrphans = async () => {
    setIsCleaningOrphans(true);
    try {
      const result = await LocalStorageManager.cleanupOrphanedRecords(userId);
      setCleanupMessage(
        `Successfully cleaned up ${result.cleanedMatches} orphaned match records and ${result.cleanedRefs} collection references.`
      );
      setOrphanAudit(null);
      await refreshStorageData();
    } finally {
      setIsCleaningOrphans(false);
    }
  };

  // Export Application Metadata Backup JSON
  const handleExportBackup = () => {
    const { jsonString, filename } = MetadataBackupService.generateBackup(userId);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Backup File Upload & Validation
  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const validation = MetadataBackupService.validateBackupFile(content);
      setValidationResult(validation);
      if (validation.isValid) {
        setIsRestoreModalOpen(true);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Commit Restore Action
  const handleCommitRestore = () => {
    if (!validationResult?.payload) return;

    setRestoreStatus(null);
    const result = MetadataBackupService.executeRestore(validationResult.payload, restoreStrategy);

    if (result.success) {
      setRestoreStatus('Application metadata successfully restored!');
      setIsRestoreModalOpen(false);
      setValidationResult(null);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } else {
      setRestoreStatus(result.error || 'Restore failed.');
    }
  };

  const handleSaveSpotifyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('pv_custom_spotify_client_id', spotifyClientId.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-spotify-secondary">Settings & Data Management</h1>
          <p className="text-xs text-spotify-on-surface mt-1">
            Manage API credentials, browser storage quotas, orphan cleanup, and metadata backups.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-spotify-surface rounded-full border border-spotify-surface-border">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeTab === 'general'
                ? 'bg-spotify-surface-border text-spotify-secondary shadow-sm'
                : 'text-spotify-on-surface hover:text-spotify-secondary'
            }`}
          >
            Integrations & API
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeTab === 'storage'
                ? 'bg-spotify-surface-border text-spotify-secondary shadow-sm'
                : 'text-spotify-on-surface hover:text-spotify-secondary'
            }`}
          >
            Storage Quotas
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeTab === 'backup'
                ? 'bg-spotify-surface-border text-spotify-secondary shadow-sm'
                : 'text-spotify-on-surface hover:text-spotify-secondary'
            }`}
          >
            Backup & Restore
          </button>
        </div>
      </div>

      {/* ================= TAB 1: GENERAL & API INTEGRATIONS ================= */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Spotify Connection & PKCE Status Card */}
          <Card className="space-y-5 p-6 border border-spotify-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-spotify-surface text-spotify-accent flex items-center justify-center border border-spotify-accent/30">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-spotify-secondary">Spotify Web API Integration</h2>
                    <Badge variant={isConnected ? 'success' : 'neutral'} size="sm">
                      {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    </Badge>
                  </div>
                  <p className="text-xs text-spotify-on-surface mt-0.5">
                    OAuth 2.0 PKCE flow for metadata queries only. No stream ripping or downloads.
                  </p>
                </div>
              </div>

              <div>
                {isConnected ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={disconnectSpotify}
                    className="gap-2 text-spotify-error border-spotify-error/40 hover:bg-spotify-error/10 hover:border-spotify-error text-xs"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Disconnect Account
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => connectSpotify('/settings')}
                    isLoading={isSpotifyLoading}
                    className="gap-2 bg-spotify-accent text-spotify-base font-bold text-xs"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Connect Spotify (PKCE)
                  </Button>
                )}
              </div>
            </div>

            {/* Connected Spotify User Info */}
            {isConnected && spotifyUser && (
              <div className="p-4 rounded-md bg-spotify-base/40 border border-spotify-surface-border flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-spotify-surface overflow-hidden flex items-center justify-center border border-spotify-surface-border">
                  {spotifyUser.images && spotifyUser.images.length > 0 ? (
                    <img
                      src={spotifyUser.images[0].url}
                      alt={spotifyUser.display_name || 'Spotify User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-5 h-5 text-spotify-on-surface" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-spotify-secondary truncate">
                    {spotifyUser.display_name || 'Spotify User'}
                  </div>
                  <div className="text-xs text-spotify-on-surface flex items-center gap-2">
                    <span>Account ID: {spotifyUser.id}</span>
                    {spotifyUser.product && (
                      <>
                        <span>•</span>
                        <span className="capitalize text-spotify-accent font-semibold">
                          {spotifyUser.product} plan
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Badge variant="success" size="sm">
                  Token Active
                </Badge>
              </div>
            )}

            {/* Client ID Configuration Form */}
            <form onSubmit={handleSaveSpotifyConfig} className="space-y-4 pt-2 border-t border-spotify-surface-border">
              <div>
                <label className="block text-xs font-bold text-spotify-secondary mb-1.5">
                  Spotify Client ID (Public PKCE)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={spotifyClientId}
                    onChange={(e) => setSpotifyClientId(e.target.value)}
                    placeholder="e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
                    className="flex-1 text-xs"
                    required
                  />
                  <Button type="submit" variant="primary" size="sm" className="bg-spotify-accent text-spotify-base font-bold text-xs h-10 px-5">
                    Save Client ID
                  </Button>
                </div>
                {saveSuccess && (
                  <p className="text-xs text-spotify-accent mt-1.5 flex items-center gap-1 font-semibold">
                    <Check className="w-3.5 h-3.5" /> Client ID saved successfully!
                  </p>
                )}
                <p className="text-[11px] text-spotify-on-surface mt-1.5 leading-relaxed">
                  Obtain this from your Spotify Developer Dashboard. Never expose your Client Secret in the frontend.
                </p>
              </div>

              {/* Redirect URI Registration Info */}
              <div className="p-3 rounded-md bg-spotify-base/40 border border-spotify-surface-border">
                <span className="text-[11px] font-bold text-spotify-secondary block mb-1">
                  Registered Redirect URI:
                </span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs text-spotify-accent font-mono select-all break-all">
                    {redirectUri}
                  </code>
                  <button
                    type="button"
                    onClick={copyRedirectUri}
                    className="text-spotify-on-surface hover:text-spotify-secondary p-1 rounded hover:bg-spotify-surface transition-colors flex-shrink-0"
                    title="Copy Redirect URI"
                  >
                    {copiedRedirect ? (
                      <Check className="w-4 h-4 text-spotify-accent" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-spotify-on-surface mt-1">
                  Must be added to &quot;Redirect URIs&quot; inside your Spotify Developer App settings.
                </p>
              </div>
            </form>
          </Card>

          {/* Backend & Supabase Architecture Status */}
          <Card className="space-y-4 p-6 border-spotify-surface-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-spotify-accent" />
                <div>
                  <h2 className="text-base font-bold text-spotify-secondary">Supabase PostgreSQL & Storage</h2>
                  <p className="text-xs text-spotify-on-surface">
                    User-isolated tables with row level security policies and private bucket encryption.
                  </p>
                </div>
              </div>
              <Badge variant={isSupabaseConfigured ? 'success' : 'warning'} size="md">
                {isSupabaseConfigured ? 'CONNECTED' : 'LOCAL RESILIENT MODE'}
              </Badge>
            </div>

            <div className="space-y-2 pt-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-md bg-spotify-base/40 border border-spotify-surface-border">
                <span className="text-spotify-on-surface">Target Endpoint URL</span>
                <code className="text-spotify-secondary font-mono text-[11px]">
                  {supabaseUrl}
                </code>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-spotify-base/40 border border-spotify-surface-border">
                <span className="text-spotify-on-surface">Row Level Security Status</span>
                <span className="text-spotify-accent font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Enforced in schema.sql
                </span>
              </div>
            </div>
          </Card>

          {/* Compliance Checklist */}
          <Card className="p-6 bg-spotify-surface border-spotify-surface-border">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-spotify-accent" />
              <h3 className="font-bold text-sm text-spotify-secondary">
                Compliance & Standalone Principles
              </h3>
            </div>
            <ul className="text-xs text-spotify-on-surface space-y-2 list-disc list-inside">
              <li>Only official Spotify Web API metadata is queried and stored.</li>
              <li>No stream audio ripping, decrypting, DRM bypass, or capture tools are implemented.</li>
              <li>Audio files are supplied directly by the user from their own authorized collections.</li>
              <li>Exported ZIP files are self-contained and run without external server dependencies.</li>
            </ul>
          </Card>
        </div>
      )}

      {/* ================= TAB 2: STORAGE QUOTAS & LOCAL MANAGEMENT ================= */}
      {activeTab === 'storage' && (
        <div className="space-y-6">
          {/* Storage Quota Progress Card */}
          <Card className="p-6 bg-spotify-surface border-spotify-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-spotify-surface-border pb-3">
              <div>
                <h2 className="text-base font-bold text-spotify-secondary flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-spotify-accent" />
                  Browser Storage Quota & Allocation
                </h2>
                <p className="text-xs text-spotify-on-surface mt-0.5">
                  Real-time disk quota inspection via the W3C StorageManager API.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={refreshStorageData}
                  disabled={isLoadingQuota}
                  className="text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQuota ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                {quotaInfo?.isSupported && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRequestPersist}
                    disabled={quotaInfo.isPersistent || isRequestingPersist}
                    className="bg-spotify-accent text-spotify-base font-bold text-xs"
                  >
                    {quotaInfo.isPersistent ? 'Storage Persisted ✓' : 'Request Persistence'}
                  </Button>
                )}
              </div>
            </div>

            {quotaInfo?.isSupported ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-spotify-on-surface">
                    Used: <strong className="text-spotify-secondary">{formatBytes(quotaInfo.usageBytes)}</strong> of{' '}
                    <strong className="text-spotify-secondary">{formatBytes(quotaInfo.quotaBytes)}</strong>
                  </span>
                  <span className="font-bold text-spotify-accent font-mono">
                    {quotaInfo.usagePercentage}%
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-spotify-base overflow-hidden">
                  <div
                    className="h-full bg-spotify-accent transition-all duration-300 rounded-full"
                    style={{ width: `${Math.max(1, quotaInfo.usagePercentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-spotify-on-surface pt-1">
                  <span>Available Remaining: {formatBytes(quotaInfo.remainingBytes)}</span>
                  <span>
                    Persistence Mode:{' '}
                    <strong className={quotaInfo.isPersistent ? 'text-spotify-accent' : 'text-spotify-warning'}>
                      {quotaInfo.isPersistent ? 'Persistent (Eviction Protected)' : 'Best-Effort'}
                    </strong>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-spotify-on-surface">
                Browser storage estimation API is not supported on this platform.
              </p>
            )}
          </Card>

          {/* Local Storage Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-spotify-surface border-spotify-surface-border space-y-2">
              <span className="text-[10px] text-spotify-on-surface uppercase font-bold">
                IndexedDB Audio Files
              </span>
              <p className="text-xl font-bold text-spotify-secondary">
                {breakdown ? formatBytes(breakdown.audioFilesBytes) : '—'}
              </p>
              <p className="text-xs text-spotify-on-surface">
                {breakdown ? `${breakdown.audioFilesCount} audio files stored` : 'Loading...'}
              </p>
            </Card>

            <Card className="p-4 bg-spotify-surface border-spotify-surface-border space-y-2">
              <span className="text-[10px] text-spotify-on-surface uppercase font-bold">
                Custom Collections
              </span>
              <p className="text-xl font-bold text-spotify-secondary">
                {breakdown ? formatBytes(breakdown.collectionsBytes) : '—'}
              </p>
              <p className="text-xs text-spotify-on-surface">
                {breakdown ? `${breakdown.collectionsCount} collections saved` : 'Loading...'}
              </p>
            </Card>

            <Card className="p-4 bg-spotify-surface border-spotify-surface-border space-y-2">
              <span className="text-[10px] text-spotify-on-surface uppercase font-bold">
                Export History Audit Logs
              </span>
              <p className="text-xl font-bold text-spotify-secondary">
                {breakdown ? formatBytes(breakdown.historyBytes) : '—'}
              </p>
              <p className="text-xs text-spotify-on-surface">
                {breakdown ? `${breakdown.historyCount} export records logged` : 'Loading...'}
              </p>
            </Card>
          </div>

          {/* Orphaned Metadata Scanner & Cleanup Tool */}
          <Card className="p-6 bg-spotify-surface border-spotify-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-spotify-surface-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-spotify-secondary flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-spotify-accent" />
                  Orphaned Metadata Scanner & Garbage Collection
                </h3>
                <p className="text-xs text-spotify-on-surface mt-0.5">
                  Detects match records or collection track references that point to deleted audio files.
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleInspectOrphans}
                disabled={isAuditingOrphans}
                className="text-xs"
              >
                {isAuditingOrphans ? 'Scanning...' : 'Scan For Orphans'}
              </Button>
            </div>

            {cleanupMessage && (
              <div className="p-3 rounded bg-spotify-accent/10 border border-spotify-accent/30 text-xs text-spotify-accent font-semibold flex items-center gap-2">
                <Check className="w-4 h-4" /> {cleanupMessage}
              </div>
            )}

            {orphanAudit && (
              <div className="space-y-3 pt-1">
                <div className="p-3 rounded bg-spotify-base/40 border border-spotify-surface-border text-xs space-y-1">
                  <p className="text-spotify-secondary font-bold">Scan Results:</p>
                  <p className="text-spotify-on-surface">
                    • Orphaned Matches:{' '}
                    <strong className={orphanAudit.orphanedMatchesCount > 0 ? 'text-spotify-warning' : 'text-spotify-accent'}>
                      {orphanAudit.orphanedMatchesCount}
                    </strong>
                  </p>
                  <p className="text-spotify-on-surface">
                    • Orphaned Collection References:{' '}
                    <strong className={orphanAudit.orphanedCollectionItemsCount > 0 ? 'text-spotify-warning' : 'text-spotify-accent'}>
                      {orphanAudit.orphanedCollectionItemsCount}
                    </strong>
                  </p>
                </div>

                {orphanAudit.orphanedMatchesCount > 0 || orphanAudit.orphanedCollectionItemsCount > 0 ? (
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCleanupOrphans}
                      disabled={isCleaningOrphans}
                      className="bg-spotify-warning text-spotify-base font-bold text-xs"
                    >
                      {isCleaningOrphans ? 'Cleaning Up...' : 'Purge All Orphaned Records'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-spotify-accent flex items-center gap-1 font-semibold">
                    <CheckCircle className="w-4 h-4" /> Database is clean! No orphaned references detected.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ================= TAB 3: BACKUP, RESTORE & DATA PORTABILITY ================= */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Backup Exporter Card */}
          <Card className="p-6 bg-spotify-surface border-spotify-surface-border space-y-4">
            <div className="flex items-center gap-3 border-b border-spotify-surface-border pb-3">
              <div className="p-2.5 rounded-full bg-spotify-base text-spotify-accent">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-spotify-secondary">Export Metadata Backup (.json)</h2>
                <p className="text-xs text-spotify-on-surface">
                  Generate a complete portable backup of your custom playlists, match decisions, export logs, and client settings.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-spotify-base/40 border border-spotify-surface-border text-xs space-y-2">
              <p className="font-bold text-spotify-secondary flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-spotify-warning" />
                Data Portability Notice
              </p>
              <p className="text-spotify-on-surface leading-relaxed">
                This JSON backup contains metadata, playlists, and match rules. It does{' '}
                <strong className="text-spotify-secondary">NOT</strong> bundle binary audio files. To back up
                audio files, generate a ZIP archive in the{' '}
                <Link to="/export" className="text-spotify-accent underline">
                  Export Vault
                </Link>
                .
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                onClick={handleExportBackup}
                className="bg-spotify-accent text-spotify-base font-bold text-xs flex items-center gap-2"
              >
                <FileJson className="w-4 h-4" />
                Download Metadata Backup JSON
              </Button>
            </div>
          </Card>

          {/* Backup Restorer Card */}
          <Card className="p-6 bg-spotify-surface border-spotify-surface-border space-y-4">
            <div className="flex items-center gap-3 border-b border-spotify-surface-border pb-3">
              <div className="p-2.5 rounded-full bg-spotify-base text-spotify-accent">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-spotify-secondary">Restore Application Metadata</h2>
                <p className="text-xs text-spotify-on-surface">
                  Import a previously exported PlaylistVault JSON backup with strict validation and conflict detection.
                </p>
              </div>
            </div>

            {restoreStatus && (
              <div className="p-3 rounded bg-spotify-accent/10 border border-spotify-accent/30 text-xs text-spotify-accent font-semibold flex items-center gap-2">
                <Check className="w-4 h-4" /> {restoreStatus}
              </div>
            )}

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleBackupFileSelect}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-spotify-surface-border hover:border-spotify-accent rounded-lg text-center cursor-pointer transition-colors bg-spotify-base/30 space-y-2"
            >
              <FileJson className="w-8 h-8 text-spotify-accent mx-auto" />
              <p className="text-xs font-bold text-spotify-secondary">
                Click to browse or drop your <code className="text-spotify-accent">.json</code> backup file
              </p>
              <p className="text-[11px] text-spotify-on-surface">
                Schema validated against <code className="text-spotify-secondary">playlistvault-backup-v1</code>
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ================= MODAL: RESTORE PREVIEW & COMMIT ================= */}
      {validationResult && (
        <Modal
          isOpen={isRestoreModalOpen}
          onClose={() => setIsRestoreModalOpen(false)}
          title="Restore Metadata Preview & Conflict Resolution"
        >
          <div className="space-y-4 text-xs">
            {validationResult.isValid ? (
              <div className="space-y-3">
                <div className="p-3 rounded bg-spotify-base/40 border border-spotify-surface-border space-y-1.5">
                  <p className="font-bold text-spotify-secondary">Incoming Backup Contents:</p>
                  <p className="text-spotify-on-surface">
                    • Collections: <strong>{validationResult.stats.collectionsCount}</strong>
                  </p>
                  <p className="text-spotify-on-surface">
                    • Match Decisions: <strong>{validationResult.stats.matchesCount}</strong>
                  </p>
                  <p className="text-spotify-on-surface">
                    • Export History Records: <strong>{validationResult.stats.historyCount}</strong>
                  </p>
                </div>

                {/* Conflict Notice */}
                {(validationResult.conflicts.conflictingCollectionsCount > 0 ||
                  validationResult.conflicts.conflictingMatchesCount > 0) && (
                  <div className="p-3 rounded bg-spotify-warning/10 border border-spotify-warning/30 text-spotify-on-surface space-y-1">
                    <p className="font-bold text-spotify-warning flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> Potential Conflicts Detected
                    </p>
                    <p>
                      {validationResult.conflicts.conflictingCollectionsCount} collection(s) and{' '}
                      {validationResult.conflicts.conflictingMatchesCount} match decision(s) already exist
                      in your local storage.
                    </p>
                  </div>
                )}

                {/* Strategy Selection */}
                <div className="space-y-2 pt-1">
                  <label className="font-bold text-spotify-secondary block">Resolution Strategy</label>
                  <div className="space-y-2">
                    <div
                      onClick={() => setRestoreStrategy('merge')}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        restoreStrategy === 'merge'
                          ? 'bg-spotify-surface-border border-spotify-accent text-spotify-secondary'
                          : 'bg-spotify-base/40 border-spotify-surface-border text-spotify-on-surface'
                      }`}
                    >
                      <p className="font-bold">Merge (Recommended)</p>
                      <p className="text-[11px] text-spotify-on-surface">
                        Keep existing collections and matches; import new non-conflicting items.
                      </p>
                    </div>

                    <div
                      onClick={() => setRestoreStrategy('overwrite')}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        restoreStrategy === 'overwrite'
                          ? 'bg-spotify-surface-border border-spotify-accent text-spotify-secondary'
                          : 'bg-spotify-base/40 border-spotify-surface-border text-spotify-on-surface'
                      }`}
                    >
                      <p className="font-bold text-spotify-warning">Overwrite</p>
                      <p className="text-[11px] text-spotify-on-surface">
                        Replace all local collections and matches with data from this backup file.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-3 border-t border-spotify-surface-border">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsRestoreModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCommitRestore}
                    className="bg-spotify-accent text-spotify-base font-bold"
                  >
                    Commit Restore
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded bg-spotify-error/10 border border-spotify-error/30 text-spotify-error space-y-1">
                  <p className="font-bold">Invalid Backup File</p>
                  {validationResult.errors.map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsRestoreModalOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
