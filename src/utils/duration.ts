import { translate } from '../i18n';

/** Reading time for display: "< 1 min", "12 min", "1 h 05". Empty string when null/undefined. */
export const formatDuration = (seconds?: number | null): string => {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return translate('duration.lessThanMinute');
  const minutes = Math.round(s / 60);
  if (minutes < 60) return translate('duration.minutes', { m: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return translate('duration.hours', { h, m: String(m).padStart(2, '0') });
};
