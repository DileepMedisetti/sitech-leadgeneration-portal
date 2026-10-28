import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  Search,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { templatesApi } from '../../../services/api-client';
import {
  CURATED_TEMPLATES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_THEMES,
  renderPersonalizedText,
  SAMPLE_RECIPIENT,
} from '../campaignConstants';
import { getCampaignDraft, saveCampaignDraft } from '../campaignDraftStore';
import TemplateOptionCards from './TemplateOptionCards';

export default function TemplateGalleryPage({ onNavigate }) {
  const draft = getCampaignDraft();

  const [templates, setTemplates] = useState(CURATED_TEMPLATES);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedTheme, setSelectedTheme] = useState('All Themes');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Initialize selected template from draft if present, else default to 'product_update'
  const [selectedTemplate, setSelectedTemplate] = useState(() => {
    if (draft.selectedTemplateId) {
      const match = CURATED_TEMPLATES.find((t) => String(t.id) === String(draft.selectedTemplateId));
      if (match) return match;
    }
    return CURATED_TEMPLATES[0]; // 'product_update'
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch backend templates and merge with curated starter templates
  useEffect(() => {
    templatesApi
      .list({ page_size: 50 })
      .then((data) => {
        if (data && data.items && data.items.length > 0) {
          // Merge backend templates with curated templates ensuring curated templates come first
          const backendItems = data.items.map((item) => ({
            id: String(item.id),
            name: item.name,
            category: item.category || 'General',
            theme: item.theme || 'Modern',
            description: item.description || '',
            subject: item.subject_hint || '',
            preview_text: item.description || '',
            html_content: item.html_content,
            thumbnail_theme: item.thumbnail_theme || 'product_update',
          }));

          // Avoid duplicates by name
          const merged = [...CURATED_TEMPLATES];
          backendItems.forEach((bItem) => {
            if (!merged.some((m) => m.name.toLowerCase() === bItem.name.toLowerCase())) {
              merged.push(bItem);
            }
          });
          setTemplates(merged);
        }
      })
      .catch(() => {
        // Fallback to local curated templates
        setTemplates(CURATED_TEMPLATES);
      });
  }, []);

  // Filter templates by search query, category, and theme
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      // Category filter
      if (selectedCategory !== 'All Categories') {
        const catMatch = tpl.category && tpl.category.toLowerCase().includes(selectedCategory.toLowerCase());
        if (!catMatch) return false;
      }
      // Theme filter
      if (selectedTheme !== 'All Themes') {
        const themeMatch = tpl.theme && tpl.theme.toLowerCase() === selectedTheme.toLowerCase();
        if (!themeMatch) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = tpl.name && tpl.name.toLowerCase().includes(q);
        const descMatch = tpl.description && tpl.description.toLowerCase().includes(q);
        const catMatch = tpl.category && tpl.category.toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !catMatch) return false;
      }
      return true;
    });
  }, [templates, selectedCategory, selectedTheme, searchQuery]);

  // Handle template selection
  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
  };

  // Handle "Use This Template"
  const handleUseThisTemplate = () => {
    if (!selectedTemplate) return;

    saveCampaignDraft({
      selectedTemplateId: String(selectedTemplate.id),
      selectedTemplateName: selectedTemplate.name,
      htmlContent: selectedTemplate.html_content,
      subject: selectedTemplate.subject || undefined,
      previewText: selectedTemplate.preview_text || undefined,
      editorMode: 'template_gallery',
      currentStep: 1,
    });

    if (onNavigate) {
      onNavigate('create-campaign');
    }
  };

  // Render thumbnail banner for a template card matching the visual reference
  const renderThumbnailHeader = (tpl, isSelected) => {
    const theme = tpl.thumbnail_theme || (tpl.id ? String(tpl.id).toLowerCase() : 'product_update');

    return (
      <div className={`template-thumbnail-banner theme-${theme}`}>
        {/* Top-Right Checkmark Badge when Selected */}
        {isSelected && (
          <div className="template-thumbnail-selected-badge" aria-label="Selected">
            <CheckCircle2 size={20} className="check-icon-solid" />
          </div>
        )}

        {/* Thumbnail Illustration Content */}
        {theme === 'product_update' && (
          <div className="thumb-content-product-update">
            <div className="thumb-logo-line">
              <span className="thumb-logo-icon">▲</span>
              <span className="thumb-logo-text">Sitech Series</span>
            </div>
            <div className="thumb-heading-box">
              <span className="thumb-title">Exciting Updates</span>
              <span className="thumb-subtitle">from Sitech Series</span>
              <div className="thumb-mini-btn">Learn More</div>
            </div>
            <div className="thumb-graphic-chart">
              <div className="thumb-chart-badge">↗</div>
              <div className="thumb-chart-bars">
                <span className="c-bar h-1" />
                <span className="c-bar h-2" />
                <span className="c-bar h-3" />
              </div>
            </div>
          </div>
        )}

        {theme === 'newsletter' && (
          <div className="thumb-content-newsletter">
            <div className="thumb-logo-line text-white">
              <span className="thumb-logo-icon">▲</span>
              <span className="thumb-logo-text">Sitech Series</span>
            </div>
            <div className="thumb-heading-box text-white">
              <span className="thumb-title">Stay Ahead</span>
              <span className="thumb-subtitle">with Insights</span>
              <div className="thumb-mini-btn btn-blue">Read More</div>
            </div>
            <div className="thumb-laptop-graphic">
              <div className="laptop-screen">
                <span className="l-bar b-1" />
                <span className="l-bar b-2" />
                <span className="l-bar b-3" />
              </div>
              <div className="laptop-base" />
            </div>
          </div>
        )}

        {theme === 'event_invitation' && (
          <div className="thumb-content-event">
            <div className="thumb-logo-line text-orange">
              <span className="thumb-logo-icon">▲</span>
              <span className="thumb-logo-text">Sitech Series</span>
            </div>
            <div className="thumb-heading-box">
              <span className="thumb-title text-brown">You&apos;re Invited!</span>
              <span className="thumb-subtitle text-brown">Join us for an exclusive event and be part of the conversation.</span>
              <div className="thumb-mini-btn btn-orange">Register Now</div>
            </div>
            <div className="thumb-calendar-graphic">
              <div className="calendar-top" />
              <div className="calendar-body">
                <span className="cal-check">✓</span>
              </div>
            </div>
          </div>
        )}

        {theme === 'survey' && (
          <div className="thumb-content-survey">
            <div className="thumb-logo-line text-green">
              <span className="thumb-logo-icon">▲</span>
              <span className="thumb-logo-text">Sitech Series</span>
            </div>
            <div className="thumb-heading-box">
              <span className="thumb-title text-darkgreen">We Value Your Feedback</span>
              <span className="thumb-subtitle text-darkgreen">Help us improve by sharing your feedback.</span>
              <div className="thumb-mini-btn btn-green">Take Survey</div>
            </div>
            <div className="thumb-survey-graphic">
              <div className="survey-paper">
                <span className="paper-line" />
                <span className="paper-line" />
              </div>
              <div className="survey-bubble">•••</div>
            </div>
          </div>
        )}

        {theme === 'welcome_email' && (
          <div className="thumb-content-welcome">
            <div className="thumb-logo-line text-purple">
              <span className="thumb-logo-icon">▲</span>
              <span className="thumb-logo-text">Sitech Series</span>
            </div>
            <div className="thumb-heading-box">
              <span className="thumb-title text-darkpurple">Welcome to Sitech Series</span>
              <span className="thumb-subtitle text-darkpurple">We&apos;re excited to have you on board. Here&apos;s what you can do next.</span>
              <div className="thumb-mini-btn btn-purple">Get Started</div>
            </div>
            <div className="thumb-rocket-graphic">
              <span className="rocket-body">🚀</span>
            </div>
          </div>
        )}

        {theme === 'promotional' && (
          <div className="thumb-content-promotional">
            <div className="thumb-logo-line text-red">
              <span className="thumb-logo-icon">▲</span>
              <span className="thumb-logo-text">Sitech Series</span>
            </div>
            <div className="thumb-heading-box">
              <span className="thumb-title text-darkred">Limited Time Offer</span>
              <span className="thumb-subtitle text-darkred">Don&apos;t miss out on this special offer available for a limited time.</span>
              <div className="thumb-mini-btn btn-red">Claim Offer</div>
            </div>
            <div className="thumb-gift-graphic">
              <div className="gift-box">
                <div className="gift-bow">🎀</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="template-selection-page-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="template-toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb Navigation */}
      <div className="template-top-nav">
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('create-campaign')}
          className="template-back-link"
        >
          <ChevronLeft size={16} />
          <span>Back to Campaign</span>
        </button>
      </div>

      {/* Page Title & Subtitle */}
      <div className="template-page-header">
        <h1 className="template-page-title">Choose Email Template</h1>
        <p className="template-page-subtitle">
          Select a ready-made template, create a custom template, or import your own HTML file.
        </p>
      </div>

      {/* 3 Selection Cards across top */}
      <TemplateOptionCards
        activeOption="gallery"
        onNavigate={onNavigate}
        onImportSuccess={() => {
          showToast('HTML template imported successfully!');
        }}
        onError={(err) => {
          alert(err);
        }}
      />

      {/* Main Workspace Card: Two Columns (Template Gallery on left, Live Template Preview on right) */}
      <div className="template-gallery-main-card">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Gallery & Filters                                           */}
        {/* ========================================================================= */}
        <div className="template-gallery-left-col">
          <div className="template-gallery-col-header">
            <h2 className="template-gallery-col-title">Template Gallery</h2>
            <p className="template-gallery-col-subtitle">
              Select a template that fits your campaign and customize it as needed.
            </p>
          </div>

          {/* Search & Filters Bar */}
          <div className="template-filters-bar">
            {/* Search Input */}
            <div className="template-search-wrapper">
              <Search size={16} className="template-search-icon" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="template-search-input"
              />
            </div>

            {/* Category Select */}
            <div className="template-select-wrapper">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="template-filter-select"
              >
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="template-select-chevron" aria-hidden="true" />
            </div>

            {/* Theme Select */}
            <div className="template-select-wrapper">
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value)}
                className="template-filter-select"
              >
                {TEMPLATE_THEMES.map((thm) => (
                  <option key={thm} value={thm}>
                    {thm}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="template-select-chevron" aria-hidden="true" />
            </div>
          </div>

          {/* Template Cards Grid (2x3) */}
          <div className="template-grid-container">
            {filteredTemplates.length === 0 ? (
              <div className="template-empty-results">
                <p>No templates found matching your search and filter criteria.</p>
              </div>
            ) : (
              filteredTemplates.map((tpl) => {
                const isSelected = selectedTemplate && String(selectedTemplate.id) === String(tpl.id);
                return (
                  <div
                    key={tpl.id}
                    className={`template-grid-card ${isSelected ? 'card-selected' : ''}`}
                    onClick={() => handleSelectTemplate(tpl)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectTemplate(tpl);
                      }
                    }}
                  >
                    {/* Visual Thumbnail Header */}
                    {renderThumbnailHeader(tpl, isSelected)}

                    {/* Card Content Details */}
                    <div className="template-grid-card-details">
                      <h4 className="template-grid-card-name">{tpl.name}</h4>
                      <p className="template-grid-card-desc">{tpl.description}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Template Preview                                           */}
        {/* ========================================================================= */}
        <div className="template-gallery-right-col">
          <div className="template-gallery-col-header">
            <h2 className="template-gallery-col-title">Template Preview</h2>
            <p className="template-gallery-col-subtitle">
              Preview how this template looks. You can customize it after selecting.
            </p>
          </div>

          <div className="template-preview-frame-container">
            {selectedTemplate && selectedTemplate.html_content ? (
              <iframe
                title={`Preview of ${selectedTemplate.name}`}
                srcDoc={renderPersonalizedText(selectedTemplate.html_content, SAMPLE_RECIPIENT)}
                className="template-preview-iframe"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="template-preview-placeholder">
                <p>Select a template on the left to preview.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="template-gallery-bottom-bar">
        <div className="template-bottom-bar-right">
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
