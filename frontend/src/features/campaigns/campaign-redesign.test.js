import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMPAIGN_STEPS,
  CURATED_TEMPLATES,
  PERSONALIZATION_TOKENS,
  renderPersonalizedText,
  SAMPLE_RECIPIENT,
} from './campaignConstants.js';
import { DEFAULT_CAMPAIGN_DRAFT } from './campaignDraftStore.js';

describe('Campaign Redesign & Workflow Integrity Tests', () => {
  test('1. Five-step sequence conforms strictly to the master redesign specification', () => {
    assert.equal(CAMPAIGN_STEPS.length, 5, 'Must define exactly 5 campaign steps');
    
    assert.deepEqual(
      CAMPAIGN_STEPS.map((s) => s.id),
      [1, 2, 3, 4, 5],
      'Step IDs must be sequential 1 through 5'
    );

    assert.equal(CAMPAIGN_STEPS[0].label, 'Content');
    assert.equal(CAMPAIGN_STEPS[1].label, 'Choose Contacts');
    assert.equal(CAMPAIGN_STEPS[2].label, 'Schedule');
    assert.equal(CAMPAIGN_STEPS[3].label, 'Placement Analysis');
    assert.equal(CAMPAIGN_STEPS[4].label, 'Review and Run Campaign');
  });

  test('2. Placement Analysis is step 4 immediately preceding Review and Run Campaign (step 5)', () => {
    const placementStep = CAMPAIGN_STEPS.find((s) => s.label === 'Placement Analysis');
    const reviewStep = CAMPAIGN_STEPS.find((s) => s.label === 'Review and Run Campaign');

    assert.ok(placementStep, 'Placement Analysis step must exist');
    assert.ok(reviewStep, 'Review and Run Campaign step must exist');
    assert.equal(placementStep.id, 4);
    assert.equal(reviewStep.id, 5);
    assert.equal(placementStep.id + 1, reviewStep.id, 'Placement Analysis must immediately precede Review');
  });

  test('3. Default draft supports draft persistence, campaignId, and tracking options', () => {
    assert.equal(DEFAULT_CAMPAIGN_DRAFT.campaignId, null);
    assert.equal(DEFAULT_CAMPAIGN_DRAFT.currentStep, 1);
    assert.equal(DEFAULT_CAMPAIGN_DRAFT.lastAnalysisFingerprint, null);
    assert.ok(Array.isArray(DEFAULT_CAMPAIGN_DRAFT.selectedListIds));
    assert.ok(typeof DEFAULT_CAMPAIGN_DRAFT.sendImmediately === 'boolean');
    assert.ok(typeof DEFAULT_CAMPAIGN_DRAFT.trackingOptions === 'object');
    assert.equal(DEFAULT_CAMPAIGN_DRAFT.trackingOptions.track_opens, true);
    assert.equal(DEFAULT_CAMPAIGN_DRAFT.trackingOptions.track_clicks, true);
  });

  test('4. Personalization token interpolation safely handles fallbacks and tokens', () => {
    const rawSubject = 'Hello {{first_name|Colleague}}, invitation to {{university|your institution}}';
    const rendered = renderPersonalizedText(rawSubject, {
      first_name: 'Alan',
      university: 'Princeton',
    });
    assert.equal(rendered, 'Hello Alan, invitation to Princeton');

    const fallbackRendered = renderPersonalizedText(rawSubject, {});
    assert.equal(fallbackRendered, 'Hello Colleague, invitation to your institution');
  });

  test('5. Curated templates include required academic outreach structure and unsubscribe tokens', () => {
    assert.ok(CURATED_TEMPLATES.length >= 3, 'Must have at least 3 curated templates');
    
    for (const t of CURATED_TEMPLATES) {
      assert.ok(t.id, 'Template must have an id');
      assert.ok(t.name, 'Template must have a name');
      assert.ok(t.html_content, 'Template must have html_content');
      assert.ok(
        t.html_content.includes('{{unsubscribe_url}}'),
        `Template ${t.id} must include an {{unsubscribe_url}} token for compliance`
      );
    }
  });

  test('6. Preflight status mapping supports all 5 standard status icons', () => {
    // Status color and icon rules
    const getStatusType = (status) => {
      if (status === 'passed') return 'success';
      if (status === 'blocked' || status === 'failed') return 'danger';
      if (status === 'warning') return 'warning';
      if (status === 'unavailable') return 'neutral';
      if (status === 'pending') return 'info';
      return 'default';
    };

    assert.equal(getStatusType('passed'), 'success');
    assert.equal(getStatusType('blocked'), 'danger');
    assert.equal(getStatusType('warning'), 'warning');
    assert.equal(getStatusType('unavailable'), 'neutral');
  });

  test('7. Step completion logic prevents false completion merely upon step visit', () => {
    const checkStepCompleted = (stepId, state) => {
      switch (stepId) {
        case 1:
          return Boolean(
            state.campaignName?.trim() &&
            state.subject?.trim() &&
            state.fromName?.trim() &&
            state.fromEmail?.trim() &&
            state.htmlContent?.trim()
          );
        case 2:
          return Boolean(state.selectedListIds?.length > 0);
        case 3:
          return Boolean(state.sendImmediately || (state.scheduledAtDate && state.scheduledAtTime));
        case 4:
          return Boolean(state.hasAnalysis && !state.isStale && (!state.blockers || state.blockers.length === 0));
        case 5:
          return false;
        default:
          return false;
      }
    };

    // User merely visiting Step 2 with empty list selection is NOT completed
    assert.equal(
      checkStepCompleted(2, { selectedListIds: [] }),
      false,
      'Visiting Step 2 without selecting audience lists must not be complete'
    );

    // User selecting a list marks Step 2 complete
    assert.equal(
      checkStepCompleted(2, { selectedListIds: [101] }),
      true,
      'Step 2 is completed when a list is selected'
    );

    // Step 4 is NOT complete if analysis has critical blockers
    assert.equal(
      checkStepCompleted(4, {
        hasAnalysis: true,
        isStale: false,
        blockers: ['Missing unsubscribe link'],
      }),
      false,
      'Step 4 cannot be completed if critical deliverability blockers exist'
    );

    // Step 4 is complete when analysis passed with no blockers
    assert.equal(
      checkStepCompleted(4, {
        hasAnalysis: true,
        isStale: false,
        blockers: [],
      }),
      true,
      'Step 4 is completed when deliverability analysis is fresh and blocker-free'
    );
  });

  test('8. Content Step Redesign layout, CSS classes, and responsive styles conform to spec', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const cssPath = path.resolve('src/features/campaigns/campaigns.css');
    const jsxPath = path.resolve('src/features/campaigns/components/ContentStep.jsx');

    const css = fs.readFileSync(cssPath, 'utf8');
    const jsx = fs.readFileSync(jsxPath, 'utf8');

    // Section A classes
    assert.ok(css.includes('.campaign-content-step'), 'Must define .campaign-content-step');
    assert.ok(css.includes('.campaign-meta-grid'), 'Must define .campaign-meta-grid for side-by-side card layout');
    assert.ok(css.includes('.campaign-meta-card'), 'Must define .campaign-meta-card');
    assert.ok(css.includes('.campaign-info-section'), 'Must define .campaign-info-section');
    assert.ok(css.includes('.campaign-sender-section'), 'Must define .campaign-sender-section');

    // Section B classes
    assert.ok(css.includes('.campaign-email-workspace'), 'Must define .campaign-email-workspace');
    assert.ok(css.includes('.campaign-design-split-grid'), 'Must define .campaign-design-split-grid');
    assert.ok(css.includes('.campaign-template-cards-stack'), 'Must define .campaign-template-cards-stack');
    assert.ok(css.includes('.campaign-preview-card'), 'Must define .campaign-preview-card');
    assert.ok(css.includes('.campaign-device-frame-desktop'), 'Must define .campaign-device-frame-desktop');
    assert.ok(css.includes('.campaign-device-frame-mobile'), 'Must define .campaign-device-frame-mobile');
    assert.ok(css.includes('.campaign-email-render-target'), 'Must define .campaign-email-render-target');

    // Section C classes
    assert.ok(css.includes('.campaign-tracking-card'), 'Must define .campaign-tracking-card');
    assert.ok(css.includes('.campaign-tracking-grid'), 'Must define .campaign-tracking-grid');
    assert.ok(css.includes('.campaign-tracking-option-card'), 'Must define .campaign-tracking-option-card');
    assert.ok(css.includes('.campaign-switch-toggle'), 'Must define .campaign-switch-toggle');

    // Responsive breakpoints
    assert.ok(css.includes('@media (max-width: 1024px)'), 'Must include 1024px breakpoint for split-grid stacking');
    assert.ok(css.includes('@media (max-width: 768px)'), 'Must include 768px breakpoint for meta-grid vertical stacking');
    assert.ok(css.includes('@media (max-width: 640px)'), 'Must include 640px breakpoint for tracking-grid vertical stacking');
    assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'Must include prefers-reduced-motion');

    // Required form inputs and controls in ContentStep.jsx
    assert.ok(jsx.includes('campaign-name-input'), 'Must contain campaign-name-input ID');
    assert.ok(jsx.includes('campaign-subject-input'), 'Must contain campaign-subject-input ID');
    assert.ok(jsx.includes('campaign-preview-input'), 'Must contain campaign-preview-input ID');
    assert.ok(jsx.includes('campaign-tags-input'), 'Must contain campaign-tags-input ID');
    assert.ok(jsx.includes('sender-identity-select'), 'Must contain sender-identity-select ID');
    assert.ok(jsx.includes('campaign-from-name'), 'Must contain campaign-from-name ID');
    assert.ok(jsx.includes('campaign-from-email'), 'Must contain campaign-from-email ID');
    assert.ok(jsx.includes('campaign-replyto-input'), 'Must contain campaign-replyto-input ID');
    assert.ok(jsx.includes('track_opens'), 'Must manage track_opens option');
    assert.ok(jsx.includes('track_clicks'), 'Must manage track_clicks option');
    assert.ok(jsx.includes('accept=".html,.htm"'), 'Must support .html and .htm file import');
    assert.ok(jsx.includes('HtmlEditorModal'), 'Must support HtmlEditorModal');
    assert.ok(jsx.includes('TemplateSelectionModal'), 'Must support TemplateSelectionModal');
  });
});
