import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure helper mirroring the sanitization logic in App.jsx navigate()
 */
function sanitizeNavigationArgs(tab, param) {
  let safeTab = 'campaigns';
  if (typeof tab === 'string' && tab.trim().length > 0) {
    safeTab = tab.trim();
  } else if (tab && typeof tab === 'object' && typeof tab.tab === 'string' && tab.tab.trim().length > 0) {
    safeTab = tab.tab.trim();
  }

  let safeParam = null;
  if (param !== null && param !== undefined) {
    if (typeof param === 'string' || typeof param === 'number' || typeof param === 'boolean') {
      safeParam = param;
    } else if (
      typeof param === 'object' &&
      !(param instanceof Event) &&
      !param.nativeEvent &&
      !param.target &&
      !param._reactName &&
      param.type !== 'click' &&
      param.type !== 'pointerdown'
    ) {
      try {
        JSON.stringify(param);
        safeParam = param;
      } catch {
        safeParam = null;
      }
    }
  }

  return { safeTab, safeParam };
}

/**
 * Pure helper mirroring CreateCampaignPage handleConfirmLeave destination resolution
 */
function resolveDiscardDestination(pendingDestination, previousRoute, defaultFallback = 'campaigns') {
  let destinationTab = defaultFallback;
  let destinationParam = null;

  if (pendingDestination && typeof pendingDestination.tab === 'string' && pendingDestination.tab.trim().length > 0) {
    destinationTab = pendingDestination.tab.trim();
    destinationParam = pendingDestination.param ?? null;
  } else if (
    previousRoute &&
    typeof previousRoute.tab === 'string' &&
    previousRoute.tab.trim().length > 0 &&
    previousRoute.tab !== 'create-campaign'
  ) {
    destinationTab = previousRoute.tab.trim();
    destinationParam = previousRoute.param ?? null;
  }

  return { destinationTab, destinationParam };
}

test('Navigation Argument Sanitization & DataCloneError Prevention', async (t) => {
  await t.test('1. PointerEvent passed as tab is safely sanitized to fallback string', () => {
    // Simulate a PointerEvent / SyntheticEvent passed to navigate(e)
    const mockPointerEvent = {
      type: 'pointerdown',
      pointerId: 1,
      target: { tagName: 'BUTTON' },
      preventDefault: () => {},
      stopPropagation: () => {},
    };

    const { safeTab, safeParam } = sanitizeNavigationArgs(mockPointerEvent, null);
    assert.equal(typeof safeTab, 'string');
    assert.equal(safeTab, 'campaigns');
    assert.equal(safeParam, null);
  });

  await t.test('2. Valid route strings are preserved untouched', () => {
    const { safeTab, safeParam } = sanitizeNavigationArgs('audience', { listId: 42 });
    assert.equal(safeTab, 'audience');
    assert.deepEqual(safeParam, { listId: 42 });
  });

  await t.test('3. Non-serializable objects or events passed as param are sanitized to null', () => {
    const mockEventParam = {
      _reactName: 'onClick',
      target: {},
      nativeEvent: {},
    };

    const { safeTab, safeParam } = sanitizeNavigationArgs('campaigns', mockEventParam);
    assert.equal(safeTab, 'campaigns');
    assert.equal(safeParam, null);
  });

  await t.test('4. Circular references in param do not crash JSON serialization', () => {
    const circular = {};
    circular.self = circular;

    const { safeTab, safeParam } = sanitizeNavigationArgs('dashboard', circular);
    assert.equal(safeTab, 'dashboard');
    assert.equal(safeParam, null);
  });
});

test('Discard Changes Destination Resolution Tests', async (t) => {
  await t.test('1. Resolves to pendingDestination when intercepted from in-app link', () => {
    const pending = { tab: 'audience', param: { tab: 'lists' } };
    const previous = { tab: 'dashboard', param: null };

    const { destinationTab, destinationParam } = resolveDiscardDestination(pending, previous);
    assert.equal(destinationTab, 'audience');
    assert.deepEqual(destinationParam, { tab: 'lists' });
  });

  await t.test('2. Resolves to previousRoute when pendingDestination is null', () => {
    const pending = null;
    const previous = { tab: 'review-queue', param: null };

    const { destinationTab, destinationParam } = resolveDiscardDestination(pending, previous);
    assert.equal(destinationTab, 'review-queue');
    assert.equal(destinationParam, null);
  });

  await t.test('3. Rejects previousRoute pointing to self (create-campaign) and falls back to campaigns', () => {
    const pending = null;
    const previous = { tab: 'create-campaign', param: null };

    const { destinationTab, destinationParam } = resolveDiscardDestination(pending, previous);
    assert.equal(destinationTab, 'campaigns');
    assert.equal(destinationParam, null);
  });

  await t.test('4. Safely falls back to campaigns when both pending and previous are undefined', () => {
    const { destinationTab, destinationParam } = resolveDiscardDestination(undefined, undefined);
    assert.equal(destinationTab, 'campaigns');
    assert.equal(destinationParam, null);
  });

  await t.test('5. Rejects accidental event object passed into pendingDestination', () => {
    const corruptedPending = { tab: { type: 'click' }, param: null };
    const previous = { tab: 'dashboard', param: null };

    const { destinationTab } = resolveDiscardDestination(corruptedPending, previous);
    assert.equal(destinationTab, 'dashboard');
  });
});
