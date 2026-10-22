import React, { useState, useMemo } from 'react';
import {
  Search,
  Users,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Clock,
  Filter,
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
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'list' | 'segment' | 'tag' | 'custom'
  const [searchQuery, setSearchQuery] = useState('');

  // Filter lists based on tab and search
  const filteredLists = useMemo(() => {
    let result = availableLists;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (l) => (l.name && l.name.toLowerCase().includes(q)) || 
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

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'list', label: 'List' },
  ];

  return (
    <div className="campaign-contacts-grid">
      {/* Left Column: Send To & List Selection Card */}
      <div
        className="campaign-card campaign-card-padded"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
            Send to
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Select the audience contact lists that will receive this outreach campaign.
          </p>
        </div>

        {/* Search Field */}
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
          <input
            type="text"
            className="campaign-input"
            placeholder="Search audience lists by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '38px',
            }}
          />
        </div>

        {/* Audience Type Tabs */}
        <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: isActive ? '#2563eb' : '#e2e8f0',
                  backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                  color: isActive ? '#2563eb' : '#64748b',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 1px 2px rgba(37, 99, 235, 0.12)' : 'none',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Bulk Actions Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>
            {filteredLists.length} lists available · {selectedLists.length} selected
          </span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => onSelectAll && onSelectAll(filteredLists)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#2563eb',
                fontSize: '12.5px',
                fontWeight: 600,
                padding: 0,
              }}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => onClearAll && onClearAll()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                fontSize: '12.5px',
                fontWeight: 600,
                padding: 0,
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Scrollable Selection Panel */}
        <div
          style={{
            maxHeight: '460px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            paddingRight: '4px',
          }}
        >
          {loadingLists ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Loading audience lists from database...
            </div>
          ) : filteredLists.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              No contact lists matched your query.
            </div>
          ) : (
            filteredLists.map((list) => {
              const listId = Number(list.id);
              const isSelected = selectedSet.has(listId);
              const isZeroCount = (Number(list.contact_count) || 0) === 0;

              return (
                <div
                  key={listId}
                  role="button"
                  tabIndex={0}
                  className={`campaign-audience-row ${isSelected ? 'selected' : ''}`}
                  onClick={(e) => {
                    // Prevent double-toggle if click originated directly from the checkbox input
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
                  <input
                    id={`audience-list-checkbox-${listId}`}
                    type="checkbox"
                    className="campaign-checkbox"
                    checked={isSelected}
                    aria-label={`Select ${list.name}`}
                    onClick={(e) => {
                      // Stop native click event from bubbling to outer div
                      e.stopPropagation();
                    }}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleList(listId);
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {list.name}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: isZeroCount ? '#fef2f2' : '#f1f5f9',
                          color: isZeroCount ? '#991b1b' : '#334155',
                          flexShrink: 0,
                        }}
                      >
                        {list.contact_count || 0} contacts
                      </span>
                    </div>

                    {list.description && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                        {list.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} />
                        Updated {list.updated_at ? new Date(list.updated_at).toLocaleDateString() : 'recently'}
                      </span>
                      <span style={{ fontSize: '11px', color: isZeroCount ? '#94a3b8' : '#16a34a', fontWeight: 600 }}>
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

      {/* Right Column: Audience Summary Card */}
      <div
        className="campaign-card campaign-card-padded"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
              Target Audience Summary
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Real-time deduplication and eligibility estimate.
            </p>
          </div>

          {onRefreshSummary && selectedListIds.length > 0 && (
            <button
              type="button"
              onClick={onRefreshSummary}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#475569',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Refresh deduplication metrics"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          )}
        </div>

        {selectedListIds.length === 0 ? (
          /* Empty State */
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Users size={28} />
            </div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: '#334155' }}>
              No audience selected
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', maxWidth: '280px', lineHeight: 1.4 }}>
              Select one or more contact lists on the left to calculate recipient counts and deduplication.
            </p>
          </div>
        ) : (
          /* Populated Audience Summary */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Primary Eligible Metric Banner */}
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: '#eff6ff',
                borderRadius: '12px',
                border: '1px solid #bfdbfe',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Estimated Eligible Contacts
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#1e3a8a', margin: '4px 0' }}>
                {audienceSummary ? audienceSummary.eligible_contacts : grossCount}
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#3b82f6', lineHeight: 1.4 }}>
                Filtered through Sitech verified eligibility standards (qualified role, personal name, valid domain).
              </p>
            </div>

            {/* Deduplication Breakdown Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}
            >
              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Total Gross Contacts</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                  {grossCount}
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Unique Deduplicated</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                  {audienceSummary ? audienceSummary.unique_contacts : grossCount}
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Selected Lists</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                  {selectedLists.length}
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Suppressed / Excluded</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                  {audienceSummary ? audienceSummary.suppressed_or_invalid_contacts : 0}
                </div>
              </div>
            </div>

            {/* Selected List Chips */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>
                Targeted Lists:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedLists.map((l) => (
                  <span
                    key={l.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      color: '#1e293b',
                      fontWeight: 600,
                    }}
                  >
                    {l.name} ({l.contact_count || 0})
                    <button
                      type="button"
                      aria-label={`Remove list ${l.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleList(Number(l.id));
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Compliance Guarantee Note */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                fontSize: '12px',
                color: '#64748b',
                lineHeight: 1.4,
                borderTop: '1px solid #e2e8f0',
                paddingTop: '12px',
              }}
            >
              <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
              <span>
                Audiences are automatically deduplicated by normalized email. Recipients are re-verified against unsubscribes and suppressions at dispatch time.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
