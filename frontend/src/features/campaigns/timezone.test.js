import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  convertLocalToUtcIso,
  validateFutureScheduledTime,
} from './timezoneUtil.js';

describe('Timezone Conversion & DST Tests', () => {
  it('1. Converts UTC local time directly to UTC ISO string', () => {
    const iso = convertLocalToUtcIso('2026-11-15', '14:30', 'UTC');
    assert.equal(iso, '2026-11-15T14:30:00.000Z');
  });

  it('2. Correctly converts Eastern Daylight Time (EDT, UTC-4) during summer', () => {
    // July 15: US Eastern is EDT (UTC-4). 10:00 AM EDT should be 14:00 UTC.
    const iso = convertLocalToUtcIso('2026-07-15', '10:00', 'America/New_York');
    assert.equal(iso, '2026-07-15T14:00:00.000Z');
  });

  it('3. Correctly converts Eastern Standard Time (EST, UTC-5) during winter', () => {
    // January 15: US Eastern is EST (UTC-5). 10:00 AM EST should be 15:00 UTC.
    const iso = convertLocalToUtcIso('2026-01-15', '10:00', 'America/New_York');
    assert.equal(iso, '2026-01-15T15:00:00.000Z');
  });

  it('4. Correctly converts Asia/Kolkata (IST, UTC+5:30)', () => {
    // 09:00 AM IST should be 03:30 AM UTC.
    const iso = convertLocalToUtcIso('2026-08-20', '09:00', 'Asia/Kolkata');
    assert.equal(iso, '2026-08-20T03:30:00.000Z');
  });

  it('5. Correctly converts Europe/London across BST (British Summer Time, UTC+1)', () => {
    // June 20: London is BST (UTC+1). 11:00 BST should be 10:00 UTC.
    const iso = convertLocalToUtcIso('2026-06-20', '11:00', 'Europe/London');
    assert.equal(iso, '2026-06-20T10:00:00.000Z');

    // Dec 20: London is GMT (UTC+0). 11:00 GMT should be 11:00 UTC.
    const isoGmt = convertLocalToUtcIso('2026-12-20', '11:00', 'Europe/London');
    assert.equal(isoGmt, '2026-12-20T11:00:00.000Z');
  });

  it('6. Rejects past dates and times', () => {
    const result = validateFutureScheduledTime('2020-01-01', '09:00', 'UTC');
    assert.equal(result.valid, false);
    assert.match(result.error, /future/i);
  });

  it('7. Accepts valid future dates and times', () => {
    const futureYear = new Date().getFullYear() + 1;
    const result = validateFutureScheduledTime(`${futureYear}-06-15`, '10:00', 'America/New_York');
    assert.equal(result.valid, true);
    assert.equal(result.error, null);
    assert.ok(result.utcIso.endsWith('Z'));
  });
});
