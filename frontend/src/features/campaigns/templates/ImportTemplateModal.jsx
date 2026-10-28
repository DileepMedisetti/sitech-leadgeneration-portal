import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Eye,
  Loader2,
} from 'lucide-react';
import { templatesApi } from '../../../services/api-client';

const PREDEFINED_CATEGORIES = [
  'Welcome',
  'Newsletter',
  'Product Update',
  'Promotional',
  'Event Invitation',
  'Follow-up',
  'Announcement',
  'Research & Labs',
  'Conferences & Events',
  'Academic Publishing',
  'General',
];

export default function ImportTemplateModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [htmlPreview, setHtmlPreview] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [subjectHint, setSubjectHint] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const validateAndReadFile = (selectedFile) => {
    setValidationError('');

    if (!selectedFile) return;

    const lowerName = selectedFile.name.toLowerCase();
    if (!lowerName.endsWith('.html') && !lowerName.endsWith('.htm')) {
      setValidationError('Please select a valid HTML file (.html or .htm).');
      return;
    }

    if (selectedFile.size === 0) {
      setValidationError('The selected file is empty.');
      return;
    }

    if (selectedFile.size > 2 * 1024 * 1024) {
      setValidationError(`File size (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB) exceeds the 2 MB limit.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (!text || !text.trim()) {
        setValidationError('The file appears to contain only whitespace.');
        return;
      }
      if (!/<[a-z][\s\S]*>/i.test(text)) {
        setValidationError('The file does not appear to contain valid HTML markup.');
        return;
      }

      setFile(selectedFile);
      setFileName(selectedFile.name);
      setFileSize(selectedFile.size);
      setHtmlPreview(text);

      // Auto-populate template name from file name if not already set
      if (!name) {
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }
    };
    reader.onerror = () => {
      setValidationError('Could not read the selected file. Please try again.');
    };
    reader.readAsText(selectedFile);
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    validateAndReadFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    validateAndReadFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setValidationError('Please select an HTML file to import.');
      return;
    }
    if (!name.trim()) {
      setValidationError('Template name is required.');
      return;
    }

    const finalCategory = category === 'Other' ? (customCategory.trim() || 'General') : category;

    setIsUploading(true);
    setValidationError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      formData.append('category', finalCategory);
      if (description.trim()) formData.append('description', description.trim());
      if (subjectHint.trim()) formData.append('subject_hint', subjectHint.trim());

      const res = await templatesApi.importFile(formData);
      onSuccess(res);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to import template. Please verify file format.';
      setValidationError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                Import HTML Template
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Upload an existing .html or .htm file to use across your campaigns
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Validation Error Alert */}
          {validationError && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#b91c1c',
                fontSize: '13px',
              }}
            >
              <AlertCircle size={16} />
              <span>{validationError}</span>
            </div>
          )}

          {/* File Upload Zone */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              HTML File (Max 2 MB) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".html,.htm"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? '#2563eb' : file ? '#10b981' : '#cbd5e1'}`,
                borderRadius: '10px',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragging ? '#eff6ff' : file ? '#f0fdf4' : '#f8fafc',
                transition: 'all 0.15s ease',
              }}
            >
              {file ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <FileCode size={32} color="#10b981" />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{fileName}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {(fileSize / 1024).toFixed(1)} KB &middot; Ready to import
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPreview(!showPreview);
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#2563eb',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Eye size={12} /> {showPreview ? 'Hide Preview' : 'Preview HTML'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        color: '#475569',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Change File
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563eb',
                    }}
                  >
                    <UploadCloud size={24} />
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                    Drag and drop your HTML file here, or <span style={{ color: '#2563eb' }}>browse</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Supports raw .html or .htm files up to 2 MB
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Sandboxed Preview */}
          {showPreview && htmlPreview && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Sandboxed HTML Preview
              </div>
              <iframe
                title="HTML Preview"
                srcDoc={htmlPreview}
                sandbox="allow-same-origin"
                style={{ width: '100%', height: '220px', border: 'none', backgroundColor: '#ffffff' }}
              />
            </div>
          )}

          {/* Template Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Template Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Faculty Welcome & Research Highlights"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                color: '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Category Dropdown */}
          <div style={{ display: 'grid', gridTemplateColumns: category === 'Other' ? '1fr 1fr' : '1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                }}
              >
                {PREDEFINED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="Other">Other (Custom category)</option>
              </select>
            </div>

            {category === 'Other' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Custom Category Name
                </label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Executive Outreach"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>

          {/* Subject Hint */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Suggested Email Subject Line <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8' }}>(Optional)</span>
            </label>
            <input
              type="text"
              value={subjectHint}
              onChange={(e) => setSubjectHint(e.target.value)}
              placeholder="e.g. Join us for our 2026 Academic Summit"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                color: '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Description <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8' }}>(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of this template's intent and best use cases..."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                color: '#0f172a',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '12px',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              disabled={isUploading}
              onClick={onClose}
              style={{
                padding: '9px 16px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                cursor: isUploading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              style={{
                padding: '9px 20px',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                cursor: isUploading || !file ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isUploading || !file ? 0.7 : 1,
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading & Validating...
                </>
              ) : (
                <>
                  <UploadCloud size={16} /> Save & Import Template
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
