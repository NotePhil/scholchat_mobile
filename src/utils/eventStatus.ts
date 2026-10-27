import { serverDateMs } from './dates';

/**
 * Status of an event computed from its dates (the server's UTC instants) — same rule as the backend's
 * `EvenementStatut` (returned as `statut`): PLANIFIE before the start, EN_COURS between start and end,
 * PASSE after the end (no end: after the start day); ANNULE stays ANNULE. Computed here too so a card
 * left on screen (or served from the feed cache) flips to "En cours"/"Terminé" on time. The stored
 * `etat` (always PLANIFIE at creation) is only a last resort when there is no start date.
 */
export const computeEventStatus = (
  e: { etat?: string | null; statut?: string | null; heureDebut?: string | null; heureFin?: string | null },
  now: number = Date.now()
): string | undefined => {
  if (e.etat === 'ANNULE' || e.statut === 'ANNULE') return 'ANNULE';
  const start = serverDateMs(e.heureDebut, NaN);
  if (Number.isNaN(start)) return e.statut || e.etat || undefined;
  if (now < start) return 'PLANIFIE';
  const end = serverDateMs(e.heureFin, NaN);
  if (!Number.isNaN(end) && end >= start) return now > end ? 'PASSE' : 'EN_COURS';
  // No end: running until the end of the start day (local day of the device).
  return new Date(now).toDateString() === new Date(start).toDateString() ? 'EN_COURS' : 'PASSE';
};
