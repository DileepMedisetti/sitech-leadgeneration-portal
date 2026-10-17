
import React, { useEffect, useState } from 'react';
import { PlusCircle, Search, ExternalLink, RefreshCw } from 'lucide-react';
import { searchJobsApi } from '../../services/api-client';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function SearchJobsPage({ onNavigate }) {
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await searchJobsApi.list({
        page,
        page_size: 10,
        status: statusFilter || undefined,
      });
      setJobs(res.items);
      setTotalPages(res.total_pages);
      setTotalCount(res.total);
    } catch (err) {
      setError(err.message || 'Failed to load search jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [page, statusFilter]);

  const filterButtons = [
    { label: 'All Jobs', value: '' },
    { label: 'Running', value: 'running' },
    { label: 'Pending', value: 'pending' },
    { label: 'Completed', value: 'completed' },
    { label: 'Stopped', value: 'stopped' },
  ];

  return (
    <div>
      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => {
                setStatusFilter(btn.value);
                setPage(1);
              }}
              className={`btn btn-sm ${statusFilter === btn.value ? 'btn-primary' : 'btn-secondary'}`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onNavigate('new-job')}
          className="btn btn-primary"
        >
          <PlusCircle size={15} />
          <span>New Search Job</span>
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading search jobs..." />
      ) : error ? (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: 'var(--danger-light)' }}>
          <p style={{ color: 'var(--danger-text)', margin: 0 }}>{error}</p>
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No search jobs found"
          message={statusFilter ? `No jobs found with status "${statusFilter}".` : 'Get started by creating your first academic lead discovery job.'}
          action={
            <button onClick={() => onNavigate('new-job')} className="btn btn-primary">
              <PlusCircle size={14} /> Create Search Job
            </button>
          }
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Job Name & Keywords</th>
                  <th>Qualified Leads</th>
                  <th>SerpApi Requests</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const leadProgress = job.target_leads > 0
                    ? Math.min(100, Math.round((job.qualified_leads_found / job.target_leads) * 100))
                    : 0;
                  return (
                    <tr key={job.id}>
                      <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>#{job.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {job.search_name || 'Academic Discovery Job'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {job.keywords}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600 }}>
                            {job.qualified_leads_found} / {job.target_leads}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({leadProgress}%)</span>
                        </div>
                        <div style={{ width: '100px', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', marginTop: '4px' }}>
                          <div style={{ width: `${leadProgress}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '2px' }} />
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{job.serpapi_requests_used}</span>
                        <span style={{ color: 'var(--text-muted)' }}> / {job.max_serpapi_requests} max</span>
                      </td>
                      <td>
                        <StatusBadge status={job.status} />
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {new Date(job.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => onNavigate('job-detail', job.id)}
                          className="btn btn-secondary btn-sm"
                        >
                          Workspace <ExternalLink size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalCount}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
