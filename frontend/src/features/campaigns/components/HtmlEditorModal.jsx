import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  X,
  Code2,
  FileText,
  Sparkles,
  Check,
  AlertTriangle,
  Eye,
  Columns,
  Maximize2,
  Minimize2,
} from 'lucide-react';

const PERSONALIZATION_TOKENS = [
  { token: '{{name}}', label: 'Full Name' },
  { token: '{{first_name}}', label: 'First Name' },
  { token: '{{last_name}}', label: 'Last Name' },
  { token: '{{university}}', label: 'University' },
  { token: '{{department}}', label: 'Department' },
  { token: '{{profession}}', label: 'Profession / Title' },
  { token: '{{country}}', label: 'Country' },
  { token: '{{unsubscribe_url}}', label: 'Unsubscribe Link URL' },
];

export default function HtmlEditorModal({
  isOpen,
  onClose,
  initialHtml = '',
  initialPlainText = '',
  onSave,
}) {
  const [activeTab, setActiveTab] = useState('html'); // 'html' | 'plaintext'
  const [htmlCode, setHtmlCode] = useState(initialHtml);
  const [plainTextCode, setPlainTextCode] = useState(initialPlainText);
  const [showPreviewPane, setShowPreviewPane] = useState(true);
  const [showTokenMenu, setShowTokenMenu] = useState(false);
  const [validationWarning, setValidationWarning] = useState(null);

  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setHtmlCode(initialHtml || '');
      setPlainTextCode(initialPlainText || '');
    }
  }, [isOpen, initialHtml, initialPlainText]);

  // Validate HTML on edit
  useEffect(() => {
    if (activeTab === 'html') {
      if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(htmlCode)) {
        setValidationWarning('Warning: Script tags are blocked by mail clients and deliverability analyzers.');
      } else if (htmlCode && !htmlCode.includes('{{unsubscribe_url}}')) {
        setValidationWarning('Notice: Missing {{unsubscribe_url}} token. Recommended for compliance.');
      } else {
        setValidationWarning(null);
      }
    } else {
      setValidationWarning(null);
    }
  }, [htmlCode, activeTab]);

  if (!isOpen) return null;

  const handleInsertToken = (token) => {
    setShowTokenMenu(false);
    const textarea = textareaRef.current;
    if (activeTab === 'html') {
      if (!textarea) {
        setHtmlCode((prev) => prev + token);
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const next = htmlCode.substring(0, start) + token + htmlCode.substring(end);
      setHtmlCode(next);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      if (!textarea) {
        setPlainTextCode((prev) => prev + token);
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const next = plainTextCode.substring(0, start) + token + plainTextCode.substring(end);
      setPlainTextCode(next);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    }
  };

  const handleFormatHtml = () => {
    // Simple indentation / cleanup helper
    let formatted = htmlCode
      .replace(/>\s*</g, '>\n<')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
    setHtmlCode(formatted);
  };

  const handleSaveAndContinue = () => {
    onSave({
      html_content: htmlCode,
      plain_text: plainTextCode,
    });
    onClose();
  };

  const lineCount = (activeTab === 'html' ? htmlCode : plainTextCode).split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1280px',
          height: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div style={{ height: '20px', width: '1px', backgroundColor: '#e2e8f0' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              Copy & paste editor
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar & Tab Bar */}
        <div
          style={{
            padding: '10px 24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Tab Selectors */}
          <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('html')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'html' ? '#ffffff' : 'transparent',
                color: activeTab === 'html' ? '#2563eb' : '#64748b',
                boxShadow: activeTab === 'html' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <Code2 size={15} /> HTML Version
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('plaintext')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'plaintext' ? '#ffffff' : 'transparent',
                color: activeTab === 'plaintext' ? '#2563eb' : '#64748b',
                boxShadow: activeTab === 'plaintext' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <FileText size={15} /> Plain Text Version
            </button>
          </div>

          {/* Action Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
            {/* Personalization Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowTokenMenu(!showTokenMenu)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#1e293b',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>&#123; &#125; Personalisation</span>
              </button>

              {showTokenMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    width: '240px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    padding: '6px',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', padding: '6px 10px' }}>
                    CLICK TO INSERT TOKEN
                  </div>
                  {PERSONALIZATION_TOKENS.map((t) => (
                    <div
                      key={t.token}
                      onClick={() => handleInsertToken(t.token)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{t.label}</span>
                      <code style={{ fontSize: '11px', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 4px', borderRadius: '4px' }}>
                        {t.token}
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Unsubscribe Button */}
            <button
              type="button"
              onClick={() => handleInsertToken('<a href="{{unsubscribe_url}}">Unsubscribe</a>')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Insert CAN-SPAM compliant unsubscribe link"
            >
              + Unsubscribe Link
            </button>

            {/* Format HTML */}
            {activeTab === 'html' && (
              <button
                type="button"
                onClick={handleFormatHtml}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Format HTML
              </button>
            )}

            {/* Toggle Preview Pane */}
            {activeTab === 'html' && (
              <button
                type="button"
                onClick={() => setShowPreviewPane(!showPreviewPane)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: showPreviewPane ? '#eff6ff' : '#ffffff',
                  borderColor: showPreviewPane ? '#bfdbfe' : '#cbd5e1',
                  color: showPreviewPane ? '#2563eb' : '#475569',
                  border: '1px solid',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Columns size={14} /> {showPreviewPane ? 'Hide Preview' : 'Split Preview'}
              </button>
            )}
          </div>
        </div>

        {/* Validation Alert */}
        {validationWarning && (
          <div
            style={{
              padding: '8px 24px',
              backgroundColor: '#fffbeb',
              borderBottom: '1px solid #fef3c7',
              color: '#b45309',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangle size={15} />
            <span>{validationWarning}</span>
          </div>
        )}

        {/* Editor Main Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', backgroundColor: '#ffffff' }}>
          {/* Code Editor with Line Numbers */}
          <div
            style={{
              flex: activeTab === 'html' && showPreviewPane ? '0 0 55%' : '1 1 100%',
              display: 'flex',
              overflow: 'hidden',
              borderRight: activeTab === 'html' && showPreviewPane ? '1px solid #e2e8f0' : 'none',
              backgroundColor: '#fafafa',
            }}
          >
            {/* Line numbers bar */}
            <div
              style={{
                width: '44px',
                padding: '16px 8px',
                backgroundColor: '#f1f5f9',
                color: '#94a3b8',
                fontSize: '12px',
                fontFamily: 'ui-monospace, monospace',
                textAlign: 'right',
                userSelect: 'none',
                overflow: 'hidden',
                lineHeight: '1.5',
              }}
            >
              {lineNumbers.map((n) => (
                <div key={n}>{n}</div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={activeTab === 'html' ? htmlCode : plainTextCode}
              onChange={(e) => {
                if (activeTab === 'html') {
                  setHtmlCode(e.target.value);
                } else {
                  setPlainTextCode(e.target.value);
                }
              }}
              placeholder={
                activeTab === 'html'
                  ? 'Paste or type HTML code here...\nInclude {{unsubscribe_url}} for CAN-SPAM compliance.'
                  : 'Enter fallback plain-text email content...'
              }
              style={{
                flex: 1,
                padding: '16px',
                border: 'none',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '13px',
                lineHeight: '1.5',
                resize: 'none',
                whiteSpace: 'pre',
                overflowY: 'auto',
              }}
            />
          </div>

          {/* Live Preview Pane (for HTML) */}
          {activeTab === 'html' && showPreviewPane && (
            <div
              style={{
                flex: '0 0 45%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#f8fafc',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Eye size={14} /> Sanitized Email Preview
              </div>

              <div
                style={{
                  flex: 1,
                  padding: '24px',
                  overflowY: 'auto',
                  backgroundColor: '#ffffff',
                  margin: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {htmlCode ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: htmlCode
                        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                        .replace(/{{name}}/g, 'Dr. Margaret Hamilton')
                        .replace(/{{first_name}}/g, 'Margaret')
                        .replace(/{{university}}/g, 'MIT')
                        .replace(/{{department}}/g, 'Computer Science')
                        .replace(/{{unsubscribe_url}}/g, '#unsubscribe'),
                    }}
                  />
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    Live sanitized preview will appear here as you write HTML.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            <span>{(activeTab === 'html' ? htmlCode : plainTextCode).length} characters</span>
            <span style={{ margin: '0 8px' }}>·</span>
            <span>~{Math.round(new Blob([htmlCode]).size / 1024)} KB</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndContinue}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
              }}
            >
              <Check size={15} /> Save & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
