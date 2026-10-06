// Export (JSON, CSV) et import (JSON) des données.
// genererCSV et validerImport sont pures (testables dans Node) ; telecharger utilise le navigateur.

import { MONTANT_MAX } from './money.js';
import { aujourdhui, estDateValide } from './dates.js';
import { typeDeCategorie } from './calculs.js';
import { moisBudgetaire, moisCommencantLe } from './periodes.js';

const TYPES_CATEGORIES = ['depense', 'revenu', 'epargne'];
const TYPES_TRANSACTIONS = ['depense', 'revenu', 'epargne', 'retrait'];

// Libellé de chaque type de transaction dans le fichier CSV
const LIBELLES_CSV = {
  depense: 'Dépense',
  revenu: 'Revenu',
  epargne: 'Épargne (versement)',
  retrait: 'Épargne (retrait)',
};
const MARQUEUR = 'mon-budget'; // permet de reconnaître nos propres fichiers à l'import

/* ===================== Export ===================== */

// Nom de fichier daté : « mon-budget-2026-10-05.json »
export function nomFichier(extension) {
  return `${MARQUEUR}-${aujourdhui()}.${extension}`;
}

// Produit le contenu du fichier de sauvegarde JSON (lisible, indenté)
export function genererJSON(donnees) {
  return JSON.stringify({ application: MARQUEUR, exporteLe: new Date().toISOString(), ...donnees }, null, 2);
}

