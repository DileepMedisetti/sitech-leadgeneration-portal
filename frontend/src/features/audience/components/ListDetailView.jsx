import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  UserPlus,
  UserMinus,
  Search,
  X,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { audienceApi } from '../../../services/api-client';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Pagination from '../../../components/ui/Pagination';
import EmptyState from '../../../components/ui/EmptyState';
import AddToListModal from './AddToListModal';

export default function ListDetailView({
  listId,
  onBack,
  onListDeleted,
}) {
  const [list, setList] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);

  // Pagination & Filtering for members
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Deletion modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingList, setDeletingList] = useState(false);

  // Removal modal
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removingMembers, setRemovingMembers] = useState(false);

  // Add more contacts modal
  const [showAddModal, setShowAddModal] = useState(false);

  // Initial Fetch of List Details
  const fetchListDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await audienceApi.getList(listId);
      setList(data);
      setEditName(data.name);
      setEditDescription(data.description || '');
    } catch (err) {
      setError(err.message || 'Failed to load contact list.');
    } finally {
      setLoading(false);
    }
  }, [listId]);

  const fetchMembers = useCallback(async () => {
    try {
      setLoadingMembers(true);
      const data = await audienceApi.getListContacts(listId, {
        page,
        page_size: 20,
        search: search.trim() || undefined,
        sort_by: 'added_at',
        sort_order: 'desc',
      });
      setMembers(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load list contacts.');
    } finally {
      setLoadingMembers(false);
    }
  }, [listId, page, search]);

  useEffect(() => {
    fetchListDetails();
  }, [fetchListDetails]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;

    try {
      setSavingEdit(true);
      const updated = await audienceApi.updateList(listId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setList(updated);
      setIsEditing(false);
      setBanner({ type: 'success', text: 'List metadata updated successfully.' });
    } catch (err) {
      setBanner({ type: 'danger', text: err.message || 'Failed to update list.' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteList = async () => {
    try {
      setDeletingList(true);
      await audienceApi.deleteList(listId);
      setShowDeleteModal(false);
      if (onListDeleted) {
        onListDeleted(listId);
      }
    } catch (err) {
      setBanner({ type: 'danger', text: err.message || 'Failed to delete list.' });
      setShowDeleteModal(false);
    } finally {
      setDeletingList(false);
    }
  };

  const handleRemoveSelectedMembers = async () => {
    if (!selectedLeadIds.length) return;

    try {
      setRemovingMembers(true);
      const res = await audienceApi.removeContactsFromList(listId, selectedLeadIds);
      setShowRemoveModal(false);
      setSelectedLeadIds([]);
      setBanner({
        type: 'success',
        text: `Removed ${res.removed} membership(s) from this list. Original lead records remain untouched.`,
      });
      if (members.length <= res.removed && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        fetchMembers();
      }
      fetchListDetails();
    } catch (err) {
      setBanner({ type: 'danger', text: err.message || 'Failed to remove contacts.' });
      setShowRemoveModal(false);
    } finally {
      setRemovingMembers(false);
    }
  };

  const handleToggleSelectMember = (leadId) => {
    if (selectedLeadIds.includes(leadId)) {
      setSelectedLeadIds(selectedLeadIds.filter((id) => id !== leadId));
    } else {
      setSelectedLeadIds([...selectedLeadIds, leadId]);
    }
  };

  const handleSelectVisibleMembers = () => {
    const visibleIds = members.map((m) => m.lead_id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedLeadIds.includes(id));
    if (allSelected) {
      setSelectedLeadIds(selectedLeadIds.filter((id) => !visibleIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedLeadIds, ...visibleIds]));
      setSelectedLeadIds(merged);
    }
  };

  if (loading) return <LoadingSpinner text="Loading contact list..." />;
  if (error || !list) {
    return (
      <div>
        <button onClick={onBack} className="btn btn-secondary btn-sm" style={{ marginBottom: '16px' }}>
          <ArrowLeft size={14} /> Back to Lists
        </button>
        <div className="card" style={{ borderLeft: '4px solid var(--border-focus)' }}>
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>{error || 'List not found.'}</p>
        </div>
      </div>
    );
  }

  const visibleIds = members.map((m) => m.lead_id);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedLeadIds.includes(id));

  return (
    <div>
      {/* Top Navigation & Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <button
          onClick={onBack}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={14} />
          <span>Back to Lists</span>
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Edit2 size={13} />
            <span>{isEditing ? 'Cancel Editing' : 'Edit List'}</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <Trash2 size={13} />
            <span>Delete List</span>
          </button>
        </div>
      </div>

      {banner && (
        <div className={`alert-banner alert-${banner.type}`} style={{ marginBottom: '16px' }}>
          <span>{banner.text}</span>
          <button
            onClick={() => setBanner(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* List Header Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        {isEditing ? (
          <form onSubmit={handleSaveEdit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                List Name
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-subtle)',
                }}
              />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-subtle)',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit || !editName.trim()}
                className="btn btn-primary btn-sm"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                  {list.name}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                  {list.description || 'No description provided.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                  }}
                >
                  <Users size={13} />
                  {list.contact_count} Contacts
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '10px',
                marginTop: '10px',
              }}
            >
              <span>Created {new Date(list.created_at).toLocaleDateString()}</span>
              <span>•</span>
              <span>Last updated {new Date(list.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Member Management Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px', maxWidth: '320px' }}>
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
            placeholder="Search list contacts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              fontSize: '12.5px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedLeadIds.length > 0 && (
            <button
              onClick={() => setShowRemoveModal(true)}
              className="btn btn-sm"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <UserMinus size={13} />
              <span>Remove {selectedLeadIds.length} Selected</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={13} />
            <span>Add Contacts</span>
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="card" style={{ padding: 0 }}>
        {loadingMembers ? (
          <LoadingSpinner text="Loading enrolled contacts..." />
        ) : members.length === 0 ? (
          <EmptyState
            title="No contacts in this list"
            message={
              search
                ? `No contacts match "${search}".`
                : 'This list is currently empty. Click "Add Contacts" to enroll eligible leads.'
            }
            action={
              <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
                <UserPlus size={13} /> Add Contacts
              </button>
            }
          />
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      onChange={handleSelectVisibleMembers}
                      style={{ accentColor: 'var(--text-primary)', cursor: 'pointer' }}
                      aria-label="Select visible members"
                    />
                  </th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>University / Institution</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Country</th>
                  <th>Added Date</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelected = selectedLeadIds.includes(member.lead_id);
                  return (
                    <tr
                      key={member.membership_id}
                      onClick={() => handleToggleSelectMember(member.lead_id)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--bg-subtle)' : undefined,
                      }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectMember(member.lead_id)}
                          style={{ accentColor: 'var(--text-primary)', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>{member.name}</td>
                      <td>
                        <a
                          href={`mailto:${member.email}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ textDecoration: 'none', color: 'var(--text-primary)' }}
                        >
                          {member.email}
                        </a>
                      </td>
                      <td>{member.university || '—'}</td>
                      <td>{member.department || '—'}</td>
                      <td>{member.profession || '—'}</td>
                      <td>{member.country || '—'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(member.added_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {members.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={20}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Delete List Confirmation Dialog */}
      {showDeleteModal && (
        <div
          className="drawer-backdrop"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 120 }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              backgroundColor: '#ffffff',
              boxShadow: 'var(--shadow-xl)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <AlertTriangle size={20} color="var(--text-primary)" />
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Delete Contact List?</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Are you sure you want to delete <strong>"{list.name}"</strong>?
            </p>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginBottom: '20px',
              }}
            >
              <strong>Safe Deletion:</strong> Only this curated list and its membership associations will be deleted.
              The original lead records in your database will <strong>never</strong> be deleted.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={deletingList}
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingList}
                onClick={handleDeleteList}
                className="btn btn-primary"
              >
                {deletingList ? 'Deleting...' : 'Delete List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Memberships Confirmation Dialog */}
      {showRemoveModal && (
        <div
          className="drawer-backdrop"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 120 }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              backgroundColor: '#ffffff',
              boxShadow: 'var(--shadow-xl)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <AlertTriangle size={20} color="var(--text-primary)" />
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Remove from List?</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Remove <strong>{selectedLeadIds.length}</strong> selected contact(s) from "{list.name}"?
            </p>
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginBottom: '20px',
              }}
            >
              <strong>Lead Preservation:</strong> This only removes their membership in this specific list.
              The contact records themselves are preserved in your Leads database.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={removingMembers}
                onClick={() => setShowRemoveModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingMembers}
                onClick={handleRemoveSelectedMembers}
                className="btn btn-primary"
              >
                {removingMembers ? 'Removing...' : 'Remove Memberships'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add More Contacts Dialog (reusing AddToListModal with target list locked) */}
      <AddToListModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        selectedLeadIds={[]}
        onSuccess={() => {
          setShowAddModal(false);
          fetchListDetails();
          fetchMembers();
        }}
      />
    </div>
  );
}
