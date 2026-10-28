import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderPersonalizedText,
  SAMPLE_RECIPIENT,
  CURATED_TEMPLATES,
  STARTER_HTML_CODE,
  highlightHtmlCode,
  TEMPLATE_CATEGORIES,
  TEMPLATE_THEMES,
} from './campaignConstants.js';

import {
  DEFAULT_CAMPAIGN_DRAFT,
} from './campaignDraftStore.js';

import {
  getRouteFromPath,
  getPathFromRoute,
} from '../../routes.js';

// Client-side HTML File Validator
function validateHtmlFileClient(fileName, fileSize, content) {
  const lower = (fileName || '').toLowerCase();
  if (!lower.endsWith('.html') && !lower.endsWith('.htm')) {
    return { valid: false, error: 'Only .html or .htm files are supported.' };
  }
  if (fileSize === 0 || !content || !content.trim()) {
    return { valid: false, error: 'File is empty.' };
  }
  if (fileSize > 2 * 1024 * 1024) {
    return { valid: false, error: 'File exceeds 2 MB limit.' };
  }
  if (!/<[a-z][\s\S]*>/i.test(content)) {
    return { valid: false, error: 'No valid HTML tags detected.' };
  }
  return { valid: true, error: null };
}

// Custom Editor Code Validator
function validateEditorHtml(html) {
  const warnings = [];
  if (!html || !html.trim()) {
    warnings.push('HTML code cannot be empty.');
  } else {
    if (!/<[a-z][\s\S]*>/i.test(html)) {
      warnings.push('No valid HTML markup detected.');
    }
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(html)) {
      warnings.push('Script tags are blocked by mail providers.');
    }
    if (!html.includes('{{unsubscribe_url}}')) {
      warnings.push('Missing {{unsubscribe_url}} token.');
    }
  }
  return warnings;
}

describe('Template Gallery & HTML Editor Routing Tests', () => {
  it('1. Correctly resolves /campaigns/create to create-campaign landing page', () => {
    const route = getRouteFromPath('/campaigns/create');
    assert.equal(route.tab, 'create-campaign');
    assert.equal(getPathFromRoute('create-campaign'), '/campaigns/create');
  });

  it('2. Correctly resolves /campaigns/create/templates to Template Gallery', () => {
    const route = getRouteFromPath('/campaigns/create/templates');
    assert.equal(route.tab, 'campaign-templates');
    assert.equal(getPathFromRoute('campaign-templates'), '/campaigns/create/templates');
  });

  it('3. Correctly resolves /campaigns/create/templates/preview/:id to Template Preview', () => {
    const route = getRouteFromPath('/campaigns/create/templates/preview/15');
    assert.equal(route.tab, 'campaign-template-preview');
    assert.equal(route.param, 15);
    assert.equal(getPathFromRoute('campaign-template-preview', 15), '/campaigns/create/templates/preview/15');
  });

  it('4. Correctly resolves /campaigns/create/html-editor to Custom HTML Editor', () => {
    const route = getRouteFromPath('/campaigns/create/html-editor');
    assert.equal(route.tab, 'campaign-html-editor');
    assert.equal(getPathFromRoute('campaign-html-editor'), '/campaigns/create/html-editor');
  });

  it('5. Ensures template/editor paths are not misinterpreted as campaign IDs and canonical route is /campaigns/create', () => {
    const createRoute = getRouteFromPath('/campaigns/create');
    assert.equal(createRoute.tab, 'create-campaign');
    assert.equal(createRoute.param, null);

    const templatesRoute = getRouteFromPath('/campaigns/create/templates');
    assert.equal(templatesRoute.tab, 'campaign-templates');

    const detailRoute = getRouteFromPath('/campaigns/102');
    assert.equal(detailRoute.tab, 'campaign-detail');
    assert.equal(detailRoute.param, 102);

    const legacyWizardRoute = getRouteFromPath('/campaigns/create/wizard');
    assert.equal(legacyWizardRoute.tab, 'create-campaign');
  });
});

