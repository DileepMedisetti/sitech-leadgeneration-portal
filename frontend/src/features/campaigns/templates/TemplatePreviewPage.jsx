import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Monitor,
  Smartphone,
  CheckCircle2,
  Mail,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { templatesApi } from '../../../services/api-client';
import { renderPersonalizedText } from '../campaignConstants';
import { saveCampaignDraft } from '../campaignDraftStore';

export default function TemplatePreviewPage({ templateId, onNavigate }) {
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [device, setDevice] = useState('desktop');

  useEffect(() => {
    if (!templateId) {
      setError('Template ID missing');
      setLoading(false);
      return;
    }

    setLoading(true);
    templatesApi
      .get(templateId)
      .then((data) => {
        setTemplate(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load template.');
      })
      .finally(() => setLoading(false));
  }, [templateId]);

  const handleUseTemplate = () => {
    if (!template) return;
    saveCampaignDraft({
      selectedTemplateId: String(template.id),
      selectedTemplateName: template.name,
      htmlContent: template.html_content,
      editorMode: 'template_gallery',
      subject: template.subject_hint || '',
    });
    onNavigate('create-campaign');
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div>Loading template preview...</div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ color: '#ef4444', marginBottom: '16px' }}>
          <AlertCircle size={40} style={{ margin: '0 auto' }} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Template Not Found</h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>{error || 'Unable to load the requested template.'}</p>
        <button
          type="button"
          onClick={() => onNavigate('campaign-templates')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back to Template Gallery
        </button>
      </div>
    );
  }

  const resolvedHtml = renderPersonalizedText(template.html_content || '');

  return (
    <div className="campaign-create-page" style={{ padding: '20px 16px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '16px',
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => onNavigate('campaign-templates')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              marginBottom: '8px',
            }}
          >
            <ArrowLeft size={16} /> Back to Gallery
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {template.name}
            </h1>
            <span
              style={{
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {template.category}
            </span>
          </div>
          {template.subject_hint && (
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Mail size={13} /> Subject Hint: <span style={{ color: '#0f172a', fontWeight: 500 }}>{template.subject_hint}</span>
            </div>
          )}
        </div>

        {/* Viewport switch and Primary Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: device === 'desktop' ? '#ffffff' : 'transparent',
                color: device === 'desktop' ? '#0f172a' : '#64748b',
                boxShadow: device === 'desktop' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Monitor size={14} /> Desktop (600px)
            </button>
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: device === 'mobile' ? '#ffffff' : 'transparent',
                color: device === 'mobile' ? '#0f172a' : '#64748b',
                boxShadow: device === 'mobile' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Smartphone size={14} /> Mobile (375px)
            </button>
          </div>

          <button
            type="button"
            onClick={handleUseTemplate}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
            }}
          >
            <CheckCircle2 size={16} /> Use This Template
          </button>
        </div>
      </div>

      {/* Simulator canvas */}
      <div
        style={{
          backgroundColor: '#0f172a',
          backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          borderRadius: '16px',
          padding: '40px 16px',
          display: 'flex',
          justifyContent: 'center',
          minHeight: '700px',
        }}
      >
        <div
          style={{
            width: device === 'desktop' ? '640px' : '375px',
            maxWidth: '100%',
            backgroundColor: '#ffffff',
            borderRadius: device === 'mobile' ? '28px' : '12px',
            border: device === 'mobile' ? '8px solid #334155' : '1px solid #334155',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            transition: 'width 0.25s ease',
          }}
        >
          {device === 'mobile' && (
            <div
              style={{
                height: '24px',
                backgroundColor: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: '60px', height: '4px', backgroundColor: '#475569', borderRadius: '4px' }} />
            </div>
          )}
          <iframe
            title={`Preview: ${template.name}`}
            srcDoc={resolvedHtml}
            sandbox="allow-same-origin"
            style={{
              width: '100%',
              height: device === 'mobile' ? '640px' : '720px',
              border: 'none',
              backgroundColor: '#ffffff',
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
}
