
import React, { useEffect, useState } from 'react';
import { CheckSquare, CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { reviewQueueApi } from '../../services/api-client';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function ReviewQueuePage({ onNavigate: _onNavigate }) {

  const [candidates, setCandidates] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [banner, setBanner] = useState(null);
  const [error, setError] = useState(null);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reviewQueueApi.list({ page, page_size: 10 });
      setCandidates(res.items);
      setTotalPages(res.total_pages);
      setTotalCount(res.total);
    } catch (err) {
      setError(err.message || 'Failed to load review queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [page]);

  const handleApprove = async (id) => {
    try {
      setActionLoadingId(id);
      await reviewQueueApi.approve(id, 'Approved via manual review queue');
      setBanner({ type: 'success', text: `Candidate #${id} approved and marked as qualified!` });
      await fetchQueue();
    } catch (err) {
      setBanner({ type: 'danger', text: err.message || 'Approval failed.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id) => {
    try {
      setActionLoadingId(id);
      await reviewQueueApi.reject(id, 'Rejected via manual review queue');
      setBanner({ type: 'info', text: `Candidate #${id} rejected.` });
      await fetchQueue();
    } catch (err) {
      setBanner({ type: 'danger', text: err.message || 'Rejection failed.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) return <LoadingSpinner text="Loading review queue..." />;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Information Header */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <span className="card-title">
            <CheckSquare size={18} color="var(--warning)" />
            Candidate Quality & Review Queue
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {totalCount} ambiguous candidates require verification
          </span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
          Contacts with ambiguous structural pairing or incomplete affiliation evidence are placed here.
          Approving a candidate promotes them to <strong>Qualified Lead</strong> status and updates job progress.
        </p>
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

      {error ? (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: 'var(--danger-light)' }}>
          <p style={{ color: 'var(--danger-text)', margin: 0 }}>{error}</p>
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState
          title="Review Queue is Clean"
          message="There are no ambiguous candidates awaiting review. High-confidence contacts have been promoted directly to qualified leads."
          icon={CheckCircle}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {candidates.map((cand) => (
            <div key={cand.id} className="card" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {cand.name}
                    </h3>
                    <StatusBadge status="needs_review" />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--warning-text)', backgroundColor: 'var(--warning-light)', padding: '2px 6px', borderRadius: '4px' }}>
                      Confidence: {cand.confidence_score ? `${Math.round(cand.confidence_score * 100)}%` : '60%'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    <a href={`mailto:${cand.email}`} style={{ color: 'var(--primary)', fontWeight: 500 }}>
                      {cand.email}
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleReject(cand.id)}
                    disabled={actionLoadingId === cand.id}
                    className="btn btn-danger btn-sm"
                  >
                    <XCircle size={14} /> Reject
                  </button>

                  <button
                    onClick={() => handleApprove(cand.id)}
                    disabled={actionLoadingId === cand.id}
                    className="btn btn-success btn-sm"
                  >
                    <CheckCircle size={14} /> Approve as Qualified
                  </button>
                </div>
              </div>

              {/* Review Reason */}
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--warning-light)',
                  border: '1px solid var(--warning-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--warning-text)',
                  fontSize: '12px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={14} />
                <span>Review Reason: {cand.qualification_reason || 'Requires manual affiliation or designation check.'}</span>
              </div>

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Role / Title:</span>{' '}
                  <strong>{cand.profession || 'Not explicitly stated'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Institution:</span>{' '}
                  <strong>{cand.university || 'Unspecified'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Country:</span>{' '}
                  <strong>{cand.country || 'Unspecified'}</strong>
                </div>
              </div>

              {cand.source_url && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Source: </span>
                  <a href={cand.source_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span>{cand.source_url}</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          ))}

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
