
import React, { useEffect, useState } from 'react';
import { Settings, ShieldCheck, Database, Key, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import { settingsApi } from '../../services/api-client';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function SettingsPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await settingsApi.get();
        setConfig(res);
      } catch (err) {
        setError(err.message || 'Failed to load system settings.');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  if (loading) return <LoadingSpinner text="Loading system configuration..." />;
  if (error || !config) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: 'var(--danger-light)' }}>
        <p style={{ color: 'var(--danger-text)', margin: 0 }}>{error || 'Unable to load configuration.'}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Settings size={18} color="var(--primary)" />
            System Configuration & Operational Parameters
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            v{config.system_version}
          </span>
        </div>

        {/* Security Notice */}
        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'var(--primary-light)',
            border: '1px solid var(--primary-border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <ShieldCheck size={18} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '13px', color: 'var(--primary-text)' }}>
            <strong>Security Boundary Protected:</strong> API keys, database credentials, and server secrets are strictly managed via server-side environment variables and are never transmitted to or readable from the frontend application.
          </div>
        </div>

        {/* Status Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Database size={16} color="var(--primary)" />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>PostgreSQL Database</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--success-text)' }}>
              <CheckCircle2 size={14} />
              <span>Connected via SQLAlchemy 2.x</span>
            </div>
          </div>

          <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Key size={16} color="var(--secondary)" />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>SerpApi Service</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: config.serpapi_configured ? 'var(--success-text)' : 'var(--danger-text)' }}>
              {config.serpapi_configured ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>API Key Configured & Ready</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} />
                  <span>API Key Not Configured in .env</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Operational Defaults */}
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
          Search & Extraction Operational Defaults
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Default Target Leads per Job</span>
            <strong style={{ fontSize: '13px' }}>{config.default_target_leads} leads</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Default SerpApi Request Budget</span>
            <strong style={{ fontSize: '13px' }}>{config.default_max_serpapi_requests} requests</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Default Extraction Batch Size</span>
            <strong style={{ fontSize: '13px' }}>{config.default_extraction_batch_size} URLs</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Maximum HTTP Retry Attempts</span>
            <strong style={{ fontSize: '13px' }}>{config.max_retries} attempts (exponential backoff)</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Webpage Fetch Timeout</span>
            <strong style={{ fontSize: '13px' }}>{config.request_timeout_seconds} seconds</strong>
          </div>
        </div>

        {/* Supported Academic Roles */}
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
          Supported Academic Designations & Roles
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {config.common_professions.map((role) => (
            <span
              key={role}
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
              }}
            >
              {role}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
