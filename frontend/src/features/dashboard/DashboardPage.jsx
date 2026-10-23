
import React, { useEffect, useState } from 'react';
import {
  Users,
  CheckCircle,
  Clock,
  Search,
  Zap,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

import { dashboardApi, searchJobsApi, leadsApi } from '../../services/api-client';
import MetricCard from '../../components/ui/MetricCard';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import IdBadge from '../../components/ui/IdBadge';
import Pagination from '../../components/ui/Pagination';

export default function DashboardPage({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search Jobs pagination state
  const [jobs, setJobs] = useState([]);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsTotalPages, setJobsTotalPages] = useState(1);
  const [jobsTotalCount, setJobsTotalCount] = useState(0);

  // Qualified Leads pagination state
  const [leads, setLeads] = useState([]);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsTotalPages, setLeadsTotalPages] = useState(1);
  const [leadsTotalCount, setLeadsTotalCount] = useState(0);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, jobsRes, leadsRes] = await Promise.all([
        dashboardApi.getStats(),
        searchJobsApi.list({ page: 1, page_size: 25 }).catch(() => null),
        leadsApi.list({ page: 1, page_size: 25, status: 'qualified' }).catch(() => null),
      ]);
      setStats(statsData);

      if (jobsRes) {
        setJobs(jobsRes.items || []);
        setJobsTotalPages(jobsRes.total_pages || 1);
        setJobsTotalCount(jobsRes.total || 0);
      } else if (statsData.recent_jobs) {
        setJobs(statsData.recent_jobs);
        setJobsTotalPages(1);
        setJobsTotalCount(statsData.recent_jobs.length);
      }

      if (leadsRes) {
        setLeads(leadsRes.items || []);
        setLeadsTotalPages(leadsRes.total_pages || 1);
        setLeadsTotalCount(leadsRes.total || 0);
      } else if (statsData.recent_qualified_leads) {
        setLeads(statsData.recent_qualified_leads);
        setLeadsTotalPages(1);
        setLeadsTotalCount(statsData.recent_qualified_leads.length);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  const handleJobsPageChange = async (newPage) => {
    setJobsPage(newPage);
    try {
      const res = await searchJobsApi.list({ page: newPage, page_size: 25 });
      setJobs(res.items || []);
      setJobsTotalPages(res.total_pages || 1);
      setJobsTotalCount(res.total || 0);
    } catch (err) {
      console.error('Failed to change jobs page:', err);
    }
  };

  const handleLeadsPageChange = async (newPage) => {
    setLeadsPage(newPage);
    try {
      const res = await leadsApi.list({ page: newPage, page_size: 25, status: 'qualified' });
      setLeads(res.items || []);
      setLeadsTotalPages(res.total_pages || 1);
      setLeadsTotalCount(res.total || 0);
    } catch (err) {
      console.error('Failed to change leads page:', err);
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
          color="var(--primary)"
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
          color="var(--info)"
        />
      </div>


      {/* Search Jobs Overview (Full-Width Balanced Table) */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span className="card-title">
              <Search size={16} color="var(--text-primary)" />
              Search Jobs Overview
            </span>
          </div>
          <button
            onClick={() => onNavigate('new-job')}
            className="btn btn-primary btn-sm"
          >
            + Create Job
          </button>
        </div>

        {/* Compact Stat Summary Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '0 0 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats.total_jobs}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Jobs</span>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-subtle)' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats.active_jobs}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Running</span>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-subtle)' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats.completed_jobs}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completed</span>
          </div>
        </div>

        {jobs && jobs.length > 0 ? (
          <>
            <div className="table-container">
            <table className="data-table jobs-table">
              <thead>
                <tr>
                  <th style={{ width: '95px' }}>Job ID</th>
                  <th style={{ minWidth: '280px' }}>Job Name</th>
                  <th style={{ width: '150px' }}>Target Leads</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const leadProgress = job.target_leads > 0
                    ? Math.min(100, Math.round((job.qualified_leads_found / job.target_leads) * 100))
                    : 0;
                  const jobDisplayName = job.search_name || job.keywords || 'Academic Lead Discovery Job';
                  const hasBoth = job.search_name && job.keywords && job.search_name !== job.keywords;

                  return (
                    <tr key={job.id}>
                      <td style={{ verticalAlign: 'middle' }}>
                        <IdBadge prefix="JOB" id={job.id} />
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <div
                          title={jobDisplayName + (hasBoth ? `\nKeywords: ${job.keywords}` : '')}
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            lineHeight: 1.45,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            wordBreak: 'break-word',
                          }}
                        >
                          {jobDisplayName}
                        </div>
                        {hasBoth && (
                          <div
                            title={job.keywords}
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-muted)',
                              marginTop: '3px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '560px',
                            }}
                          >
                            {job.keywords}
                          </div>
                        )}
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                            {job.qualified_leads_found}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            / {job.target_leads}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ({leadProgress}%)
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100px',
                            height: '4px',
                            backgroundColor: 'var(--border-color)',
                            borderRadius: '2px',
                            marginTop: '5px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${leadProgress}%`,
                              height: '100%',
                              backgroundColor: 'var(--primary)',
                              borderRadius: '2px',
                            }}
                          />
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <StatusBadge status={job.status} />
                      </td>
                      <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                        <button
                          onClick={() => onNavigate('job-detail', job.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ minWidth: '86px', justifyContent: 'center' }}
                        >
                          Workspace
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={jobsPage}
            totalPages={jobsTotalPages}
            totalItems={jobsTotalCount}
            pageSize={25}
            onPageChange={handleJobsPageChange}
          />
        </>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '8px 0' }}>
            No search jobs created yet.
          </p>
        )}
      </div>

      {/* Extraction Pipeline Health (Horizontal Streamlined Layout) */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <span className="card-title">
            <TrendingUp size={16} color="var(--text-primary)" />
            Extraction Pipeline Health
          </span>
          <button
            onClick={() => onNavigate('extraction')}
            className="btn btn-secondary btn-sm"
          >
            Monitor <ArrowRight size={13} />
          </button>
        </div>

        <div className="extraction-health-grid">
          {/* Success rate progress bar section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
                Extraction Success Rate
              </span>
              <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>
                {stats.extraction_success_rate}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--border-color)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${stats.extraction_success_rate}%`,
                  height: '100%',
                  backgroundColor: 'var(--primary)',
                }}
              />
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Direct HTML parsing rate across target domains
            </div>
          </div>

          {/* 4 Status metric tiles */}
          <div className="health-tiles-grid">
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                padding: '12px 8px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {stats.processed_results}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Processed
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                padding: '12px 8px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {stats.pending_results}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Pending
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                padding: '12px 8px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {stats.skipped_results}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Skipped
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                padding: '12px 8px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-muted)' }}>
                {stats.failed_results}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Failed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Qualified Leads */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <span className="card-title">
            <CheckCircle size={16} color="var(--text-primary)" />
            Recently Discovered & Qualified Leads
          </span>
          <button
            onClick={() => onNavigate('leads')}
            className="btn btn-secondary btn-sm"
          >
            View All Leads <ArrowRight size={13} />
          </button>
        </div>

        {leads && leads.length > 0 ? (
          <>
            <div className="table-container">
              <table className="data-table" style={{ minWidth: '750px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '95px' }}>Lead ID</th>
                    <th style={{ minWidth: '160px' }}>Name</th>
                    <th style={{ minWidth: '190px' }}>Email</th>
                    <th style={{ minWidth: '160px' }}>Designation</th>
                    <th style={{ minWidth: '180px' }}>University / Institution</th>
                    <th style={{ width: '110px' }}>Country</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td style={{ verticalAlign: 'middle' }}>
                        <IdBadge prefix="LEAD" id={lead.id} />
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                        {lead.name}
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <a href={`mailto:${lead.email}`}>{lead.email}</a>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>{lead.profession || '—'}</td>
                      <td style={{ verticalAlign: 'middle' }}>{lead.university || '—'}</td>
                      <td style={{ verticalAlign: 'middle' }}>{lead.country || '—'}</td>
                      <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {lead.confidence_score ? `${Math.round(lead.confidence_score * 100)}%` : 'Verified'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={leadsPage}
              totalPages={leadsTotalPages}
              totalItems={leadsTotalCount}
              pageSize={25}
              onPageChange={handleLeadsPageChange}
            />
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '8px 0' }}>
            No qualified leads yet. Run a search job or extract pending URLs to discover contacts.
          </p>
        )}
      </div>
    </div>
  );
}
