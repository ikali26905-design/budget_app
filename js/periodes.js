// Mois « budgétaires » : un mois peut commencer avant le 1er (par exemple le jour où la paye arrive).
//
// On retient seulement les débuts indiqués par l'utilisateur : { "2026-11": "2026-10-28", ... }.
// Un mois sans début indiqué commence le 1er. Un mois va de son début jusqu'à la veille du début du suivant.
//
// Règle qui rend tout simple : le début du mois M est compris entre le 15 du mois précédent
// et le 14 du mois M. Conséquences :
//  - deux mois ne peuvent jamais se chevaucher ;
//  - une date suffit pour savoir quel mois elle fait commencer (le 28/10 → novembre, le 3/11 → novembre).
// Toutes ces fonctions sont pures : les transactions gardent leur vraie date, seul le regroupement change.

import { moisDe, decalerMois, decalerJour } from './dates.js';

// Jour limite : à partir du 15, une date peut faire commencer le mois suivant
const JOUR_PIVOT = 15;

// Premier jour du mois budgétaire (le 1er par défaut)
export function debutPeriode(mois, debuts = {}) {
  return debuts[mois] ?? `${mois}-01`;
}

// Dernier jour du mois budgétaire : la veille du début du mois suivant
export function finPeriode(mois, debuts = {}) {
  return decalerJour(debutPeriode(decalerMois(mois, 1), debuts), -1);
}

// Mois budgétaire auquel appartient une date : « 2026-10-29 » → « 2026-11 » si novembre commence le 28/10
export function moisBudgetaire(date, debuts = {}) {
  const mois = moisDe(date);
  const suivant = decalerMois(mois, 1);
  if (date >= debutPeriode(suivant, debuts)) return suivant;
  if (date < debutPeriode(mois, debuts)) return decalerMois(mois, -1);
  return mois;
}

// Mois dont une date peut marquer le début : avant le 15 → ce mois-ci, à partir du 15 → le mois suivant
export function moisCommencantLe(date) {
  const mois = moisDe(date);
  return Number(date.slice(8, 10)) >= JOUR_PIVOT ? decalerMois(mois, 1) : mois;
}

// Dates autorisées pour le début d'un mois : du 15 du mois précédent au 14 du mois
export function bornesDebut(mois) {
  return { min: `${decalerMois(mois, -1)}-${JOUR_PIVOT}`, max: `${mois}-${JOUR_PIVOT - 1}` };
}

// Vrai si le mois n'est pas un mois calendaire classique (début ou fin décalé)
export function estPeriodeDecalee(mois, debuts = {}) {
  return debutPeriode(mois, debuts) !== `${mois}-01` || Boolean(debuts[decalerMois(mois, 1)]);
}
