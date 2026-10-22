import React, { useEffect, useState } from 'react';
import { Cpu, RefreshCw, ShieldCheck, Play, ExternalLink, Download } from 'lucide-react';
import { searchJobsApi, triggerBlobDownload } from '../../services/api-client';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Pagination from '../../components/ui/Pagination';
import IdBadge, { formatEntityId } from '../../components/ui/IdBadge';
import { generateSearchResultsExcelBlob } from '../../utils/excelExport';

export default function ExtractionMonitorPage({ onNavigate: _onNavigate }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [batchLimit, setBatchLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [banner, setBanner] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsTotalPages, setResultsTotalPages] = useState(1);
  const [resultsTotalCount, setResultsTotalCount] = useState(0);

  const loadJobResults = async (jobId, filter = statusFilter, page = resultsPage) => {
    if (!jobId) {
      setResults([]);
      setResultsTotalPages(1);
      setResultsTotalCount(0);
      return;
    }
    try {
      setResultsLoading(true);
      const apiStatus = filter === 'all' ? undefined : filter;
      const res = await searchJobsApi.getResults(jobId, {
        page,
        page_size: 25,
        status: apiStatus,
      });
      setResults(res.items || []);
      setResultsPage(res.page || 1);
      setResultsTotalPages(res.total_pages || 1);
      setResultsTotalCount(res.total || 0);
    } catch (err) {
      console.error('Failed to load search job results:', err);
      setResults([]);
      setResultsTotalPages(1);
      setResultsTotalCount(0);
    } finally {
      setResultsLoading(false);
    }
  };

  const loadJobDetails = async (jobId, filter = statusFilter, page = resultsPage) => {
    try {
      const data = await searchJobsApi.get(jobId);
      setSelectedJob(data);
      await loadJobResults(jobId, filter, page);
    } catch (err) {
      console.error('Failed to load job details:', err);
    }
  };

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        const res = await searchJobsApi.list({ page_size: 50 });
        setJobs(res.items || []);
        if (res.items && res.items.length > 0) {
          const initialJobId = res.items[0].id;
          setSelectedJobId(initialJobId);
          await loadJobDetails(initialJobId, 'all', 1);
        }
      } catch (err) {
        console.error('Failed to fetch jobs queue:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const handleSelectJob = (id) => {
    const numericId = id ? Number(id) : '';
    setSelectedJobId(numericId);
    setBanner(null);
    setStatusFilter('all');
    setResultsPage(1);
    loadJobDetails(numericId, 'all', 1);
  };

  const handleFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setResultsPage(1);
    if (selectedJobId) {
      loadJobResults(selectedJobId, newStatus, 1);
    }
  };

  const handlePageChange = (newPage) => {
    setResultsPage(newPage);
    if (selectedJobId) {
      loadJobResults(selectedJobId, statusFilter, newPage);
    }
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
      await loadJobDetails(selectedJobId, statusFilter, resultsPage);
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
      await loadJobDetails(selectedJobId, statusFilter, resultsPage);
    } catch (err) {
      setBanner({ type: 'danger', text: err.message || 'Retry failed.' });
    } finally {
      setRetrying(false);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedJobId) return;

    const formattedId = String(selectedJobId).padStart(3, '0');
    const filterLabel = statusFilter === 'all' ? 'all' : statusFilter;
    const filename = `job_${formattedId}_${filterLabel}_results.xlsx`;

    try {
      setExporting(true);
      setBanner(null);

      if (statusFilter === 'all') {
        if (resultsTotalCount === 0 && (!selectedJob || selectedJob.results_count === 0)) {
          setBanner({
            type: 'info',
            text: `No stored results available to export for Job ${formattedId}.`,
          });
          return;
        }

        await searchJobsApi.downloadResultsXlsx(selectedJobId, filename);
        setBanner({
          type: 'success',
          text: `Successfully exported all stored extraction results for Job ${formattedId} to ${filename}.`,
        });
      } else {
        // Fetch all matching records for the selected status across all pages
        const firstPage = await searchJobsApi.getResults(selectedJobId, {
          page: 1,
          page_size: 100,
          status: statusFilter,
        });

        let allMatching = firstPage.items || [];
        if (firstPage.total_pages > 1) {
          const remainingPages = [];
          for (let p = 2; p <= firstPage.total_pages; p++) {
            remainingPages.push(
              searchJobsApi.getResults(selectedJobId, {
                page: p,
                page_size: 100,
                status: statusFilter,
              })
            );
          }
          const pageResults = await Promise.all(remainingPages);
          pageResults.forEach((pr) => {
            allMatching = allMatching.concat(pr.items || []);
          });
        }

        if (allMatching.length === 0) {
          setBanner({
            type: 'info',
            text: `No ${statusFilter} records available to export for Job ${formattedId}.`,
          });
          return;
        }

        const blob = generateSearchResultsExcelBlob(allMatching);
        triggerBlobDownload(blob, filename, null, true);
        setBanner({
          type: 'success',
          text: `Successfully exported ${allMatching.length} ${statusFilter} result(s) for Job ${formattedId} to ${filename}.`,
        });
      }
    } catch (err) {
      setBanner({
        type: 'danger',
        text: `Failed to export Excel file for Job ${formattedId}: ${err.message || 'Unknown network error'}.`,
      });
    } finally {
      setExporting(false);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '4px 10px', borderRadius: '9999px', border: '1px solid var(--primary-border)', fontWeight: 500 }}>
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
              style={{ height: '36px' }}
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {formatEntityId('JOB', j.id)} — {j.search_name || j.keywords} ({j.status})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '11.5px', marginBottom: '4px' }}>Batch Size</label>
              <select
                value={batchLimit}
                onChange={(e) => setBatchLimit(parseInt(e.target.value, 10))}
                className="form-control"
                style={{ width: '110px', height: '36px' }}
              >
                <option value={5}>5 URLs</option>
                <option value={10}>10 URLs</option>
                <option value={20}>20 URLs</option>
                <option value={50}>50 URLs</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleRunExtraction}
                disabled={extracting || !selectedJob || selectedJob.pending_results_count === 0}
                className="btn btn-primary"
                style={{
                  height: '36px',
                  padding: '0 14px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Play size={14} />
                <span>{extracting ? 'Extracting...' : `Extract Batch (${selectedJob ? selectedJob.pending_results_count : 0} Pending)`}</span>
              </button>

              {selectedJob && selectedJob.failed_results_count > 0 && (
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  disabled={retrying}
                  className="btn btn-secondary"
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-md)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={14} className={retrying ? 'spin' : ''} />
                  <span>Retry Eligible ({selectedJob.failed_results_count})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {banner && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: banner.type === 'success' ? 'var(--success-light, #f0fdf4)' : banner.type === 'danger' ? 'var(--danger-light, #fef2f2)' : 'var(--bg-subtle)',
            border: `1px solid ${banner.type === 'success' ? 'var(--success-border, #bbf7d0)' : banner.type === 'danger' ? 'var(--danger-border, #fecaca)' : 'var(--border-color)'}`,
            color: banner.type === 'success' ? 'var(--success-text, #15803d)' : banner.type === 'danger' ? 'var(--danger-text, #b91c1c)' : 'var(--text-primary)',
            marginBottom: '16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span>{banner.text}</span>
          <button
            onClick={() => setBanner(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              padding: '0 4px',
            }}
            aria-label="Dismiss banner"
          >
            ×
          </button>
        </div>
      )}

      {/* Queue Status Breakdown */}
      {selectedJob && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
          <div className="card" style={{ margin: 0, textAlign: 'center', borderTop: '3px solid var(--warning)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending URLs</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--warning-text)', marginTop: '4px' }}>
              {selectedJob.pending_results_count}
            </div>
          </div>
          <div className="card" style={{ margin: 0, textAlign: 'center', borderTop: '3px solid var(--success)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Processed & Extracted</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--success-text)', marginTop: '4px' }}>
              {selectedJob.processed_results_count}
            </div>
          </div>
          <div className="card" style={{ margin: 0, textAlign: 'center', borderTop: '3px solid var(--text-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Skipped (No Contact)</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '4px' }}>
              {selectedJob.skipped_results_count}
            </div>
          </div>
          <div className="card" style={{ margin: 0, textAlign: 'center', borderTop: '3px solid var(--danger)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Failed (HTTP 403 / Net)</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--danger-text)', marginTop: '4px' }}>
              {selectedJob.failed_results_count}
            </div>
          </div>
        </div>
      )}

      {/* Real-time URLs Table */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
            Recent Stored Results for Job {selectedJobId ? String(selectedJobId).padStart(3, '0') : ''}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              disabled={exporting}
              className="form-control"
              style={{
                height: '36px',
                width: '130px',
                fontSize: '13px',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0 12px',
                cursor: exporting ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box',
              }}
              aria-label="Filter results by status"
            >
              <option value="all">All</option>
              <option value="processed">Processed</option>
              <option value="skipped">Skipped</option>
              <option value="failed">Failed</option>
            </select>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={exporting || !selectedJobId}
              className="btn btn-secondary btn-sm"
              style={{
                height: '36px',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 14px',
                fontSize: '12.5px',
                boxSizing: 'border-box',
              }}
              title={`Export ${statusFilter === 'all' ? 'all' : statusFilter} results for Job ${selectedJobId ? String(selectedJobId).padStart(3, '0') : ''} to Excel (.xlsx)`}
            >
              <Download size={14} className={exporting ? 'spin' : ''} />
              <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Result ID</th>
                <th>Target Webpage URL</th>
                <th>Status</th>
                <th>Retries</th>
                <th>Extraction Details</th>
              </tr>
            </thead>
            <tbody>
              {resultsLoading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <RefreshCw size={14} className="spin" />
                      <span>Loading {statusFilter === 'all' ? '' : statusFilter} results...</span>
                    </div>
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {statusFilter === 'all'
                      ? 'No results stored for this job yet. Run discovery to collect URLs.'
                      : `No results with status "${statusFilter}" found for this job.`}
                  </td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <IdBadge prefix="RES" id={r.id} />
                    </td>
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

        <Pagination
          page={resultsPage}
          totalPages={resultsTotalPages}
          totalItems={resultsTotalCount}
          pageSize={25}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
