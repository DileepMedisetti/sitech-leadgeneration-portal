import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  Code2,
  Monitor,
  Smartphone,
  Eye,
  Check,
  AlertTriangle,
  Info,
  FileCode,
  FileText,
} from 'lucide-react';
import { CURATED_TEMPLATES, PERSONALIZATION_TOKENS, renderPersonalizedText } from '../campaignConstants';

export default function EmailDesignStep({
  editorMode = 'template_gallery',
  setEditorMode,
  selectedTemplateId = 'research_collab',
  setSelectedTemplateId,
  htmlContent,
  setHtmlContent,
  plainText,
  setPlainText,
  subject,
  setSubject,
  previewText,
  setPreviewText,
  fromName,
  fromEmail,
  fieldErrors = {},
  clearFieldError,
}) {
  const [devicePreview, setDevicePreview] = useState('desktop'); // 'desktop' | 'mobile'
  const [editorSubTab, setEditorSubTab] = useState('html'); // 'html' | 'plaintext' | 'preview'
  const [validationWarning, setValidationWarning] = useState(null);

  const textareaRef = useRef(null);

  // Auto-initialize with first template if htmlContent is empty
  useEffect(() => {
    if (!htmlContent || htmlContent.trim() === '') {
      const defaultTmpl = CURATED_TEMPLATES.find((t) => t.id === selectedTemplateId) || CURATED_TEMPLATES[0];
      if (defaultTmpl) {
        setHtmlContent(defaultTmpl.html_content);
        setPlainText(defaultTmpl.plain_text);
        if (!subject || subject.trim() === '') {
          setSubject(defaultTmpl.subject);
        }
        if (!previewText || previewText.trim() === '') {
          setPreviewText(defaultTmpl.preview_text);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validation feedback for HTML editor
  useEffect(() => {
    if (editorMode === 'html_editor') {
      if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(htmlContent)) {
        setValidationWarning('Script tags are blocked by mail servers and spam filters. Please remove <script> tags.');
      } else if (htmlContent && !htmlContent.includes('{{unsubscribe_url}}')) {
        setValidationWarning('Notice: Missing {{unsubscribe_url}} token. Recommended for CAN-SPAM and GDPR compliance.');
      } else {
        setValidationWarning(null);
      }
    } else {
      setValidationWarning(null);
    }
  }, [htmlContent, editorMode]);

  const handleSelectTemplate = (template) => {
    setSelectedTemplateId(template.id);
    setHtmlContent(template.html_content);
    setPlainText(template.plain_text);
    if (!subject || subject.trim() === '') {
      setSubject(template.subject);
    }
    if (!previewText || previewText.trim() === '') {
      setPreviewText(template.preview_text);
    }
    if (clearFieldError) clearFieldError('content');
  };

  const handleInsertTokenToEditor = (token) => {
    const textarea = textareaRef.current;
    if (editorSubTab === 'html') {
      if (!textarea) {
        setHtmlContent((prev) => (prev ? prev + token : token));
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const next = htmlContent.substring(0, start) + token + htmlContent.substring(end);
      setHtmlContent(next);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      if (!textarea) {
        setPlainText((prev) => (prev ? prev + token : token));
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const next = plainText.substring(0, start) + token + plainText.substring(end);
      setPlainText(next);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    }
    if (clearFieldError) clearFieldError('content');
  };

  // Helper to render sanitized email preview HTML with automatic personalization
  const renderPreviewHtml = () => {
    const raw = htmlContent || '<p style="color:#94a3b8;text-align:center;padding:40px;">No email content provided.</p>';
    const sanitized = raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return renderPersonalizedText(sanitized);
  };

  return (
    <div className="campaign-step-container">
      {/* 1. Method Selection Segmented Control */}
      <div className="campaign-mode-switcher-container">
        <div className="campaign-mode-grid">
          {/* Option A: Template Gallery */}
          <button
            type="button"
            onClick={() => setEditorMode('template_gallery')}
            className={`campaign-mode-card ${
              editorMode === 'template_gallery' ? 'mode-card-selected' : ''
            }`}
          >
            <div className="campaign-mode-card-icon">
              <Layout size={20} />
            </div>
            <div className="campaign-mode-card-body">
              <div className="campaign-mode-card-title-row">
                <span className="campaign-mode-card-title">Template Gallery</span>
                {editorMode === 'template_gallery' && (
                  <span className="campaign-mode-active-indicator">
                    <Check size={12} strokeWidth={3} /> Active
                  </span>
                )}
              </div>
              <p className="campaign-mode-card-desc">
                Choose from pre-built, high-converting academic templates curated for faculty collaboration and symposiums.
              </p>
            </div>
          </button>

          {/* Option B: HTML Editor */}
          <button
            type="button"
            onClick={() => setEditorMode('html_editor')}
            className={`campaign-mode-card ${
              editorMode === 'html_editor' ? 'mode-card-selected' : ''
            }`}
          >
            <div className="campaign-mode-card-icon">
              <Code2 size={20} />
            </div>
            <div className="campaign-mode-card-body">
              <div className="campaign-mode-card-title-row">
                <span className="campaign-mode-card-title">HTML Editor</span>
                {editorMode === 'html_editor' && (
                  <span className="campaign-mode-active-indicator">
                    <Check size={12} strokeWidth={3} /> Active
                  </span>
                )}
              </div>
              <p className="campaign-mode-card-desc">
                Copy and paste custom HTML code or write inline markup with deliverability tokens and live preview.
              </p>
            </div>
          </button>
        </div>
      </div>

      {fieldErrors.content && (
        <div className="campaign-inline-alert campaign-inline-alert-danger" role="alert">
          <AlertTriangle size={16} />
          <span>{fieldErrors.content}</span>
        </div>
      )}

      {/* 2. Primary Workspace based on Active Selection */}
      {editorMode === 'template_gallery' ? (
        /* Template Gallery 2-Column Responsive Workspace */
        <div className="campaign-design-split-grid">
          {/* Left Column: Template Selection Cards */}
          <div className="campaign-card campaign-card-padded campaign-template-list-card">
            <div className="campaign-section-header">
              <h3 className="campaign-section-title">Select Template</h3>
              <p className="campaign-section-subtitle">
                Click any template to load its content into your outreach message.
              </p>
            </div>

            <div className="campaign-template-cards-stack">
              {CURATED_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectTemplate(tmpl)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectTemplate(tmpl);
                      }
                    }}
                    className={`campaign-template-row-card ${
                      isSelected ? 'template-card-selected' : ''
                    }`}
                  >
                    <div className="campaign-template-row-top">
                      <span className="campaign-template-category-badge">
                        {tmpl.category}
                      </span>
                      {isSelected ? (
                        <span className="campaign-template-selected-badge">
                          <Check size={12} strokeWidth={3} /> Selected
                        </span>
                      ) : (
                        <span className="campaign-template-select-action">
                          Select
                        </span>
                      )}
                    </div>

                    <h4 className="campaign-template-title">{tmpl.name}</h4>
                    <p className="campaign-template-desc">{tmpl.description}</p>

                    <div className="campaign-template-meta-row">
                      <span className="campaign-template-subject-preview">
                        <strong>Subject:</strong> {tmpl.subject}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Email Preview Panel */}
          <div className="campaign-card campaign-preview-card">
            {/* Preview Toolbar */}
            <div className="campaign-preview-toolbar">
              <div className="campaign-preview-toolbar-title">
                <Eye size={15} />
                <span>Live Preview</span>
              </div>

              {/* Desktop / Mobile view toggle */}
              <div className="campaign-device-toggle-group">
                <button
                  type="button"
                  onClick={() => setDevicePreview('desktop')}
                  className={`campaign-device-btn ${
                    devicePreview === 'desktop' ? 'device-btn-active' : ''
                  }`}
                  title="Desktop Preview"
                  aria-label="Desktop Preview"
                >
                  <Monitor size={14} />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDevicePreview('mobile')}
                  className={`campaign-device-btn ${
                    devicePreview === 'mobile' ? 'device-btn-active' : ''
                  }`}
                  title="Mobile View"
                  aria-label="Mobile View"
                >
                  <Smartphone size={14} />
                  <span>Mobile</span>
                </button>
              </div>
            </div>

            {/* Simulated Email Client Header */}
            <div className="campaign-preview-inbox-header">
              <div className="campaign-inbox-header-row">
                <span className="campaign-inbox-header-label">Subject:</span>
                <span className="campaign-inbox-header-subject">
                  {renderPersonalizedText(subject) || '(No subject line configured)'}
                </span>
              </div>
              <div className="campaign-inbox-header-row">
                <span className="campaign-inbox-header-label">From:</span>
                <span className="campaign-inbox-header-value">
                  {fromName || 'Sitech Outreach'} &lt;{fromEmail || 'outreach@sitechseries.org'}&gt;
                </span>
              </div>
              {previewText && (
                <div className="campaign-inbox-header-row">
                  <span className="campaign-inbox-header-label">Preview:</span>
                  <span className="campaign-inbox-header-preheader">{renderPersonalizedText(previewText)}</span>
                </div>
              )}
            </div>

            {/* Rendered Email Body Canvas */}
            <div className="campaign-preview-body-wrapper">
              <div
                className={
                  devicePreview === 'mobile'
                    ? 'campaign-device-frame-mobile'
                    : 'campaign-device-frame-desktop'
                }
              >
                <div
                  className="campaign-email-render-target"
                  dangerouslySetInnerHTML={{ __html: renderPreviewHtml() }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* HTML Code Editor Workspace */
        <div className="campaign-card campaign-card-padded campaign-code-workspace">
          {/* Code Editor Header & Quick Personalization Toolbar */}
          <div className="campaign-code-toolbar">
            <div className="campaign-code-tabs">
              <button
                type="button"
                onClick={() => setEditorSubTab('html')}
                className={`campaign-code-tab ${
                  editorSubTab === 'html' ? 'code-tab-active' : ''
                }`}
              >
                <FileCode size={14} />
                <span>HTML Code</span>
              </button>
              <button
                type="button"
                onClick={() => setEditorSubTab('plaintext')}
                className={`campaign-code-tab ${
                  editorSubTab === 'plaintext' ? 'code-tab-active' : ''
                }`}
              >
                <FileText size={14} />
                <span>Plain Text Fallback</span>
              </button>
              <button
                type="button"
                onClick={() => setEditorSubTab('preview')}
                className={`campaign-code-tab ${
                  editorSubTab === 'preview' ? 'code-tab-active' : ''
                }`}
              >
                <Eye size={14} />
                <span>Rendered Preview</span>
              </button>
            </div>

            {/* Quick Personalization Token Insertion */}
            <div className="campaign-code-tokens-bar">
              <span className="campaign-code-token-label">Insert Token:</span>
              <div className="campaign-code-token-chips">
                {PERSONALIZATION_TOKENS.map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    onClick={() => handleInsertTokenToEditor(item.token)}
                    className="campaign-token-insert-pill"
                    title={`Insert ${item.label} tag`}
                  >
                    <span>{item.token}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Validation Notice if applicable */}
          {validationWarning && (
            <div className="campaign-code-notice">
              <Info size={15} />
              <span>{validationWarning}</span>
            </div>
          )}

          {/* SubTab Views */}
          {editorSubTab === 'html' && (
            <div className="campaign-editor-box">
              <textarea
                ref={textareaRef}
                className="campaign-code-textarea"
                value={htmlContent}
                onChange={(e) => {
                  setHtmlContent(e.target.value);
                  if (clearFieldError) clearFieldError('content');
                }}
                placeholder="<!-- Paste your responsive HTML code here... -->"
                spellCheck={false}
              />
              <div className="campaign-editor-footer-info">
                <span>{htmlContent.length} characters</span>
                <span>Responsive table markup with inline CSS recommended for optimal deliverability</span>
              </div>
            </div>
          )}

          {editorSubTab === 'plaintext' && (
            <div className="campaign-editor-box">
              <textarea
                ref={textareaRef}
                className="campaign-code-textarea"
                value={plainText}
                onChange={(e) => setPlainText(e.target.value)}
                placeholder="Plain text version delivered to legacy or text-only mail clients..."
                spellCheck={false}
              />
              <div className="campaign-editor-footer-info">
                <span>{plainText.length} characters</span>
                <span>Optional plain text fallback ensures maximum accessibility</span>
              </div>
            </div>
          )}

          {editorSubTab === 'preview' && (
            <div className="campaign-rendered-preview-container">
              <div className="campaign-preview-toolbar" style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  Live Rendered HTML Preview
                </span>
                <div className="campaign-device-toggle-group">
                  <button
                    type="button"
                    onClick={() => setDevicePreview('desktop')}
                    className={`campaign-device-btn ${devicePreview === 'desktop' ? 'device-btn-active' : ''}`}
                  >
                    <Monitor size={14} /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevicePreview('mobile')}
                    className={`campaign-device-btn ${devicePreview === 'mobile' ? 'device-btn-active' : ''}`}
                  >
                    <Smartphone size={14} /> Mobile
                  </button>
                </div>
              </div>

              <div className="campaign-preview-body-wrapper" style={{ minHeight: '440px', padding: '24px' }}>
                <div className={devicePreview === 'mobile' ? 'campaign-device-frame-mobile' : 'campaign-device-frame-desktop'}>
                  <div
                    className="campaign-email-render-target"
                    dangerouslySetInnerHTML={{ __html: renderPreviewHtml() }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
