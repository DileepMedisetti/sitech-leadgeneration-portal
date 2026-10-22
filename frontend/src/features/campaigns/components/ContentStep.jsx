import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Info,
  Check,
  Plus,
  Tag,
  Mail,
  Code2,
  Layout,
  Smartphone,
  Monitor,
  Eye,
  ShieldCheck,
  X,
} from 'lucide-react';

const SENDER_IDENTITIES = [
  { email: 'outreach@sitechseries.org', name: 'Sitech Academic Outreach', verified: true },
  { email: 'symposium@sitechseries.org', name: 'Sitech Symposium Secretariat', verified: true },
  { email: 'editor@sitechseries.org', name: 'Sitech Editorial Office', verified: true },
];

const PREDEFINED_TAGS = ['Faculty Outreach', 'Keynote Invitation', 'Symposium 2026', 'Research Labs', 'Special Issue'];

const AI_SUBJECT_SUGGESTIONS = [
  'Cross-Institutional Research Initiative — Faculty Collaboration',
  'Invitation to Keynote: 2026 Academic Summit on Advanced Computing',
  'Special Issue Call for Papers: Scalable Intelligence Systems',
  'Faculty Colloquium & Collaborative Lab Inquiry',
  'Distinguished Seminar Speaker Invitation — Computer Science Department',
];

const PERSONALIZATION_TOKENS = [
  '{{name}}',
  '{{first_name}}',
  '{{university}}',
  '{{department}}',
  '{{profession}}',
  '{{country}}',
];

