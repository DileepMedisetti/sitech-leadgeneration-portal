import React, { useEffect, useState } from 'react';
import {
  Search,
  Download,
  Users,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  X,
  FileSpreadsheet,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { leadsApi, triggerBlobDownload } from '../../services/api-client';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import LeadDetailDrawer from './LeadDetailDrawer';
import IdBadge from '../../components/ui/IdBadge';
import { COUNTRIES } from '../../data/countries';
import { generateLeadsExcelBlob, isGenericHomepage } from '../../utils/excelExport';

export default function LeadsPage({ initialLeadId, onNavigate: _onNavigate }) {

  const [leads, setLeads] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quality audit state
  const [auditing, setAuditing] = useState(false);
  const [auditBanner, setAuditBanner] = useState(null);

  // File download states (Axios blob)
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  const handleExportXlsx = async () => {
    try {
      setDownloadingXlsx(true);
      setAuditBanner(null);

      const activeParams = {
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        country: countryFilter || undefined,
      };

      const hasActiveFilters = Boolean(
        activeParams.search || activeParams.status || activeParams.country
      );

      // Fetch all matching records across pagination using centralized Axios client
      const firstPage = await leadsApi.list({
        page: 1,
        page_size: 100,
        ...activeParams,
      });

      let allLeads = firstPage.items || [];
      if (firstPage.total_pages > 1) {
        const remainingRequests = [];
        for (let p = 2; p <= firstPage.total_pages; p++) {
          remainingRequests.push(
            leadsApi.list({
              page: p,
              page_size: 100,
              ...activeParams,
            })
          );
        }
        const pages = await Promise.all(remainingRequests);
        pages.forEach((pr) => {
          allLeads = allLeads.concat(pr.items || []);
        });
      }

      if (allLeads.length === 0) {
        setAuditBanner({
          type: 'info',
          text: hasActiveFilters
            ? 'No leads matched your active search and filter criteria to export.'
            : 'No leads currently stored in the database to export.',
        });
        return;
      }

      const filename = `sitech_leads_${statusFilter || 'all'}.xlsx`;
      const blob = generateLeadsExcelBlob(allLeads);
      triggerBlobDownload(blob, filename, null, true);

      setAuditBanner({
        type: 'success',
        text: `Successfully exported ${allLeads.length} lead(s) matching your criteria to ${filename}.`,
      });
    } catch (err) {
      setAuditBanner({
        type: 'danger',
        text: `Excel export failed: ${err.message || 'Unknown network error.'}`,
      });
    } finally {
      setDownloadingXlsx(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setDownloadingCsv(true);
      await leadsApi.downloadCsv(statusFilter || undefined);
    } catch (err) {
      setAuditBanner({
        type: 'danger',
        text: `CSV export failed: ${err.message || 'Network error'}`,
      });
    } finally {
      setDownloadingCsv(false);
    }
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await leadsApi.list({

        page,
        page_size: 25,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        country: countryFilter || undefined,
      });
      setLeads(res.items);
      setTotalPages(res.total_pages);
      setTotalCount(res.total);

      // Open initial lead if provided
      if (initialLeadId) {
        const found = res.items.find((l) => l.id === parseInt(initialLeadId, 10));
        if (found) setSelectedLead(found);
      }
    } catch (err) {
      setError(err.message || 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, statusFilter, countryFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLeads();
  };

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
    fetchLeads();
  };

  const handleLeadUpdated = (updated) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setSelectedLead(updated);
  };

  const handleRunAudit = async () => {
    try {
      setAuditing(true);
      const res = await leadsApi.audit();
      const demotedCount = (res.reclassified_to_rejected || 0) + (res.reclassified_to_review || 0);
      setAuditBanner({
        type: 'success',
        text: `Quality audit completed: ${res.total_audited} records evaluated. ${demotedCount} suspicious records reclassified safely; ${res.adjusted_jobs} job counters updated.`,
      });
      await fetchLeads();
    } catch (err) {
      setAuditBanner({
        type: 'danger',
        text: `Quality audit failed: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setAuditing(false);
    }
  };

  const formatConfidence = (score) => {
    if (score === null || score === undefined || score === '') return '—';
    const num = Number(score);
    if (!Number.isFinite(num)) return '—';
    const pct = Math.round(num <= 1 ? num * 100 : num);
    return `${Math.min(100, Math.max(0, pct))}%`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Audit Banner Notification */}
      {auditBanner && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: auditBanner.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            border: `1px solid ${auditBanner.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            color: auditBanner.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} />
            <span>{auditBanner.text}</span>
          </div>
          <button
            onClick={() => setAuditBanner(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
            title="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Page Header and Action Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '2px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Lead Management
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {totalCount} verified academic faculty contacts in directory
          </div>
        </div>

        {/* Action Buttons Row on the Right Side of the Same Horizontal Line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* 1. Audit Records */}
          <button
            type="button"
            onClick={handleRunAudit}
            disabled={auditing}
            className="btn btn-secondary"
            title="Audit stored leads to detect non-person headings and generic emails"
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
            <RefreshCw size={14} className={auditing ? 'spin' : ''} />
            <span>{auditing ? 'Auditing...' : 'Audit Records'}</span>
          </button>

          {/* 2. Download Excel */}
          <button
            type="button"
            onClick={handleExportXlsx}
            disabled={downloadingXlsx}
            className="btn btn-primary"
            title="Download verified leads as a styled Excel (.xlsx) spreadsheet"
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
            <FileSpreadsheet size={14} className={downloadingXlsx ? 'spin' : ''} />
            <span>{downloadingXlsx ? 'Exporting...' : 'Download Excel'}</span>
          </button>

          {/* 3. Download CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={downloadingCsv}
            className="btn btn-secondary"
            title="Download CSV export of currently filtered leads"
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
            <Download size={14} className={downloadingCsv ? 'spin' : ''} />
            <span>{downloadingCsv ? 'Exporting...' : 'Download CSV'}</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="card" style={{ padding: '14px 18px', margin: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: 'flex',
              gap: '8px',
              flex: '1 1 280px',
              maxWidth: '420px',
            }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                placeholder="Search by name, email, department, institution..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-control"
                style={{ paddingLeft: '32px', paddingRight: search ? '30px' : '10px', height: '36px' }}
              />
              <Search
                size={14}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              {search && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-secondary" style={{ height: '36px', padding: '0 14px', flexShrink: 0 }}>
              Search
            </button>
          </form>

          {/* Filter Dropdowns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="form-control"
              style={{ width: '145px', height: '36px', fontSize: '12.5px' }}
              aria-label="Filter by qualification status"
            >
              <option value="">All Statuses</option>
              <option value="qualified">Qualified</option>
              <option value="needs_review">Needs Review</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setPage(1);
              }}
              className="form-control"
              style={{ width: '160px', height: '36px', fontSize: '12.5px' }}
              aria-label="Filter by country"
            >
              <option value="">All Countries</option>
              <option value="United States">United States</option>
              <option value="India">India</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
              <option value="Germany">Germany</option>
              <option disabled>──────────</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <LoadingSpinner text="Loading verified contacts..." />
      ) : error ? (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: 'var(--danger-light)', margin: 0 }}>
          <p style={{ color: 'var(--danger-text)', margin: 0 }}>{error}</p>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          title="No leads found"
          message={
            search || statusFilter || countryFilter
              ? 'No contacts matched your search and filter criteria.'
              : 'No leads currently stored in the database. Run a search job and extract leads to build your contact pipeline.'
          }
          icon={Users}
        />
      ) : (
        <div className="card" style={{ padding: 0, margin: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', margin: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '85px' }}>Lead ID</th>
                  <th style={{ width: '17%' }}>Lead / Person</th>
                  <th style={{ width: '17%' }}>Professional Email</th>
                  <th style={{ width: '18%' }}>Designation & Specialization</th>
                  <th style={{ width: '14%' }}>Institution</th>
                  <th style={{ width: '8%' }}>Country</th>
                  <th style={{ width: '150px' }}>Institutional Webpage</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '7%' }}>Confidence</th>
                  <th style={{ textAlign: 'right', width: '85px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const isSuspiciousHeading =
                    lead.evidence?.audit_flag === 'suspicious_heading' ||
                    lead.qualification_reason?.includes('Non-person heading') ||
                    lead.qualification_reason?.includes('webpage heading');

                  const isGenericInbox =
                    lead.evidence?.audit_flag === 'generic_role_email' ||
                    lead.qualification_reason?.includes('Generic role') ||
                    lead.qualification_reason?.includes('generic role email');

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Lead ID */}
                      <td>
                        <IdBadge prefix="LEAD" id={lead.id} />
                      </td>

                      {/* 1. Lead / Person */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {lead.name}
                          </span>
                          {isSuspiciousHeading && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--bg-subtle)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              title="Flagged: Name resembles a webpage title or navigation heading"
                            >
                              <AlertTriangle size={10} /> Heading
                            </span>
                          )}
                        </div>
                        {lead.phone_number && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {lead.phone_number}
                          </div>
                        )}
                      </td>

                      {/* 2. Professional Email */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <a
                            href={`mailto:${lead.email}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              color: 'var(--primary)',
                              fontWeight: 500,
                              fontSize: '13px',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {lead.email}
                          </a>
                          {isGenericInbox && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Department / Role Inbox
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Designation & Specialization */}
                      <td>
                        <div
                          style={{
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '220px',
                          }}
                          title={lead.profession || undefined}
                        >
                          {lead.profession || '—'}
                        </div>
                        {lead.research_specialization ? (
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '220px',
                              marginTop: '2px',
                            }}
                            title={
                              lead.department && lead.department !== lead.research_specialization
                                ? `${lead.research_specialization} (${lead.department})`
                                : lead.research_specialization
                            }
                          >
                            {lead.research_specialization}
                            {lead.department && lead.department !== lead.research_specialization
                              ? ` • ${lead.department}`
                              : ''}
                          </div>
                        ) : lead.department ? (
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '220px',
                              marginTop: '2px',
                            }}
                            title={lead.department}
                          >
                            {lead.department}
                          </div>
                        ) : null}
                      </td>

                      {/* 4. Institution */}
                      <td>
                        <div
                          style={{
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '180px',
                          }}
                          title={lead.university || undefined}
                        >
                          {lead.university || '—'}
                        </div>
                      </td>

                      {/* 5. Country */}
                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {lead.country || '—'}
                        </span>
                      </td>

                      {/* 6. Institutional Webpage */}
                      <td>
                        {(() => {
                          const verificationUrl =
                            lead.website && !isGenericHomepage(lead.website)
                              ? lead.website
                              : lead.source_url && !isGenericHomepage(lead.source_url)
                              ? lead.source_url
                              : null;

                          return verificationUrl ? (
                            <a
                              href={verificationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                color: 'var(--text-primary)',
                                textDecoration: 'underline',
                                fontWeight: 500,
                              }}
                              title={verificationUrl}
                            >
                              <Globe size={12} style={{ flexShrink: 0 }} />
                              <span>View Source</span>
                              <ExternalLink size={10} style={{ flexShrink: 0 }} />
                            </a>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not available</span>
                          );
                        })()}
                      </td>

                      {/* 7. Qualification Status */}
                      <td>
                        <StatusBadge status={lead.qualification_status} />
                      </td>

                      {/* 8. Confidence (Strictly percentage or em dash, NEVER 'Verified') */}
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '12px',
                            color:
                              lead.confidence_score !== null && Number(lead.confidence_score) >= 0.8
                                ? 'var(--success-text)'
                                : 'var(--text-secondary)',
                          }}
                        >
                          {formatConfidence(lead.confidence_score)}
                        </span>
                      </td>

                      {/* 8. Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLead(lead);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '5px 9px', fontSize: '12px' }}
                        >
                          Dossier <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={25}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Slide-over Detail Drawer */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onLeadUpdated={handleLeadUpdated}
        />
      )}
    </div>
  );
}
