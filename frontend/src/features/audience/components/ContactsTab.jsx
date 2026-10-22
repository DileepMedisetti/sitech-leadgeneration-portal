import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Columns,
  FolderPlus,
  X,
  RotateCcw,
} from 'lucide-react';
import { audienceApi } from '../../../services/api-client';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Pagination from '../../../components/ui/Pagination';
import EmptyState from '../../../components/ui/EmptyState';
import ColumnSelectorModal from './ColumnSelectorModal';
import { DEFAULT_VISIBLE_COLUMNS, ALL_COLUMNS } from '../columnConstants';
import AddToListModal from './AddToListModal';
import { COUNTRIES } from '../../../data/countries';

const STORAGE_KEY_COLUMNS = 'sitech_audience_contacts_columns';

export default function ContactsTab({ onSelectLead: _onSelectLead }) {
  const [contacts, setContacts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);

  // Selection & Bulk Actions
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  // Modals
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);

  // Visible Columns state persisted in localStorage with defensive sanitization
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLUMNS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validIds = ALL_COLUMNS.map((c) => c.id);
          const sanitized = parsed.filter((id) => typeof id === 'string' && validIds.includes(id));
          if (!sanitized.includes('name')) sanitized.unshift('name');
          if (!sanitized.includes('email')) sanitized.splice(1, 0, 'email');
          if (sanitized.length > 0) return sanitized;
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_VISIBLE_COLUMNS;
  });

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await audienceApi.getContacts({
        page,
        page_size: 20,
        search: search.trim() || undefined,
        country: countryFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setContacts(res.items || []);
      setTotalPages(res.total_pages || 1);
      setTotalCount(res.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load eligible contacts.');
    } finally {
      setLoading(false);
    }
  }, [page, search, countryFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSaveColumns = (newColumns) => {
    setVisibleColumns(newColumns);
    try {
      localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(newColumns));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleLead = (id) => {
    if (selectedLeadIds.includes(id)) {
      setSelectedLeadIds(selectedLeadIds.filter((item) => item !== id));
    } else {
      setSelectedLeadIds([...selectedLeadIds, id]);
    }
  };

  const handleSelectVisible = () => {
    const visibleIds = contacts.map((c) => c.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedLeadIds.includes(id));
    if (allSelected) {
      setSelectedLeadIds(selectedLeadIds.filter((id) => !visibleIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedLeadIds, ...visibleIds]));
      setSelectedLeadIds(merged);
    }
  };

  const handleClearSelection = () => {
    setSelectedLeadIds([]);
  };

  const hasActiveFilters = Boolean(search || countryFilter || sortBy !== 'created_at' || sortOrder !== 'desc');

  const handleResetFilters = () => {
    setSearch('');
    setCountryFilter('');
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
  };

  const visibleIds = contacts.map((c) => c.id);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedLeadIds.includes(id));

  return (
    <div>
      {/* Top Filter and Search Bar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: '1 1 auto' }}>
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
              placeholder="Search contacts (name, email, university)..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                fontSize: '12.5px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
              }}
            />
          </div>

          {/* Country Filter */}
          <select
            value={countryFilter}
            onChange={(e) => {
              setCountryFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '7px 12px',
              fontSize: '12.5px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All Countries</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Sort By Dropdown */}
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split(':');
              setSortBy(sb);
              setSortOrder(so);
              setPage(1);
            }}
            style={{
              padding: '7px 12px',
              fontSize: '12.5px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
              color: 'var(--text-primary)',
            }}
          >
            <option value="created_at:desc">Newest Discovered</option>
            <option value="created_at:asc">Oldest Discovered</option>
            <option value="name:asc">Name (A–Z)</option>
            <option value="name:desc">Name (Z–A)</option>
            <option value="university:asc">University (A–Z)</option>
            <option value="country:asc">Country (A–Z)</option>
            <option value="confidence_score:desc">Highest Confidence</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="btn btn-sm btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px' }}
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Column Chooser Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowColumnModal(true)}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Choose which columns to show or hide"
          >
            <Columns size={13} />
            <span>Customize Columns</span>
          </button>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Toolbar */}
      {selectedLeadIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '10px 16px',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            borderRadius: 'var(--radius-md)',
            marginBottom: '14px',
            boxShadow: 'var(--shadow-md)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            <span style={{ fontWeight: 600 }}>
              {selectedLeadIds.length} contact{selectedLeadIds.length > 1 ? 's' : ''} selected
            </span>
            <span style={{ opacity: 0.6 }}>•</span>
            <button
              onClick={handleClearSelection}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                textDecoration: 'underline',
                fontSize: '12px',
                cursor: 'pointer',
                opacity: 0.85,
              }}
            >
              Deselect All
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowAddToListModal(true)}
              className="btn btn-sm"
              style={{
                backgroundColor: '#ffffff',
                color: 'var(--primary)',
                border: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FolderPlus size={14} />
              <span>Add to Existing List</span>
            </button>
          </div>
        </div>
      )}

      {/* Banner */}
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

      {/* Contacts Data Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <LoadingSpinner text="Loading verified contacts..." />
        ) : error ? (
          <div style={{ padding: '24px', borderLeft: '4px solid var(--border-focus)' }}>
            <p style={{ margin: 0, color: 'var(--text-primary)' }}>{error}</p>
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            title="No contacts found"
            message={
              hasActiveFilters
                ? 'No eligible contacts matched your active search and filter criteria.'
                : 'No qualified contacts currently found in your database.'
            }
            action={
              hasActiveFilters ? (
                <button onClick={handleResetFilters} className="btn btn-secondary btn-sm">
                  <RotateCcw size={13} /> Reset Filters
                </button>
              ) : null
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
                      onChange={handleSelectVisible}
                      style={{ accentColor: 'var(--text-primary)', cursor: 'pointer' }}
                      aria-label="Select visible contacts"
                    />
                  </th>
                  {visibleColumns.includes('name') && <th>Name</th>}
                  {visibleColumns.includes('email') && <th>Email</th>}
                  {visibleColumns.includes('university') && <th>University / Institution</th>}
                  {visibleColumns.includes('department') && <th>Department</th>}
                  {visibleColumns.includes('profession') && <th>Designation</th>}
                  {visibleColumns.includes('country') && <th>Country</th>}
                  {visibleColumns.includes('research_specialization') && <th>Specialization</th>}
                  {visibleColumns.includes('confidence_score') && <th>Confidence</th>}
                  {visibleColumns.includes('created_at') && <th>Discovered</th>}
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const isSelected = selectedLeadIds.includes(contact.id);
                  return (
                    <tr
                      key={contact.id}
                      onClick={() => handleToggleLead(contact.id)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--bg-subtle)' : undefined,
                      }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleLead(contact.id)}
                          style={{ accentColor: 'var(--text-primary)', cursor: 'pointer' }}
                        />
                      </td>

                      {visibleColumns.includes('name') && (
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {contact.name}
                        </td>
                      )}

                      {visibleColumns.includes('email') && (
                        <td>
                          <a
                            href={`mailto:${contact.email}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                          >
                            {contact.email}
                          </a>
                        </td>
                      )}

                      {visibleColumns.includes('university') && (
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {contact.university || '—'}
                        </td>
                      )}

                      {visibleColumns.includes('department') && (
                        <td style={{ color: 'var(--text-muted)' }}>
                          {contact.department || '—'}
                        </td>
                      )}

                      {visibleColumns.includes('profession') && (
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {contact.profession || '—'}
                        </td>
                      )}

                      {visibleColumns.includes('country') && (
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                            }}
                          >
                            {contact.country || '—'}
                          </span>
                        </td>
                      )}

                      {visibleColumns.includes('research_specialization') && (
                        <td style={{ maxWidth: '240px' }}>
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {contact.research_specialization || '—'}
                          </span>
                        </td>
                      )}

                      {visibleColumns.includes('confidence_score') && (
                        <td>
                          {contact.confidence_score !== null && contact.confidence_score !== undefined
                            ? `${Math.round(contact.confidence_score * 100)}%`
                            : '—'}
                        </td>
                      )}

                      {visibleColumns.includes('created_at') && (
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {new Date(contact.created_at).toLocaleDateString()}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {contacts.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={20}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Column Chooser Modal */}
      <ColumnSelectorModal
        isOpen={showColumnModal}
        onClose={() => setShowColumnModal(false)}
        visibleColumns={visibleColumns}
        onSaveColumns={handleSaveColumns}
      />

      {/* Add To List Modal */}
      <AddToListModal
        isOpen={showAddToListModal}
        onClose={() => setShowAddToListModal(false)}
        selectedLeadIds={selectedLeadIds}
        onSuccess={(summary) => {
          setBanner({
            type: 'success',
            text: `Enrolled ${summary.added} contact(s) into list (${summary.skipped_duplicates} duplicate(s) skipped).`,
          });
          setSelectedLeadIds([]);
        }}
      />
    </div>
  );
}
