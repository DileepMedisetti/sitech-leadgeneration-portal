import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  X,
  Layout,
  Code2,
  Check,
} from 'lucide-react';
import { CURATED_TEMPLATES } from '../campaignConstants';

export default function TemplateSelectionModal({
  isOpen,
  onClose,
  onSelectTemplate,
  onOpenHtmlEditor,
}) {
  const [view, setView] = useState('choices'); // 'choices' | 'gallery'

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: view === 'gallery' ? '980px' : '760px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {view === 'gallery' ? (
              <button
                type="button"
                onClick={() => setView('choices')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#2563eb',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <ArrowLeft size={16} /> Back to Options
              </button>
            ) : (
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                Choose email template
              </h3>
            )}
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

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '36px 32px', backgroundColor: '#f8fafc' }}>
          {view === 'choices' ? (
            <div>
              {/* Centered Heading */}
              <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                  Choose how you want to create your email
                </h2>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b', maxWidth: '480px', marginInline: 'auto' }}>
                  Select from pre-curated high-converting templates or write custom HTML with live deliverability tokens.
                </p>
              </div>

              {/* Exactly Two Prominent Centered Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '24px',
                  maxWidth: '680px',
                  margin: '0 auto',
                }}
              >
                {/* 1. Template Gallery */}
                <div
                  onClick={() => setView('gallery')}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '16px',
                    padding: '32px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(37, 99, 235, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.04)';
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '12px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                    }}
                  >
                    Curated
                  </span>

                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '16px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '20px',
                    }}
                  >
                    <Layout size={32} />
                  </div>

                  <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Template Gallery
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                    Browse pre-designed, responsive academic & B2B outreach templates crafted for research partnerships and symposium invitations.
                  </p>
                </div>

                {/* 2. HTML Editor */}
                <div
                  onClick={() => {
                    if (onOpenHtmlEditor) onOpenHtmlEditor();
                    onClose();
                  }}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '16px',
                    padding: '32px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(37, 99, 235, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.04)';
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '12px',
                      backgroundColor: '#fff7ed',
                      color: '#c2410c',
                    }}
                  >
                    Full Code
                  </span>

                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '16px',
                      backgroundColor: '#fff7ed',
                      color: '#ea580c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '20px',
                    }}
                  >
                    <Code2 size={32} />
                  </div>

                  <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    HTML Editor
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                    Paste and edit custom HTML with live syntax highlighting, line numbers, cursor personalization tokens, and split rendering.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Template Gallery Sub-View */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    Curated Academic & Outreach Templates
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                    Optimized for engagement with built-in unsubscribe and institutional compliance tokens.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {CURATED_TEMPLATES.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#2563eb',
                            backgroundColor: '#eff6ff',
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          {tmpl.category}
                        </span>
                      </div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        {tmpl.name}
                      </h4>
                      <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                        {tmpl.description}
                      </p>

                      <div
                        style={{
                          backgroundColor: '#f8fafc',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          marginBottom: '16px',
                        }}
                      >
                        <strong>Subject:</strong> {tmpl.subject}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectTemplate(tmpl);
                        onClose();
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '9px 16px',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                      }}
                    >
                      <Check size={14} /> Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
