/**
 * Shared date/time helpers.
 *
 * Backend contract: every date-time in an API response is an ISO-8601 UTC
 * instant with at most millisecond precision ("2026-10-05T11:00:00.000Z").
 * Older payloads may still carry naive "yyyy-MM-ddTHH:mm:ss[.ffffff]" strings
 * (historically interpreted as local time), Jackson timestamp arrays, or —
 * for some legacy message fields — java.util.Date#toString() strings
 * ("Mon Oct 05 12:00:00 WAT 2026"). Pure dates are "yyyy-MM-dd".
 *
 * Everything the app SENDS must be an ISO string with an offset
 * (`toServerDateTime`), and pure dates a local "YYYY-MM-DD"
 * (`toLocalDateString`). Every request also carries an `X-Timezone` header
 * (see `getDeviceTimeZone`) so the server can interpret any remaining naive
 * strings in the device's zone.
 *
 * All parsing is done by hand rather than via `new Date(string)` because
 * Hermes rejects >3 fractional-second digits and non-ISO formats.
 */

import { useLanguageStore } from '../store/useLanguageStore';

export type DateInput = Date | string | number | number[] | null | undefined;

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// Minutes east of UTC for the zone abbreviations java.util.Date#toString() can emit.
const TZ_OFFSETS: Record<string, number> = {
  UTC: 0, GMT: 0, Z: 0, WET: 0, WAT: 60, CET: 60, BST: 60, CEST: 120, CAT: 120, EET: 120, SAST: 120,
  EEST: 180, EAT: 180, EST: -300, EDT: -240, CST: -360, CDT: -300, MST: -420, MDT: -360, PST: -480, PDT: -420,
};

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?(?:\[[^\]]*\])?$/i;
const JAVA_DATE_RE = /^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{2}):(\d{2}):(\d{2}) ([A-Za-z]+) (\d{4})$/;

const valid = (d: Date): Date | null => (Number.isNaN(d.getTime()) ? null : d);

/** Parses an offset like "Z", "+01:00", "+0100", "-05" into minutes east of UTC. */
const offsetMinutes = (zone: string): number => {
  if (zone.toUpperCase() === 'Z') return 0;
  const sign = zone[0] === '-' ? -1 : 1;
  const digits = zone.slice(1).replace(':', '');
  const hh = Number(digits.slice(0, 2)) || 0;
  const mm = Number(digits.slice(2, 4)) || 0;
  return sign * (hh * 60 + mm);
};

/**
 * Robustly parses any date value coming from the server (or from local state)
 * into a Date, or null when it is missing/unparseable (never an Invalid Date).
 * - Date / epoch millis / Jackson arrays ([y, M, d, h, m, s, nanos], local)
 * - ISO with Z/offset → exact instant (fractions truncated to ms)
 * - "YYYY-MM-DD" → LOCAL midnight (no off-by-one in negative-offset zones)
 * - naive "YYYY-MM-DD[T ]HH:mm[:ss[.f…]]" → local time (legacy behaviour)
 * - java.util.Date#toString() strings (best effort)
 */
export const parseServerDate = (value: DateInput | unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return valid(new Date(value.getTime()));
  if (typeof value === 'number') return Number.isFinite(value) ? valid(new Date(value)) : null;
  if (Array.isArray(value)) {
    const [y, mo = 1, d = 1, h = 0, mi = 0, s = 0, nanos = 0] = value.map(Number);
    if (!Number.isFinite(y)) return null;
    return valid(new Date(y, mo - 1, d, h, mi, s, Math.floor((nanos || 0) / 1e6)));
  }
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  if (/^-?\d{10,}$/.test(raw)) return valid(new Date(Number(raw)));

  let m = raw.match(DATE_ONLY_RE);
  if (m) return valid(new Date(+m[1], +m[2] - 1, +m[3]));

  m = raw.match(DATE_TIME_RE);
  if (m) {
    const [, y, mo, d, hh, mi, ss = '0', frac = '', zone] = m;
    const ms = frac ? Number(frac.slice(0, 3).padEnd(3, '0')) : 0;
    if (zone) {
      const utc = Date.UTC(+y, +mo - 1, +d, +hh, +mi, +ss, ms);
      return valid(new Date(utc - offsetMinutes(zone) * 60_000));
    }
    return valid(new Date(+y, +mo - 1, +d, +hh, +mi, +ss, ms));
  }

  m = raw.match(JAVA_DATE_RE);
  if (m) {
    const [, mon, day, hh, mi, ss, tz, year] = m;
    const month = MONTHS[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()];
    if (month === undefined) return null;
    const offset = TZ_OFFSETS[tz.toUpperCase()];
    if (offset !== undefined) {
      return valid(new Date(Date.UTC(+year, month, +day, +hh, +mi, +ss) - offset * 60_000));
    }
    return valid(new Date(+year, month, +day, +hh, +mi, +ss));
  }

  // Last resort: whatever the engine can parse (never return Invalid Date).
  try {
    return valid(new Date(raw));
  } catch {
    return null;
  }
};

