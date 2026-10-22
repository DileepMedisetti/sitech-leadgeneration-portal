import React, { useState } from 'react';
import {
  ArrowLeft,
  X,
  Layout,
  Code2,
  Check,
  Eye,
  Sparkles,
} from 'lucide-react';

export const CURATED_TEMPLATES = [
  {
    id: 'research_collab',
    name: 'Academic Research Collaboration',
    category: 'Research & Labs',
    description: 'Targeted invitation to faculty peers exploring joint lab initiatives and co-investigator grants.',
    subject: 'Cross-Institutional Research Initiative — Faculty Collaboration',
    preview_text: 'Reviewing joint computational research opportunities with faculty colleagues.',
    html_content: `<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;line-height:1.6;">
  <p>Dear {{name}},</p>
  <p>I have followed your lab's recent contributions in {{department}} at {{university}} with great interest.</p>
  <p>Our research consortium is currently coordinating a multi-institutional proposal targeting next-generation computational methods. Given your expertise, we would welcome the opportunity to discuss potential alignment.</p>
  <p>You can review our preliminary research framework here: <a href="https://sitechseries.org/research-framework" style="color:#2563eb;text-decoration:underline;">Research Framework Overview</a>.</p>
  <p>I look forward to connecting at your convenience.</p>
  <p>Sincerely,<br/><strong>{{first_name|Colleague}}</strong><br/><span style="color:#64748b;font-size:12px;">Consortium Coordinator</span></p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="font-size:11px;color:#94a3b8;line-height:1.4;">
    Sitech Academic Outreach · 100 Innovation Way, Suite 400, Cambridge, MA 02142<br/>
    <a href="{{unsubscribe_url}}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe from future academic research notices</a>
  </p>
</div>`,
    plain_text: `Dear {{name}},

I have followed your lab's recent contributions in {{department}} at {{university}} with great interest.

Our research consortium is currently coordinating a multi-institutional proposal targeting next-generation computational methods. Review our framework at https://sitechseries.org/research-framework

Sincerely,
Dr. Academic Outreach

Sitech Academic Outreach, 100 Innovation Way, Suite 400, Cambridge, MA 02142
Unsubscribe: {{unsubscribe_url}}`,
  },
  {
    id: 'symposium_invitation',
    name: 'Symposium / Keynote Speaker Call',
    category: 'Conferences & Events',
    description: 'Formal academic conference invitation for department chairs and distinguished lecturers.',
    subject: 'Keynote Speaker Invitation — 2026 Academic Summit on Advanced Computing',
    preview_text: 'Inviting selected department leaders to keynote our summit.',
    html_content: `<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;line-height:1.6;">
  <p>Dear {{name}},</p>
  <p>On behalf of the academic organizing committee, we are pleased to invite you to deliver a keynote address at the upcoming <strong>2026 Academic Summit on Advanced Computing</strong>.</p>
  <p>Your work in {{research_specialization|your field}} represents a pivotal perspective for our attendees across international institutions.</p>
  <p>Full symposium details, session tracks, and speaker guidelines can be accessed at: <a href="https://sitechseries.org/symposium2026" style="color:#2563eb;text-decoration:underline;">Speaker Overview Portal</a>.</p>
  <p>Please let us know if you would be able to participate by the 15th of next month.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="font-size:11px;color:#94a3b8;line-height:1.4;">
    Summit Secretariat, 200 Technology Square, Boston, MA 02138<br/>
    <a href="{{unsubscribe_url}}" style="color:#94a3b8;text-decoration:underline;">Opt-out from speaker invitations</a>
  </p>
</div>`,
    plain_text: `Dear {{name}},

We are pleased to invite you to deliver a keynote address at the 2026 Academic Summit on Advanced Computing.

Details: https://sitechseries.org/symposium2026
Summit Secretariat, 200 Technology Square, Boston, MA 02138
Opt-out: {{unsubscribe_url}}`,
  },
  {
    id: 'call_for_papers',
    name: 'Special Issue Call for Papers',
    category: 'Academic Publishing',
    description: 'Targeted invitation for high-impact manuscript submissions to upcoming journal special issues.',
    subject: 'Call for Papers: Special Issue on Scalable Intelligence Systems',
    preview_text: 'Manuscript submission deadline and editorial scope overview.',
    html_content: `<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;line-height:1.6;">
  <p>Dear {{name}},</p>
  <p>The Editorial Board cordially invites you and your colleagues at {{university}} to submit original research to our upcoming Special Issue on <em>Scalable Intelligence Systems</em>.</p>
  <p>Given your impactful record in {{department}}, we believe your recent investigations would provide valuable contributions to this volume.</p>
  <p>Manuscript submission deadline is June 30, 2026. Review author guidelines and submission portal: <a href="https://sitechseries.org/special-issue" style="color:#2563eb;text-decoration:underline;">Submission Information</a>.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="font-size:11px;color:#94a3b8;line-height:1.4;">
    Sitech Publishing Office, 400 Research Parkway, New York, NY 10001<br/>
    <a href="{{unsubscribe_url}}" style="color:#94a3b8;text-decoration:underline;">Manage journal notification preferences</a>
  </p>
</div>`,
    plain_text: `Dear {{name}},

The Editorial Board invites you to submit original research to our Special Issue on Scalable Intelligence Systems.
Submission details: https://sitechseries.org/special-issue

Sitech Publishing Office, 400 Research Parkway, New York, NY 10001
Preferences: {{unsubscribe_url}}`,
  },
  {
    id: 'seminar_invitation',
    name: 'Department Seminar & Colloquium',
    category: 'Institutional Seminars',
    description: 'Invitation to present guest research colloquiums or attend institutional faculty seminars.',
    subject: 'Distinguished Guest Seminar Series — Faculty Invitation',
    preview_text: 'Invitation to present at our virtual faculty colloquium.',
    html_content: `<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;line-height:1.6;">
  <p>Dear {{name}},</p>
  <p>Our departmental seminar committee would be honored to host you for a 45-minute virtual colloquium discussing your group's current research agenda.</p>
  <p>We host weekly sessions attended by faculty, postdoctoral fellows, and graduate researchers across partner institutions.</p>
  <p>Please let us know your availability over the upcoming term: <a href="https://sitechseries.org/seminars" style="color:#2563eb;text-decoration:underline;">Schedule Faculty Colloquium</a>.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="font-size:11px;color:#94a3b8;line-height:1.4;">
    Colloquium Committee, 500 University Ave, Seattle, WA 98105<br/>
    <a href="{{unsubscribe_url}}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe from seminar notices</a>
  </p>
</div>`,
    plain_text: `Dear {{name}},

Our departmental seminar committee would be honored to host you for a guest colloquium.
Details: https://sitechseries.org/seminars

Colloquium Committee, 500 University Ave, Seattle, WA 98105
Unsubscribe: {{unsubscribe_url}}`,
  },
];

export default function TemplateSelectionModal({
  isOpen,
  onClose,
  onSelectTemplate,
  onOpenHtmlEditor,
}) {
  const [view, setView] = useState('choices'); // 'choices' | 'gallery'

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
