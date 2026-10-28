import React, { useRef } from 'react';
import { LayoutGrid, Code2, Upload } from 'lucide-react';
import { saveCampaignDraft } from '../campaignDraftStore';

export default function TemplateOptionCards({
  activeOption = 'gallery', // 'gallery' | 'html_editor'
  onNavigate,
  onImportSuccess,
  onError,
}) {
  const fileInputRef = useRef(null);

  const handleCardClick = (option) => {
    if (option === 'gallery') {
      if (activeOption !== 'gallery' && onNavigate) {
        onNavigate('campaign-templates');
      }
    } else if (option === 'html_editor') {
      if (activeOption !== 'html_editor' && onNavigate) {
        onNavigate('campaign-html-editor');
      }
    } else if (option === 'import') {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.html') && !lowerName.endsWith('.htm')) {
      const err = 'Only .html or .htm files are supported.';
      if (onError) onError(err);
      else alert(err);
      e.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      const err = 'File size exceeds the 2 MB limit.';
      if (onError) onError(err);
      else alert(err);
      e.target.value = '';
      return;
    }

    if (file.size === 0) {
      const err = 'File is empty.';
      if (onError) onError(err);
      else alert(err);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      if (!content || typeof content !== 'string' || !/<[a-z][\s\S]*>/i.test(content)) {
        const err = 'No valid HTML markup detected in file.';
        if (onError) onError(err);
        else alert(err);
        return;
      }

      const templateName = file.name.replace(/\.[^/.]+$/, '');
      saveCampaignDraft({
        htmlContent: content,
        selectedTemplateId: null,
        selectedTemplateName: templateName,
        editorMode: 'html_editor',
      });

      if (onImportSuccess) {
        onImportSuccess(content, templateName);
      } else if (onNavigate) {
        onNavigate('campaign-html-editor');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input to allow re-uploading same file if desired
  };

  return (
    <div className="template-option-cards-container">
      {/* Hidden File Input for Device Import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".html,.htm"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Card 1: Template Gallery */}
      <div
        className={`template-option-card ${activeOption === 'gallery' ? 'card-selected' : ''}`}
        onClick={() => handleCardClick('gallery')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick('gallery');
          }
        }}
      >
        <div className="template-option-card-left">
          <div className="template-option-icon-circle icon-gallery" aria-hidden="true">
            <LayoutGrid size={22} />
          </div>
          <div className="template-option-text-stack">
            <h3 className="template-option-title">Template Gallery</h3>
            <p className="template-option-desc">
              Choose from our professionally designed email templates.
            </p>
          </div>
        </div>
        <div className="template-option-radio-indicator" aria-hidden="true">
          {activeOption === 'gallery' ? (
            <span className="radio-dot-active" />
          ) : (
            <span className="radio-dot-inactive" />
          )}
        </div>
      </div>

      {/* Card 2: Custom HTML Editor */}
      <div
        className={`template-option-card ${activeOption === 'html_editor' ? 'card-selected' : ''}`}
        onClick={() => handleCardClick('html_editor')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick('html_editor');
          }
        }}
      >
        <div className="template-option-card-left">
          <div className="template-option-icon-circle icon-editor" aria-hidden="true">
            <Code2 size={22} />
          </div>
          <div className="template-option-text-stack">
            <h3 className="template-option-title">Custom HTML Editor</h3>
            <p className="template-option-desc">
              Create your own email template using our HTML editor.
            </p>
          </div>
        </div>
        <div className="template-option-radio-indicator" aria-hidden="true">
          {activeOption === 'html_editor' ? (
            <span className="radio-dot-active" />
          ) : (
            <span className="radio-dot-inactive" />
          )}
        </div>
      </div>

      {/* Card 3: Import from Device */}
      <div
        className="template-option-card"
        onClick={() => handleCardClick('import')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick('import');
          }
        }}
      >
        <div className="template-option-card-left">
          <div className="template-option-icon-circle icon-upload" aria-hidden="true">
            <Upload size={22} />
          </div>
          <div className="template-option-text-stack">
            <h3 className="template-option-title">Import from Device</h3>
            <p className="template-option-desc">
              Upload an existing HTML file from your device.
            </p>
          </div>
        </div>
        <div className="template-option-radio-indicator" aria-hidden="true">
          <span className="radio-dot-inactive" />
        </div>
      </div>
    </div>
  );
}

