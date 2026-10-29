import React, { useEffect, useState } from 'react';
import { X, FolderPlus, Search, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { audienceApi } from '../../../services/api-client';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export default function AddToListModal({
  isOpen,
  onClose,
  selectedLeadIds = [],
  onSuccess,
}) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedListId, setSelectedListId] = useState(null);
  const [resultSummary, setResultSummary] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedListId(null);
      setError(null);
      setResultSummary(null);
      setSearch('');
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const fetchLists = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await audienceApi.getLists({ page: 1, page_size: 100, sort_by: 'updated_at' });
        setLists(res.items || []);
        if (res.items && res.items.length > 0) {
          setSelectedListId(res.items[0].id);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch existing lists.');
      } finally {
        setLoading(false);
      }
    };

    fetchLists();

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLists = lists.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedListId) {
      setError('Please select a target contact list.');
      return;
    }
    if (!selectedLeadIds.length) {
      setError('No contacts are currently selected.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const summary = await audienceApi.addContactsToList(selectedListId, selectedLeadIds);
      setResultSummary(summary);
      if (onSuccess) {
        onSuccess(summary);
      }
    } catch (err) {
      setError(err.message || 'Failed to add contacts to list.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="drawer-backdrop"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 110,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          boxShadow: 'var(--shadow-xl)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
        }}
        role="dialog"
        aria-labelledby="add-to-list-title"
        aria-modal="true"
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderPlus size={18} color="var(--text-primary)" />
            <h3 id="add-to-list-title" style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              Add to Existing List
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="btn btn-sm btn-outline"
            style={{ padding: '4px', borderRadius: 'var(--radius-sm)' }}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {resultSummary ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <CheckCircle size={24} color="var(--text-primary)" />
              </div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                Batch Completed
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Successfully processed <strong>{resultSummary.requested}</strong> selected contact(s).
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  padding: '12px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {resultSummary.added}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Added
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {resultSummary.skipped_duplicates}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Duplicates
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {resultSummary.rejected_invalid}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Ineligible
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Enrolling <strong>{selectedLeadIds.length}</strong> selected contact(s) into a saved list.
                  Duplicate emails and duplicate leads will be automatically skipped safely.
                </p>
              </div>

              {error && (
                <div
                  className="alert-banner alert-danger"
                  style={{ marginBottom: '16px', fontSize: '12.5px' }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {loading ? (
                <LoadingSpinner text="Loading saved lists..." />
              ) : lists.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    border: '1px dashed var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-app)',
                  }}
                >
                  <Users size={24} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 4px' }}>
                    No saved lists found
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Please create a list first from the Lists tab.
                  </p>
                </div>
              ) : (
                <>
                  {/* Search within lists */}
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <Search
                      size={14}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search lists..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        fontSize: '12.5px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-subtle)',
                      }}
                    />
                  </div>

                  {/* List Selection Options */}
                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {filteredLists.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        No matching lists found.
                      </div>
                    ) : (
                      filteredLists.map((item) => {
                        const isSelected = selectedListId === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedListId(item.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              borderBottom: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? 'var(--bg-subtle)' : '#ffffff',
                              transition: 'background-color var(--transition-fast)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type="radio"
                                name="destination_list"
                                checked={isSelected}
                                onChange={() => setSelectedListId(item.id)}
                                style={{ accentColor: 'var(--text-primary)', cursor: 'pointer' }}
                              />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                  {item.name}
                                </div>
                                {item.description && (
                                  <div
                                    style={{
                                      fontSize: '11.5px',
                                      color: 'var(--text-muted)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '280px',
                                    }}
                                  >
                                    {item.description}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: '11.5px',
                                color: 'var(--text-muted)',
                                backgroundColor: 'var(--bg-app)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              {item.contact_count} contacts
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      marginTop: '20px',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '10px',
                    }}
                  >
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={onClose}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !selectedListId || selectedLeadIds.length === 0}
                      className="btn btn-primary"
                    >
                      {submitting ? 'Adding...' : 'Add Contacts'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
