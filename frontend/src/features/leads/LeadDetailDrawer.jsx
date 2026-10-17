import React, { useEffect, useState } from 'react';
import {
  X,
  Mail,
  Phone,
  Globe,
  Building,
  GraduationCap,
  ExternalLink,
  Edit2,
  Save,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Shield,
  Layers,
} from 'lucide-react';

import { leadsApi, reviewQueueApi } from '../../services/api-client';
import StatusBadge from '../../components/ui/StatusBadge';
import IdBadge from '../../components/ui/IdBadge';

const getInitialFormData = (lead) => ({
  name: lead?.name || '',
  phone_number: lead?.phone_number || '',
  profession: lead?.profession || '',
  research_specialization: lead?.research_specialization || '',
  department: lead?.department || '',
  university: lead?.university || '',
  country: lead?.country || '',
  website: lead?.website || '',
  qualification_status: lead?.qualification_status || 'qualified',
});

function LinkedInMark() {
  return (
    <span
      aria-label="LinkedIn"
      title="LinkedIn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 17,
        height: 17,
        borderRadius: 3,
        backgroundColor: '#18181b',
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      in
    </span>
  );
}

function SectionHeading({ icon, title }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-secondary)',
        marginBottom: 12,
        marginTop: 20,
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: 6,
      }}
    >
      {icon}
      <span>{title}</span>
    </div>
  );
}

function DetailItem({ icon, label, children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        minWidth: 0,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 2 }}>{icon}</span>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 2,
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflowWrap: 'anywhere',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
}) {
  return (
    <div className="form-group" style={{ marginBottom: 12 }}>
      <label className="form-label" htmlFor={`lead-${name}`} style={{ fontSize: 12, marginBottom: 4 }}>
        {label}
      </label>

      <input
        id={`lead-${name}`}
        type={type}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        className="form-control"
        style={{ fontSize: 13 }}
      />
    </div>
  );
}