/** Epoch millis for sorting/comparisons; `fallback` (default 0) when unparseable. */
export const serverDateMs = (value: DateInput | unknown, fallback = 0): number =>
  parseServerDate(value)?.getTime() ?? fallback;

/** Date-time to send to the backend: ISO-8601 UTC instant ("…Z"), or null. */
export const toServerDateTime = (value: DateInput | unknown): string | null => {
  const d = parseServerDate(value);
  return d ? d.toISOString() : null;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Pure date to send to the backend: "YYYY-MM-DD" from LOCAL components, or null. */
export const toLocalDateString = (value: DateInput | unknown): string | null => {
  const d = parseServerDate(value);
  return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : null;
};

/**
 * Locale of the current app language (fr-FR / en-GB); formatters read it at
 * call time so they follow the language switch. Pass `locale` to override.
 */
export const currentDateLocale = (): string =>
  useLanguageStore.getState().currentLanguage === 'en' ? 'en-GB' : 'fr-FR';

/** Local date, e.g. "05/10/2026" (default) or per `options`. */
export const formatDate = (
  value: DateInput | unknown,
  options?: Intl.DateTimeFormatOptions,
  fallback = '',
  locale: string = currentDateLocale()
): string => {
  const d = parseServerDate(value);
  return d ? d.toLocaleDateString(locale, options) : fallback;
};

/** Local date + time, e.g. "05/10/2026 12:00:00" (default) or per `options`. */
export const formatDateTime = (
  value: DateInput | unknown,
  options?: Intl.DateTimeFormatOptions,
  fallback = '',
  locale: string = currentDateLocale()
): string => {
  const d = parseServerDate(value);
  return d ? d.toLocaleString(locale, options) : fallback;
};

/** Local time "HH:mm" (default) or per `options`. */
export const formatTime = (
  value: DateInput | unknown,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
  fallback = '',
  locale: string = currentDateLocale()
): string => {
  const d = parseServerDate(value);
  return d ? d.toLocaleTimeString(locale, options) : fallback;
};

/**
 * The device's IANA time zone (e.g. "Africa/Douala"), or null when Intl or
 * timeZone resolution is unavailable — callers then omit the X-Timezone header.
 */
export const getDeviceTimeZone = (): string | null => {
  // Not cached: the user can change the device zone while the app is running.
  let tz: string | null = null;
  try {
    const resolved =
      typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined;
    tz = typeof resolved === 'string' && resolved.trim() ? resolved.trim() : null;
  } catch {
    tz = null;
  }
  return tz;
};

/** Header object to spread into raw fetch() calls to the backend. */
export const timeZoneHeaders = (): Record<string, string> => {
  const tz = getDeviceTimeZone();
  return tz ? { 'X-Timezone': tz } : {};
};

/**
 * Returns a shallow copy of `payload` where each listed date-time field that
 * holds a value is rewritten as an ISO instant with offset (toServerDateTime).
 * null/undefined/'' and unparseable values are left untouched.
 */
export const withServerDateTimes = <T extends object>(payload: T, keys: readonly string[]): T => {
  const out = { ...payload } as Record<string, unknown>;
  for (const key of keys) {
    const current = out[key];
    if (current === null || current === undefined || current === '') continue;
    const iso = toServerDateTime(current);
    if (iso) out[key] = iso;
  }
  return out as T;
};
