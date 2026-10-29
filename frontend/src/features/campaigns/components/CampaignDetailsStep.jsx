import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { PREDEFINED_TAGS } from '../campaignConstants';
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
  emailAccountId,
  setEmailAccountId,
  receiverName,
  setReceiverName,
  receiverEmail,
  setReceiverEmail,
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

  useEffect(() => {
    let isMounted = true;

    const fetchSenders = async () => {
      setLoadingSenders(true);
      setSenderLoadError(null);
      try {
        const senders = await campaignsApi.getSenderIdentities();
        if (!isMounted) return;

        const availableSenders = Array.isArray(senders) ? senders : [];
        setSenderIdentities(availableSenders);

        if (availableSenders.length > 0) {
          let matched = null;
          if (emailAccountId) {
            matched = availableSenders.find((sender) => String(sender.id) === String(emailAccountId));
          }
          if (!matched && fromEmail) {
            matched = availableSenders.find((sender) => sender.email === fromEmail);
          }
          if (!matched) matched = availableSenders[0];

          if (matched) {
            if (setEmailAccountId) setEmailAccountId(matched.id);
            setFromEmail(matched.email || '');
            if (!fromName || !fromName.trim()) setFromName(matched.name || '');
            if (matched.reply_to && (!replyTo || !replyTo.trim())) {
              setReplyTo(matched.reply_to);
              setShowReplyTo(matched.reply_to !== matched.email);
            }
            if (matched.receiver_name && (!receiverName || !receiverName.trim()) && setReceiverName) {
              setReceiverName(matched.receiver_name);
            }
            if (matched.receiver_email && (!receiverEmail || !receiverEmail.trim()) && setReceiverEmail) {
              setReceiverEmail(matched.receiver_email);
            }
          }
        }
      } catch (error) {
        if (isMounted) setSenderLoadError(error?.message || 'Failed to load sender accounts.');
      } finally {
        if (isMounted) setLoadingSenders(false);
      }
    };

    fetchSenders();
    return () => {
      isMounted = false;
    };
    // Sender defaults are intentionally applied once when the step mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
      setNewTagInput('');
    }
  };

  const handleAddPredefinedTag = (tag) => {
    if (!selectedTags.includes(tag)) setSelectedTags([...selectedTags, tag]);
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  const handleSenderIdentityChange = (event) => {
    const selectedEmail = event.target.value;
    const matched = senderIdentities.find((sender) => sender.email === selectedEmail);
    setFromEmail(selectedEmail);

    if (matched) {
      if (setEmailAccountId) setEmailAccountId(matched.id);
      setFromName(matched.name || '');
      if (matched.reply_to) {
        setReplyTo(matched.reply_to);
        setShowReplyTo(matched.reply_to !== selectedEmail);
      } else {
        setReplyTo(selectedEmail);
        setShowReplyTo(false);
      }
      const resolvedReceiver = (matched.receiver_name && matched.receiver_name.trim()) ? matched.receiver_name.trim() : (matched.name ? matched.name.trim() : '');
      if (setReceiverName) setReceiverName(resolvedReceiver);
      if (setReceiverEmail) setReceiverEmail(matched.receiver_email || '');
    }

    if (clearFieldError) {
      clearFieldError('fromEmail');
      clearFieldError('fromName');
      clearFieldError('receiverEmail');
    }
  };

  return (
    <div className="campaign-step-container campaign-details-step">
      <div className="campaign-details-grid">
        {/* Campaign basics */}
        <section className="campaign-card campaign-card-padded campaign-details-panel">
          <div className="campaign-section-header">
            <div className="campaign-details-section-icon" aria-hidden="true">01</div>
            <div>
              <h2 className="campaign-section-title">Campaign Information</h2>
              <p className="campaign-section-subtitle">
                Set the campaign name and the message recipients will see in their inbox.
              </p>
            </div>
          </div>

          <div className="campaign-form-stack">
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
                onChange={(event) => {
                  setCampaignName(event.target.value);
                  if (clearFieldError) clearFieldError('name');
                }}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'campaign-name-error' : 'campaign-name-help'}
              />
              {fieldErrors.name ? (
                <span id="campaign-name-error" className="campaign-field-error" role="alert">{fieldErrors.name}</span>
              ) : (
                <span id="campaign-name-help" className="campaign-helper-text">
                  Internal name used in reporting, analytics, and activity logs.
                </span>
              )}
            </div>

            <div className="campaign-field-group">
              <div className="campaign-field-label-row">
                <label htmlFor="campaign-subject-input" className="campaign-label">
                  Email Subject Line <span className="campaign-label-required">*</span>
                </label>
                <span className="campaign-char-counter">{subject.length}/60</span>
              </div>
              <input
                id="campaign-subject-input"
                type="text"
                maxLength={150}
                className={`campaign-input ${fieldErrors.subject ? 'campaign-input-error' : ''}`}
                placeholder="e.g. Faculty collaboration opportunity"
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  if (clearFieldError) clearFieldError('subject');
                }}
                aria-invalid={Boolean(fieldErrors.subject)}
                aria-describedby={fieldErrors.subject ? 'campaign-subject-error' : 'campaign-subject-help'}
              />
              {fieldErrors.subject ? (
                <span id="campaign-subject-error" className="campaign-field-error" role="alert">{fieldErrors.subject}</span>
              ) : (
                <span id="campaign-subject-help" className="campaign-helper-text">
                  Aim for a clear, specific subject line of about 60 characters or fewer.
                </span>
              )}
            </div>

            <div className="campaign-field-group">
              <div className="campaign-field-label-row">
                <label htmlFor="campaign-preview-text-input" className="campaign-label">Preview Text (Preheader)</label>
                <span className="campaign-char-counter">{previewText.length}/90</span>
              </div>
              <input
                id="campaign-preview-text-input"
                type="text"
                className="campaign-input"
                placeholder="A short summary shown beside the subject in the inbox"
                value={previewText}
                onChange={(event) => setPreviewText(event.target.value)}
                maxLength={120}
              />
              <span className="campaign-helper-text">Use this space to give recipients a reason to open your email.</span>
            </div>
          </div>
        </section>

        {/* Sender setup */}
        <section className="campaign-card campaign-card-padded campaign-details-panel">
          <div className="campaign-section-header">
            <div className="campaign-details-section-icon" aria-hidden="true">02</div>
            <div>
              <h2 className="campaign-section-title">Sender Configuration</h2>
              <p className="campaign-section-subtitle">
                Choose the sending identity and configure how recipients can reply.
              </p>
            </div>
          </div>

          <div className="campaign-form-stack">
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
                onChange={(event) => {
                  setFromName(event.target.value);
                  if (clearFieldError) clearFieldError('fromName');
                }}
                aria-invalid={Boolean(fieldErrors.fromName)}
              />
              {fieldErrors.fromName && <span className="campaign-field-error" role="alert">{fieldErrors.fromName}</span>}
            </div>

            <div className="campaign-field-group">
              <div className="campaign-field-label-row">
                <label htmlFor="campaign-from-email" className="campaign-label">
                  Sender Email <span className="campaign-label-required">*</span>
                </label>
                {fromEmail && !loadingSenders && !senderLoadError && senderIdentities.length > 0 && (
                  <span className="campaign-verified-badge campaign-sender-identity-badge">
                    <ShieldCheck size={13} />
                    <span>Saved sender identity</span>
                  </span>
                )}
              </div>

              {loadingSenders ? (
                <div className="campaign-sender-status campaign-sender-status-loading" role="status">
                  <RefreshCw size={15} className="campaign-spin-icon" />
                  <span>Loading sender identities…</span>
                </div>
              ) : senderLoadError ? (
                <div className="campaign-sender-status campaign-sender-status-error" role="alert">
                  <AlertTriangle size={15} />
                  <span>{senderLoadError}</span>
                </div>
              ) : senderIdentities.length === 0 ? (
                <div className="campaign-sender-status campaign-sender-status-empty">
                  <div className="campaign-sender-status-heading"><AlertTriangle size={16} /><strong>No sender accounts available</strong></div>
                  <p>Add a sender account before attempting to send a campaign.</p>
                  {onNavigate && (
                    <button type="button" onClick={() => onNavigate('email-accounts')} className="campaign-micro-btn campaign-micro-btn-blue">
                      <Send size={13} /><span>Manage Email Accounts</span>
                    </button>
                  )}
                </div>
              ) : (
                <select
                  id="campaign-from-email"
                  className={`campaign-select ${fieldErrors.fromEmail ? 'campaign-input-error' : ''}`}
                  value={fromEmail || ''}
                  onChange={handleSenderIdentityChange}
                  aria-invalid={Boolean(fieldErrors.fromEmail)}
                >
                  {senderIdentities.map((sender) => (
                    <option key={sender.id ?? sender.email} value={sender.email}>
                      {sender.email}{sender.name ? ` — ${sender.name}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.fromEmail && <span className="campaign-field-error" role="alert">{fieldErrors.fromEmail}</span>}
              <span className="campaign-helper-text">The email address recipients will see as the sender. Verification status is managed by your email account settings.</span>
            </div>

            <div className="campaign-field-group campaign-reply-to-field">
              {!showReplyTo ? (
                <button type="button" onClick={() => setShowReplyTo(true)} className="campaign-inline-action-btn">
                  <Plus size={14} /><span>Configure a different Reply-To address</span>
                </button>
              ) : (
                <div className="campaign-nested-box">
                  <div className="campaign-field-label-row">
                    <label htmlFor="campaign-reply-to" className="campaign-label">Reply-To Address</label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReplyTo(false);
                        setReplyTo(fromEmail);
                      }}
                      className="campaign-text-link-danger"
                    >Remove</button>
                  </div>
                  <input
                    id="campaign-reply-to"
                    type="email"
                    className="campaign-input"
                    placeholder="e.g. replies@sitechseries.org"
                    value={replyTo || ''}
                    onChange={(event) => setReplyTo(event.target.value)}
                  />
                  <span className="campaign-helper-text">Replies will go to this address instead of the sender address.</span>
                </div>
              )}
            </div>

            <div className="campaign-details-subsection">
              <h3 className="campaign-details-subsection-title">Default recipient details <span>Optional</span></h3>
              <p className="campaign-helper-text campaign-details-subsection-help">
                Defaults associated with the selected sender account. The actual campaign audience is selected in the Audience step.
              </p>
              <div className="campaign-two-col-grid">
                <div className="campaign-field-group">
                  <label htmlFor="campaign-receiver-name" className="campaign-label">Default Recipient Name</label>
                  <input
                    id="campaign-receiver-name"
                    type="text"
                    className="campaign-input"
                    placeholder="e.g. Dr. Recipient Name"
                    value={receiverName || ''}
                    onChange={(event) => setReceiverName && setReceiverName(event.target.value)}
                  />
                </div>
                <div className="campaign-field-group">
                  <label htmlFor="campaign-receiver-email" className="campaign-label">Default Recipient Email</label>
                  <input
                    id="campaign-receiver-email"
                    type="email"
                    className={`campaign-input ${fieldErrors.receiverEmail ? 'campaign-input-error' : ''}`}
                    placeholder="e.g. recipient@university.edu"
                    value={receiverEmail || ''}
                    onChange={(event) => {
                      if (setReceiverEmail) setReceiverEmail(event.target.value);
                      if (clearFieldError) clearFieldError('receiverEmail');
                    }}
                    aria-invalid={Boolean(fieldErrors.receiverEmail)}
                  />
                  {fieldErrors.receiverEmail && <span className="campaign-field-error" role="alert">{fieldErrors.receiverEmail}</span>}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tags and categorization */}
        <section className="campaign-card campaign-card-padded campaign-details-panel campaign-details-tags-panel">
          <div className="campaign-section-header">
            <div className="campaign-details-section-icon" aria-hidden="true"><Tag size={16} /></div>
            <div>
              <h2 className="campaign-section-title">Campaign Tags</h2>
              <p className="campaign-section-subtitle">Organize campaigns for easier searching and reporting.</p>
            </div>
          </div>

          {selectedTags.length > 0 && (
            <div className="campaign-tag-pills-row" aria-label="Selected campaign tags">
              {selectedTags.map((tag) => (
                <span key={tag} className="campaign-tag-chip">
                  <Tag size={12} /><span>{tag}</span>
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="campaign-tag-remove-btn" aria-label={`Remove tag ${tag}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="campaign-tag-input-row">
            <input
              id="campaign-tags-input"
              type="text"
              className="campaign-input campaign-tag-input"
              placeholder="Add a tag, e.g. Faculty Outreach"
              value={newTagInput}
              onChange={(event) => setNewTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <button type="button" onClick={handleAddTag} className="campaign-action-btn-secondary campaign-tag-add-btn">
              <Plus size={14} /><span>Add Tag</span>
            </button>
          </div>

          <div className="campaign-predefined-tags">
            <span className="campaign-predefined-label">Suggested tags</span>
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
                    {isSelected && <Check size={11} />}<span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Engagement and tracking */}
        <section className="campaign-card campaign-card-padded campaign-details-panel campaign-details-tracking-panel">
          <button
            type="button"
            onClick={() => setShowAdditionalOptions((shown) => !shown)}
            className="campaign-accordion-toggle"
            aria-expanded={showAdditionalOptions}
            aria-controls="campaign-tracking-options"
          >
            <div className="campaign-accordion-toggle-left">
              <span className="campaign-details-section-icon" aria-hidden="true"><ShieldCheck size={16} /></span>
              <span className="campaign-details-tracking-heading">
                <span className="campaign-accordion-title">Engagement &amp; Tracking</span>
                <span className="campaign-section-subtitle">Choose which engagement metrics to collect.</span>
              </span>
              <span className="campaign-accordion-badge">
                {trackingOptions?.track_opens && trackingOptions?.track_clicks
                  ? 'Opens & clicks enabled'
                  : 'Customized'}
              </span>
            </div>
            {showAdditionalOptions ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          {showAdditionalOptions && (
            <div id="campaign-tracking-options" className="campaign-accordion-content">
              <div className="campaign-tracking-grid">
                <label className="campaign-checkbox-card">
                  <input
                    type="checkbox"
                    className="campaign-checkbox"
                    checked={trackingOptions?.track_opens ?? true}
                    onChange={(event) => setTrackingOptions({ ...trackingOptions, track_opens: event.target.checked })}
                  />
                  <div className="campaign-checkbox-text">
                    <span className="campaign-checkbox-label">Track email opens</span>
                    <span className="campaign-checkbox-desc">Measure opens using an email tracking pixel. Some email clients may block image-based tracking.</span>
                  </div>
                </label>
                <label className="campaign-checkbox-card">
                  <input
                    type="checkbox"
                    className="campaign-checkbox"
                    checked={trackingOptions?.track_clicks ?? true}
                    onChange={(event) => setTrackingOptions({ ...trackingOptions, track_clicks: event.target.checked })}
                  />
                  <div className="campaign-checkbox-text">
                    <span className="campaign-checkbox-label">Track link clicks</span>
                    <span className="campaign-checkbox-desc">Measure clicks on links in the campaign to understand recipient engagement.</span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
