import React, { useEffect, useState, useRef } from 'react';
import {
  Plus,
  Search,
  Filter,
  Columns,
  ChevronDown,
  MoreVertical,
  Edit2,
  BarChart2,
  Trash2,
  Pause,
  Play,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Archive,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { campaignsApi } from '../../services/api-client';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import CustomizeColumnsDrawer from './components/CustomizeColumnsDrawer';
import { getSavedColumns, ALL_COLUMNS } from './campaignColumnConstants';
import './campaigns.css';

export default function CampaignsPage({ onNavigate }) {
  const [campaigns, setCampaigns] = useState([]);
  const [counts, setCounts] = useState({ all: 0, completed: 0, scheduled: 0, inactive: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState('all'); // all | completed | scheduled | inactive
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Column Customization Drawer
  const [isColumnsDrawerOpen, setIsColumnsDrawerOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(getSavedColumns);

  // Filter Dropdown
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  // Create Campaign Split Dropdown
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Table Row Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Active Row Action Dropdown
  const [activeRowMenu, setActiveRowMenu] = useState(null);

  const fetchCampaigns = () => {
    setLoading(true);
    const resolvedStatus = filterStatus || (activeTab === 'all' ? undefined : activeTab);
    campaignsApi
      .list({
        page,
        page_size: pageSize,
        status: resolvedStatus,
        search: searchQuery.trim() || undefined,
        sort_by: 'created_at',
        sort_order: 'desc',
      })
      .then((res) => {
        setCampaigns(res.items || []);
        setTotal(res.total || 0);
        setTotalPages(res.total_pages || 1);
        if (res.counts) {
          setCounts(res.counts);
        }
      })
      .catch((err) => {
        console.error('Failed to load campaigns:', err);
      })
      .finally(() => setLoading(false));
  };

  // Modal states for delete confirmation and error popups
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
  });

  useEffect(() => {
    fetchCampaigns();
  }, [page, pageSize, activeTab, filterStatus, searchQuery]);

  const handleRequestDelete = (campaign) => {
    setActiveRowMenu(null);
    setDeleteTarget({ id: campaign.id, name: campaign.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await campaignsApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      await fetchCampaigns();
    } catch (err) {
      setDeleteTarget(null);
      setFeedbackModal({
        isOpen: true,
        type: 'danger',
        title: 'Failed to delete campaign',
        message: err.message || 'An error occurred while deleting the campaign. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePause = async (cid) => {
    setActionLoading(cid);
    setActiveRowMenu(null);
    try {
      await campaignsApi.pause(cid);
      fetchCampaigns();
    } catch (err) {
      setFeedbackModal({
        isOpen: true,
        type: 'danger',
        title: 'Failed to pause campaign',
        message: err.message || 'An error occurred while attempting to pause the campaign.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (cid) => {
    setActionLoading(cid);
    setActiveRowMenu(null);
    try {
      await campaignsApi.resume(cid);
      fetchCampaigns();
    } catch (err) {
      setFeedbackModal({
        isOpen: true,
        type: 'danger',
        title: 'Failed to resume campaign',
        message: err.message || 'An error occurred while attempting to resume the campaign.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(campaigns.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const statusTabs = [
    { id: 'all', label: 'All', count: counts.all, icon: Mail },
    { id: 'completed', label: 'Completed', count: counts.completed, icon: CheckCircle2 },
    { id: 'scheduled', label: 'Scheduled', count: counts.scheduled, icon: Clock },
    { id: 'inactive', label: 'Inactive', count: counts.inactive, icon: Archive },
  ];

  return (
    <div className="campaigns-page-responsive" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .campaigns-page-responsive { width: 100%; min-width: 0; box-sizing: border-box; }
        .campaigns-page-responsive *, .campaigns-page-responsive *::before, .campaigns-page-responsive *::after { box-sizing: border-box; }
        .campaigns-page-header { min-width: 0; }
        .campaigns-header-actions { min-width: 0; }
        .campaigns-search-wrapper { flex: 1 1 220px; min-width: 0; }
        .campaigns-status-header { min-width: 0; }
        .campaigns-status-tabs { min-width: 0; flex: 1 1 auto; }
        .campaigns-table-scroll { width: 100%; max-width: 100%; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
        .campaigns-responsive-table { width: 100%; min-width: 760px; }
        .campaigns-pagination { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
        @media (max-width: 1024px) {
          .campaigns-page-responsive { gap: 18px !important; }
          .campaigns-page-header { align-items: flex-start !important; }
          .campaigns-header-actions { width: 100%; display: flex !important; flex-wrap: wrap !important; }
          .campaigns-search-wrapper { flex: 1 1 240px; width: auto !important; }
          .campaigns-status-header { padding: 0 10px !important; }
          .campaigns-status-tabs { overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
          .campaigns-status-tabs::-webkit-scrollbar { display: none; }
          .campaigns-status-tabs > button { flex: 0 0 auto; padding: 12px 14px !important; }
        }
        @media (max-width: 768px) {
          .campaigns-page-responsive { gap: 16px !important; }
          .campaigns-page-header { flex-direction: column !important; align-items: stretch !important; gap: 14px !important; }
          .campaigns-page-header > div:first-child { width: 100%; }
          .campaigns-page-header h2 { font-size: 22px !important; }
          .campaigns-header-actions { display: grid !important; grid-template-columns: minmax(0, 1fr) auto; gap: 10px !important; width: 100%; }
          .campaigns-search-wrapper { grid-column: 1 / -1; width: 100% !important; }
          .campaigns-header-actions > div:nth-child(2) { justify-self: start; }
          .campaigns-header-actions > div:nth-child(3) { justify-self: end; }
          .campaigns-status-header { align-items: stretch !important; padding: 0 8px !important; }
          .campaigns-status-tabs { width: 100%; }
          .campaigns-status-tabs > button { padding: 12px 10px !important; gap: 6px !important; font-size: 12px !important; }
          .campaigns-status-header > div:last-child { width: 100%; padding: 0 0 10px; }
          .campaigns-status-header > div:last-child > button { width: 100%; justify-content: center; }
          .campaigns-responsive-table { min-width: 760px; }
          .campaigns-pagination { padding: 12px !important; }
        }
        @media (max-width: 480px) {
          .campaigns-page-header h2 { font-size: 20px !important; }
          .campaigns-header-actions { grid-template-columns: minmax(0, 1fr); }
          .campaigns-header-actions > div:nth-child(2), .campaigns-header-actions > div:nth-child(3) { justify-self: stretch; }
          .campaigns-header-actions > div:nth-child(2) > button { width: 100%; justify-content: center; }
          .campaigns-header-actions > div:nth-child(3) { width: 100%; }
          .campaigns-header-actions > div:nth-child(3) > button:first-child { flex: 1; justify-content: center; }
          .campaigns-status-header { padding: 0 4px !important; }
          .campaigns-status-tabs > button { padding: 10px 8px !important; gap: 5px !important; }
          .campaigns-status-tabs > button svg { width: 14px; height: 14px; }
          .campaigns-status-tabs > button span { font-size: 10px !important; padding: 2px 6px !important; }
        }
      `}</style>
      {/* 1. Header with Title on Left, Search + Filter + Create Split Button on Right */}
      <div
        className="campaigns-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.3px',
            }}
          >
            Campaigns
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Design, verify spam deliverability risk, test seedbox placement, and schedule outreach.
          </p>
        </div>

        {/* Right Header Actions */}
        <div className="campaigns-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Search campaigns field */}
          <div className="campaigns-search-wrapper" style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                fontSize: '13px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filter button beside search */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: filterStatus ? '#2563eb' : '#475569',
                backgroundColor: filterStatus ? '#eff6ff' : '#ffffff',
                border: '1px solid',
                borderColor: filterStatus ? '#bfdbfe' : '#cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <Filter size={15} />
              <span>Filter</span>
              {filterStatus && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#2563eb',
                  }}
                />
              )}
            </button>

            {/* Filter Dropdown */}
            {showFilterDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                  padding: '12px',
                  zIndex: 40,
                  width: '200px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
                  FILTER BY STATUS
                </div>
                {['', 'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'].map((st) => (
                  <div
                    key={st}
                    onClick={() => {
                      setFilterStatus(st);
                      setShowFilterDropdown(false);
                      setPage(1);
                    }}
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: filterStatus === st ? 700 : 500,
                      color: filterStatus === st ? '#2563eb' : '#334155',
                      backgroundColor: filterStatus === st ? '#eff6ff' : 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{st ? st.toUpperCase() : 'All Statuses'}</span>
                    {filterStatus === st && <CheckCircle2 size={12} color="#2563eb" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Primary Create Campaign Button with Dropdown Trigger */}
          <div style={{ position: 'relative', display: 'flex' }}>
            <button
              type="button"
              onClick={() => onNavigate('create-campaign')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: '#2563eb',
                border: 'none',
                borderTopLeftRadius: '8px',
                borderBottomLeftRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
              }}
            >
              <Plus size={16} /> Create Campaign
            </button>
            <button
              type="button"
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '9px 10px',
                backgroundColor: '#1d4ed8',
                color: '#ffffff',
                border: 'none',
                borderLeft: '1px solid rgba(255,255,255,0.2)',
                borderTopRightRadius: '8px',
                borderBottomRightRadius: '8px',
                cursor: 'pointer',
              }}
              title="More campaign options"
            >
              <ChevronDown size={14} />
            </button>

            {/* Split Dropdown Menu */}
            {showCreateMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 50,
                  width: '210px',
                  padding: '6px',
                }}
              >
                <div
                  onClick={() => {
                    setShowCreateMenu(false);
                    onNavigate('create-campaign');
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0f172a',
                    cursor: 'pointer',
                    borderRadius: '6px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Standard Campaign
                </div>
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: '#94a3b8',
                    cursor: 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Automated Drip</span>
                  <span style={{ fontSize: '10px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    Roadmap
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Status Tabs with Blue Underline and Counts */}
      <div
        className="campaigns-status-header"
        style={{
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '12px 12px 0 0',
          padding: '0 16px',
          // Prevent the status-tab header from creating a vertical scrollbar.
          overflow: 'hidden',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div
          className="campaigns-status-tabs"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            overflowY: 'hidden',
            maxWidth: '100%',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {statusTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 18px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
                  color: isActive ? '#2563eb' : '#475569',
                  fontSize: '14px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  marginBottom: '-1px',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: isActive ? '#eff6ff' : '#f1f5f9',
                    color: isActive ? '#2563eb' : '#64748b',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {tab.count ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Column Configuration Button */}
        <div>
          <button
            type="button"
            onClick={() => setIsColumnsDrawerOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#475569',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            title="Customize Table Columns"
          >
            <Columns size={14} /> Customize Columns
          </button>
        </div>
      </div>

      {/* 3. Main Campaign Table Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div
            style={{
              padding: '70px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Mail size={28} />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
              No campaigns found
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b', maxWidth: '380px' }}>
              Create your first email campaign with built-in spam-risk analysis and controlled placement testing.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('create-campaign')}
              style={{
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="campaigns-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="campaigns-responsive-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {/* Checkbox Header */}
                  <th style={{ padding: '12px 16px', width: '32px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length === campaigns.length && campaigns.length > 0}
                      onChange={handleSelectAll}
                      style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                  </th>

                  {visibleColumns.includes('name') && (
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>
                      Campaign Name & Subject
                    </th>
                  )}
                  {visibleColumns.includes('status') && (
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>
                      Status
                    </th>
                  )}
                  {visibleColumns.includes('open_rate') && (
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
                      Open Rate
                    </th>
                  )}
                  {visibleColumns.includes('total_recipients') && (
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
                      Recipients
                    </th>
                  )}
                  {visibleColumns.includes('delivered_count') && (
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
                      Delivered
                    </th>
                  )}
                  {visibleColumns.includes('sent_count') && (
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
                      Sent Count
                    </th>
                  )}
                  {visibleColumns.includes('scheduled_at') && (
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>
                      Schedule / Sent
                    </th>
                  )}
                  {visibleColumns.includes('created_at') && (
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>
                      Created Date
                    </th>
                  )}
                  {visibleColumns.includes('updated_at') && (
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>
                      Last Updated
                    </th>
                  )}
                  {visibleColumns.includes('actions') && (
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const isSelected = selectedIds.includes(c.id);
                  const isDraft = c.status === 'draft';
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isSelected ? '#f8faff' : '#ffffff',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#fafafa';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '14px 16px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(c.id)}
                          style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                        />
                      </td>

                      {/* Name & Subject/Description */}
                      {visibleColumns.includes('name') && (
                        <td style={{ padding: '14px 16px' }}>
                          <div
                            onClick={() => onNavigate('campaign-detail', c.id)}
                            style={{
                              fontWeight: 700,
                              color: '#0f172a',
                              fontSize: '14px',
                              cursor: 'pointer',
                            }}
                          >
                            {c.name}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#64748b',
                              marginTop: '2px',
                              maxWidth: '340px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.subject || c.description || 'No subject line specified'}
                          </div>
                        </td>
                      )}

                      {/* Status */}
                      {visibleColumns.includes('status') && (
                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge status={c.status} />
                        </td>
                      )}

                      {/* Open Rate (Distinguishing unavailable from 0%) */}
                      {visibleColumns.includes('open_rate') && (
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600 }}>
                          {c.status === 'sent' && c.delivered_count > 0 ? (
                            <span style={{ color: '#0f172a' }}>
                              {c.open_rate !== null && c.open_rate !== undefined ? `${c.open_rate}%` : '—'}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      )}

                      {/* Recipients */}
                      {visibleColumns.includes('total_recipients') && (
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                          {c.total_recipients > 0 ? c.total_recipients : '—'}
                        </td>
                      )}

                      {/* Delivered Count */}
                      {visibleColumns.includes('delivered_count') && (
                        <td style={{ padding: '14px 16px', textAlign: 'right', color: '#475569' }}>
                          {c.status === 'sent' ? c.delivered_count : '—'}
                        </td>
                      )}

                      {/* Sent Count */}
                      {visibleColumns.includes('sent_count') && (
                        <td style={{ padding: '14px 16px', textAlign: 'right', color: '#475569' }}>
                          {c.status === 'sent' ? c.sent_count : '—'}
                        </td>
                      )}

                      {/* Scheduled / Sent Date */}
                      {visibleColumns.includes('scheduled_at') && (
                        <td style={{ padding: '14px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {c.sent_at
                            ? new Date(c.sent_at).toLocaleDateString()
                            : c.scheduled_at
                            ? `${new Date(c.scheduled_at).toLocaleDateString()} (${c.timezone_name})`
                            : '—'}
                        </td>
                      )}

                      {/* Created Date */}
                      {visibleColumns.includes('created_at') && (
                        <td style={{ padding: '14px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                      )}

                      {/* Updated Date */}
                      {visibleColumns.includes('updated_at') && (
                        <td style={{ padding: '14px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(c.updated_at).toLocaleDateString()}
                        </td>
                      )}

                      {/* Actions */}
                      {visibleColumns.includes('actions') && (
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                            {/* Contextual primary action: Edit for draft, Report/Workspace for finished */}
                            {isDraft ? (
                              <button
                                type="button"
                                onClick={() => onNavigate('create-campaign', c.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#2563eb',
                                  backgroundColor: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                }}
                              >
                                <Edit2 size={13} /> Edit
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onNavigate('campaign-detail', c.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#334155',
                                  backgroundColor: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                }}
                              >
                                <BarChart2 size={13} /> Report
                              </button>
                            )}

                            {/* Additional Actions Dropdown Trigger */}
                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={() => setActiveRowMenu(activeRowMenu === c.id ? null : c.id)}
                                style={{
                                  padding: '6px',
                                  background: 'none',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  color: '#64748b',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <MoreVertical size={14} />
                              </button>

                              {activeRowMenu === c.id && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                                    zIndex: 50,
                                    width: '160px',
                                    padding: '4px',
                                  }}
                                >
                                  <div
                                    onClick={() => {
                                      setActiveRowMenu(null);
                                      onNavigate('campaign-detail', c.id);
                                    }}
                                    style={{
                                      padding: '8px 10px',
                                      fontSize: '12px',
                                      color: '#1e293b',
                                      cursor: 'pointer',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <BarChart2 size={13} /> Workspace
                                  </div>

                                  {c.status === 'scheduled' && (
                                    <div
                                      onClick={() => handlePause(c.id)}
                                      style={{
                                        padding: '8px 10px',
                                        fontSize: '12px',
                                        color: '#d97706',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fffbeb')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <Pause size={13} /> Pause
                                    </div>
                                  )}

                                  {c.status === 'paused' && (
                                    <div
                                      onClick={() => handleResume(c.id)}
                                      style={{
                                        padding: '8px 10px',
                                        fontSize: '12px',
                                        color: '#16a34a',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <Play size={13} /> Resume
                                    </div>
                                  )}

                                  <div
                                    onClick={() => handleRequestDelete(c)}
                                    style={{
                                      padding: '8px 10px',
                                      fontSize: '12px',
                                      color: '#dc2626',
                                      cursor: 'pointer',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      borderTop: '1px solid #f1f5f9',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <Trash2 size={13} /> Delete
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="campaigns-pagination" style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalRecords={total}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* Customizable Columns Right-Side Drawer */}
      <CustomizeColumnsDrawer
        isOpen={isColumnsDrawerOpen}
        onClose={() => setIsColumnsDrawerOpen(false)}
        visibleColumns={visibleColumns}
        onApply={(cols) => setVisibleColumns(cols)}
      />

      {/* Centered Campaign Deletion Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        type="danger"
        title="Delete this campaign?"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone and will permanently remove this campaign.`
            : ''
        }
        cancelLabel="Cancel"
        confirmLabel="Delete Campaign"
        confirmVariant="danger"
        isLoading={isDeleting}
        onCancel={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        onClose={() => !isDeleting && setDeleteTarget(null)}
      />

      {/* Centered Action Failure / Feedback Modal */}
      <ConfirmationModal
        isOpen={feedbackModal.isOpen}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        confirmLabel="Dismiss"
        cancelLabel={null}
        confirmVariant="danger"
        onClose={() => setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
