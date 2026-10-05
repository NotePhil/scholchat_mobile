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
