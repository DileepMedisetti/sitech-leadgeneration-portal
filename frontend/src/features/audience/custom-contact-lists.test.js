import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Helper functions mirroring frontend logic
function validateContact(contact, existingContacts = [], editIndex = -1) {
  const errors = {};
  if (!contact.name || !contact.name.trim()) {
    errors.name = 'Contact name is required.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!contact.email || !contact.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!emailRegex.test(contact.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  } else {
    const norm = contact.email.trim().toLowerCase();
    const isDup = existingContacts.some(
      (c, idx) => idx !== editIndex && (c.email || '').trim().toLowerCase() === norm
    );
    if (isDup) {
      errors.email = 'A contact with this email address has already been added to the list.';
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

function calculateCampaignRates(metrics) {
  const attempted = metrics?.emails_attempted || 0;
  const delivered = metrics?.delivered_messages || 0;
  const uniqueOpens = metrics?.unique_opens || 0;
  const uniqueClicks = metrics?.unique_clickers || 0;
  const replies = metrics?.replies_received || 0;

  return {
    bounceRate: attempted > 0 ? Number(((metrics.bounced_messages || 0) / attempted * 100).toFixed(1)) : 0.0,
    openRate: delivered > 0 ? Number((uniqueOpens / delivered * 100).toFixed(1)) : 0.0,
    clickRate: delivered > 0 ? Number((uniqueClicks / delivered * 100).toFixed(1)) : 0.0,
    replyRate: delivered > 0 ? Number((replies / delivered * 100).toFixed(1)) : 0.0,
  };
}

describe('Custom Audience Lists & Contact Management Tests', () => {
  test('1. Validates manual contact entry: requires name, valid email format, and checks duplicates', () => {
    // Missing name
    const res1 = validateContact({ name: '', email: 'alice@mit.edu' });
    assert.equal(res1.isValid, false);
    assert.equal(res1.errors.name, 'Contact name is required.');

    // Malformed email
    const res2 = validateContact({ name: 'Alice', email: 'alice-at-mit' });
    assert.equal(res2.isValid, false);
    assert.equal(res2.errors.email, 'Please enter a valid email address.');

    // Duplicate email against pending list
    const existing = [
      { name: 'Alice Smith', email: 'alice@mit.edu' },
      { name: 'Bob Jones', email: 'bob@cern.ch' },
    ];
    const res3 = validateContact({ name: 'Duplicate Alice', email: 'ALICE@MIT.EDU' }, existing);
    assert.equal(res3.isValid, false);
    assert.ok(res3.errors.email.includes('already been added'));

    // Editing same contact allows preserving email
    const res4 = validateContact({ name: 'Alice Updated', email: 'alice@mit.edu' }, existing, 0);
    assert.equal(res4.isValid, true);
  });

  test('2. Column synonym recognition matches various spreadsheet header conventions', () => {
    const synonyms = {
      name: ['name', 'full_name', 'fullname', 'contact_name', 'person_name', 'lead_name'],
      email: ['email', 'email_address', 'emailaddress', 'mail', 'e-mail'],
      profession: ['profession', 'job_title', 'title', 'designation', 'role', 'occupation'],
      university: ['university', 'institution', 'college', 'organization', 'school'],
      country: ['country', 'nation', 'location'],
    };

    function matchHeader(header, categoryList) {
      const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_|_$/g, '');
      return categoryList.includes(norm);
    }

    assert.ok(matchHeader('Full Name', synonyms.name));
    assert.ok(matchHeader('Email Address', synonyms.email));
    assert.ok(matchHeader('Job Title', synonyms.profession));
    assert.ok(matchHeader('Institution', synonyms.university));
    assert.ok(matchHeader('Nation', synonyms.country));
  });

  test('3. Campaign analytics rate calculations handle zero denominators safely without NaN or Infinity', () => {
    const emptyMetrics = {
      emails_attempted: 0,
      delivered_messages: 0,
      bounced_messages: 0,
      unique_opens: 0,
      unique_clickers: 0,
      replies_received: 0,
    };
    const emptyRates = calculateCampaignRates(emptyMetrics);
    assert.equal(emptyRates.bounceRate, 0.0);
    assert.equal(emptyRates.openRate, 0.0);
    assert.equal(emptyRates.clickRate, 0.0);
    assert.equal(emptyRates.replyRate, 0.0);
    assert.ok(!isNaN(emptyRates.openRate));
    assert.ok(isFinite(emptyRates.openRate));

    const populatedMetrics = {
      emails_attempted: 100,
      delivered_messages: 95,
      bounced_messages: 5,
      unique_opens: 48,
      unique_clickers: 19,
      replies_received: 8,
    };
    const populatedRates = calculateCampaignRates(populatedMetrics);
    assert.equal(populatedRates.bounceRate, 5.0);
    assert.equal(populatedRates.openRate, 50.5); // 48 / 95 = 50.526% -> 50.5%
    assert.equal(populatedRates.clickRate, 20.0); // 19 / 95 = 20.0%
    assert.equal(populatedRates.replyRate, 8.4); // 8 / 95 = 8.42% -> 8.4%
  });

  test('4. Metric availability disclosure clearly distinguishes unavailable metrics from 0%', () => {
    const availability = {
      delivery_events: true,
      open_tracking: true,
      click_tracking: true,
      reply_tracking: true,
      unsubscribes: true,
      spam_complaints: false, // Provider does not report spam complaints
      deferred_messages: false,
    };

    function renderMetricValue(key, value, isAvailable) {
      if (!isAvailable) return 'Unavailable';
      if (value === null || value === undefined) return '—';
      return `${value}`;
    }

    assert.equal(renderMetricValue('spam_complaints', 0, availability.spam_complaints), 'Unavailable');
    assert.equal(renderMetricValue('deferred_messages', 0, availability.deferred_messages), 'Unavailable');
    assert.equal(renderMetricValue('open_tracking', '48.0%', availability.open_tracking), '48.0%');
  });
});
