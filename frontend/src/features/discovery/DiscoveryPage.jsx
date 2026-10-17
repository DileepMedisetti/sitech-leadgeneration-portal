
import React, { useEffect, useState } from 'react';
import { Compass, Shield, Play, CheckCircle2, ArrowRight } from 'lucide-react';
import { searchJobsApi } from '../../services/api-client';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function DiscoveryPage({ onNavigate }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [queryOverride, setQueryOverride] = useState('');
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActiveJobs = async () => {
      try {
        setLoading(true);
        const res = await searchJobsApi.list({ page_size: 50 });
        setJobs(res.items);
        if (res.items.length > 0) {
          const first = res.items[0];
          setSelectedJobId(first.id);
          setSelectedJob(first);
          setQueryOverride(first.keywords);
        }
      } catch (err) {
        setError(err.message || 'Failed to load jobs for discovery.');
      } finally {
        setLoading(false);
      }
    };
    fetchActiveJobs();
  }, []);

  const handleJobChange = async (jobId) => {
    setSelectedJobId(jobId);
    setResult(null);
    try {
      const jobData = await searchJobsApi.get(jobId);
      setSelectedJob(jobData);
      setQueryOverride(jobData.keywords);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunDiscovery = async () => {
    if (!selectedJobId) return;
    try {
      setCollecting(true);
      setError(null);
      setResult(null);
      const res = await searchJobsApi.collect(selectedJobId, queryOverride.trim() || null);
      setResult(res);
      // Refresh job data
      const updatedJob = await searchJobsApi.get(selectedJobId);
      setSelectedJob(updatedJob);
    } catch (err) {
      setError(err.message || 'Discovery request failed.');
    } finally {
      setCollecting(false);
    }
  };

  if (loading) return <LoadingSpinner text="Preparing discovery engine..." />;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Compass size={18} color="var(--text-primary)" />
            Targeted Academic Lead Discovery
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Google Search via SerpApi (Strict Budget Enforced)
          </span>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
              No search jobs available. Create a job first to run discovery.
            </p>
            <button onClick={() => onNavigate('new-job')} className="btn btn-primary">
              Create Search Job
            </button>
          </div>
        ) : (
          <div>
            <div className="form-group">
              <label className="form-label">Active Search Job</label>
              <select
                value={selectedJobId}
                onChange={(e) => handleJobChange(e.target.value)}
                className="form-control"
                style={{ height: '36px' }}
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    Job {String(j.id).padStart(3, '0')} — {j.search_name || j.keywords} ({j.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedJob && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', backgroundColor: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Qualified Leads</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedJob.qualified_leads_found} / {selectedJob.target_leads}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SerpApi Requests Used</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedJob.serpapi_requests_used} / {selectedJob.max_serpapi_requests}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Remaining Budget</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {Math.max(0, selectedJob.max_serpapi_requests - selectedJob.serpapi_requests_used)} requests
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Search Query Execution</label>
              <input
                type="text"
                value={queryOverride}
                onChange={(e) => setQueryOverride(e.target.value)}
                className="form-control"
                placeholder="Query sent to SerpApi"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                You can execute targeted query variations (e.g. adding <code>"faculty directory"</code> or <code>site:edu</code>).
              </span>
            </div>

            {/* Quick Query Presets */}
            {selectedJob && (
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  High-Yield Query Variants:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                  {[
                    `${selectedJob.keywords} faculty directory email`,
                    `${selectedJob.keywords} "faculty profile" mailto`,
                    `${selectedJob.keywords} department professors contact`,
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQueryOverride(preset)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px' }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <Shield size={14} color="var(--text-primary)" />
                <span>Deterministic query cache prevents duplicate API credit consumption</span>
              </div>

              <button
                onClick={handleRunDiscovery}
                disabled={collecting || (selectedJob && selectedJob.serpapi_requests_used >= selectedJob.max_serpapi_requests)}
                className="btn btn-primary"
              >
                <Play size={14} />
                <span>{collecting ? 'Running Discovery...' : 'Execute Search Batch'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Discovery Outcome Card */}
      {result && (
        <div className="card" style={{ borderLeft: '4px solid #18181b', backgroundColor: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CheckCircle2 size={18} color="var(--text-primary)" />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
              Discovery Batch Executed Successfully
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', margin: '14px 0', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{result.results_received}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Raw Results</div>
            </div>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{result.results_saved}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>New Stored URLs</div>
            </div>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)' }}>{result.duplicates_skipped}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duplicates Avoided</div>
            </div>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {result.was_cached ? '0 (Cached)' : '1 Credit'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SerpApi Cost</div>
            </div>
          </div>


          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={() => onNavigate('job-detail', selectedJobId)}
              className="btn btn-primary btn-sm"
            >
              Open Job Workspace <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