describe('HTML File Import Client Validation Tests', () => {
  it('1. Accepts valid .html file under 2 MB with proper markup', () => {
    const result = validateHtmlFileClient('newsletter.html', 1024, '<html><body><h1>Title</h1></body></html>');
    assert.equal(result.valid, true);
    assert.equal(result.error, null);
  });

  it('2. Accepts valid .htm file', () => {
    const result = validateHtmlFileClient('welcome.htm', 2048, '<div><p>Welcome to Sitech</p></div>');
    assert.equal(result.valid, true);
  });

  it('3. Rejects invalid extensions (.pdf, .txt, .docx)', () => {
    assert.equal(validateHtmlFileClient('file.pdf', 100, '<div></div>').valid, false);
    assert.equal(validateHtmlFileClient('file.txt', 100, '<div></div>').valid, false);
    assert.equal(validateHtmlFileClient('file.png', 100, '<div></div>').valid, false);
  });

  it('4. Rejects empty file (0 bytes)', () => {
    const result = validateHtmlFileClient('empty.html', 0, '');
    assert.equal(result.valid, false);
    assert.match(result.error, /empty/i);
  });

  it('5. Rejects files larger than 2 MB', () => {
    const result = validateHtmlFileClient('huge.html', 3 * 1024 * 1024, '<html>huge</html>');
    assert.equal(result.valid, false);
    assert.match(result.error, /2 MB/i);
  });

  it('6. Rejects non-HTML plain text inside .html file', () => {
    const result = validateHtmlFileClient('fake.html', 500, 'just some plain text without any opening or closing html tags');
    assert.equal(result.valid, false);
    assert.match(result.error, /HTML/i);
  });
});

describe('Personalization Tokens & Variable Replacement Tests', () => {
  it('1. Correctly replaces {{name}}, {{first_name}}, {{university}}, {{department}}', () => {
    const raw = 'Dear {{name}}, congratulations from {{department}} at {{university}}. Best, {{first_name}}.';
    const resolved = renderPersonalizedText(raw, SAMPLE_RECIPIENT);
    assert.ok(resolved.includes(SAMPLE_RECIPIENT.name));
    assert.ok(resolved.includes(SAMPLE_RECIPIENT.department));
    assert.ok(resolved.includes(SAMPLE_RECIPIENT.university));
    assert.ok(resolved.includes(SAMPLE_RECIPIENT.first_name));
  });

  it('2. Supports token fallbacks such as {{first_name|Colleague}}', () => {
    const raw = 'Dear {{first_name|Colleague}},';
    const resolvedEmpty = renderPersonalizedText(raw, { ...SAMPLE_RECIPIENT, first_name: '' });
    assert.equal(resolvedEmpty, 'Dear Colleague,');
  });

  it('3. Replaces {{unsubscribe_url}} token', () => {
    const raw = '<a href="{{unsubscribe_url}}">Unsubscribe</a>';
    const resolved = renderPersonalizedText(raw, SAMPLE_RECIPIENT);
    assert.ok(!resolved.includes('{{unsubscribe_url}}'));
  });
});

describe('Custom HTML Editor Validation Tests', () => {
  it('1. Detects dangerous <script> tags for mail client security', () => {
    const code = '<div><script>alert("hack")</script><p>Hello</p></div>';
    const warnings = validateEditorHtml(code);
    assert.ok(warnings.some((w) => w.includes('Script tags are blocked')));
  });

  it('2. Alerts when {{unsubscribe_url}} is missing', () => {
    const code = '<div><p>Hello colleague</p></div>';
    const warnings = validateEditorHtml(code);
    assert.ok(warnings.some((w) => w.includes('unsubscribe_url')));
  });

  it('3. Passes clean HTML with proper tags and unsubscribe link', () => {
    const code = '<div><p>Hello {{name}}</p><a href="{{unsubscribe_url}}">Unsubscribe</a></div>';
    const warnings = validateEditorHtml(code);
    assert.equal(warnings.length, 0);
  });
});

