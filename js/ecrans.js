// Rendu des 4 écrans (Accueil, Historique, Budgets, Réglages).
// Chaque fonction « rendreXxx » reçoit le conteneur de l'écran et un contexte :
//   { donnees, mois, filtre, actions }
// Elle redessine entièrement l'écran à partir des données (aucun état caché dans le DOM).
// Les clics sont transmis à app.js via les fonctions de « actions ».

import { creer, remplir, etatVide } from './ui.js';
import { formaterMontant, formaterMontantCourt } from './money.js';
import { nomDuMoisSeul, deMois } from './dates.js';
import {
  transactionsDuMois, calculerTotaux, calculerSoldeCumule, calculerTotalParCategorie,
  calculerEtatBudget, pourcentage,
} from './calculs.js';
import { creerGraphiqueBarres, creerJauge, infosNiveau } from './charts.js';

/* ===================== Outils communs ===================== */

// Catégorie de secours si une transaction pointe vers une catégorie inconnue
const CATEGORIE_INCONNUE = { id: '', nom: 'Sans catégorie', emoji: '❔', couleur: 8, type: 'depense' };

// Crée une fonction qui retrouve une catégorie par son id (via une Map, plus rapide qu'un find)
function indexerCategories(categories) {
  const index = new Map(categories.map((c) => [c.id, c]));
  return (id) => index.get(id) ?? CATEGORIE_INCONNUE;
}

// Bloc « libellé + montant » pour une jauge de budget, ex. « 180 € / 250 € »
function enTeteJauge(titre, etat) {
  return creer('div', { class: 'jauge__entete' },
    creer('span', { class: 'jauge__titre' }, titre),
    creer('span', { class: 'jauge__montants montant' },
      creer('strong', {}, formaterMontantCourt(etat.depense)), ` / ${formaterMontantCourt(etat.plafond)}`),
  );
}

// Ligne sous une jauge : pourcentage + niveau (symbole et texte) + reste ou dépassement
function piedJauge(etat) {
  const niveau = infosNiveau(etat.niveau);
  const reste = etat.reste >= 0
    ? `Reste ${formaterMontantCourt(etat.reste)}`
    : `Dépassé de ${formaterMontantCourt(-etat.reste)}`;
  return creer('div', { class: `jauge__pied jauge__pied--${etat.niveau}` },
    creer('span', {},
      creer('span', { class: 'jauge__symbole', 'aria-hidden': 'true' }, niveau.symbole),
      ` ${etat.pourcentage} %`, creer('span', { class: 'visuellement-cache' }, ` — ${niveau.libelle}`)),
    creer('span', { class: 'montant' }, reste),
  );
}

// Jauge complète (titre, montants, barre colorée, pied)
export function creerBlocJauge(titre, etat) {
  return creer('div', { class: 'jauge' },
    enTeteJauge(titre, etat),
    creerJauge(etat, `${titre} : ${formaterMontant(etat.depense)} sur ${formaterMontant(etat.plafond)}, ${etat.pourcentage} %`),
    piedJauge(etat),
  );
}

/* ===================== Accueil ===================== */

// Carte principale : le solde du mois, en très grand
function carteSolde(totaux, mois) {
  const positif = totaux.solde >= 0;
  const message = positif
    ? (totaux.solde > 0 ? 'Il te reste de la marge 👍' : "Tu es à l'équilibre")
    : 'Tu dépenses plus que tu ne gagnes ce mois-ci';
  return creer('div', { class: 'carte carte-solde' },
    creer('p', { class: 'carte-solde__label' }, `Solde ${deMois(mois)}`),
    creer('p', { class: `carte-solde__montant montant ${positif ? '' : 'carte-solde__montant--negatif'}` },
      (positif && totaux.solde > 0 ? '+' : '') + formaterMontant(totaux.solde)),
    creer('p', { class: 'carte-solde__message' }, message),
  );
}

// Deux tuiles côte à côte : total des revenus et total des dépenses
function tuilesTotaux(totaux) {
  const tuile = (libelle, montant, classe, symbole) => creer('div', { class: `tuile ${classe}` },
    creer('p', { class: 'tuile__label' }, creer('span', { 'aria-hidden': 'true' }, symbole), ` ${libelle}`),
    creer('p', { class: 'tuile__montant montant' }, formaterMontant(montant)));
  return creer('div', { class: 'tuiles' },
    tuile('Revenus', totaux.revenus, 'tuile--revenus', '↑'),
    tuile('Dépenses', totaux.depenses, 'tuile--depenses', '↓'));
}

// Ligne discrète : solde cumulé depuis la première transaction jusqu'à la fin du mois
function ligneSoldeCumule(cumul, mois) {
  return creer('div', { class: 'carte ligne-info' },
    creer('span', {}, 'Solde cumulé', creer('br'),
      creer('span', { class: 'aide' }, `tous les mois jusqu'à fin ${nomDuMoisSeul(mois)}`)),
    creer('strong', { class: `montant ${cumul < 0 ? 'montant--negatif' : ''}` }, formaterMontant(cumul)),
  );
}

// Carte du budget global (si défini), avec sa jauge
function carteBudgetGlobal(donnees, totaux) {
  if (!donnees.budgetGlobal) return null;
  const etat = calculerEtatBudget(totaux.depenses, donnees.budgetGlobal);
  return creer('div', { class: 'carte' }, creerBlocJauge('Budget du mois', etat));
}

// Carte « Dépenses par catégorie » avec le graphique en barres
function carteRepartition(duMois, categorie) {
  const totaux = calculerTotalParCategorie(duMois, 'depense');
  if (totaux.length === 0) {
    return creer('div', { class: 'carte' },
      creer('h2', { class: 'carte__titre' }, 'Dépenses par catégorie'),
      creer('p', { class: 'aide' }, 'Aucune dépense ce mois-ci.'));
  }
  const totalDepenses = totaux.reduce((s, t) => s + t.total, 0);
  const lignes = totaux.map(({ categorieId, total }) => {
    const c = categorie(categorieId);
    return {
      emoji: c.emoji,
      libelle: c.nom,
      valeur: total,
      couleur: `var(--serie-${c.couleur})`,
      texteValeur: formaterMontant(total),
      textePourcent: `${pourcentage(total, totalDepenses)} %`,
    };
  });
  return creer('div', { class: 'carte' },
    creer('h2', { class: 'carte__titre' }, 'Dépenses par catégorie'),
    creerGraphiqueBarres(lignes, 'Répartition des dépenses du mois par catégorie'));
}

// Écran d'accueil : solde du mois, totaux, solde cumulé, budget global, répartition
export function rendreAccueil(conteneur, { donnees, mois }) {
  const duMois = transactionsDuMois(donnees.transactions, mois);
  const cumul = calculerSoldeCumule(donnees.transactions, mois);
  if (duMois.length === 0) {
    remplir(conteneur,
      creer('div', { class: 'carte' },
        etatVide('🪙', 'Aucune transaction ce mois-ci, appuie sur +',
          'Note tes dépenses et tes revenus au fil de l’eau : tu sauras toujours où tu en es.')),
      donnees.transactions.length > 0 && ligneSoldeCumule(cumul, mois));
    return;
  }
  const totaux = calculerTotaux(duMois);
  remplir(conteneur,
    carteSolde(totaux, mois),
    tuilesTotaux(totaux),
    carteBudgetGlobal(donnees, totaux),
    carteRepartition(duMois, indexerCategories(donnees.categories)),
    ligneSoldeCumule(cumul, mois),
  );
}
