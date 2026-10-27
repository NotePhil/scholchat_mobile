/**
 * Valid education levels — same list (and same values) as the web's single source of truth,
 * scholchat_front/src/constants/niveaux.js. Every mobile form that lets a user pick a "niveau"
 * must use this list rather than its own copy, so the two apps never drift apart.
 */
export const NIVEAUX = [
  'CP',
  'CE1',
  'CE2',
  'CM1',
  'CM2',
  '6ème',
  '5ème',
  '4ème',
  '3ème',
  '2nde',
  '1ère',
  'Terminale',
  'Licence 1',
  'Licence 2',
  'Licence 3',
  'Master 1',
  'Master 2',
] as const;

export type Niveau = (typeof NIVEAUX)[number];

/**
 * "Autre" option offered at the end of CLASS level pickers: it reveals a free-text input and the
 * typed text (not "Autre") is sent as the class niveau — the backend accepts any class level.
 * (Exercises stay restricted to NIVEAUX.) Same as the web's constants/niveaux.js.
 */
export const NIVEAU_AUTRE = 'Autre';

/** true when the level is one of the standard NIVEAUX (otherwise it's a custom "Autre" level). */
export const isNiveauStandard = (niveau: string | null | undefined): boolean =>
  !!niveau && (NIVEAUX as readonly string[]).includes(niveau);
