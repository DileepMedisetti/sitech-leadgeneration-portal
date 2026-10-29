import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  Code2,
  Eye,
  RotateCcw,
  Copy,
  Monitor,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import {
  STARTER_HTML_CODE,
  highlightHtmlCode,
  renderPersonalizedText,
  SAMPLE_RECIPIENT,
} from '../campaignConstants';
import { getCampaignDraft, saveCampaignDraft } from '../campaignDraftStore';
import TemplateOptionCards from '../templates/TemplateOptionCards';

export default function CustomHtmlEditorPage({ onNavigate }) {
  const draft = getCampaignDraft();

  // Load initial HTML from draft if available, otherwise use STARTER_HTML_CODE
  const [htmlCode, setHtmlCode] = useState(() => {
    return (draft.htmlContent && draft.htmlContent.trim() !== '')
      ? draft.htmlContent
      : STARTER_HTML_CODE;
  });

  const [initialHtml] = useState(() => {
    return (draft.htmlContent && draft.htmlContent.trim() !== '')
      ? draft.htmlContent
      : STARTER_HTML_CODE;
  });

  const [debouncedHtml, setDebouncedHtml] = useState(htmlCode);
  const [deviceMode, setDeviceMode] = useState('desktop'); // 'desktop' | 'mobile'
  const [toastMessage, setToastMessage] = useState(null);

  const textareaRef = useRef(null);
  const preRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // Debounced live preview update (150ms for smooth editing)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedHtml(htmlCode);
    }, 150);
    return () => clearTimeout(timer);
  }, [htmlCode]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Synchronized scrolling between textarea, highlighted pre, and line numbers
  const handleScroll = (e) => {
    const { scrollTop, scrollLeft } = e.target;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  };

  // Handle Tab key insertion (2 spaces)
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const updated = val.substring(0, start) + '  ' + val.substring(end);
      setHtmlCode(updated);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Reset to initial HTML
  const handleReset = () => {
    if (htmlCode !== initialHtml) {
      if (window.confirm('Reset the HTML editor back to its initial content? Unsaved edits will be discarded.')) {
        setHtmlCode(initialHtml);
        showToast('Editor reset to initial content');
      }
    } else {
      setHtmlCode(STARTER_HTML_CODE);
      showToast('Editor reset to starter template');
    }
  };

  // Copy code to clipboard
  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(htmlCode);
      } else {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.select();
          document.execCommand('copy');
        }
      }
      showToast('HTML code copied to clipboard!');
    } catch {
      showToast('Failed to copy to clipboard.');
    }
  };

  // Calculate lines count for gutter
  const lineCount = useMemo(() => {
    return Math.max(1, htmlCode.split('\n').length);
  }, [htmlCode]);

  const lines = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1);
  }, [lineCount]);

  // Syntax highlighting HTML
  const highlightedCode = useMemo(() => {
    return highlightHtmlCode(htmlCode);
  }, [htmlCode]);

  // "Use This Template" Action
  const handleUseThisTemplate = () => {
    if (!htmlCode.trim()) {
      alert('HTML code cannot be empty.');
      return;
    }
    if (!/<[a-z][\s\S]*>/i.test(htmlCode)) {
      alert('Please provide valid HTML markup with opening and closing tags.');
      return;
    }

    saveCampaignDraft({
      htmlContent: htmlCode,
      selectedTemplateId: null,
      selectedTemplateName: 'Custom HTML',
      editorMode: 'html_editor',
      currentStep: 1,
    });

    if (onNavigate) {
      onNavigate('create-campaign');
    }
  };

  return (
    <div className="template-selection-page-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="template-toast-notification">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb Navigation */}
      <div className="template-top-nav">
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('campaign-templates')}
          className="template-back-link"
        >
          <ChevronLeft size={16} />
          <span>Back to Template Options</span>
        </button>
      </div>

      {/* Page Title & Subtitle */}
      <div className="template-page-header">
        <h1 className="template-page-title">Custom HTML Editor</h1>
        <p className="template-page-subtitle">
          Create your own email template using HTML. Write or paste your HTML code on the left and see the live preview on the right.
        </p>
      </div>

      {/* 3 Selection Cards across top */}
      <TemplateOptionCards
        activeOption="html_editor"
        onNavigate={onNavigate}
        onImportSuccess={(content, fileName) => {
          setHtmlCode(content);
          showToast(`Imported ${fileName} successfully!`);
        }}
        onError={(err) => {
          alert(err);
        }}
      />

      {/* Main Workspace: Two Panels Side by Side */}
      <div className="custom-html-editor-workspace">
        {/* ========================================================================= */}
        {/* LEFT PANEL: HTML Editor                                                   */}
        {/* ========================================================================= */}
        <div className="custom-editor-panel">
          <div className="custom-editor-panel-header">
            <div className="panel-header-left">
              <div className="panel-header-icon-badge" aria-hidden="true">
                <Code2 size={18} />
              </div>
              <div>
                <h2 className="panel-header-title">HTML Editor</h2>
                <p className="panel-header-subtitle">
                  Write or paste your HTML code for your email template.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="custom-editor-reset-btn"
              title="Reset editor code"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>

          {/* Code Box with Gutter & Overlay Syntax Highlighter */}
          <div className="custom-editor-box-container">
            {/* Copy Button at top right of editor box */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="custom-editor-copy-btn"
              title="Copy HTML to clipboard"
              aria-label="Copy code"
            >
              <Copy size={15} />
            </button>

            {/* Line Numbers Gutter */}
            <div ref={lineNumbersRef} className="custom-editor-line-numbers" aria-hidden="true">
              {lines.map((num) => (
                <div key={num} className="line-num-item">
                  {num}
                </div>
              ))}
            </div>

            {/* Code Wrapper: Overlay Pre & Textarea */}
            <div className="custom-editor-code-wrapper">
              <pre
                ref={preRef}
                className="custom-editor-syntax-pre"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: highlightedCode + '\n' }}
              />
              <textarea
                ref={textareaRef}
                value={htmlCode}
                onChange={(e) => setHtmlCode(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                className="custom-editor-textarea"
                spellCheck="false"
                autoCapitalize="off"
                autoComplete="off"
                placeholder="Write or paste your HTML code here..."
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: Live Preview                                                 */}
        {/* ========================================================================= */}
        <div className="custom-editor-panel">
          <div className="custom-editor-panel-header">
            <div className="panel-header-left">
              <div className="panel-header-icon-badge" aria-hidden="true">
                <Eye size={18} />
              </div>
              <div>
                <h2 className="panel-header-title">Live Preview</h2>
                <p className="panel-header-subtitle">
                  See how your email template will look to recipients.
                </p>
              </div>
            </div>

            {/* Device Switcher Controls */}
            <div className="custom-preview-device-toggle" role="group" aria-label="Device Preview Mode">
              <button
                type="button"
                onClick={() => setDeviceMode('desktop')}
                className={`device-btn ${deviceMode === 'desktop' ? 'device-active' : ''}`}
                title="Desktop Preview"
                aria-pressed={deviceMode === 'desktop'}
              >
                <Monitor size={16} />
              </button>
              <button
                type="button"
                onClick={() => setDeviceMode('mobile')}
                className={`device-btn ${deviceMode === 'mobile' ? 'device-active' : ''}`}
                title="Mobile Preview"
                aria-pressed={deviceMode === 'mobile'}
              >
                <Smartphone size={16} />
              </button>
            </div>
          </div>

          {/* Browser Window Chrome Box */}
          <div className="custom-preview-window-box">
            {/* macOS Style Traffic Dots */}
            <div className="custom-window-dots-bar" aria-hidden="true">
              <span className="window-dot dot-red" />
              <span className="window-dot dot-yellow" />
              <span className="window-dot dot-green" />
            </div>

            {/* Live Sandboxed Rendered Iframe */}
            <div className={`custom-preview-viewport-wrapper mode-${deviceMode}`}>
              <iframe
                title="Live HTML email preview"
                srcDoc={renderPersonalizedText(debouncedHtml, SAMPLE_RECIPIENT)}
                className="custom-preview-iframe"
                sandbox=""
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="custom-editor-bottom-bar">
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('campaign-templates')}
          className="template-btn-back-options"
        >
          <ChevronLeft size={16} />
          <span>Back to Template Options</span>
        </button>

        <div className="custom-editor-bottom-actions-right">
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('create-campaign')}
            className="template-btn-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUseThisTemplate}
            className="template-btn-use"
          >
            Use This Template
          </button>
        </div>
      </div>
    </div>
  );
}
