// Suivi du PEA (Plan d'Épargne en Actions) : fonctions pures.
//
// Le PEA est un compte d'épargne comme les autres pour les versements et retraits (ils touchent le budget),
// mais sa VALEUR évolue avec la bourse. L'utilisateur la relève chaque mois : pea.releves = [{ date, valeur }].
// On compare cette valeur à ce qui a été réellement investi pour obtenir la plus ou moins-value.

import { ecartJours, moisEcoules } from './dates.js';

// Durée de détention à partir de laquelle les gains ne sont plus soumis à l'impôt sur le revenu
export const MOIS_AVANTAGE_FISCAL = 60;
// Au-delà de ce nombre de jours sans relevé, on rappelle de faire le point
export const JOURS_AVANT_RAPPEL = 31;
// Frais par défaut sur les versements, en points de base (100 = 1 %)
export const TAUX_FRAIS_DEFAUT = 100;

// Frais d'un versement en centimes, arrondis au centime le plus proche : (10 000 c, 100 pb) → 100 c (1 €)
// Calcul en entiers : on ajoute 5 000 avant la division entière pour arrondir au plus proche
export function calculerFrais(montant, tauxPointsDeBase) {
  return Math.floor((montant * tauxPointsDeBase + 5000) / 10000);
}

// Frais à appliquer à un versement : seulement un versement (« epargne ») sur le compte du PEA
export function fraisDuVersement(valeurs, pea) {
  if (!pea || valeurs.type !== 'epargne' || valeurs.categorieId !== pea.compteId) return 0;
  return calculerFrais(valeurs.montant, pea.tauxFrais ?? TAUX_FRAIS_DEFAUT);
}

// Total des frais de versement payés sur le PEA
export function totalFrais(transactions, compteId) {
  return transactions.reduce((s, t) => s + (t.categorieId === compteId ? (t.frais ?? 0) : 0), 0);
}

// Relevés triés du plus ancien au plus récent
export function trierReleves(releves) {
  return [...releves].sort((a, b) => a.date.localeCompare(b.date));
}

// Montant net investi dans le PEA jusqu'à une date : investi de départ + versements − retraits
export function calculerInvesti(transactions, compteId, soldeInitial = 0, dateLimite = '9999-12-31') {
  let total = soldeInitial;
  for (const t of transactions) {
    if (t.categorieId !== compteId || t.date > dateLimite) continue;
    if (t.type === 'epargne') total += t.montant;
    if (t.type === 'retrait') total -= t.montant;
  }
  return total;
}

// Dernier relevé connu à une date (ou null s'il n'y en a aucun)
export function dernierReleve(releves, dateLimite = '9999-12-31') {
  const anterieurs = trierReleves(releves).filter((r) => r.date <= dateLimite);
  return anterieurs.length > 0 ? anterieurs[anterieurs.length - 1] : null;
}

// Valeur estimée à une date : dernier relevé + versements − retraits faits APRÈS ce relevé.
// (Un relevé est supposé inclure les mouvements du jour même.) Renvoie null sans aucun relevé.
export function calculerValeurEstimee(pea, transactions, dateLimite = '9999-12-31') {
  const releve = dernierReleve(pea.releves, dateLimite);
  if (!releve) return null;
  let valeur = releve.valeur;
  for (const t of transactions) {
    if (t.categorieId !== pea.compteId || t.date <= releve.date || t.date > dateLimite) continue;
    if (t.type === 'epargne') valeur += t.montant;
    if (t.type === 'retrait') valeur -= t.montant;
  }
  return valeur;
}

// Plus-value en centimes et en dixièmes de pourcent (ex. 80 = +8,0 %) ; pourcentage null si rien d'investi
export function calculerPlusValue(valeur, investi) {
  const montant = valeur - investi;
  const pourMille = investi > 0 ? Math.round((montant * 1000) / investi) : null;
  return { montant, pourMille };
}

// Résumé complet du PEA à une date : investi, valeur (estimée ou null), plus-value, dernier relevé
export function resumerPea(pea, transactions, soldeInitial = 0, dateLimite = '9999-12-31') {
  const investi = calculerInvesti(transactions, pea.compteId, soldeInitial, dateLimite);
  const valeur = calculerValeurEstimee(pea, transactions, dateLimite);
  const releve = dernierReleve(pea.releves, dateLimite);
  return {
    investi,
    valeur,
    releve,
    plusValue: valeur === null ? null : calculerPlusValue(valeur, investi),
  };
}

// Points du graphique : pour chaque relevé, la valeur relevée et le montant investi à cette date
export function serieEvolution(pea, transactions, soldeInitial = 0) {
  return trierReleves(pea.releves).map((r) => ({
    date: r.date,
    valeur: r.valeur,
    investi: calculerInvesti(transactions, pea.compteId, soldeInitial, r.date),
  }));
}

// Vrai si le dernier relevé date de plus d'un mois (ou s'il n'y en a pas)
export function rappelNecessaire(releves, aujourdhui) {
  const releve = dernierReleve(releves);
  return !releve || ecartJours(releve.date, aujourdhui) > JOURS_AVANT_RAPPEL;
}

// Avantage fiscal (5 ans) : { acquis, moisRestants, dateAcquisition } à partir de la date d'ouverture
export function avantageFiscal(dateOuverture, aujourdhui) {
  const ecoules = moisEcoules(dateOuverture, aujourdhui);
  const [annee, mois, jour] = dateOuverture.split('-');
  return {
    acquis: ecoules >= MOIS_AVANTAGE_FISCAL,
    moisRestants: Math.max(0, MOIS_AVANTAGE_FISCAL - ecoules),
    dateAcquisition: `${Number(annee) + 5}-${mois}-${jour}`,
  };
}