describe('Campaign Draft Store Structure Tests', () => {
  it('1. Default draft contains all required campaign and design fields', () => {
    assert.ok('campaignName' in DEFAULT_CAMPAIGN_DRAFT);
    assert.ok('subject' in DEFAULT_CAMPAIGN_DRAFT);
    assert.ok('htmlContent' in DEFAULT_CAMPAIGN_DRAFT);
    assert.ok('editorMode' in DEFAULT_CAMPAIGN_DRAFT);
    assert.ok('fromName' in DEFAULT_CAMPAIGN_DRAFT);
    assert.ok('fromEmail' in DEFAULT_CAMPAIGN_DRAFT);
    assert.ok('replyTo' in DEFAULT_CAMPAIGN_DRAFT);
  });
});

describe('Approved UI Template Gallery & Custom HTML Editor Tests', () => {
  it('1. CURATED_TEMPLATES contains all 6 approved reference templates', () => {
    const names = CURATED_TEMPLATES.map((t) => t.name);
    assert.ok(names.includes('Product Update'), 'Missing Product Update');
    assert.ok(names.includes('Newsletter'), 'Missing Newsletter');
    assert.ok(names.includes('Event Invitation'), 'Missing Event Invitation');
    assert.ok(names.includes('Survey'), 'Missing Survey');
    assert.ok(names.includes('Welcome Email'), 'Missing Welcome Email');
    assert.ok(names.includes('Promotional'), 'Missing Promotional');
  });

  it('2. Product Update template matches the approved visual preview content', () => {
    const productUpdate = CURATED_TEMPLATES.find((t) => t.id === 'product_update');
    assert.ok(productUpdate, 'product_update template should exist');
    assert.equal(productUpdate.category, 'Product Update');
    assert.equal(productUpdate.theme, 'Modern');
    assert.ok(productUpdate.html_content.includes('Exciting Updates from Sitech Series'));
    assert.ok(productUpdate.html_content.includes('What&#39;s New?') || productUpdate.html_content.includes("What's New?"));
    assert.ok(productUpdate.html_content.includes('Improved performance and faster processing'));
    assert.ok(productUpdate.html_content.includes('New analytics dashboard with deeper insights'));
    assert.ok(productUpdate.html_content.includes('Enhanced user experience and updated interface'));
    assert.ok(productUpdate.html_content.includes('Learn More'));
  });

  it('3. STARTER_HTML_CODE matches the Custom HTML Editor screenshot specification', () => {
    assert.ok(STARTER_HTML_CODE.includes('<!DOCTYPE html>'));
    assert.ok(STARTER_HTML_CODE.includes('<h1 style="color: #1f2937; margin: 0 0 16px;">Hello {{name}},</h1>'));
    assert.ok(STARTER_HTML_CODE.includes("We're excited to share the latest updates with you."));
    assert.ok(STARTER_HTML_CODE.includes('Learn More'));
  });

  it('4. highlightHtmlCode correctly tokenizes and styles HTML tags, attributes, and variables', () => {
    const snippet = '<h1 style="color: #1f2937;">Hello {{name}},</h1>';
    const highlighted = highlightHtmlCode(snippet);
    assert.ok(highlighted.includes('color:#e11d48'), 'Tag should be highlighted in pink/red');
    assert.ok(highlighted.includes('color:#ea580c'), 'Attribute name should be highlighted in orange');
    assert.ok(highlighted.includes('color:#2563eb'), 'Attribute value should be highlighted in blue');
    assert.ok(highlighted.includes('color:#7c3aed'), 'Token should be highlighted in purple');
  });

  it('5. Categories and themes contain standard filter options matching UI reference', () => {
    assert.ok(TEMPLATE_CATEGORIES.includes('All Categories'));
    assert.ok(TEMPLATE_CATEGORIES.includes('Product Update'));
    assert.ok(TEMPLATE_CATEGORIES.includes('Newsletter'));
    assert.ok(TEMPLATE_CATEGORIES.includes('Event Invitation'));
    assert.ok(TEMPLATE_THEMES.includes('All Themes'));
    assert.ok(TEMPLATE_THEMES.includes('Modern'));
    assert.ok(TEMPLATE_THEMES.includes('Dark'));
    assert.ok(TEMPLATE_THEMES.includes('Warm'));
  });
});