export default function ContentStep({
  subject,
  setSubject,
  previewText,
  setPreviewText,
  fromName,
  setFromName,
  fromEmail,
  setFromEmail,
  replyTo,
  setReplyTo,
  selectedTags = [],
  setSelectedTags,
  htmlContent,
  plainText,
  onOpenTemplateModal,
  onOpenHtmlEditor,
  trackingOptions,
  setTrackingOptions,
}) {
  const [showReplyTo, setShowReplyTo] = useState(Boolean(replyTo && replyTo !== fromEmail));
  const [showAdditionalOptions, setShowAdditionalOptions] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [showTokenMenu, setShowTokenMenu] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [devicePreview, setDevicePreview] = useState('desktop'); // 'desktop' | 'mobile'

  const handleInsertTokenToSubject = (token) => {
    setSubject((prev) => prev + ' ' + token);
    setShowTokenMenu(false);
  };

  const handleAddTag = () => {
    const val = newTagInput.trim();
    if (val && !selectedTags.includes(val)) {
      setSelectedTags([...selectedTags, val]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="campaign-editor-grid">
      {/* Left Column: Form Configuration Card */}
      <div
        className="campaign-card campaign-card-padded"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
        }}
      >
        {/* Email Subject Line */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '6px',
            }}
          >
            <label className="campaign-label" style={{ marginBottom: 0 }}>
              Email Subject Line <span className="campaign-label-required">*</span>
            </label>

            <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
              {/* Token Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowTokenMenu(!showTokenMenu)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#2563eb',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                >
                  <span>&#123; &#125; Personalise</span>
                </button>

                {showTokenMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                      zIndex: 50,
                      padding: '4px',
                      width: '180px',
                    }}
                  >
                    {PERSONALIZATION_TOKENS.map((token) => (
                      <div
                        key={token}
                        onClick={() => handleInsertTokenToSubject(token)}
                        style={{
                          padding: '7px 10px',
                          fontSize: '12px',
                          color: '#1e293b',
                          cursor: 'pointer',
                          borderRadius: '4px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {token}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Assistance Button */}
              <button
                type="button"
                onClick={() => setShowAiSuggestions(!showAiSuggestions)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#7c3aed',
                  backgroundColor: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ede9fe')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f5f3ff')}
              >
                <Sparkles size={13} /> AI Ideas
              </button>
            </div>
          </div>

          <input
            type="text"
            className="campaign-input"
            placeholder="e.g. Cross-Institutional Research Initiative — Faculty Collaboration"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          {/* AI Suggestions Dropdown Popover */}
          {showAiSuggestions && (
            <div
              style={{
                marginTop: '8px',
                backgroundColor: '#fdf4ff',
                border: '1px solid #f0abfc',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 12px rgba(134, 25, 143, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#86198f' }}>
                  High-Converting Academic Subject Ideas
                </span>
                <button
                  type="button"
                  onClick={() => setShowAiSuggestions(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86198f' }}
                >
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {AI_SUBJECT_SUGGESTIONS.map((idea) => (
                  <div
                    key={idea}
                    onClick={() => {
                      setSubject(idea);
                      setShowAiSuggestions(false);
                    }}
                    style={{
                      padding: '7px 10px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #f5d0fe',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#4a044e',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fae8ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    <span>{idea}</span>
                    <span style={{ fontSize: '11px', color: '#a21caf', fontWeight: 600 }}>Use</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preview Text */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="campaign-label" style={{ marginBottom: 0 }}>
              Preview Text (Preheader)
            </label>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              {previewText.length}/90 chars (Recommended: 35–90)
            </span>
          </div>
          <input
            type="text"
            className="campaign-input"
            placeholder="Appears in recipient inbox beside the subject line..."
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
          />
          <span className="campaign-helper-text">
            Gives faculty recipients immediate context in their inbox preview pane before opening.
          </span>
        </div>

        {/* Sender Identity & Display Name */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div>
            <label className="campaign-label">
              Sender Display Name <span className="campaign-label-required">*</span>
            </label>
            <input
              type="text"
              className="campaign-input"
              placeholder="e.g. Sitech Academic Outreach"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
          </div>

          <div>
            <label className="campaign-label">
              Sender Identity (From Email) <span className="campaign-label-required">*</span>
            </label>
            <select
              className="campaign-select"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            >
              {SENDER_IDENTITIES.map((sender) => (
                <option key={sender.email} value={sender.email}>
                  {sender.email} ({sender.verified ? 'Verified' : 'Unverified'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Expandable Alternative Reply-To Address */}
        <div>
          {!showReplyTo ? (
            <button
              type="button"
              onClick={() => setShowReplyTo(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#2563eb',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
              }}
            >
              + Add alternative reply-to address
            </button>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="campaign-label" style={{ marginBottom: 0 }}>
                  Alternative Reply-to Address
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowReplyTo(false);
                    setReplyTo(fromEmail);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  Remove
                </button>
              </div>
              <input
                type="email"
                className="campaign-input"
                placeholder="replies@sitechseries.org"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Campaign Tags */}
        <div>
          <label className="campaign-label">
            Campaign Tags
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {selectedTags.map((t) => (
              <span
                key={t}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '14px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <Tag size={11} /> {t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#1d4ed8',
                    padding: 0,
                    fontSize: '13px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="campaign-input"
              placeholder="Add a tag (e.g. Faculty Outreach)..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="campaign-action-btn-secondary"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Additional Options Accordion */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={() => setShowAdditionalOptions(!showAdditionalOptions)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: '#0f172a',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            <span>Additional Options & Tracking</span>
            {showAdditionalOptions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {showAdditionalOptions && (
            <div
              style={{
                marginTop: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: '#f8fafc',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={trackingOptions?.track_opens ?? true}
                  onChange={(e) =>
                    setTrackingOptions({ ...trackingOptions, track_opens: e.target.checked })
                  }
                  style={{ accentColor: '#2563eb', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  Track email opens
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={trackingOptions?.track_clicks ?? true}
                  onChange={(e) =>
                    setTrackingOptions({ ...trackingOptions, track_clicks: e.target.checked })
                  }
                  style={{ accentColor: '#2563eb', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  Track link clicks
                </span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Live Email Preview Panel */}
      <div
        className="campaign-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '620px',
          overflow: 'hidden',
        }}
      >
        {/* Device toggle & Actions Bar */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={15} color="#2563eb" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Email Preview</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Desktop / Mobile view toggle */}
            <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setDevicePreview('desktop')}
                style={{
                  padding: '5px 9px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: devicePreview === 'desktop' ? '#ffffff' : 'transparent',
                  color: devicePreview === 'desktop' ? '#2563eb' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: devicePreview === 'desktop' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Desktop view"
              >
                <Monitor size={14} />
              </button>
              <button
                type="button"
                onClick={() => setDevicePreview('mobile')}
                style={{
                  padding: '5px 9px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: devicePreview === 'mobile' ? '#ffffff' : 'transparent',
                  color: devicePreview === 'mobile' ? '#2563eb' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: devicePreview === 'mobile' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Mobile view"
              >
                <Smartphone size={14} />
              </button>
            </div>

            {/* Change or Edit actions if content exists */}
            {htmlContent ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={onOpenTemplateModal}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#2563eb',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                >
                  Change Template
                </button>
                <button
                  type="button"
                  onClick={onOpenHtmlEditor}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#ffffff',
                    backgroundColor: '#2563eb',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                >
                  <Code2 size={13} /> Edit HTML
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Email Header Card */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '10px', fontSize: '13px' }}>
            <span style={{ fontWeight: 700, color: '#64748b', width: '75px', flexShrink: 0 }}>Subject:</span>
            <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>
              {subject || '(No subject line specified)'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px' }}>
            <span style={{ fontWeight: 600, color: '#64748b', width: '75px', flexShrink: 0 }}>From:</span>
            <span style={{ color: '#1e293b' }}>
              {fromName} &lt;{fromEmail}&gt;
            </span>
          </div>

          {showReplyTo && (
            <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px' }}>
              <span style={{ fontWeight: 600, color: '#64748b', width: '75px', flexShrink: 0 }}>Reply-To:</span>
              <span style={{ color: '#1e293b' }}>&lt;{replyTo || fromEmail}&gt;</span>
            </div>
          )}

          {previewText && (
            <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
              <span style={{ fontWeight: 600, color: '#64748b', width: '75px', flexShrink: 0 }}>Preview:</span>
              <span style={{ color: '#64748b', fontStyle: 'italic', wordBreak: 'break-word' }}>{previewText}</span>
            </div>
          )}
        </div>

        {/* Email Body Area: Empty State OR Live Content */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#f8fafc',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!htmlContent ? (
            /* Reference-style Empty State */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                maxWidth: '400px',
                padding: '40px 20px',
              }}
            >
              {/* Illustration / Icon Circle */}
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.12)',
                  border: '1px solid #bfdbfe',
                }}
              >
                <Mail size={36} strokeWidth={1.75} />
              </div>

              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Add Email Content
              </h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                Select a high-converting academic template from our gallery or code custom HTML with deliverability tokens.
              </p>

              <button
                type="button"
                onClick={onOpenTemplateModal}
                className="campaign-action-btn-primary"
                style={{
                  padding: '11px 24px',
                  fontSize: '14px',
                }}
              >
                <Layout size={16} /> Choose email template
              </button>
            </div>
          ) : (
            /* Sanitized Live Email Render inside Device Frame */
            <div
              className={devicePreview === 'mobile' ? 'campaign-preview-canvas-mobile' : 'campaign-preview-canvas'}
              style={{
                width: devicePreview === 'mobile' ? '360px' : '100%',
                maxWidth: '640px',
                transition: 'width 0.25s ease',
              }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: htmlContent
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/{{name}}/g, 'Dr. Margaret Hamilton')
                    .replace(/{{first_name}}/g, 'Margaret')
                    .replace(/{{university}}/g, 'MIT')
                    .replace(/{{department}}/g, 'Computer Science')
                    .replace(/{{unsubscribe_url}}/g, '#unsubscribe'),
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
