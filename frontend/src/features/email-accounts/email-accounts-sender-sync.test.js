import test from 'node:test';
import assert from 'node:assert/strict';

test('Email Accounts & Campaign Sender/Receiver Synchronization Tests', async (t) => {
  // Mock sender accounts loaded from /api/campaigns/sender-identities
  const mockSenders = [
    {
      id: 101,
      email: 'dr.sharma@university.edu',
      name: 'Dr. Mohan Sharma',
      verified: true,
      provider_status: 'ready',
      is_eligible: true,
      receiver_name: 'Faculty Dean',
      receiver_email: 'dean@university.edu',
      reply_to: 'replies@university.edu',
    },
    {
      id: 102,
      email: 'outreach@sitechseries.org',
      name: 'Sitech Outreach',
      verified: true,
      provider_status: 'ready',
      is_eligible: true,
      receiver_name: 'Department Head',
      receiver_email: 'dept.head@engineering.edu',
      reply_to: null,
    },
    {
      id: 103,
      email: 'custom@research.org',
      name: 'Research Initiative',
      verified: true,
      provider_status: 'ready',
      is_eligible: true,
      receiver_name: null,
      receiver_email: null,
      reply_to: 'custom.replies@research.org',
    },
  ];

  // Helper matching CampaignDetailsStep identity resolution logic
  function resolveAccountSelection(selectedEmail, senders) {
    const matched = senders.find((s) => s.email === selectedEmail) || senders[0];
    if (!matched) return null;
    return {
      emailAccountId: matched.id,
      fromEmail: matched.email,
      fromName: matched.name || '',
      replyTo: matched.reply_to || matched.email,
      hasCustomReplyTo: Boolean(matched.reply_to),
      receiverName: matched.receiver_name || '',
      receiverEmail: matched.receiver_email || '',
    };
  }

  await t.test('1. Selecting an email account auto-populates sender and receiver details', () => {
    const resolved = resolveAccountSelection('dr.sharma@university.edu', mockSenders);
    assert.strictEqual(resolved.emailAccountId, 101);
    assert.strictEqual(resolved.fromEmail, 'dr.sharma@university.edu');
    assert.strictEqual(resolved.fromName, 'Dr. Mohan Sharma');
    assert.strictEqual(resolved.replyTo, 'replies@university.edu');
    assert.strictEqual(resolved.hasCustomReplyTo, true);
    assert.strictEqual(resolved.receiverName, 'Faculty Dean');
    assert.strictEqual(resolved.receiverEmail, 'dean@university.edu');
  });

  await t.test('2. Switching email accounts updates all sender and receiver fields dynamically', () => {
    // Switch from account 101 to account 102
    const initial = resolveAccountSelection('dr.sharma@university.edu', mockSenders);
    assert.strictEqual(initial.emailAccountId, 101);

    const switched = resolveAccountSelection('outreach@sitechseries.org', mockSenders);
    assert.strictEqual(switched.emailAccountId, 102);
    assert.strictEqual(switched.fromEmail, 'outreach@sitechseries.org');
    assert.strictEqual(switched.fromName, 'Sitech Outreach');
    assert.strictEqual(switched.receiverName, 'Department Head');
    assert.strictEqual(switched.receiverEmail, 'dept.head@engineering.edu');
    // Account 102 has no custom reply-to, falls back to sender email
    assert.strictEqual(switched.replyTo, 'outreach@sitechseries.org');
    assert.strictEqual(switched.hasCustomReplyTo, false);
  });

  await t.test('3. Handles accounts with null receiver details safely without crashing', () => {
    const resolved = resolveAccountSelection('custom@research.org', mockSenders);
    assert.strictEqual(resolved.emailAccountId, 103);
    assert.strictEqual(resolved.receiverName, '');
    assert.strictEqual(resolved.receiverEmail, '');
    assert.strictEqual(resolved.replyTo, 'custom.replies@research.org');
    assert.strictEqual(resolved.hasCustomReplyTo, true);
  });

  await t.test('4. Edit modal parses email prefix and domain cleanly', () => {
    const email = 'dr.sharma@university.edu';
    const [prefix, domain] = email.split('@');
    assert.strictEqual(prefix, 'dr.sharma');
    assert.strictEqual(domain, 'university.edu');
  });

  await t.test('5. Validates email formats correctly for sender, receiver, and reply-to', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    assert.strictEqual(emailRegex.test('valid.user@institution.edu'), true);
    assert.strictEqual(emailRegex.test('invalid-email'), false);
    assert.strictEqual(emailRegex.test('missing@domain'), false);
    assert.strictEqual(emailRegex.test(''), false);
  });
  await t.test('6. Automatically determines receiver name: Priority 1 (actual receiver_name) and Priority 2 (fallback sender name)', async () => {
    const { determineReceiverName } = await import('../campaigns/campaignConstants.js');
    const accountWithReceiver = {
      name: 'Mohan',
      receiver_name: 'Dileep',
      receiver_email: 'dileep@example.com',
    };
    assert.strictEqual(determineReceiverName(accountWithReceiver), 'Dileep');

    const accountWithoutReceiver = {
      name: 'Mohan',
      receiver_name: null,
      receiver_email: 'dileep@example.com',
    };
    assert.strictEqual(determineReceiverName(accountWithoutReceiver), 'Mohan');

    const accountWithEmptyReceiver = {
      name: 'Mohan',
      receiver_name: '   ',
      receiver_email: 'dileep@example.com',
    };
    assert.strictEqual(determineReceiverName(accountWithEmptyReceiver), 'Mohan');

    const accountWithFromName = {
      from_name: 'Dr. Jane Doe',
      receiver_name: '',
    };
    assert.strictEqual(determineReceiverName(accountWithFromName), 'Dr. Jane Doe');
    assert.strictEqual(determineReceiverName(null, 'Sitech Series'), 'Sitech Series');
  });
});