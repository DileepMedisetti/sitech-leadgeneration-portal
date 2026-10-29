export const CAMPAIGN_STEPS = [
  { id: 1, label: 'Content', shortLabel: 'Content', desc: 'Campaign details, sender, template & tracking' },
  { id: 2, label: 'Choose Contacts', shortLabel: 'Choose Contacts', desc: 'Select audience lists' },
  { id: 3, label: 'Schedule', shortLabel: 'Schedule', desc: 'Delivery timing' },
  { id: 4, label: 'Placement Analysis', shortLabel: 'Placement Analysis', desc: 'Spam risk & ML forecast' },
  { id: 5, label: 'Review and Run Campaign', shortLabel: 'Review', desc: 'Summary & launch' },
];

export const SENDER_IDENTITIES = [
  { email: 'outreach@sitechseries.org', name: 'Sitech Academic Outreach', verified: true },
  { email: 'symposium@sitechseries.org', name: 'Sitech Symposium Secretariat', verified: true },
  { email: 'editor@sitechseries.org', name: 'Sitech Editorial Office', verified: true },
];

export const PREDEFINED_TAGS = [
  'Product Update',
  'Q4 2024',
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

export const TEMPLATE_CATEGORIES = [
  'All Categories',
  'Product Update',
  'Newsletter',
  'Event Invitation',
  'Survey',
  'Welcome Email',
  'Promotional',
  'Research & Labs',
  'Conferences & Events',
];

export const TEMPLATE_THEMES = [
  'All Themes',
  'Modern',
  'Dark',
  'Warm',
  'Minimal',
  'Tech',
  'Vibrant',
];

export const STARTER_HTML_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Template</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px; text-align: center;">
        <h1 style="color: #1f2937; margin: 0 0 16px;">Hello {{name}},</h1>
        <p style="color: #6b7280; margin: 0 0 24px; font-size: 16px;">
          We're excited to share the latest updates with you.
        </p>
        <a href="#" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Learn More
        </a>
      </td>
    </tr>
  </table>
</body>
</html>`;

/**
 * Lightweight, fast, robust syntax highlighter for HTML code editor.
 * Returns highlighted HTML spans styled matching the visual reference.
 */
export function highlightHtmlCode(code) {
  if (!code) return '';
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // HTML comments
  escaped = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color:#94a3b8;font-style:italic;">$1</span>');

  // Personalization tokens {{name}}
  escaped = escaped.replace(/(\{\{[a-zA-Z0-9_|]+\}\})/g, '<span style="color:#7c3aed;font-weight:700;">$1</span>');

  // Tags & attributes
  escaped = escaped.replace(/(&lt;\/?[a-zA-Z0-9!-]+)(.*?)(&gt;)/g, (_match, openTag, attrs, closeTag) => {
    const styledAttrs = attrs.replace(/([a-zA-Z0-9_:-]+)(=)(["'][^"']*["'])/g, (_, attrName, eq, attrVal) => {
      return `<span style="color:#ea580c;">${attrName}</span>${eq}<span style="color:#2563eb;">${attrVal}</span>`;
    });
    return `<span style="color:#e11d48;font-weight:600;">${openTag}</span>${styledAttrs}<span style="color:#e11d48;font-weight:600;">${closeTag}</span>`;
  });

  return escaped;
}

export const CURATED_TEMPLATES = [
  {
    id: 'product_update',
    name: 'Product Update',
    category: 'Product Update',
    theme: 'Modern',
    description: 'Clean and modern design for product updates and announcements.',
    subject: 'Exciting Updates from Sitech Series',
    preview_text: 'Discover new features and improvements to help you grow faster.',
    thumbnail_theme: 'product_update',
    html_content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product Update</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    
    <!-- Top Nav Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #f1f5f9;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span style="font-weight: 700; font-size: 15px; color: #0f172a; letter-spacing: -0.01em;">Sitech Series</span>
      </div>
      <div style="display: flex; gap: 16px; font-size: 13px; color: #475569; font-weight: 500;">
        <span style="color: #475569; cursor: pointer;">Events</span>
        <span style="color: #475569; cursor: pointer;">Research</span>
        <span style="color: #475569; cursor: pointer;">Contact</span>
      </div>
    </div>
    
    <!-- Hero Banner with Soft Blue Gradient -->
    <div style="background: linear-gradient(135deg, #f0f7ff 0%, #e0effe 100%); padding: 32px 28px; position: relative;">
      <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.25; max-width: 340px;">
        Exciting Updates from Sitech Series
      </h1>
      <p style="margin: 0 0 22px; font-size: 14px; color: #475569; line-height: 1.5; max-width: 340px;">
        Discover new features and improvements to help you grow faster and achieve greater success.
      </p>
      <a href="#" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 13px; padding: 10px 22px; border-radius: 6px; text-decoration: none;">
        Learn More
      </a>
    </div>

    <!-- Body Section -->
    <div style="padding: 28px 24px; color: #334155; font-size: 14px; line-height: 1.6;">
      <p style="margin: 0 0 12px; font-weight: 600; color: #0f172a;">Hi there,</p>
      <p style="margin: 0 0 24px; color: #475569;">
        We're excited to share the latest updates from Sitech Series. These new features are designed to help you streamline your workflow and achieve better results.
      </p>

      <h3 style="margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #0f172a;">
        What's New?
      </h3>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 18px; height: 18px; border-radius: 50%; background-color: #2563eb; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; flex-shrink: 0;">✓</div>
          <span style="font-size: 13px; color: #334155; font-weight: 500;">Improved performance and faster processing</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 18px; height: 18px; border-radius: 50%; background-color: #2563eb; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; flex-shrink: 0;">✓</div>
          <span style="font-size: 13px; color: #334155; font-weight: 500;">New analytics dashboard with deeper insights</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 18px; height: 18px; border-radius: 50%; background-color: #2563eb; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; flex-shrink: 0;">✓</div>
          <span style="font-size: 13px; color: #334155; font-weight: 500;">Enhanced user experience and updated interface</span>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="border-top: 1px solid #f1f5f9; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8; background-color: #fafafa;">
      <p style="margin: 0;">Sitech Series &middot; Academic Lead Generation Platform</p>
      <p style="margin: 6px 0 0;"><a href="{{unsubscribe_url}}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    category: 'Newsletter',
    theme: 'Dark',
    description: 'Professional template for regular newsletters.',
    subject: 'Stay Ahead with Insights — Sitech Series Newsletter',
    preview_text: 'Get the latest insights, tips, and resources delivered to your inbox.',
    thumbnail_theme: 'newsletter',
    html_content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    <div style="background-color: #0f172a; padding: 32px 28px; text-align: left;">
      <span style="color: #38bdf8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Sitech Series Monthly</span>
      <h1 style="margin: 10px 0 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">Stay Ahead with Insights</h1>
      <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">Get the latest insights, tips, and resources delivered to your inbox.</p>
    </div>
    <div style="padding: 28px 24px; color: #334155; line-height: 1.6; font-size: 14px;">
      <p style="margin-top: 0;">Hello {{name}},</p>
      <p>Welcome to this edition of our research intelligence digest. We are spotlighting the top findings across departments this month.</p>
      <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <h4 style="margin: 0 0 6px; color: #0f172a; font-size: 15px;">Featured Highlight</h4>
        <p style="margin: 0; color: #475569; font-size: 13px;">Key breakthroughs and methodology shifts observed across institutional cohorts.</p>
      </div>
      <a href="#" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 13px; padding: 10px 22px; border-radius: 6px; text-decoration: none;">Read More</a>
    </div>
    <div style="border-top: 1px solid #f1f5f9; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
      <p style="margin: 0;">Sitech Series &middot; Monthly Academic Insights</p>
      <p style="margin: 6px 0 0;"><a href="{{unsubscribe_url}}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'event_invitation',
    name: 'Event Invitation',
    category: 'Event Invitation',
    theme: 'Warm',
    description: 'Perfect for webinars, events and special announcements.',
    subject: "You're Invited! Join Us for an Exclusive Event",
    preview_text: 'Join us for an exclusive event and be part of the conversation.',
    thumbnail_theme: 'event_invitation',
    html_content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Invitation</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #fffbeb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #fef3c7;">
    <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); padding: 32px 28px; text-align: left;">
      <span style="color: #ea580c; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Sitech Series</span>
      <h1 style="margin: 10px 0 0; color: #9a3412; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">You're Invited!</h1>
      <p style="margin: 8px 0 0; color: #7c2d12; font-size: 14px;">Join us for an exclusive event and be part of the conversation.</p>
    </div>
    <div style="padding: 28px 24px; color: #334155; line-height: 1.6; font-size: 14px;">
      <p style="margin-top: 0;">Dear {{name}},</p>
      <p>We are delighted to invite you to participate in our upcoming virtual symposium covering recent progress in institutional collaboration.</p>
      <div style="margin: 24px 0;">
        <a href="#" style="display: inline-block; background-color: #ea580c; color: #ffffff; font-weight: 600; font-size: 13px; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Register Now</a>
      </div>
    </div>
    <div style="border-top: 1px solid #fef3c7; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
      <p style="margin: 0;"><a href="{{unsubscribe_url}}" style="color: #ea580c; text-decoration: underline;">Opt-out from event notices</a></p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'survey',
    name: 'Survey',
    category: 'Survey',
    theme: 'Minimal',
    description: 'Collect feedback and insights from your audience.',
    subject: 'We Value Your Feedback — Help Us Improve',
    preview_text: 'Help us improve by sharing your feedback.',
    thumbnail_theme: 'survey',
    html_content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Survey</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #f0fdf4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #dcfce7;">
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 32px 28px; text-align: left;">
      <span style="color: #16a34a; font-size: 12px; font-weight: 700; text-transform: uppercase;">Sitech Series</span>
      <h1 style="margin: 10px 0 0; color: #166534; font-size: 24px; font-weight: 800;">We Value Your Feedback</h1>
      <p style="margin: 8px 0 0; color: #15803d; font-size: 14px;">Help us improve by sharing your thoughts and experience.</p>
    </div>
    <div style="padding: 28px 24px; color: #334155; line-height: 1.6; font-size: 14px;">
      <p style="margin-top: 0;">Hi {{name}},</p>
      <p>We are constantly refining our platform and would love your input. It takes just 2 minutes to complete.</p>
      <div style="margin: 24px 0;">
        <a href="#" style="display: inline-block; background-color: #16a34a; color: #ffffff; font-weight: 600; font-size: 13px; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Take Survey</a>
      </div>
    </div>
    <div style="border-top: 1px solid #dcfce7; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
      <p style="margin: 0;"><a href="{{unsubscribe_url}}" style="color: #16a34a; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'welcome_email',
    name: 'Welcome Email',
    category: 'Welcome Email',
    theme: 'Tech',
    description: 'Great for new user onboarding and introductions.',
    subject: 'Welcome to Sitech Series',
    preview_text: "We're excited to have you on board. Here's what you can do next.",
    thumbnail_theme: 'welcome_email',
    html_content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Sitech Series</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #f5f3ff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #ede9fe;">
    <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); padding: 32px 28px; text-align: left;">
      <span style="color: #7c3aed; font-size: 12px; font-weight: 700; text-transform: uppercase;">Sitech Series</span>
      <h1 style="margin: 10px 0 0; color: #5b21b6; font-size: 24px; font-weight: 800;">Welcome to Sitech Series</h1>
      <p style="margin: 8px 0 0; color: #6d28d9; font-size: 14px;">We're excited to have you on board. Here's what you can do next.</p>
    </div>
    <div style="padding: 28px 24px; color: #334155; line-height: 1.6; font-size: 14px;">
      <p style="margin-top: 0;">Welcome, {{first_name|there}}!</p>
      <p>Your account is ready. Discover faculty leads, verify deliverability, and launch targeted email outreach with confidence.</p>
      <div style="margin: 24px 0;">
        <a href="#" style="display: inline-block; background-color: #7c3aed; color: #ffffff; font-weight: 600; font-size: 13px; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Get Started</a>
      </div>
    </div>
    <div style="border-top: 1px solid #ede9fe; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
      <p style="margin: 0;"><a href="{{unsubscribe_url}}" style="color: #7c3aed; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'promotional',
    name: 'Promotional',
    category: 'Promotional',
    theme: 'Vibrant',
    description: 'Ideal for promotions, offers and special deals.',
    subject: 'Limited Time Offer — Exclusive Academic Access',
    preview_text: "Don't miss out on this special offer available for a limited time.",
    thumbnail_theme: 'promotional',
    html_content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promotional Offer</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #fff1f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #ffe4e6;">
    <div style="background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); padding: 32px 28px; text-align: left;">
      <span style="color: #e11d48; font-size: 12px; font-weight: 700; text-transform: uppercase;">Sitech Series</span>
      <h1 style="margin: 10px 0 0; color: #9f1239; font-size: 24px; font-weight: 800;">Limited Time Offer</h1>
      <p style="margin: 8px 0 0; color: #be123c; font-size: 14px;">Don't miss out on this special offer available for a limited time.</p>
    </div>
    <div style="padding: 28px 24px; color: #334155; line-height: 1.6; font-size: 14px;">
      <p style="margin-top: 0;">Hello {{name}},</p>
      <p>For a limited period, gain early access to our premium faculty discovery pipeline with dedicated deliverability monitoring.</p>
      <div style="margin: 24px 0;">
        <a href="#" style="display: inline-block; background-color: #e11d48; color: #ffffff; font-weight: 600; font-size: 13px; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Claim Offer</a>
      </div>
    </div>
    <div style="border-top: 1px solid #ffe4e6; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
      <p style="margin: 0;"><a href="{{unsubscribe_url}}" style="color: #e11d48; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'research_collab',
    name: 'Academic Research Collaboration',
    category: 'Research & Labs',
    theme: 'Modern',
    description: 'Targeted invitation to faculty peers exploring joint lab initiatives and co-investigator grants.',
    subject: 'Cross-Institutional Research Initiative — Faculty Collaboration',
    preview_text: 'Reviewing joint computational research opportunities with faculty colleagues.',
    thumbnail_theme: 'product_update',
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
    theme: 'Warm',
    description: 'Formal academic conference invitation for department chairs and distinguished lecturers.',
    subject: 'Keynote Speaker Invitation — 2026 Academic Summit on Advanced Computing',
    preview_text: 'Inviting selected department leaders to keynote our summit.',
    thumbnail_theme: 'event_invitation',
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
    theme: 'Minimal',
    description: 'Targeted invitation for high-impact manuscript submissions to upcoming journal special issues.',
    subject: 'Call for Papers: Special Issue on Scalable Intelligence Systems',
    preview_text: 'Manuscript submission deadline and editorial scope overview.',
    thumbnail_theme: 'survey',
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
    theme: 'Modern',
    description: 'Invitation to present guest research colloquiums or attend institutional faculty seminars.',
    subject: 'Distinguished Guest Seminar Series — Faculty Invitation',
    preview_text: 'Invitation to present at our virtual faculty colloquium.',
    thumbnail_theme: 'newsletter',
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

export function determineReceiverName(account, fallbackSenderName = '') {
  if (!account) return (fallbackSenderName || '').trim();
  const trimmedReceiver = (account.receiver_name || '').trim();
  if (trimmedReceiver) {
    return trimmedReceiver;
  }
  const senderName = (account.name || account.from_name || fallbackSenderName || '').trim();
  return senderName;
}
