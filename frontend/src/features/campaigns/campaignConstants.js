export const CAMPAIGN_STEPS = [
  { id: 1, label: 'Campaign Details', shortLabel: 'Details', desc: 'Metadata & sender' },
  { id: 2, label: 'Email Design', shortLabel: 'Design', desc: 'Template & content' },
  { id: 3, label: 'Audience', shortLabel: 'Audience', desc: 'Recipients & lists' },
  { id: 4, label: 'Schedule', shortLabel: 'Schedule', desc: 'Delivery timing' },
  { id: 5, label: 'Review', shortLabel: 'Review', desc: 'Preflight & launch' },
];

export const SENDER_IDENTITIES = [
  { email: 'outreach@sitechseries.org', name: 'Sitech Academic Outreach', verified: true },
  { email: 'symposium@sitechseries.org', name: 'Sitech Symposium Secretariat', verified: true },
  { email: 'editor@sitechseries.org', name: 'Sitech Editorial Office', verified: true },
];

export const PREDEFINED_TAGS = [
  'Faculty Outreach',
  'Keynote Invitation',
  'Symposium 2026',
  'Research Labs',
  'Special Issue',
];

export const AI_SUBJECT_SUGGESTIONS = [
  'Cross-Institutional Research Initiative — Faculty Collaboration',
  'Invitation to Keynote: 2026 Academic Summit on Advanced Computing',
  'Special Issue Call for Papers: Scalable Intelligence Systems',
  'Faculty Colloquium & Collaborative Lab Inquiry',
  'Distinguished Seminar Speaker Invitation — Computer Science Department',
];

export const PERSONALIZATION_TOKENS = [
  { token: '{{name}}', label: 'Full Name' },
  { token: '{{first_name}}', label: 'First Name' },
  { token: '{{last_name}}', label: 'Last Name' },
  { token: '{{university}}', label: 'University' },
  { token: '{{department}}', label: 'Department' },
  { token: '{{profession}}', label: 'Academic Title' },
  { token: '{{country}}', label: 'Country' },
  { token: '{{unsubscribe_url}}', label: 'Unsubscribe Link' },
];

export const SAMPLE_RECIPIENT = {
  name: 'Dr. Margaret Hamilton',
  first_name: 'Margaret',
  last_name: 'Hamilton',
  email: 'm.hamilton@mit.edu',
  university: 'MIT',
  department: 'Computer Science',
  profession: 'Professor',
  country: 'United States',
  source_url: 'https://mit.edu/faculty/hamilton',
  unsubscribe_url: '#unsubscribe',
};

/**
 * Automatically resolves supported personalization tokens in campaign subject lines,
 * preview text, or email bodies using actual recipient data or sample preview data.
 */
export function renderPersonalizedText(text, recipient = SAMPLE_RECIPIENT) {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(/\{\{name(?:\|[^}]+)?\}\}/g, recipient.name || 'Recipient')
    .replace(/\{\{first_name(?:\|([^}]+))?\}\}/g, (_, fallback) => recipient.first_name || fallback || 'Colleague')
    .replace(/\{\{last_name(?:\|([^}]+))?\}\}/g, (_, fallback) => recipient.last_name || fallback || '')
    .replace(/\{\{email(?:\|[^}]+)?\}\}/g, recipient.email || 'recipient@university.edu')
    .replace(/\{\{university(?:\|([^}]+))?\}\}/g, (_, fallback) => recipient.university || fallback || 'your institution')
    .replace(/\{\{department(?:\|([^}]+))?\}\}/g, (_, fallback) => recipient.department || fallback || 'your department')
    .replace(/\{\{profession(?:\|([^}]+))?\}\}/g, (_, fallback) => recipient.profession || fallback || 'Academic Faculty')
    .replace(/\{\{country(?:\|([^}]+))?\}\}/g, (_, fallback) => recipient.country || fallback || 'your country')
    .replace(/\{\{source_url(?:\|[^}]+)?\}\}/g, recipient.source_url || '#')
    .replace(/\{\{unsubscribe_url(?:\|[^}]+)?\}\}/g, recipient.unsubscribe_url || '#unsubscribe');
}

export const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time — New York, Boston (EDT/EST)' },
  { value: 'America/Chicago', label: 'Central Time — Chicago, Houston (CDT/CST)' },
  { value: 'America/Denver', label: 'Mountain Time — Denver, Phoenix (MDT/MST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time — San Francisco, Seattle (PDT/PST)' },
  { value: 'Europe/London', label: 'London, Edinburgh (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Rome (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi (GST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore, Hong Kong (SGT/HKT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Seoul (JST/KST)' },
  { value: 'Australia/Sydney', label: 'Sydney, Melbourne (AEST/AEDT)' },
];

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
