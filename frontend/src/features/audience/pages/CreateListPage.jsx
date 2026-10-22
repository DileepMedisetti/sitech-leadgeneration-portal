import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  FolderPlus,
  Search,
  Users,
  AlertCircle,
  RotateCcw,
  Loader2,
  X,
  Mail,
  Building,
} from 'lucide-react';
import { audienceApi } from '../../../services/api-client';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Pagination from '../../../components/ui/Pagination';
import EmptyState from '../../../components/ui/EmptyState';
import { COUNTRIES } from '../../../data/countries';

export default function CreateListPage({ onNavigate, onSuccess }) {
  // Form details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState({});
  const [nameError, setNameError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Selected lead IDs (persisted across pagination, search, and filtering)
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  // Contacts dataset state
  const [contacts, setContacts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter & Sort state
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Checkbox indeterminate ref
  const selectAllCheckboxRef = useRef(null);

  const fetchEligibleContacts = useCallback(async () => {
    try {
      setLoadingContacts(true);
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
      console.error('Failed to load eligible contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  }, [page, search, countryFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchEligibleContacts();
  }, [fetchEligibleContacts]);

  // Handle header checkbox indeterminate state
  const visibleIds = contacts.map((c) => c.id);
  const isAllVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedLeadIds.includes(id));
  const isSomeVisibleSelected =
    visibleIds.some((id) => selectedLeadIds.includes(id)) && !isAllVisibleSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isSomeVisibleSelected;
    }
  }, [isSomeVisibleSelected]);

  // Validation
  const validateForm = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('List name is required.');
      return false;
    }
    if (trimmed.length > 255) {
      setNameError('List name cannot exceed 255 characters.');
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleNameBlur = () => {
    setTouched((prev) => ({ ...prev, name: true }));
    validateForm();
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
    if (nameError) {
      setNameError(null);
    }
  };

  // Selection handlers
  const handleToggleLead = (id) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleDeselectAll = () => {
    setSelectedLeadIds([]);
  };

  // Filter resets
  const hasActiveFilters = Boolean(
    search || countryFilter || sortBy !== 'created_at' || sortOrder !== 'desc'
  );

  const handleResetFilters = () => {
    setSearch('');
    setCountryFilter('');
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
  };

  // Back / Cancel navigation
  const handleBack = () => {
    if (onNavigate) {
      onNavigate('audience', { tab: 'lists' });
    } else {
      window.history.back();
    }
  };

  // Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true });

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        lead_ids: selectedLeadIds,
      };

      const res = await audienceApi.createList(payload);

      if (onSuccess) {
        onSuccess(res);
      } else if (onNavigate) {
        if (res && res.id) {
          onNavigate('audience', {
            listId: res.id,
            tab: 'lists',
            notification: `Contact list "${res.name}" created successfully with ${
              res.contact_count ?? (res.membership_summary?.added || 0)
            } contact(s).`,
          });
        } else {
          onNavigate('audience', {
            tab: 'lists',
            notification: `Contact list "${res.name}" created successfully.`,
          });
        }
      }
    } catch (err) {
      // Meaningful error message; user entered details & selections remain fully preserved
      setSubmitError(err.message || 'Failed to create contact list. Please check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* Top Back Navigation & Page Title */}
      <div style={{ marginBottom: '22px' }}>
        <button
          type="button"
          onClick={handleBack}
          className="btn btn-secondary btn-sm"
          style={{
            marginBottom: '14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-secondary)',
          }}
        >
          <ArrowLeft size={14} /> Back to Lists
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                margin: '0 0 6px 0',
              }}
            >
              Create Contact List
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
              Curate and segment verified eligible contacts into a dedicated outreach list.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            <Users size={14} />
            <span>
              {selectedLeadIds.length} contact{selectedLeadIds.length === 1 ? '' : 's'} selected
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {submitError && (
        <div
          className="alert-banner alert-danger"
          style={{
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{submitError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit}>
        {/* Card 1: List Details */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                1. List Details
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Define the identification metadata for your new saved list.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* List Name */}
            <div>
              <label
                htmlFor="list-name"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: 'var(--text-primary)',
                }}
              >
                List Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="list-name"
                type="text"
                required
                maxLength={255}
                disabled={submitting}
                placeholder="e.g., Computer Science Chairs & AI Faculty 2026"
                value={name}
                onChange={handleNameChange}
                onBlur={handleNameBlur}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '13.5px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${touched.name && nameError ? '#dc2626' : 'var(--border-color)'}`,
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxShadow: touched.name && nameError ? '0 0 0 2px rgba(220, 38, 38, 0.15)' : 'none',
                  boxSizing: 'border-box',
                }}
              />
              {touched.name && nameError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    color: '#dc2626',
                    marginTop: '5px',
                  }}
                >
                  <AlertCircle size={12} />
                  <span>{nameError}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="list-description"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: 'var(--text-primary)',
                }}
              >
                Description <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <textarea
                id="list-description"
                rows={3}
                disabled={submitting}
                placeholder="e.g., Primary outreach cohort for Sitech Series Robotics & AI Conference invited keynote speakers."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Select Contacts */}
        <div className="card" style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                2. Select Contacts <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Select verified eligible contacts to enroll immediately. You can also add more contacts later.
              </p>
            </div>

            {/* Selection Status & Deselect */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: selectedLeadIds.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {selectedLeadIds.length} contact{selectedLeadIds.length === 1 ? '' : 's'} selected
              </span>
              {selectedLeadIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '11.5px', padding: '3px 8px' }}
                >
                  Deselect All
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              padding: '14px 20px',
              backgroundColor: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: '1 1 auto' }}>
              {/* Search */}
              <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px', maxWidth: '340px' }}>
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
                    boxSizing: 'border-box',
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
                  type="button"
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
          </div>

          {/* Table Area */}
          {loadingContacts ? (
            <div style={{ padding: '40px 20px' }}>
              <LoadingSpinner text="Loading eligible contacts..." />
            </div>
          ) : contacts.length === 0 ? (
            <div style={{ padding: '30px 20px' }}>
              <EmptyState
                title="No eligible contacts found"
                message={
                  hasActiveFilters
                    ? 'No contacts match your current search and filter criteria.'
                    : 'No eligible leads are currently available in the database.'
                }
                action={
                  hasActiveFilters ? (
                    <button type="button" onClick={handleResetFilters} className="btn btn-sm btn-outline">
                      Clear Filters
                    </button>
                  ) : null
                }
              />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ width: '44px', textAlign: 'center', padding: '10px 14px' }}>
                      <input
                        type="checkbox"
                        ref={selectAllCheckboxRef}
                        checked={isAllVisibleSelected}
                        onChange={handleSelectVisible}
                        aria-label="Select all visible contacts"
                        style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                      />
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Contact Name</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Email Address</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Institution & Country</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Specialization</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Confidence</th>
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
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: isSelected ? 'rgba(24, 24, 27, 0.03)' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td
                          style={{ width: '44px', textAlign: 'center', padding: '11px 14px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleLead(contact.id)}
                            aria-label={`Select ${contact.name}`}
                            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                          />
                        </td>

                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{contact.name}</div>
                          {(contact.profession || contact.department) && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {[contact.profession, contact.department].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '11px 14px' }}>
                          {contact.email ? (
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              <Mail size={12} color="var(--text-muted)" />
                              {contact.email}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                            <Building size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                            <span>{contact.university || '—'}</span>
                          </div>
                          {contact.country && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', paddingLeft: '17px' }}>
                              {contact.country}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '11px 14px', maxWidth: '240px' }}>
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-secondary)',
                            }}
                            title={contact.research_specialization || ''}
                          >
                            {contact.research_specialization || '—'}
                          </span>
                        </td>

                        <td style={{ padding: '11px 14px' }}>
                          {contact.confidence_score !== null && contact.confidence_score !== undefined ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 7px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-subtle)',
                                border: '1px solid var(--border-color)',
                                fontSize: '11.5px',
                                fontWeight: 600,
                              }}
                            >
                              {Math.round(contact.confidence_score * 100)}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {contacts.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={20}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>

        {/* Card 3: Action Footer */}
        <div
          className="card"
          style={{
            position: 'sticky',
            bottom: '16px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            zIndex: 30,
            padding: '16px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              Ready to create list:
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {name.trim() ? `"${name.trim()}"` : '(Untitled)'} with {selectedLeadIds.length} contact{selectedLeadIds.length === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={handleBack}
              className="btn btn-secondary"
              style={{ minWidth: '90px' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '150px',
                justifyContent: 'center',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="spinner" />
                  <span>Creating List...</span>
                </>
              ) : (
                <>
                  <FolderPlus size={15} />
                  <span>
                    Create List {selectedLeadIds.length > 0 ? `(${selectedLeadIds.length})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
