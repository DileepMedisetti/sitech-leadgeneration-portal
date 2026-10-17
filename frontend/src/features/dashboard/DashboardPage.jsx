
import React, { useEffect, useState } from 'react';
import {
  Users,
  CheckCircle,
  Clock,
  Search,
  Zap,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { dashboardApi } from '../../services/api-client';
import MetricCard from '../../components/ui/MetricCard';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function DashboardPage({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading dashboard metrics..." />;
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: 'var(--danger-light)' }}>
        <h3 style={{ color: 'var(--danger-text)', margin: '0 0 8px 0', fontSize: '15px' }}>
          Unable to Load Dashboard
        </h3>
        <p style={{ color: 'var(--danger-text)', fontSize: '13px', margin: 0 }}>{error}</p>
        <button onClick={fetchStats} className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Metric Cards Grid */}
      <div className="grid-cols-4" style={{ marginBottom: '24px' }}>
        <MetricCard
          title="Total Leads"
          value={stats.total_leads}
          subtitle="All contacts across jobs"
          icon={Users}
          color="var(--secondary)"
        />
        <MetricCard
          title="Qualified Leads"
          value={stats.qualified_leads}
          subtitle="Verified academic profiles"
          icon={CheckCircle}
          color="var(--success)"
        />
        <MetricCard
          title="Review Queue"
          value={stats.review_leads}
          subtitle="Ambiguous candidates"
          icon={Clock}
          color="var(--warning)"
        />
        <MetricCard
          title="Efficiency Ratio"
          value={`${stats.qualified_leads_per_request} leads`}
          subtitle={`Per SerpApi credit (${stats.serpapi_requests_used} used)`}
          icon={Zap}
          color="var(--primary)"
        />
      </div>

      {/* Active Jobs & Extraction Health */}
      <div className="grid-cols-2" style={{ marginBottom: '24px' }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <span className="card-title">
              <Search size={16} color="var(--primary)" />
              Search Jobs Overview
            </span>
            <button
              onClick={() => onNavigate('new-job')}
              className="btn btn-primary btn-sm"
            >
              + Create Job
            </button>
          </div>

          <div style={{ display: 'flex', gap: '20px', padding: '10px 0 16px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {stats.total_jobs}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Jobs</div>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--info-text)' }}>
                {stats.active_jobs}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Running</div>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success-text)' }}>
                {stats.completed_jobs}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completed</div>
            </div>
          </div>

          {stats.recent_jobs && stats.recent_jobs.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job Name</th>
                    <th>Target</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_jobs.map((job) => (
                    <tr key={job.id}>
                      <td style={{ fontWeight: 500 }}>
                        {job.search_name || job.keywords}
                      </td>
                      <td>
                        {job.qualified_leads_found} / {job.target_leads}
                      </td>
                      <td>
                        <StatusBadge status={job.status} />
                      </td>
                      <td>
                        <button
                          onClick={() => onNavigate('job-detail', job.id)}
                          className="btn btn-secondary btn-sm"
                        >
                          Workspace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '8px 0' }}>
              No search jobs created yet.
            </p>
          )}
        </div>

        {/* Extraction Pipeline Health */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <span className="card-title">
              <TrendingUp size={16} color="var(--primary)" />
              Extraction Pipeline Health
            </span>
            <button
              onClick={() => onNavigate('extraction')}
              className="btn btn-secondary btn-sm"
            >
              Monitor <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Extraction Success Rate</span>
              <span style={{ fontWeight: 600 }}>{stats.extraction_success_rate}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
              <div
                style={{
                  width: `${stats.extraction_success_rate}%`,
                  height: '100%',
                  backgroundColor: 'var(--primary)',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center' }}>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--info-text)' }}>{stats.processed_results}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Processed</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--warning-text)' }}>{stats.pending_results}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)' }}>{stats.skipped_results}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Skipped</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--danger-text)' }}>{stats.failed_results}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Failed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Qualified Leads */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <CheckCircle size={16} color="var(--success)" />
            Recently Discovered & Qualified Leads
          </span>
          <button
            onClick={() => onNavigate('leads')}
            className="btn btn-secondary btn-sm"
          >
            View All Leads <ArrowRight size={13} />
          </button>
        </div>

        {stats.recent_qualified_leads && stats.recent_qualified_leads.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Designation</th>
                  <th>University / Institution</th>
                  <th>Country</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_qualified_leads.map((lead) => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {lead.name}
                    </td>
                    <td>
                      <a href={`mailto:${lead.email}`}>{lead.email}</a>
                    </td>
                    <td>{lead.profession || '—'}</td>
                    <td>{lead.university || '—'}</td>
                    <td>{lead.country || '—'}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--success-text)' }}>
                        {lead.confidence_score ? `${Math.round(lead.confidence_score * 100)}%` : 'Verified'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '8px 0' }}>
            No qualified leads yet. Run a search job or extract pending URLs to discover contacts.
          </p>
        )}
      </div>
    </div>
  );
}
