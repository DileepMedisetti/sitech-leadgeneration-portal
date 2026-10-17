
import React, { useEffect, useState } from 'react';
import { Cpu, RefreshCw, ShieldCheck, Play, ExternalLink } from 'lucide-react';
import { searchJobsApi } from '../../services/api-client';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function ExtractionMonitorPage({ onNavigate: _onNavigate }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [batchLimit, setBatchLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [banner, setBanner] = useState(null);
  const [results, setResults] = useState([]);

  const loadJobDetails = async (jobId) => {
    try {
      const data = await searchJobsApi.get(jobId);
      setSelectedJob(data);
      const res = await searchJobsApi.getResults(jobId, { page_size: 20 });
      setResults(res.items);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        const res = await searchJobsApi.list({ page_size: 50 });
        setJobs(res.items);
        if (res.items.length > 0) {
          setSelectedJobId(res.items[0].id);
          loadJobDetails(res.items[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);


  const handleSelectJob = (id) => {
    setSelectedJobId(id);
    setBanner(null);
    loadJobDetails(id);
  };

  const handleRunExtraction = async () => {
    if (!selectedJobId) return;
    try {
      setExtracting(true);
      setBanner(null);
      const res = await searchJobsApi.extractLeads(selectedJobId, batchLimit);
      setBanner({
        type: 'success',
        text: `Extraction Complete: ${res.results_processed} pages parsed, ${res.leads_created} new leads created, ${res.leads_enriched} enriched. (0 SerpApi credits consumed).`,
      });
      await loadJobDetails(selectedJobId);
    } catch (err) {
      setBanner({ type: 'danger', text: err.message || 'Extraction failed.' });
    } finally {
      setExtracting(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!selectedJobId) return;
    try {
      setRetrying(true);
      setBanner(null);
      const res = await searchJobsApi.retryFailed(selectedJobId, batchLimit);
      setBanner({
        type: 'info',
        text: `Retry Policy: Requeued ${res.results_requeued} transient failures (${res.results_not_retryable} non-retryable errors kept).`,
      });
      await loadJobDetails(selectedJobId);
    } catch (err) {
      setBanner({ type: 'danger', text: err.message || 'Retry failed.' });
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading extraction monitor..." />;

  return (
    <div>
      {/* Overview Banner */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <span className="card-title">
            <Cpu size={18} color="var(--primary)" />
            Direct HTML Extraction Monitor
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--success-text)', backgroundColor: 'var(--success-light)', padding: '4px 10px', borderRadius: '9999px', border: '1px solid var(--success-border)' }}>
            <ShieldCheck size={14} />
            <span>Direct Webpage Parsing • 0 SerpApi Credits</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: '320px', flex: 1 }}>
            <label className="form-label">Select Search Job Queue</label>
            <select
              value={selectedJobId}
              onChange={(e) => handleSelectJob(e.target.value)}
              className="form-control"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  #{j.id} — {j.search_name || j.keywords} ({j.status})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Batch Size</label>
              <select
                value={batchLimit}
                onChange={(e) => setBatchLimit(parseInt(e.target.value, 10))}
                className="form-control"
                style={{ width: '100px' }}
              >
                <option value={5}>5 URLs</option>
                <option value={10}>10 URLs</option>
                <option value={20}>20 URLs</option>
                <option value={50}>50 URLs</option>
              </select>
            </div>

            <button
              onClick={handleRunExtraction}
              disabled={extracting || !selectedJob || selectedJob.pending_results_count === 0}
              className="btn btn-primary"
            >
              <Play size={14} />
              <span>{extracting ? 'Extracting...' : `Extract Batch (${selectedJob ? selectedJob.pending_results_count : 0} Pending)`}</span>
            </button>

            {selectedJob && selectedJob.failed_results_count > 0 && (
              <button
                onClick={handleRetryFailed}
                disabled={retrying}
                className="btn btn-danger btn-sm"
              >
                <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} />
                <span>Retry Eligible ({selectedJob.failed_results_count})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {banner && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: banner.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            border: `1px solid ${banner.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            color: banner.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
            marginBottom: '16px',
            fontSize: '13px',
          }}
        >
          {banner.text}
        </div>
      )}

      {/* Queue Status Breakdown */}
      {selectedJob && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
          <div className="card" style={{ margin: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending URLs</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--warning-text)' }}>
              {selectedJob.pending_results_count}
            </div>
          </div>
          <div className="card" style={{ margin: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Processed & Extracted</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success-text)' }}>
              {selectedJob.processed_results_count}
            </div>
          </div>
          <div className="card" style={{ margin: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Skipped (No Contact)</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {selectedJob.skipped_results_count}
            </div>
          </div>
          <div className="card" style={{ margin: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Failed (HTTP 403 / Net)</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--danger-text)' }}>
              {selectedJob.failed_results_count}
            </div>
          </div>
        </div>
      )}

      {/* Real-time URLs Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
          Recent Stored Results for Job #{selectedJobId}
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Target Webpage URL</th>
                <th>Status</th>
                <th>Retries</th>
                <th>Extraction Details</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No results stored for this job yet. Run discovery to collect URLs.
                  </td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--text-muted)' }}>#{r.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.result_title || 'Webpage Document'}
                      </div>
                      <a
                        href={r.result_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span style={{ maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.result_url}
                        </span>
                        <ExternalLink size={10} />
                      </a>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {r.retry_count || 0}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '300px' }}>
                      {r.error_message || (r.status === 'processed' ? 'Contact details verified & saved' : 'Awaiting parser')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
