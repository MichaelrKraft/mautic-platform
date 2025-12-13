'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import CreateContactModal from '@/components/CreateContactModal';
import Link from 'next/link';

interface MauticStats {
  contacts: { total: number; identified: number; anonymous: number };
  emails: { sent: number; read: number; clicked: number; bounced: number };
  campaigns: { active: number; total: number };
}

export default function Dashboard() {
  const [stats, setStats] = useState<MauticStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/mautic/stats');
      const data = await response.json();

      if (response.status === 401) {
        setNeedsAuth(true);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch stats');
      }

      setStats(data);
      setNeedsAuth(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const connectToMautic = async () => {
    try {
      const response = await fetch('/api/mautic/auth');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      setError('Failed to initiate OAuth flow');
    }
  };

  const calculateOpenRate = () => {
    if (!stats || stats.emails.sent === 0) return '0.0';
    return ((stats.emails.read / stats.emails.sent) * 100).toFixed(1);
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from Mautic? You will need to reconnect to access your data.')) {
      return;
    }

    try {
      const response = await fetch('/api/mautic/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        // Reload the page to show auth required state
        window.location.reload();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to disconnect');
      }
    } catch {
      setError('Failed to disconnect from Mautic');
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1">Welcome back! Here&apos;s your marketing overview.</p>
        </div>

        {/* Auth Required Banner */}
        {needsAuth && (
          <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-yellow/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary">Connect to Mautic</h3>
                <p className="text-text-secondary">You need to authorize this dashboard to access your Mautic instance.</p>
              </div>
              <button onClick={connectToMautic} className="btn-primary">
                Connect to Mautic
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && !needsAuth && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-4 mb-6">
            <p className="text-accent-red">{error}</p>
            <button onClick={fetchStats} className="text-mautic-blue-light underline mt-2">
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-bg-secondary rounded-xl border border-border-subtle p-6 animate-pulse">
                <div className="h-4 bg-bg-tertiary rounded w-1/2 mb-3"></div>
                <div className="h-8 bg-bg-tertiary rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-bg-tertiary rounded w-2/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        {!loading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Contacts */}
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6 hover:border-accent-cyan/50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-cyan/20 to-accent-cyan/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <Link href="/contacts" className="text-text-muted hover:text-accent-cyan text-sm">
                  View →
                </Link>
              </div>
              <p className="text-text-muted text-sm">Total Contacts</p>
              <p className="text-3xl font-semibold text-text-primary mt-1">{stats.contacts.total.toLocaleString()}</p>
              <p className="text-text-secondary text-sm mt-2">
                {stats.contacts.identified.toLocaleString()} identified
              </p>
            </div>

            {/* Email Open Rate */}
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6 hover:border-accent-purple/50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-purple/20 to-accent-purple/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <Link href="/emails" className="text-text-muted hover:text-accent-purple text-sm">
                  View →
                </Link>
              </div>
              <p className="text-text-muted text-sm">Email Open Rate</p>
              <p className="text-3xl font-semibold text-text-primary mt-1">{calculateOpenRate()}%</p>
              <p className="text-text-secondary text-sm mt-2">
                {stats.emails.read.toLocaleString()} of {stats.emails.sent.toLocaleString()} opened
              </p>
            </div>

            {/* Active Campaigns */}
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6 hover:border-accent-green/50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-green/20 to-accent-green/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                <Link href="/campaigns" className="text-text-muted hover:text-accent-green text-sm">
                  View →
                </Link>
              </div>
              <p className="text-text-muted text-sm">Active Campaigns</p>
              <p className="text-3xl font-semibold text-text-primary mt-1">{stats.campaigns.active}</p>
              <p className="text-text-secondary text-sm mt-2">
                {stats.campaigns.total} total campaigns
              </p>
            </div>

            {/* Emails Sent */}
            <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6 hover:border-accent-cyan/50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-cyan/20 to-accent-cyan/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
              </div>
              <p className="text-text-muted text-sm">Total Emails Sent</p>
              <p className="text-3xl font-semibold text-text-primary mt-1">{stats.emails.sent.toLocaleString()}</p>
              <p className="text-text-secondary text-sm mt-2">
                All time
              </p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Quick Actions Panel */}
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/70 transition-colors group w-full text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-text-primary font-medium">Add New Contact</p>
                  <p className="text-text-muted text-sm">Create a new contact in Mautic</p>
                </div>
                <svg className="w-4 h-4 text-text-muted group-hover:text-accent-cyan transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <a
                href="https://ploink.site/s/campaigns/new"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/70 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-accent-purple/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-text-primary font-medium">Create Campaign</p>
                  <p className="text-text-muted text-sm">Build a new automation campaign</p>
                </div>
                <svg className="w-4 h-4 text-text-muted group-hover:text-accent-purple transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              <a
                href="https://ploink.site/s/emails/new"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/70 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-text-primary font-medium">Compose Email</p>
                  <p className="text-text-muted text-sm">Create a new email template</p>
                </div>
                <svg className="w-4 h-4 text-text-muted group-hover:text-accent-green transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>

          {/* Mautic Status Panel */}
          <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Mautic Connection</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${stats ? 'bg-accent-green' : needsAuth ? 'bg-accent-yellow' : 'bg-accent-red'}`}></div>
                <p className="text-text-primary">
                  {stats ? 'Connected' : needsAuth ? 'Authentication required' : 'Disconnected'}
                </p>
              </div>

              <div className="p-4 bg-bg-tertiary rounded-lg">
                <p className="text-text-muted text-sm mb-1">Instance URL</p>
                <a
                  href="https://ploink.site"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-cyan hover:underline"
                >
                  https://ploink.site
                </a>
              </div>

              <div className="flex gap-3">
                <a
                  href="https://ploink.site"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex-1 text-center"
                >
                  Open Mautic
                </a>
                <button onClick={fetchStats} className="btn-secondary" title="Refresh connection">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                {stats && (
                  <button onClick={handleDisconnect} className="btn-secondary text-accent-red border-accent-red/30 hover:bg-accent-red/10" title="Disconnect">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Explore</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/contacts"
              className="p-4 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/70 border border-transparent hover:border-accent-cyan/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-text-primary font-medium group-hover:text-accent-cyan transition-colors">Contacts</p>
                  <p className="text-text-muted text-sm">Manage your leads</p>
                </div>
              </div>
            </Link>

            <Link
              href="/campaigns"
              className="p-4 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/70 border border-transparent hover:border-accent-purple/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                <div>
                  <p className="text-text-primary font-medium group-hover:text-accent-purple transition-colors">Campaigns</p>
                  <p className="text-text-muted text-sm">Automate marketing</p>
                </div>
              </div>
            </Link>

            <Link
              href="/emails"
              className="p-4 rounded-lg bg-bg-tertiary hover:bg-bg-tertiary/70 border border-transparent hover:border-accent-green/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-text-primary font-medium group-hover:text-accent-green transition-colors">Emails</p>
                  <p className="text-text-muted text-sm">Email templates</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>

      {/* Create Contact Modal */}
      <CreateContactModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          // Refresh stats after contact creation
          fetchStats();
        }}
      />
    </div>
  );
}
