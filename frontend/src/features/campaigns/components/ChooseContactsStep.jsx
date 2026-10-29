import React, { useState, useMemo } from 'react';
import {
  Search,
  Users,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
} from 'lucide-react';

export default function ChooseContactsStep({
  availableLists = [],
  selectedListIds = [],
  onToggleList,
  onSelectAll,
  onClearAll,
  audienceSummary,
  loadingLists = false,
  onRefreshSummary,
  fieldErrors = {},
  onNavigate,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter lists based on search
  const filteredLists = useMemo(() => {
    let result = availableLists;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.description && l.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [availableLists, searchQuery]);

  // Selected list ID set for fast, type-safe lookups
  const selectedSet = useMemo(() => {
    return new Set((selectedListIds || []).map(Number));
  }, [selectedListIds]);

  // Selected lists details
  const selectedLists = useMemo(() => {
    return availableLists.filter((l) => selectedSet.has(Number(l.id)));
  }, [availableLists, selectedSet]);

  // Gross contact count across selected lists
  const grossCount = useMemo(() => {
    return selectedLists.reduce((sum, l) => sum + (Number(l.contact_count) || 0), 0);
  }, [selectedLists]);

  return (
    <div className="campaign-step-container">
      {fieldErrors.audience && (
        <div className="campaign-inline-alert campaign-inline-alert-danger" role="alert">
          <AlertCircle size={16} />
          <span>{fieldErrors.audience}</span>
        </div>
      )}

      {/* 2-Column Responsive Contacts Grid */}
      <div className="campaign-contacts-grid">
        {/* Left Column: Audience Lists Picker Card */}
        <div className="campaign-card campaign-card-padded">
          <div className="campaign-section-header">
            <h2 className="campaign-section-title">Select Target Audience</h2>
            <p className="campaign-section-subtitle">
              Choose one or more verified contact lists to receive this email outreach campaign.
            </p>
          </div>

          {/* Search Bar */}
          <div className="campaign-search-wrapper">
            <Search size={16} className="campaign-search-icon" />
            <input
              type="text"
              className="campaign-input campaign-search-input"
              placeholder="Search contact lists by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="campaign-search-clear-btn"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Subheader Toolbar: Counts & Bulk Select */}
          <div className="campaign-contacts-toolbar">
            <span className="campaign-contacts-count-label">
              {filteredLists.length} lists available · {selectedLists.length} selected
            </span>
            <div className="campaign-contacts-toolbar-actions">
              <button
                type="button"
                onClick={() => onSelectAll && onSelectAll(filteredLists)}
                className="campaign-text-action-btn"
              >
                Select All
              </button>
              <span className="campaign-toolbar-divider">·</span>
              <button
                type="button"
                onClick={() => onClearAll && onClearAll()}
                className="campaign-text-action-btn campaign-text-action-muted"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Scrollable Selection Panel */}
          <div className="campaign-contacts-list-viewport">
            {loadingLists ? (
              <div className="campaign-empty-viewport">
                <div className="campaign-loading-spinner" />
                <span>Loading verified contact lists from database...</span>
              </div>
            ) : filteredLists.length === 0 ? (
              <div className="campaign-empty-viewport">
                <Users size={32} className="campaign-empty-icon" />
                <h4 className="campaign-empty-title">No contact lists found</h4>
                <p className="campaign-empty-desc">
                  {searchQuery
                    ? `No lists matched "${searchQuery}". Try modifying your search query.`
                    : 'No audience contact lists are available yet.'}
                </p>
                {onNavigate && !searchQuery && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => onNavigate('create-contact-list', { mode: 'existing' })}
                      className="campaign-micro-btn campaign-micro-btn-blue"
                    >
                      + Create List
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('create-contact-list', { mode: 'custom' })}
                      className="campaign-micro-btn campaign-micro-btn-slate"
                    >
                      + Custom List (CSV)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredLists.map((list) => {
                const listId = Number(list.id);
                const isSelected = selectedSet.has(listId);
                const contactCount = Number(list.contact_count) || 0;
                const isZeroCount = contactCount === 0;

                return (
                  <div
                    key={listId}
                    role="button"
                    tabIndex={0}
                    className={`campaign-audience-row ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'input') {
                        return;
                      }
                      onToggleList(listId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'input') {
                          return;
                        }
                        e.preventDefault();
                        onToggleList(listId);
                      }
                    }}
                  >
                    {/* Checkbox with isolated event propagation */}
                    <input
                      id={`audience-list-checkbox-${listId}`}
                      type="checkbox"
                      className="campaign-checkbox"
                      checked={isSelected}
                      aria-label={`Select ${list.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleList(listId);
                      }}
                    />

                    {/* Content details */}
                    <div className="campaign-audience-info">
                      <div className="campaign-audience-name-row">
                        <span className="campaign-audience-title" title={list.name}>
                          {list.name}
                        </span>
                        <span
                          className={`campaign-audience-count-pill ${
                            isZeroCount ? 'count-pill-zero' : 'count-pill-active'
                          }`}
                        >
                          {contactCount.toLocaleString()} contact{contactCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      {list.description && (
                        <p className="campaign-audience-description">
                          {list.description}
                        </p>
                      )}

                      <div className="campaign-audience-meta-row">
                        <span className="campaign-audience-date">
                          <Clock size={11} />
                          Updated {list.updated_at ? new Date(list.updated_at).toLocaleDateString() : 'recently'}
                        </span>
                        <span
                          className={`campaign-audience-status ${
                            isZeroCount ? 'status-empty' : 'status-verified'
                          }`}
                        >
                          {isZeroCount ? 'Empty list' : 'Verified Contacts'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Authoritative Audience Summary Panel */}
        <div className="campaign-card campaign-card-padded campaign-audience-summary-card">
          <div className="campaign-summary-header">
            <div>
              <h3 className="campaign-summary-title">Audience Summary</h3>
              <p className="campaign-summary-subtitle">
                Authoritative recipient counts and deduplication metrics.
              </p>
            </div>

            {onRefreshSummary && selectedListIds.length > 0 && (
              <button
                type="button"
                onClick={onRefreshSummary}
                className="campaign-micro-btn campaign-micro-btn-slate"
                title="Refresh deduplication metrics"
              >
                <RefreshCw size={12} />
                <span>Refresh</span>
              </button>
            )}
          </div>

          {selectedListIds.length === 0 ? (
            /* Empty Selection State */
            <div className="campaign-summary-empty-state">
              <div className="campaign-summary-empty-icon-circle">
                <Users size={26} />
              </div>
              <h4 className="campaign-summary-empty-heading">No audience selected</h4>
              <p className="campaign-summary-empty-desc">
                Select one or more contact lists on the left to calculate real-time recipient counts, deduplication, and deliverability eligibility.
              </p>
            </div>
          ) : (
            /* Authoritative Live Audience Metrics */
            <div className="campaign-summary-content-stack">
              {/* Primary KPI Card */}
              <div className="campaign-kpi-banner">
                <span className="campaign-kpi-tag">Estimated Eligible Contacts</span>
                <div className="campaign-kpi-value">
                  {(audienceSummary
                    ? audienceSummary.eligible_contacts
                    : grossCount
                  ).toLocaleString()}
                </div>
                <p className="campaign-kpi-subtext">
                  Filtered through Sitech verified eligibility standards (qualified role, personal name, valid domain).
                </p>
              </div>

              {/* Deduplication Breakdown Grid */}
              <div className="campaign-breakdown-grid">
                <div className="campaign-breakdown-item">
                  <span className="campaign-breakdown-label">Total Gross</span>
                  <span className="campaign-breakdown-value">{grossCount.toLocaleString()}</span>
                </div>
                <div className="campaign-breakdown-item">
                  <span className="campaign-breakdown-label">Unique Deduplicated</span>
                  <span className="campaign-breakdown-value">
                    {(audienceSummary
                      ? audienceSummary.unique_contacts
                      : grossCount
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="campaign-breakdown-item">
                  <span className="campaign-breakdown-label">Lists Selected</span>
                  <span className="campaign-breakdown-value">{selectedLists.length}</span>
                </div>
                <div className="campaign-breakdown-item">
                  <span className="campaign-breakdown-label">Suppressed / Excluded</span>
                  <span className="campaign-breakdown-value">
                    {audienceSummary
                      ? (audienceSummary.suppressed_or_invalid_contacts || 0).toLocaleString()
                      : '0'}
                  </span>
                </div>
              </div>

              {/* Targeted List Chips */}
              <div className="campaign-targeted-lists-section">
                <span className="campaign-targeted-lists-header">Targeted Lists:</span>
                <div className="campaign-targeted-chips-row">
                  {selectedLists.map((l) => (
                    <span key={l.id} className="campaign-targeted-chip">
                      <span>{l.name}</span>
                      <span className="campaign-targeted-chip-count">
                        ({(Number(l.contact_count) || 0).toLocaleString()})
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove list ${l.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleList(Number(l.id));
                        }}
                        className="campaign-targeted-remove-btn"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Compliance & Safety Guarantee */}
              <div className="campaign-compliance-guarantee">
                <CheckCircle2 size={16} className="campaign-compliance-icon" />
                <p className="campaign-compliance-text">
                  Audiences are automatically deduplicated by normalized email. Recipients are re-verified against unsubscribes and suppressions at dispatch time.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
