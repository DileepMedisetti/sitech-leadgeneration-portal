/**
 * Timezone-aware date parsing and conversion utilities.
 * Accurately converts local scheduled times in any IANA timezone to UTC ISO-8601 timestamps,
 * properly respecting daylight saving time (DST) shifts without arbitrary string truncation.
 */

/**
 * Converts a local date and time in a specified IANA timezone to a true UTC ISO string.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeStr - 'HH:MM'
 * @param {string} timeZone - IANA timezone (e.g. 'America/New_York', 'UTC', 'Europe/London')
 * @returns {string} ISO-8601 UTC string (e.g. '2026-10-30T14:00:00.000Z')
 */
export function convertLocalToUtcIso(dateStr, timeStr, timeZone = 'UTC') {
  if (!dateStr || !timeStr) {
    throw new Error('Both date and time must be specified.');
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    isNaN(hour) || isNaN(minute) ||
    month < 1 || month > 12 || day < 1 || day > 31 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59
  ) {
    throw new Error(`Invalid date or time component: ${dateStr} ${timeStr}`);
  }

  // Treat input as a UTC timestamp first to compute timezone offset at that approximate point
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  if (!timeZone || timeZone.toUpperCase() === 'UTC' || timeZone.toUpperCase() === 'GMT') {
    return new Date(naiveUtc).toISOString();
  }

  // Resolve local representation in the target timezone
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = dtf.formatToParts(new Date(naiveUtc));
  const partMap = {};
  for (const p of parts) {
    if (p.type !== 'literal') partMap[p.type] = Number(p.value);
  }

  const localHour = partMap.hour === 24 ? 0 : partMap.hour;
  const localTarget = Date.UTC(
    partMap.year,
    partMap.month - 1,
    partMap.day,
    localHour,
    partMap.minute,
    partMap.second || 0
  );

  // The offset between local time in target timezone and UTC
  const offsetMs = localTarget - naiveUtc;

  // Actual UTC timestamp corresponding to desired local time
  const exactUtcMs = naiveUtc - offsetMs;
  return new Date(exactUtcMs).toISOString();
}

/**
 * Validates whether a scheduled date and time in the given timezone is in the future.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeStr - 'HH:MM'
 * @param {string} timeZone - IANA timezone
 * @returns {{ valid: boolean, error: string | null, utcIso: string | null }}
 */
export function validateFutureScheduledTime(dateStr, timeStr, timeZone = 'UTC') {
  if (!dateStr) {
    return { valid: false, error: 'Please specify a scheduled send date.', utcIso: null };
  }
  if (!timeStr) {
    return { valid: false, error: 'Please specify a scheduled send time.', utcIso: null };
  }

  try {
    const utcIso = convertLocalToUtcIso(dateStr, timeStr, timeZone);
    const targetDate = new Date(utcIso);
    const now = new Date();

    if (targetDate.getTime() <= now.getTime()) {
      return {
        valid: false,
        error: 'Scheduled date and time must be set in the future.',
        utcIso,
      };
    }

    return { valid: true, error: null, utcIso };
  } catch (err) {
    return { valid: false, error: err.message || 'Invalid scheduled date or time.', utcIso: null };
  }
}
