import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Tag,
  Plus,
  X,
  Check,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Send,
  Sparkles,
  Code2,
} from 'lucide-react';
import {
  PREDEFINED_TAGS,
  PERSONALIZATION_TOKENS,
  AI_SUBJECT_SUGGESTIONS,
} from '../campaignConstants';
import { campaignsApi } from '../../../services/api-client';

export default function CampaignDetailsStep({
  campaignName,
  setCampaignName,
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
  trackingOptions,
  setTrackingOptions,
  fieldErrors = {},
  clearFieldError,
  onNavigate,
}) {
  const [showReplyTo, setShowReplyTo] = useState(Boolean(replyTo && replyTo !== fromEmail));
  const [showAdditionalOptions, setShowAdditionalOptions] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [senderIdentities, setSenderIdentities] = useState([]);
  const [loadingSenders, setLoadingSenders] = useState(true);
  const [senderLoadError, setSenderLoadError] = useState(null);

  // Subject line assistance popovers
  const [showTokenMenu, setShowTokenMenu] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);

  const subjectInputRef = useRef(null);
  const tokenMenuRef = useRef(null);
  const aiMenuRef = useRef(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        tokenMenuRef.current &&
        !tokenMenuRef.current.contains(e.target) &&
        aiMenuRef.current &&
        !aiMenuRef.current.contains(e.target)
      ) {
        setShowTokenMenu(false);
        setShowAiMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch eligible sender identities from backend
  useEffect(() => {
    let isMounted = true;
    const fetchSenders = async () => {
      setLoadingSenders(true);
      setSenderLoadError(null);
      try {
        const senders = await campaignsApi.getSenderIdentities();
        if (isMounted) {
          setSenderIdentities(senders);
          if (senders.length > 0) {
            const currentValid = senders.some((s) => s.email === fromEmail);
            if (!currentValid || !fromEmail) {
              setFromEmail(senders[0].email);
              if (!fromName || fromName.trim() === '') {
                setFromName(senders[0].name);
              }
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setSenderLoadError(err.message || 'Failed to load sender accounts.');
        }
      } finally {
        if (isMounted) {
          setLoadingSenders(false);
        }
      }
    };

    fetchSenders();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
      setNewTagInput('');
    }
  };

  const handleAddPredefinedTag = (t) => {
    if (!selectedTags.includes(t)) {
      setSelectedTags([...selectedTags, t]);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter((t) => t !== tagToRemove));
  };

  const handleSenderIdentityChange = (e) => {
    const selectedEmail = e.target.value;
    setFromEmail(selectedEmail);
    const matched = senderIdentities.find((s) => s.email === selectedEmail);
    if (matched && (!fromName || fromName.trim() === '')) {
      setFromName(matched.name);
    }
    if (clearFieldError) clearFieldError('fromEmail');
  };

  const handleInsertToken = (token) => {
    setShowTokenMenu(false);
    const input = subjectInputRef.current;
    if (!input) {
      setSubject((prev) => (prev ? `${prev} ${token}` : token));
    } else {
      const start = input.selectionStart ?? subject.length;
      const end = input.selectionEnd ?? subject.length;
      const next = subject.substring(0, start) + token + subject.substring(end);
      setSubject(next);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    }
    if (clearFieldError) clearFieldError('subject');
  };

  const handleApplyAiSuggestion = (suggestion) => {
    setSubject(suggestion);
    setShowAiMenu(false);
    if (clearFieldError) clearFieldError('subject');
  };

  return (
    <div className="campaign-step-container">
      {/* Primary Card Container */}
      <div className="campaign-card campaign-card-padded">
        {/* Section 1: Campaign Information */}
        <div className="campaign-form-section">
          <div className="campaign-section-header">
            <h2 className="campaign-section-title">Campaign Information</h2>
            <p className="campaign-section-subtitle">
              Basic identification and internal categorization for this email campaign.
            </p>
          </div>

          <div className="campaign-form-stack">
            {/* 1. Campaign Name */}
            <div className="campaign-field-group">
              <label htmlFor="campaign-name-input" className="campaign-label">
                Campaign Name <span className="campaign-label-required">*</span>
              </label>
              <input
                id="campaign-name-input"
                type="text"
                className={`campaign-input ${fieldErrors.name ? 'campaign-input-error' : ''}`}
                placeholder="e.g. Academic Research Symposium Outreach"
                value={campaignName}
                onChange={(e) => {
                  setCampaignName(e.target.value);
                  if (clearFieldError) clearFieldError('name');
                }}
              />
              {fieldErrors.name ? (
                <span className="campaign-field-error" role="alert">
                  {fieldErrors.name}
                </span>
              ) : (
                <span className="campaign-helper-text">
                  Internal campaign label used across analytics dashboards, reporting, and activity logs.
                </span>
              )}
            </div>

            {/* 2. Email Subject Line with Token Insertion & AI suggestions */}
            <div className="campaign-field-group">
              <div className="campaign-field-label-row">
                <label htmlFor="campaign-subject-input" className="campaign-label">
                  Email Subject Line <span className="campaign-label-required">*</span>
                </label>

                {/* Subject Helpers Toolbar */}
                <div className="campaign-subject-actions" ref={tokenMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTokenMenu(!showTokenMenu);
                      setShowAiMenu(false);
                    }}
                    className="campaign-micro-btn campaign-micro-btn-blue"
                    title="Insert personalization variable token"
                  >
                    <Code2 size={13} />
                    <span>Personalize</span>
                    <ChevronDown size={11} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAiMenu(!showAiMenu);
                      setShowTokenMenu(false);
                    }}
                    className="campaign-micro-btn campaign-micro-btn-purple"
                    title="View high-converting subject suggestions"
                  >
                    <Sparkles size={13} />
                    <span>AI Ideas</span>
                    <ChevronDown size={11} />
                  </button>

                  {/* Token Dropdown Popover */}
                  {showTokenMenu && (
                    <div className="campaign-dropdown-menu">
                      <div className="campaign-dropdown-header">Dynamic Recipient Variables</div>
                      {PERSONALIZATION_TOKENS.map((item) => (
                        <button
                          key={item.token}
                          type="button"
                          onClick={() => handleInsertToken(item.token)}
                          className="campaign-dropdown-item"
                        >
                          <span className="campaign-token-code">{item.token}</span>
                          <span className="campaign-token-desc">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* AI Ideas Popover */}
                  {showAiMenu && (
                    <div className="campaign-ai-popover" ref={aiMenuRef}>
                      <div className="campaign-ai-header">
                        <div className="campaign-ai-header-title">
                          <Sparkles size={14} />
                          <span>Curated Academic Subject Lines</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAiMenu(false)}
                          className="campaign-icon-close-btn"
                          aria-label="Close suggestions"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="campaign-ai-list">
                        {AI_SUBJECT_SUGGESTIONS.map((suggestion, idx) => (
                          <div
                            key={idx}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleApplyAiSuggestion(suggestion)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleApplyAiSuggestion(suggestion);
                            }}
                            className="campaign-ai-item"
                          >
                            <span className="campaign-ai-text">{suggestion}</span>
                            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600 }}>Apply</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <input
                ref={subjectInputRef}
                id="campaign-subject-input"
                type="text"
                className={`campaign-input ${fieldErrors.subject ? 'campaign-input-error' : ''}`}
                placeholder="e.g. Cross-Institutional Research Initiative — Faculty Collaboration"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (clearFieldError) clearFieldError('subject');
                }}
              />
              {fieldErrors.subject ? (
                <span className="campaign-field-error" role="alert">
                  {fieldErrors.subject}
                </span>
              ) : (
                <span className="campaign-helper-text">
                  Dynamic variables (e.g. &#123;&#123;name&#125;&#125;, &#123;&#123;university&#125;&#125;) are automatically replaced with recipient details at dispatch.
                </span>
              )}
            </div>

            {/* 3. Preview Text (Preheader) */}
            <div className="campaign-field-group">
              <div className="campaign-field-label-row">
                <label htmlFor="campaign-preview-text-input" className="campaign-label">
                  Preview Text (Preheader)
                </label>
                <span className="campaign-char-counter">
                  {previewText.length}/90 characters
                </span>
              </div>
              <input
                id="campaign-preview-text-input"
                type="text"
                className="campaign-input"
                placeholder="Brief summary displayed right after the subject in recipient email clients..."
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                maxLength={120}
              />
              <span className="campaign-helper-text">
                Appears in the recipient’s inbox preview snippet right next to the subject line to boost open rates.
              </span>
            </div>
          </div>
        </div>

        <div className="campaign-divider" />

        {/* Section 2: Sender Information */}
        <div className="campaign-form-section">
          <div className="campaign-section-header">
            <h2 className="campaign-section-title">Sender Information</h2>
            <p className="campaign-section-subtitle">
              Identity details and domain authentication configuration displayed to recipients.
            </p>
          </div>

          <div className="campaign-form-stack">
            {/* 2-Column Grid for Sender Display Name and From Email */}
            <div className="campaign-two-col-grid">
              {/* Sender Display Name */}
              <div className="campaign-field-group">
                <label htmlFor="campaign-from-name" className="campaign-label">
                  Sender Display Name <span className="campaign-label-required">*</span>
                </label>
                <input
                  id="campaign-from-name"
                  type="text"
                  className={`campaign-input ${fieldErrors.fromName ? 'campaign-input-error' : ''}`}
                  placeholder="e.g. Sitech Academic Outreach"
                  value={fromName}
                  onChange={(e) => {
                    setFromName(e.target.value);
                    if (clearFieldError) clearFieldError('fromName');
                  }}
                />
                {fieldErrors.fromName && (
                  <span className="campaign-field-error" role="alert">
                    {fieldErrors.fromName}
                  </span>
                )}
              </div>

              {/* Sender Identity (From Email) */}
              <div className="campaign-field-group">
                <div className="campaign-field-label-row">
                  <label htmlFor="campaign-from-email" className="campaign-label">
                    Sender Identity (From Email) <span className="campaign-label-required">*</span>
                  </label>
                  <span className="campaign-verified-badge">
                    <ShieldCheck size={12} />
                    <span>DKIM/SPF Verified</span>
                  </span>
                </div>

                {loadingSenders ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#64748b',
                      fontSize: '13px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <RefreshCw size={14} style={{ animation: 'campaignSpin 1s linear infinite' }} />
                    <span>Loading verified sender identities...</span>
                  </div>
                ) : senderLoadError ? (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#fef2f2',
                      color: '#991b1b',
                      fontSize: '12.5px',
                      border: '1px solid #fecaca',
                    }}
                  >
                    {senderLoadError}
                  </div>
                ) : senderIdentities.length === 0 ? (
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#92400e',
                        fontSize: '13px',
                        fontWeight: 700,
                        marginBottom: '4px',
                      }}
                    >
                      <AlertTriangle size={14} color="#f59e0b" />
                      <span>No verified sender accounts available</span>
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#78350f', lineHeight: 1.45 }}>
                      You must add and verify at least one email identity before sending campaigns.
                    </p>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('email-accounts')}
                        className="campaign-micro-btn campaign-micro-btn-blue"
                      >
                        <Send size={12} />
                        <span>Manage Email Accounts</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    id="campaign-from-email"
                    className={`campaign-select ${fieldErrors.fromEmail ? 'campaign-input-error' : ''}`}
                    value={fromEmail}
                    onChange={handleSenderIdentityChange}
                  >
                    {senderIdentities.map((sender) => (
                      <option key={sender.email} value={sender.email}>
                        {sender.email} ({sender.name})
                      </option>
                    ))}
                  </select>
                )}

                {fieldErrors.fromEmail && (
                  <span className="campaign-field-error" role="alert">
                    {fieldErrors.fromEmail}
                  </span>
                )}
              </div>
            </div>

            {/* Alternative Reply-To Address */}
            <div className="campaign-field-group">
              {!showReplyTo ? (
                <button
                  type="button"
                  onClick={() => setShowReplyTo(true)}
                  className="campaign-inline-action-btn"
                >
                  <Plus size={14} />
                  <span>Configure alternative reply-to address</span>
                </button>
              ) : (
                <div className="campaign-nested-box">
                  <div className="campaign-field-label-row">
                    <label htmlFor="campaign-reply-to" className="campaign-label">
                      Alternative Reply-to Address
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReplyTo(false);
                        setReplyTo(fromEmail);
                      }}
                      className="campaign-text-link-danger"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    id="campaign-reply-to"
                    type="email"
                    className="campaign-input"
                    placeholder="e.g. replies@sitechseries.org"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                  />
                  <span className="campaign-helper-text">
                    Replies from recipients will be directed to this inbox instead of the sender address.
                  </span>
                </div>
              )}
            </div>

            {/* Campaign Categorization Tags */}
            <div className="campaign-field-group">
              <label htmlFor="campaign-tags-input" className="campaign-label">
                Campaign Tags
              </label>

              {/* Tag Pills */}
              {selectedTags.length > 0 && (
                <div className="campaign-tag-pills-row">
                  {selectedTags.map((tag) => (
                    <span key={tag} className="campaign-tag-chip">
                      <Tag size={12} />
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="campaign-tag-remove-btn"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add Custom Tag Bar */}
              <div className="campaign-tag-input-row">
                <input
                  id="campaign-tags-input"
                  type="text"
                  className="campaign-input campaign-tag-input"
                  placeholder="Add custom tag (e.g. Faculty Outreach, Q2 Summit)..."
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
                  className="campaign-action-btn-secondary campaign-tag-add-btn"
                >
                  <Plus size={14} />
                  <span>Add Tag</span>
                </button>
              </div>

              {/* Predefined Tag Suggestions */}
              <div className="campaign-predefined-tags">
                <span className="campaign-predefined-label">Suggested Tags:</span>
                <div className="campaign-predefined-chips">
                  {PREDEFINED_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={isSelected}
                        onClick={() => handleAddPredefinedTag(tag)}
                        className={`campaign-predefined-chip ${isSelected ? 'chip-selected' : ''}`}
                      >
                        {isSelected && <Check size={11} />}
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="campaign-divider" />

        {/* Section 3: Collapsible Engagement & Tracking Options */}
        <div className="campaign-accordion-section">
          <button
            type="button"
            onClick={() => setShowAdditionalOptions(!showAdditionalOptions)}
            className="campaign-accordion-toggle"
            aria-expanded={showAdditionalOptions}
          >
            <div className="campaign-accordion-toggle-left">
              <span className="campaign-accordion-title">
                Engagement & Tracking Options
              </span>
              <span className="campaign-accordion-badge">
                {trackingOptions?.track_opens && trackingOptions?.track_clicks
                  ? 'Opens & Clicks Active'
                  : 'Customized'}
              </span>
            </div>
            {showAdditionalOptions ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          {showAdditionalOptions && (
            <div className="campaign-accordion-content">
              <div className="campaign-tracking-grid">
                {/* Track Opens */}
                <label className="campaign-checkbox-card">
                  <input
                    type="checkbox"
                    className="campaign-checkbox"
                    checked={trackingOptions?.track_opens ?? true}
                    onChange={(e) =>
                      setTrackingOptions({
                        ...trackingOptions,
                        track_opens: e.target.checked,
                      })
                    }
                  />
                  <div className="campaign-checkbox-text">
                    <span className="campaign-checkbox-label">Track email opens</span>
                    <span className="campaign-checkbox-desc">
                      Embeds a high-reputation 1x1 tracking pixel to monitor recipient read rates and engagement over time.
                    </span>
                  </div>
                </label>

                {/* Track Clicks */}
                <label className="campaign-checkbox-card">
                  <input
                    type="checkbox"
                    className="campaign-checkbox"
                    checked={trackingOptions?.track_clicks ?? true}
                    onChange={(e) =>
                      setTrackingOptions({
                        ...trackingOptions,
                        track_clicks: e.target.checked,
                      })
                    }
                  />
                  <div className="campaign-checkbox-text">
                    <span className="campaign-checkbox-label">Track link clicks</span>
                    <span className="campaign-checkbox-desc">
                      Monitors link clicks using transparent TLS redirection without triggering browser security warnings.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