export default function LeadDetailDrawer({
  lead,
  onClose,
  onLeadUpdated,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const [formData, setFormData] = useState(() =>
    getInitialFormData(lead)
  );

  useEffect(() => {
    setFormData(getInitialFormData(lead));
    setEditing(false);
    setError(null);
    setSaving(false);
    setNotification(null);
  }, [lead?.id]);

  useEffect(() => {
    if (!lead) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving && !actionLoading) {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lead, saving, actionLoading, onClose]);

  if (!lead) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setError(null);

      const updatedLead = await leadsApi.update(lead.id, formData);
      if (updatedLead) {
        setFormData(getInitialFormData(updatedLead));
      }
      setEditing(false);
      setNotification({ type: 'success', text: 'Lead details updated successfully.' });

      if (onLeadUpdated && updatedLead) {
        onLeadUpdated(updatedLead);
      }
    } catch (err) {
      setError(err?.message || 'Failed to update lead. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickApprove = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await reviewQueueApi.approve(lead.id, 'Manually approved via Lead Dossier');
      setNotification({ type: 'success', text: 'Candidate approved and marked as qualified lead!' });
      if (onLeadUpdated && res) {
        onLeadUpdated(res);
      }
    } catch (err) {
      setError(err?.message || 'Failed to approve lead.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickReject = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await reviewQueueApi.reject(lead.id, 'Manually rejected via Lead Dossier');
      setNotification({ type: 'info', text: 'Candidate marked as rejected.' });
      if (onLeadUpdated && res) {
        onLeadUpdated(res);
      }
    } catch (err) {
      setError(err?.message || 'Failed to reject lead.');
    } finally {
      setActionLoading(false);
    }
  };

  // Format confidence percentage strictly or display em dash (never "Verified")
  const formatConfidence = (score) => {
    if (score === null || score === undefined || score === '') return '—';
    const num = Number(score);
    if (!Number.isFinite(num)) return '—';
    const pct = Math.round(num <= 1 ? num * 100 : num);
    return `${Math.min(100, Math.max(0, pct))}%`;
  };

  const isSuspicious =
    lead.evidence?.audit_flag ||
    lead.qualification_reason?.includes('Non-person heading') ||
    lead.qualification_reason?.includes('webpage heading') ||
    lead.qualification_reason?.includes('Generic role');

  const iconStyle = {
    color: 'var(--primary)',
    flexShrink: 0,
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !actionLoading) {
          onClose?.();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.48)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-drawer-title"
        style={{
          width: 560,
          maxWidth: '100%',
          backgroundColor: '#ffffff',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflowY: 'auto',
          color: 'var(--text-primary)',
        }}
      >
        {/* Drawer Header */}
        <header
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            position: 'sticky',
            top: 0,
            backgroundColor: '#ffffff',
            zIndex: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                LEAD DOSSIER
              </span>

              <IdBadge prefix="LEAD" id={lead.id} />
              <StatusBadge status={lead.qualification_status} />
            </div>

            <h2
              id="lead-drawer-title"
              style={{
                fontSize: 17,
                fontWeight: 700,
                margin: '4px 0 0',
                overflowWrap: 'anywhere',
                color: 'var(--text-primary)',
              }}
            >
              {lead.name || 'Unnamed Contact'}
            </h2>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            {!editing ? (
              <button
                type="button"
                onClick={() => {
                  setFormData(getInitialFormData(lead));
                  setError(null);
                  setNotification(null);
                  setEditing(true);
                }}
                className="btn btn-secondary btn-sm"
              >
                <Edit2 size={13} /> Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary btn-sm"
              >
                <Save size={13} /> {saving ? 'Saving...' : 'Save'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={saving || actionLoading}
              className="btn btn-secondary btn-sm"
              aria-label="Close lead details"
              title="Close"
              style={{ padding: 6 }}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Notifications & Error Banners */}
        {error && (
          <div
            role="alert"
            style={{
              margin: '14px 22px 0',
              padding: '10px 14px',
              backgroundColor: 'var(--danger-light)',
              color: 'var(--danger-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              border: '1px solid var(--danger-border)',
            }}
          >
            {error}
          </div>
        )}

        {notification && (
          <div
            role="status"
            style={{
              margin: '14px 22px 0',
              padding: '10px 14px',
              backgroundColor: notification.type === 'success' ? 'var(--success-light)' : 'var(--bg-subtle)',
              color: notification.type === 'success' ? 'var(--success-text)' : 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              border: `1px solid ${notification.type === 'success' ? 'var(--success-border)' : 'var(--border-color)'}`,
            }}
          >
            {notification.text}
          </div>
        )}

        {/* Suspicious Heading / Quality Audit Warning Callout */}
        {isSuspicious && (
          <div
            style={{
              margin: '14px 22px 0',
              padding: '12px 14px',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-primary)' }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Suspicious Contact Detected</div>
              <div>
                {lead.qualification_reason || 'This record has been flagged as a webpage heading or non-personal inbox.'}
              </div>
            </div>
          </div>
        )}

        {/* Drawer Body */}
        <div
          style={{
            padding: '20px 22px',
            flex: 1,
            minWidth: 0,
          }}
        >
          {editing ? (
            /* Inline Edit Form */
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <FormField label="Full Name" name="name" value={formData.name} onChange={handleChange} />
              <FormField label="Designation / Role" name="profession" value={formData.profession} onChange={handleChange} />
              <FormField label="Specialization / Profession" name="research_specialization" value={formData.research_specialization} onChange={handleChange} />
              <FormField label="Department" name="department" value={formData.department} onChange={handleChange} />
              <FormField label="University / Institution" name="university" value={formData.university} onChange={handleChange} />
              <FormField label="Country" name="country" value={formData.country} onChange={handleChange} />
              <FormField label="Institutional Webpage / Lab URL" name="website" value={formData.website} onChange={handleChange} />
              <FormField label="Phone Number" name="phone_number" value={formData.phone_number} onChange={handleChange} />

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="lead-qualification-status" style={{ fontSize: 12, marginBottom: 4 }}>
                  Qualification Status
                </label>
                <select
                  id="lead-qualification-status"
                  name="qualification_status"
                  value={formData.qualification_status}
                  onChange={handleChange}
                  className="form-control"
                  style={{ fontSize: 13 }}
                >
                  <option value="qualified">Qualified</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={saving}
                  onClick={() => {
                    setFormData(getInitialFormData(lead));
                    setEditing(false);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  <Save size={13} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            /* Structured Read-Only Details */
            <div>
              {/* SECTION 1: Personal and Professional Details */}
              <SectionHeading icon={<GraduationCap size={15} color="var(--primary)" />} title="Personal & Academic Profile" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                <DetailItem icon={<Shield size={15} style={iconStyle} />} label="Full Name">
                  <span style={{ fontWeight: 600 }}>{lead.name || '—'}</span>
                </DetailItem>

                <DetailItem icon={<GraduationCap size={15} style={iconStyle} />} label="Designation / Role">
                  {lead.profession || '—'}
                </DetailItem>

                <DetailItem icon={<FileText size={15} style={iconStyle} />} label="Specialization / Profession">
                  {lead.research_specialization || '—'}
                </DetailItem>

                {lead.department && (
                  <DetailItem icon={<Layers size={15} style={iconStyle} />} label="Department / Division">
                    {lead.department}
                  </DetailItem>
                )}
              </div>

              {/* SECTION 2: Contact Information */}
              <SectionHeading icon={<Mail size={15} color="var(--primary)" />} title="Contact Channels" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                <DetailItem icon={<Mail size={15} style={iconStyle} />} label="Professional Email">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {lead.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </DetailItem>

                {lead.phone_number && (
                  <DetailItem icon={<Phone size={15} style={iconStyle} />} label="Direct Phone">
                    {lead.phone_number}
                  </DetailItem>
                )}

                {lead.linkedin_url && (
                  <DetailItem icon={<LinkedInMark />} label="LinkedIn Profile">
                    <a
                      href={lead.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-primary)', textDecoration: 'underline' }}
                    >
                      <span>{lead.linkedin_url}</span>
                      <ExternalLink size={11} />
                    </a>
                  </DetailItem>
                )}

                {lead.website && (
                  <DetailItem icon={<Globe size={15} style={iconStyle} />} label="Institutional Webpage / Lab URL">
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <span>{lead.website}</span>
                      <ExternalLink size={11} />
                    </a>
                  </DetailItem>
                )}
              </div>

              {/* SECTION 3: Institution and Location */}
              <SectionHeading icon={<Building size={15} color="var(--primary)" />} title="Institution & Location" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                <DetailItem icon={<Building size={15} style={iconStyle} />} label="University / Affiliation">
                  {lead.university || '—'}
                </DetailItem>

                <DetailItem icon={<Globe size={15} style={iconStyle} />} label="Country">
                  {lead.country || '—'}
                </DetailItem>
              </div>

              {/* SECTION 4: Qualification Reasoning and Confidence */}
              <SectionHeading icon={<Shield size={15} color="var(--primary)" />} title="Qualification & Confidence" />
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>STATUS:</span>
                    <StatusBadge status={lead.qualification_status} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Confidence:</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color:
                          lead.confidence_score !== null && Number(lead.confidence_score) >= 0.8
                            ? 'var(--success-text)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      {formatConfidence(lead.confidence_score)}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {lead.qualification_reason || 'Standard system evaluation without specific anomalies.'}
                </div>
              </div>

              {/* SECTION 5: Source Webpage and Provenance */}
              <SectionHeading icon={<FileText size={15} color="var(--primary)" />} title="Source Evidence & Provenance" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {lead.source_url ? (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Source Webpage</div>
                    <a
                      href={lead.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      <span>{lead.source_url}</span>
                      <ExternalLink size={12} style={{ flexShrink: 0 }} />
                    </a>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No source webpage recorded.</div>
                )}

                {lead.evidence && (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      padding: 10,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      marginTop: 4,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Extraction Evidence Metadata
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {typeof lead.evidence === 'string'
                        ? lead.evidence
                        : JSON.stringify(lead.evidence, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* SECTION 6: Available Actions Workflow */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Record:</span>
                  <IdBadge prefix="LEAD" id={lead.id} />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {lead.qualification_status !== 'qualified' && (
                    <button
                      type="button"
                      onClick={handleQuickApprove}
                      disabled={actionLoading}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <CheckCircle size={13} />
                      {actionLoading ? 'Updating...' : 'Approve Lead'}
                    </button>
                  )}

                  {lead.qualification_status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={handleQuickReject}
                      disabled={actionLoading}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <XCircle size={13} />
                      {actionLoading ? 'Updating...' : 'Reject Lead'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}