// Protège un champ CSV : guillemets si besoin, et neutralise les formules (=, +, -, @) pour Excel
function champCSV(valeur) {
  let texte = String(valeur);
  if (/^[=+\-@]/.test(texte)) texte = `'${texte}`;
  if (/[;"\r\n]/.test(texte)) texte = `"${texte.replace(/"/g, '""')}"`;
  return texte;
}

// Montant signé pour un tableur français : 1890 centimes (dépense) → « -18,90 »
// (comme dans l'app : dépense et versement d'épargne sortent du budget, donc négatifs)
function montantCSV(transaction) {
  const signe = transaction.type === 'depense' || transaction.type === 'epargne' ? '-' : '';
  const euros = Math.floor(transaction.montant / 100);
  const centimes = String(transaction.montant % 100).padStart(2, '0');
  return `${signe}${euros},${centimes}`;
}

// Produit un CSV (séparateur « ; », virgule décimale) que Excel et LibreOffice ouvrent directement
export function genererCSV(donnees) {
  const categories = new Map(donnees.categories.map((c) => [c.id, c.nom]));
  const entete = ['Date', 'Mois', 'Type', 'Catégorie', 'Montant (€)', 'Note', 'Mensuelle'];
  const lignes = [...donnees.transactions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.creeLe - b.creeLe)
    .map((t) => [
      t.date,
      moisBudgetaire(t.date, donnees.debutsMois), // mois budgétaire (peut différer de la date, ex. paye)
      LIBELLES_CSV[t.type],
      champCSV(categories.get(t.categorieId) ?? 'Sans catégorie'),
      montantCSV(t), // pas de champCSV ici : le « - » d'un montant négatif doit rester un nombre
      champCSV(t.note ?? ''),
      t.recurrenteId ? 'oui' : 'non',
    ].join(';'));
  // ﻿ (BOM) : indique à Excel que le fichier est en UTF-8 (sinon « Dépense » devient « DÃ©pense »)
  return `﻿${[entete.join(';'), ...lignes].join('\r\n')}\r\n`;
}

// Déclenche le téléchargement d'un fichier généré dans le navigateur
export function telecharger(nom, contenu, typeMime) {
  const url = URL.createObjectURL(new Blob([contenu], { type: typeMime }));
  const lien = Object.assign(document.createElement('a'), { href: url, download: nom });
  document.body.append(lien);
  lien.click();
  lien.remove();
  // On libère la mémoire un peu plus tard, une fois le téléchargement lancé
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ===================== Import ===================== */

// Erreur de validation avec un message destiné à l'utilisateur
class ErreurImport extends Error {}

// Lève une ErreurImport si la condition est fausse
function verifier(condition, message) {
  if (!condition) throw new ErreurImport(message);
}

// Vrai si la valeur est un montant valide en centimes
function estMontant(valeur) {
  return Number.isSafeInteger(valeur) && valeur > 0 && valeur <= MONTANT_MAX;
}

// Valide et nettoie une catégorie importée
function nettoyerCategorie(c, i) {
  verifier(c && typeof c.id === 'string' && c.id, `Catégorie n°${i + 1} : identifiant manquant.`);
  verifier(typeof c.nom === 'string' && c.nom.trim(), `Catégorie n°${i + 1} : nom manquant.`);
  verifier(TYPES_CATEGORIES.includes(c.type), `Catégorie « ${c.nom} » : type inconnu.`);
  const couleur = Number.isInteger(c.couleur) && c.couleur >= 1 && c.couleur <= 8 ? c.couleur : 8;
  return { id: c.id, nom: c.nom.trim().slice(0, 40), emoji: typeof c.emoji === 'string' && c.emoji ? c.emoji.slice(0, 8) : '📦', type: c.type, couleur };
}

// Vérifie que la catégorie existe et correspond au type (ex. un retrait doit viser un compte d'épargne)
function verifierCategorie(element, nom, typesCategories) {
  verifier(typesCategories.has(element.categorieId), `${nom} : catégorie inconnue.`);
  verifier(typesCategories.get(element.categorieId) === typeDeCategorie(element.type), `${nom} : catégorie d'un autre type.`);
}

// Valide et nettoie une transaction importée
function nettoyerTransaction(t, i, typesCategories) {
  const nom = `Transaction n°${i + 1}`;
  verifier(t && typeof t.id === 'string' && t.id, `${nom} : identifiant manquant.`);
  verifier(TYPES_TRANSACTIONS.includes(t.type), `${nom} : type inconnu.`);
  verifier(estMontant(t.montant), `${nom} : montant invalide (il doit être en centimes, entier et positif).`);
  verifierCategorie(t, nom, typesCategories);
  verifier(estDateValide(t.date), `${nom} : date invalide.`);
  return {
    id: t.id,
    type: t.type,
    montant: t.montant,
    categorieId: t.categorieId,
    date: t.date,
    note: typeof t.note === 'string' ? t.note.slice(0, 80) : '',
    recurrenteId: typeof t.recurrenteId === 'string' ? t.recurrenteId : null,
    creeLe: Number.isFinite(t.creeLe) ? t.creeLe : 0,
  };
}

// Valide et nettoie un modèle de transaction mensuelle importé
function nettoyerRecurrente(r, i, typesCategories) {
  const nom = `Transaction mensuelle n°${i + 1}`;
  verifier(r && typeof r.id === 'string' && r.id, `${nom} : identifiant manquant.`);
  verifier(TYPES_TRANSACTIONS.includes(r.type), `${nom} : type inconnu.`);
  verifier(estMontant(r.montant), `${nom} : montant invalide.`);
  verifierCategorie(r, nom, typesCategories);
  verifier(Number.isInteger(r.jour) && r.jour >= 1 && r.jour <= 31, `${nom} : jour invalide.`);
  verifier(typeof r.dernierMois === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(r.dernierMois), `${nom} : mois invalide.`);
  return { id: r.id, type: r.type, montant: r.montant, categorieId: r.categorieId, jour: r.jour, note: typeof r.note === 'string' ? r.note.slice(0, 80) : '', dernierMois: r.dernierMois };
}

// Vérifie qu'une liste ne contient pas deux fois le même id
function verifierIdsUniques(liste, quoi) {
  verifier(new Set(liste.map((e) => e.id)).size === liste.length, `Le fichier contient deux ${quoi} avec le même identifiant.`);
}

// Garde, dans un objet { idCompte → centimes }, les montants valides de comptes d'épargne existants
function montantsDesComptes(objet, typesCategories) {
  const resultat = {};
  for (const [id, montant] of Object.entries(objet ?? {})) {
    if (typesCategories.get(id) === 'epargne' && estMontant(montant)) resultat[id] = montant;
  }
  return resultat;
}

// Garde les débuts de mois valides : une vraie date, qui correspond bien au mois indiqué
function nettoyerDebutsMois(objet) {
  const resultat = {};
  for (const [mois, date] of Object.entries(objet ?? {})) {
    if (estDateValide(date) && moisCommencantLe(date) === mois) resultat[mois] = date;
  }
  return resultat;
}

/**
 * Valide un objet issu d'un fichier JSON importé.
 * Renvoie { ok: true, donnees } (données nettoyées) ou { ok: false, erreur } (message lisible).
 */
export function validerImport(objet) {
  try {
    verifier(objet && typeof objet === 'object' && !Array.isArray(objet), "Ce fichier n'est pas une sauvegarde de Mon Budget.");
    verifier(Array.isArray(objet.categories) && Array.isArray(objet.transactions), "Ce fichier n'est pas une sauvegarde de Mon Budget.");
    const categories = objet.categories.map(nettoyerCategorie);
    verifierIdsUniques(categories, 'catégories');
    // Les comptes d'épargne sont facultatifs : les fichiers d'avant l'épargne n'en ont pas (ils seront ajoutés)
    verifier(['depense', 'revenu'].every((type) => categories.some((c) => c.type === type)), 'Le fichier doit contenir au moins une catégorie de dépense et une de revenu.');
    const typesCategories = new Map(categories.map((c) => [c.id, c.type]));

    const transactions = objet.transactions.map((t, i) => nettoyerTransaction(t, i, typesCategories));
    verifierIdsUniques(transactions, 'transactions');
    const recurrentes = (Array.isArray(objet.recurrentes) ? objet.recurrentes : []).map((r, i) => nettoyerRecurrente(r, i, typesCategories));
    verifierIdsUniques(recurrentes, 'transactions mensuelles');
    // Un lien vers un modèle mensuel absent du fichier est simplement retiré
    const idsRecurrentes = new Set(recurrentes.map((r) => r.id));
    for (const t of transactions) {
      if (!idsRecurrentes.has(t.recurrenteId)) t.recurrenteId = null;
    }

    // Budgets : on ne garde que les plafonds valides de catégories de dépense existantes
    const budgets = {};
    for (const [id, plafond] of Object.entries(objet.budgets ?? {})) {
      if (typesCategories.get(id) === 'depense' && estMontant(plafond)) budgets[id] = plafond;
    }
    const budgetGlobal = estMontant(objet.budgetGlobal) ? objet.budgetGlobal : null;
    // Objectifs et soldes de départ : uniquement pour des comptes d'épargne existants
    const objectifs = montantsDesComptes(objet.objectifs, typesCategories);
    const soldesInitiaux = montantsDesComptes(objet.soldesInitiaux, typesCategories);
    const debutsMois = nettoyerDebutsMois(objet.debutsMois);

    return { ok: true, donnees: { categories, transactions, recurrentes, budgets, budgetGlobal, objectifs, soldesInitiaux, debutsMois } };
  } catch (erreur) {
    if (erreur instanceof ErreurImport) return { ok: false, erreur: erreur.message };
    throw erreur;
  }
}
