import React, { useState } from 'react';
import {
  X,
  Monitor,
  Smartphone,
  CheckCircle2,
  Tag,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { renderPersonalizedText } from '../campaignConstants';

export default function TemplatePreviewModal({ template, isOpen, onClose, onUseTemplate }) {
  const [device, setDevice] = useState('desktop'); // 'desktop' | 'mobile'

  if (!isOpen || !template) return null;

  const resolvedHtml = renderPersonalizedText(template.html_content || '');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1000px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {template.name}
                </h3>
                <span
                  style={{
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {template.category || 'General'}
                </span>
                {template.is_system_template && (
                  <span
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    System Template
                  </span>
                )}
              </div>
              {template.subject_hint && (
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={12} /> Subject: <span style={{ color: '#0f172a', fontWeight: 500 }}>{template.subject_hint}</span>
                </div>
              )}
            </div>
          </div>

          {/* Device Switcher & Actions */}
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
                  padding: '6px 12px',
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
                  padding: '6px 12px',
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
              onClick={() => {
                onUseTemplate(template);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              <CheckCircle2 size={16} /> Use This Template
            </button>

            <button
              type="button"
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
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Viewport Simulation Area */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#0f172a',
            backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            overflowY: 'auto',
            padding: '32px 16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
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
              minHeight: '480px',
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
              sandbox=""
              style={{
                width: '100%',
                height: device === 'mobile' ? '640px' : '680px',
                border: 'none',
                backgroundColor: '#ffffff',
                display: 'block',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
