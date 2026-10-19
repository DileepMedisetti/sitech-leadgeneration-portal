
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Search,
  Cpu,
  RefreshCw,
  Square,
  Play,
  Users,
  Compass,
  ExternalLink,
  CheckCircle,

  FileText,
  Zap,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { searchJobsApi, leadsApi } from '../../services/api-client';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import IdBadge, { formatEntityId } from '../../components/ui/IdBadge';

export default function JobDetailPage({ jobId, onNavigate }) {
  const [job, setJob] = useState(null);
  const [activeTab, setActiveTab] = useState('results'); // 'results', 'leads', 'config'
  const [results, setResults] = useState([]);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsTotalPages, setResultsTotalPages] = useState(1);
  const [resultsTotal, setResultsTotal] = useState(0);

  const [leads, setLeads] = useState([]);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsTotalPages, setLeadsTotalPages] = useState(1);
  const [leadsTotal, setLeadsTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [bannerMessage, setBannerMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleExportXlsx = async () => {
    try {
      setDownloadingXlsx(true);
      await leadsApi.downloadXlsx('qualified', jobId);
    } catch (err) {
      setBannerMessage({
        type: 'danger',
        text: `Excel export failed: ${err.message || 'Network error'}`,
      });
    } finally {
      setDownloadingXlsx(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setDownloadingCsv(true);
      await leadsApi.downloadCsv('qualified', jobId);
    } catch (err) {
      setBannerMessage({
        type: 'danger',
        text: `CSV export failed: ${err.message || 'Network error'}`,
      });
    } finally {
      setDownloadingCsv(false);
    }
  };

  const fetchJob = async () => {

    try {
      setError(null);
      const data = await searchJobsApi.get(jobId);
      setJob(data);
    } catch (err) {
      setError(err.message || 'Failed to load search job.');
    }
  };

  const fetchResults = async (page = 1) => {
    try {
      const data = await searchJobsApi.getResults(jobId, { page, page_size: 25 });
      setResults(data.items);
      setResultsPage(data.page);
      setResultsTotalPages(data.total_pages);
      setResultsTotal(data.total);
    } catch (err) {
      console.error('Failed to load results:', err);
    }
  };

  const fetchLeads = async (page = 1) => {
    try {
      const data = await searchJobsApi.getLeads(jobId, { page, page_size: 25 });
      setLeads(data.items);
      setLeadsPage(data.page);
      setLeadsTotalPages(data.total_pages);
      setLeadsTotal(data.total);
    } catch (err) {
      console.error('Failed to load job leads:', err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await fetchJob();
      await fetchResults(1);
      await fetchLeads(1);
      setLoading(false);
    };
    loadAll();
  }, [jobId]);

  const handleCollectBatch = async () => {
    try {
      setActionLoading(true);
      setBannerMessage(null);
      const res = await searchJobsApi.collect(jobId);
      setBannerMessage({
        type: 'success',
        text: `Discovery batch completed: Discovered ${res.results_saved} new URLs (${res.duplicates_skipped} duplicates skipped). ${res.was_cached ? 'Reused cached query (0 SerpApi credits consumed)!' : '1 SerpApi credit used.'}`,
      });
      await fetchJob();
      await fetchResults(1);
    } catch (err) {
      setBannerMessage({ type: 'danger', text: err.message || 'Collection batch failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtractLeads = async () => {
    try {
      setActionLoading(true);
      setBannerMessage(null);
      const res = await searchJobsApi.extractLeads(jobId, 10);
      setBannerMessage({
        type: 'success',
        text: `Extraction batch completed: Processed ${res.results_processed} pages, created ${res.leads_created} leads, enriched ${res.leads_enriched} leads. Zero SerpApi credits consumed.`,
      });
      await fetchJob();
      await fetchResults(resultsPage);
      await fetchLeads(1);
    } catch (err) {
      setBannerMessage({ type: 'danger', text: err.message || 'Lead extraction failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      setActionLoading(true);
      setBannerMessage(null);
      const res = await searchJobsApi.retryFailed(jobId, 10);
      setBannerMessage({
        type: 'info',
        text: `Retry policy applied: Requeued ${res.results_requeued} transient failures (${res.results_not_retryable} non-retryable 403/404s skipped).`,
      });
      await fetchJob();
      await fetchResults(resultsPage);
    } catch (err) {
      setBannerMessage({ type: 'danger', text: err.message || 'Retry failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      setActionLoading(true);
      setBannerMessage(null);
      await searchJobsApi.start(jobId);
      setBannerMessage({ type: 'success', text: 'Search job started successfully.' });
      await fetchJob();
    } catch (err) {
      setBannerMessage({ type: 'danger', text: err.message || 'Failed to start job.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setActionLoading(true);
      await searchJobsApi.stop(jobId);
      await fetchJob();
    } catch (err) {
      setBannerMessage({ type: 'danger', text: err.message || 'Failed to stop job.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await searchJobsApi.resume(jobId);
      await fetchJob();
    } catch (err) {
      setBannerMessage({ type: 'danger', text: err.message || 'Failed to resume job.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunAutomated = async () => {
    try {
      setActionLoading(true);
      setBannerMessage(null);
      const res = await searchJobsApi.run(jobId);
      setBannerMessage({
        type: 'success',
        text: `Automated Lead Generation: Discovered ${res.results_saved} URLs and generated ${res.leads_created} qualified leads across ${res.queries_executed} targeted queries. ${res.completed ? 'Goal reached!' : 'Job updated.'}`,
      });
      await fetchJob();
      await fetchResults(1);
      await fetchLeads(1);
    } catch (err) {
      setBannerMessage({ type: 'danger', text: err.message || 'Automated execution failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading job workspace..." />;
  if (error || !job) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: 'var(--danger-light)' }}>
        <p style={{ color: 'var(--danger-text)', margin: 0 }}>{error || 'Job not found.'}</p>
        <button onClick={() => onNavigate('jobs')} className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}>
          Back to Jobs
        </button>
      </div>
    );
  }

  const isCompleted = job.status === 'completed';
  const isRunning = job.status === 'running';
  const isPending = job.status === 'pending';
  const canCollect = !isCompleted && job.serpapi_requests_used < job.max_serpapi_requests && job.qualified_leads_found < job.target_leads;

  return (
    <div>
      {/* Top Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={() => onNavigate('jobs')} className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Back to Search Jobs
        </button>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isPending && (
            <button onClick={handleStart} disabled={actionLoading} className="btn btn-secondary btn-sm">
              <Play size={13} /> Start Job
            </button>
          )}

          {/* Automated Run Pipeline Button */}
          {!isCompleted && (
            <button
              onClick={handleRunAutomated}
              disabled={actionLoading || !canCollect}
              className="btn btn-primary btn-sm"
              title="Automatically run query planning, Serper.dev search, and academic lead extraction until target is met"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Zap size={13} /> Run Automated Pipeline
            </button>
          )}

          {isRunning && (
            <button onClick={handleStop} disabled={actionLoading} className="btn btn-secondary btn-sm">
              <Square size={13} color="var(--warning-text)" /> Stop Job
            </button>
          )}

          {(job.status === 'stopped' || job.status === 'failed') && (
            <button onClick={handleResume} disabled={actionLoading} className="btn btn-secondary btn-sm">
              <Play size={13} color="var(--success-text)" /> Resume Job
            </button>
          )}

          <button
            onClick={handleCollectBatch}
            disabled={actionLoading || !canCollect}
            className="btn btn-secondary btn-sm"
            title="Consumes 1 Serper.dev search request (or 0 if cached) to discover URLs"
          >
            <Compass size={14} color="var(--primary)" /> Collect Search Batch
          </button>

          <button
            onClick={handleExtractLeads}
            disabled={actionLoading || job.pending_results_count === 0}
            className="btn btn-secondary btn-sm"
            title="Extracts contacts from stored pending URLs (0 search credits consumed)"
          >
            <Cpu size={14} /> Extract Leads ({job.pending_results_count} pending)
          </button>

          {job.failed_results_count > 0 && (
            <button
              onClick={handleRetryFailed}
              disabled={actionLoading}
              className="btn btn-danger btn-sm"
            >
              <RefreshCw size={13} /> Requeue Retries
            </button>
          )}
        </div>
      </div>

      {bannerMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: bannerMessage.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            border: `1px solid ${bannerMessage.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            color: bannerMessage.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
            marginBottom: '16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle size={16} />
          <span>{bannerMessage.text}</span>
        </div>
      )}

      {/* Workspace Header Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {job.search_name || 'Academic Discovery Workspace'}
              </h2>
              <IdBadge prefix="JOB" id={job.id} />
              <StatusBadge status={job.status} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Keywords: <strong style={{ color: 'var(--text-primary)' }}>{job.keywords}</strong>
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
            <div>Created: {new Date(job.created_at).toLocaleString()}</div>
            {job.started_at && <div>Started: {new Date(job.started_at).toLocaleString()}</div>}
          </div>
        </div>

        {/* Dual Progress Bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '12px 0 6px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span>Target Lead Progress</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {job.qualified_leads_found} / {job.target_leads} leads ({job.progress_percentage}%)
              </strong>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${job.progress_percentage}%`,
                  height: '100%',
                  backgroundColor: 'var(--primary)',
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span>Search Requests Budget (Serper.dev)</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {job.serpapi_requests_used} / {job.max_serpapi_requests} used ({job.remaining_requests} remaining)
              </strong>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, (job.serpapi_requests_used / job.max_serpapi_requests) * 100)}%`,
                  height: '100%',
                  backgroundColor: job.remaining_requests === 0 ? 'var(--danger)' : 'var(--secondary)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Results Outcome Breakdown Chips */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Total Discovered: <strong>{job.results_count}</strong>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--info-text)' }}>
            Processed: <strong>{job.processed_results_count}</strong>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--warning-text)' }}>
            Pending Extraction: <strong>{job.pending_results_count}</strong>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Skipped: <strong>{job.skipped_results_count}</strong>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--danger-text)' }}>
            Failed: <strong>{job.failed_results_count}</strong>
          </div>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('results')}
          className={`btn btn-sm ${activeTab === 'results' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Search size={14} /> Search Results ({resultsTotal})
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className={`btn btn-sm ${activeTab === 'leads' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Users size={14} /> Qualified Leads ({leadsTotal})
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`btn btn-sm ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <FileText size={14} /> Search Criteria & Config
        </button>
      </div>

      {/* Tab 1: Search Results */}
      {activeTab === 'results' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Result ID</th>
                  <th>URL & Page Title</th>
                  <th>Status</th>
                  <th>Retries</th>
                  <th>Outcome / Message</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No search results discovered yet. Click "Collect Search Batch" above.
                    </td>
                  </tr>
                ) : (
                  results.map((res) => (
                    <tr key={res.id}>
                      <td>
                        <IdBadge prefix="RES" id={res.id} />
                      </td>
                      <td style={{ maxWidth: '400px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {res.result_title || 'Webpage Document'}
                        </div>
                        <a
                          href={res.result_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '12px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '360px' }}>
                            {res.result_url}
                          </span>
                          <ExternalLink size={10} />
                        </a>
                      </td>
                      <td>
                        <StatusBadge status={res.status} />
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {res.retry_count || 0}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px' }}>
                        {res.error_message || (res.status === 'processed' ? 'Contact extracted successfully' : 'Awaiting extraction')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {res.lead_id && (
                          <button
                            onClick={() => onNavigate('leads', res.lead_id)}
                            className="btn btn-secondary btn-sm"
                          >
                            View Lead ({formatEntityId('LEAD', res.lead_id)})
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={resultsPage}
            totalPages={resultsTotalPages}
            totalItems={resultsTotal}
            pageSize={25}
            onPageChange={(p) => {
              setResultsPage(p);
              fetchResults(p);
            }}
          />
        </div>
      )}

      {/* Tab 2: Qualified Leads */}
      {activeTab === 'leads' && (
        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-subtle)',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {leadsTotal} Verified Leads Discovered
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleExportXlsx}
                disabled={downloadingXlsx}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Download this job's verified leads as a styled Excel (.xlsx) file"
              >
                <FileSpreadsheet size={13} className={downloadingXlsx ? 'spin' : ''} />
                {downloadingXlsx ? 'Exporting...' : 'Download Excel (.xlsx)'}
              </button>
              <button
                onClick={handleExportCsv}
                disabled={downloadingCsv}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Download this job's verified leads as CSV"
              >
                <Download size={13} className={downloadingCsv ? 'spin' : ''} />
                {downloadingCsv ? 'Exporting...' : 'CSV'}
              </button>
            </div>

          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Lead ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Designation</th>
                  <th>University</th>
                  <th>Country</th>
                  <th>Confidence</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No leads extracted yet for this job. Click "Extract Leads" above to parse pending URLs.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <IdBadge prefix="LEAD" id={lead.id} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{lead.name}</td>
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
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => onNavigate('leads', lead.id)}
                          className="btn btn-secondary btn-sm"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={leadsPage}
            totalPages={leadsTotalPages}
            totalItems={leadsTotal}
            pageSize={25}
            onPageChange={(p) => {
              setLeadsPage(p);
              fetchLeads(p);
            }}
          />
        </div>
      )}

      {/* Tab 3: Configuration & Criteria */}
      {activeTab === 'config' && (
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
            Search Criteria & Safety Configuration
          </h3>
          <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <pre style={{ margin: 0, fontSize: '13px', overflowX: 'auto', fontFamily: 'monospace' }}>
              {JSON.stringify(
                {
                  id: job.id,
                  search_name: job.search_name,
                  keywords: job.keywords,
                  search_criteria: job.search_criteria,
                  target_leads: job.target_leads,
                  max_serpapi_requests: job.max_serpapi_requests,
                  serpapi_requests_used: job.serpapi_requests_used,
                  status: job.status,
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
