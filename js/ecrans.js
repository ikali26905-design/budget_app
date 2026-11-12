// Rendu des 5 écrans (Accueil, Historique, Épargne, Budgets, Réglages).
// Chaque fonction « rendreXxx » reçoit le conteneur de l'écran et un contexte :
//   { donnees, mois, filtre, actions }
// Elle redessine entièrement l'écran à partir des données (aucun état caché dans le DOM).
// Les clics sont transmis à app.js via les fonctions de « actions ».

import { creer, remplir, etatVide, badgeCategorie, icone, rendreGlissable } from './ui.js';
import { THEMES } from './preferences.js';
import { formaterMontant, formaterMontantCourt, formaterMontantSigne } from './money.js';
import { nomDuMoisSeul, nomDuMois, libelleJour, aujourdhui, decalerMois, dateLongue, dateCourte, ecartJours } from './dates.js';
import { resumerPea, serieEvolution, rappelNecessaire, avantageFiscal, trierReleves, totalFrais, TAUX_FRAIS_DEFAUT } from './pea.js';
import { finPeriode, bornesDebut } from './periodes.js';
import {
  transactionsDuMois, calculerTotaux, calculerSoldeCumule, calculerTotalParCategorie,
  calculerEtatBudget, pourcentage, grouperParJour, categoriesUtilisees, compterUtilisations,
  calculerSoldesEpargne, montantDebite, ID_COMPTE_EPARGNE,
} from './calculs.js';
import { creerGraphiqueBarres, creerJauge, infosNiveau, creerBarreProgression, creerGraphiqueEvolution } from './charts.js';

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
  let reste = `Reste ${formaterMontantCourt(etat.reste)}`;
  if (etat.reste === 0) reste = 'Plafond atteint';
  if (etat.reste < 0) reste = `Dépassé de ${formaterMontantCourt(-etat.reste)}`;
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

// Icônes « œil » ouvert / barré (mode discret)
const OEIL = ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'];
const OEIL_BARRE = ['M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2', 'M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6', 'M9.9 9.9a3 3 0 0 0 4.2 4.2', 'M3 3l18 18'];

// Bouton « œil » : masque ou affiche tous les montants de l'app
function boutonDiscret(discret, actions) {
  return creer('button', {
    type: 'button',
    class: 'heros__oeil',
    'aria-pressed': discret ? 'true' : 'false',
    'aria-label': discret ? 'Afficher les montants' : 'Masquer les montants',
    onclick: actions.basculerDiscret,
  }, icone(...(discret ? OEIL_BARRE : OEIL)));
}

// Carte principale : le solde du compte en très grand, le solde du mois en pastille juste dessous
function carteSolde(totaux, mois, cumul, discret, actions) {
  const positif = totaux.solde >= 0;
  const totalHeros = (libelle, montant, symbole) => creer('div', { class: 'heros__total' },
    creer('span', { class: 'heros__total-label' }, creer('span', { 'aria-hidden': 'true' }, symbole), ` ${libelle}`),
    creer('span', { class: 'heros__total-montant montant' }, formaterMontantCourtArrondi(montant)));
  // Chiffre principal : ce qu'il y a sur le compte (solde cumulé jusqu'à la fin du mois affiché)
  return creer('div', { class: 'carte carte-solde heros' },
    creer('div', { class: 'heros__entete' },
      creer('p', { class: 'carte-solde__label' }, 'Solde du compte'),
      boutonDiscret(discret, actions)),
    creer('p', { class: `carte-solde__montant montant ${cumul < 0 ? 'carte-solde__montant--negatif' : ''}`, 'data-valeur': String(cumul) },
      montantAvecCentimes(formaterMontant(cumul))),
    creer('div', { class: 'heros__mois' },
      creer('span', { class: `heros__puce ${positif ? '' : 'heros__puce--negatif'}` },
        `${majuscule(nomDuMoisSeul(mois))} : ${(positif && totaux.solde > 0 ? '+' : '')}${formaterMontant(totaux.solde)}`)),
    creer('div', { class: 'heros__totaux' },
      totalHeros('Revenus', totaux.revenus, '↑'),
      totalHeros('Dépenses', totaux.depenses, '↓'),
      totalHeros('Épargne', totaux.epargne + totaux.frais, '⇢')), // frais de versement compris
  );
}

// « novembre » → « Novembre »
function majuscule(texte) {
  return texte.replace(/^./, (l) => l.toUpperCase());
}

// « 1 234,56 € » → « 1 234 » en grand et « ,56 € » en plus petit (renvoie une liste d'éléments)
export function montantAvecCentimes(texte) {
  const virgule = texte.lastIndexOf(',');
  const entier = virgule === -1 ? texte : texte.slice(0, virgule);
  // En très grand et resserré, l'espace des milliers disparaît : chaque groupe de chiffres
  // devient un <span> séparé par une marge (« 1 408 » reste lisible)
  const groupes = entier.split(/[\s\u00a0\u202f]/).map((g, i) => creer('span', { class: i > 0 ? 'milliers' : null }, g));
  return virgule === -1 ? groupes : [...groupes, creer('span', { class: 'centimes' }, texte.slice(virgule))];
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

// Écran d'accueil : solde du compte (avec le mois en pastille), budget global, répartition
export function rendreAccueil(conteneur, { donnees, mois, moisCourant, discret, actions }) {
  const duMois = transactionsDuMois(donnees.transactions, mois, donnees.debutsMois);
  const cumul = calculerSoldeCumule(donnees.transactions, mois, donnees.debutsMois);
  const totaux = calculerTotaux(duMois);
  const vide = creer('div', { class: 'carte' },
    etatVide('🪙', 'Aucune transaction ce mois-ci, appuie sur +',
      'Note tes dépenses et tes revenus au fil de l’eau : tu sauras toujours où tu en es.'));
  // Toute première utilisation : seulement l'invitation (un solde à 0 n'apprendrait rien)
  if (donnees.transactions.length === 0) {
    remplir(conteneur, vide);
    return;
  }
  remplir(conteneur,
    carteSolde(totaux, mois, cumul, discret, actions),
    duMois.length === 0 ? vide : [
      carteBudgetGlobal(donnees, totaux),
      carteRepartition(duMois, indexerCategories(donnees.categories)),
    ],
    carteNouveauMois(donnees, mois, moisCourant, actions),
  );
}

// En fin de mois, propose de faire commencer le mois suivant (quand la paye arrive)
function carteNouveauMois(donnees, mois, moisCourant, actions) {
  const prochain = decalerMois(mois, 1);
  // Seulement sur le mois en cours, à partir du 15, et si le mois suivant n'a pas déjà de début
  if (mois !== moisCourant || donnees.debutsMois[prochain] || aujourdhui() < bornesDebut(prochain).min) return null;
  return creer('div', { class: 'carte carte-nouveau-mois' },
    creer('p', {}, creer('strong', {}, 'Ta paye est arrivée ?'), creer('br'),
      creer('span', { class: 'aide' }, `Fais commencer ${nomDuMoisSeul(prochain)} dès aujourd’hui : tes prochaines transactions compteront pour ce mois.`)),
    creer('button', { type: 'button', class: 'bouton bouton--secondaire bouton--plein', onclick: actions.commencerMois },
      `Commencer ${nomDuMoisSeul(prochain)}`));
}

/* ===================== Historique ===================== */

// Rangée de pastilles de filtre (« Toutes » + les catégories utilisées ce mois-ci)
function barreFiltres(categories, filtre, actions) {
  const bouton = (id, contenu) => creer('button', {
    type: 'button',
    class: 'filtre',
    'aria-pressed': String(filtre === id),
    onclick: () => actions.changerFiltre(id),
  }, contenu);
  return creer('div', { class: 'filtres', role: 'group', 'aria-label': 'Filtrer par catégorie' },
    bouton(null, 'Toutes'),
    categories.map((c) => bouton(c.id, [creer('span', { 'aria-hidden': 'true' }, c.emoji), ` ${c.nom}`])),
  );
}

// Résumé affiché quand un filtre est actif : « 171,50 € · 3 transactions »
function resumeFiltre(transactions, categorie) {
  // Pour un compte d'épargne, les retraits viennent en déduction des versements
  const total = transactions.reduce((s, t) => s + (t.type === 'retrait' ? -t.montant : t.montant), 0);
  const nb = transactions.length;
  return creer('p', { class: 'resume-filtre' },
    creer('strong', {}, categorie.nom), ' : ',
    creer('span', { class: 'montant' }, formaterMontant(total)),
    ` · ${nb} transaction${nb > 1 ? 's' : ''}`);
}

// Couleur du montant selon le type (l'épargne reste neutre : ce n'est ni un gain ni une perte)
const CLASSES_MONTANT = { depense: '', revenu: 'montant--revenu', epargne: 'montant--epargne', retrait: 'montant--epargne' };

// Texte secondaire d'une ligne : la note, ou à défaut la nature du mouvement d'épargne
function noteTransaction(transaction) {
  let texte = transaction.note;
  if (!texte && transaction.type === 'epargne') texte = 'Mis de côté';
  if (!texte && transaction.type === 'retrait') texte = 'Retiré de l’épargne';
  // Les frais de versement (PEA) sont rappelés pour expliquer le montant débité
  if (transaction.frais) texte = `${texte} · dont ${formaterMontant(transaction.frais)} de frais`;
  return texte;
}

// Une ligne de transaction : un toucher ouvre la modification ;
// glissée vers la droite elle s'ouvre aussi, vers la gauche elle est supprimée (avec « Annuler »)
function ligneTransaction(transaction, categorie, actions) {
  const recurrente = transaction.recurrenteId !== null;
  const ligne = creer('li', {},
    creer('button', {
      type: 'button',
      class: 'ligne-transaction',
      onclick: () => actions.modifierTransaction(transaction),
    },
    badgeCategorie(categorie),
    creer('span', { class: 'ligne-transaction__texte' },
      creer('span', { class: 'ligne-transaction__nom' }, categorie.nom,
        recurrente && creer('span', { class: 'ligne-transaction__recurrente', title: 'Chaque mois' },
          icone('M17 2l4 4-4 4', 'M3 11V9a3 3 0 0 1 3-3h15', 'M7 22l-4-4 4-4', 'M21 13v2a3 3 0 0 1-3 3H3'),
          creer('span', { class: 'visuellement-cache' }, ' (chaque mois)'))),
      noteTransaction(transaction) && creer('span', { class: 'ligne-transaction__note' }, noteTransaction(transaction))),
    creer('span', { class: `ligne-transaction__montant montant ${CLASSES_MONTANT[transaction.type]}` },
      formaterMontantSigne(montantDebite(transaction), transaction.type)),
    ));
  return rendreGlissable(ligne, {
    libelleGauche: 'Supprimer',
    surGauche: () => actions.supprimerTransaction(transaction),
    libelleDroite: 'Modifier',
    surDroite: () => actions.modifierTransaction(transaction),
  });
}

// Un groupe « jour » : titre (Aujourd'hui, Hier, Lundi 5 octobre) + ses transactions
function groupeJour(groupe, categorie, actions) {
  return creer('section', { class: 'jour' },
    creer('h2', { class: 'jour__titre' },
      creer('span', {}, libelleJour(groupe.date)),
      creer('span', { class: 'montant' }, formaterMontantSigne(Math.abs(groupe.solde), groupe.solde >= 0 ? 'revenu' : 'depense'))),
    creer('ul', { class: 'liste carte' },
      groupe.transactions.map((t) => ligneTransaction(t, categorie(t.categorieId), actions))),
  );
}

// Écran Historique : filtres, puis transactions du mois groupées par jour
export function rendreHistorique(conteneur, { donnees, mois, filtre, actions }) {
  const duMois = transactionsDuMois(donnees.transactions, mois, donnees.debutsMois);
  if (duMois.length === 0) {
    remplir(conteneur, creer('div', { class: 'carte' },
      etatVide('🧾', 'Aucune transaction ce mois-ci, appuie sur +', 'Tes dépenses et revenus apparaîtront ici, jour par jour.')));
    return;
  }
  const categorie = indexerCategories(donnees.categories);
  const utilisees = categoriesUtilisees(duMois, donnees.categories);
  // Un filtre sur une catégorie absente ce mois-ci est ignoré
  const filtreActif = utilisees.some((c) => c.id === filtre) ? filtre : null;
  const visibles = filtreActif ? duMois.filter((t) => t.categorieId === filtreActif) : duMois;
  remplir(conteneur,
    barreFiltres(utilisees, filtreActif, actions),
    filtreActif ? resumeFiltre(visibles, categorie(filtreActif)) : creer('p', { class: 'aide aide--centre' }, 'Touche une transaction pour la modifier. Glisse-la vers la gauche pour la supprimer.'),
    grouperParJour(visibles).map((g) => groupeJour(g, categorie, actions)),
  );
}

/* ===================== Budgets ===================== */

// Carte du budget global : jauge si défini, sinon invitation à le définir
function carteBudgetGlobalEditable(donnees, totalDepenses, actions) {
  if (!donnees.budgetGlobal) {
    return creer('div', { class: 'carte' },
      creer('h2', { class: 'carte__titre' }, 'Budget global du mois'),
      creer('p', { class: 'aide aide--sous-champ' }, 'Fixe un maximum pour l’ensemble de tes dépenses du mois.'),
      creer('button', { type: 'button', class: 'bouton bouton--secondaire bouton--plein', onclick: () => actions.modifierBudget(null) },
        'Définir un budget global'));
  }
  const etat = calculerEtatBudget(totalDepenses, donnees.budgetGlobal);
  return creer('button', { type: 'button', class: 'carte carte--bouton', onclick: () => actions.modifierBudget(null), 'aria-label': `Modifier le budget global, ${formaterMontant(etat.depense)} sur ${formaterMontant(etat.plafond)}` },
    creerBlocJauge('Budget global', etat));
}

// Ligne d'une catégorie avec plafond : jauge cliquable
function ligneBudget(categorie, etat, actions) {
  return creer('li', {},
    creer('button', { type: 'button', class: 'ligne-budget', onclick: () => actions.modifierBudget(categorie.id) },
      creerBlocJauge(`${categorie.emoji} ${categorie.nom}`, etat)));
}

// Ligne d'une catégorie sans plafond : dépensé ce mois-ci + invitation
function ligneSansPlafond(categorie, depense, actions) {
  return creer('li', {},
    creer('button', { type: 'button', class: 'ligne-transaction', onclick: () => actions.modifierBudget(categorie.id) },
      badgeCategorie(categorie),
      creer('span', { class: 'ligne-transaction__texte' },
        creer('span', { class: 'ligne-transaction__nom' }, categorie.nom),
        creer('span', { class: 'ligne-transaction__note' }, `${formaterMontant(depense)} dépensés`)),
      creer('span', { class: 'lien-action' }, 'Définir')));
}

// Écran Budgets : budget global, catégories avec plafond (les plus consommées d'abord), puis sans plafond
export function rendreBudgets(conteneur, { donnees, mois, actions }) {
  const duMois = transactionsDuMois(donnees.transactions, mois, donnees.debutsMois);
  const depensesParCategorie = new Map(calculerTotalParCategorie(duMois, 'depense').map((t) => [t.categorieId, t.total]));
  const totalDepenses = calculerTotaux(duMois).depenses;
  const categoriesDepense = donnees.categories.filter((c) => c.type === 'depense');

  const avecPlafond = categoriesDepense
    .filter((c) => donnees.budgets[c.id])
    .map((c) => ({ categorie: c, etat: calculerEtatBudget(depensesParCategorie.get(c.id) ?? 0, donnees.budgets[c.id]) }))
    .sort((a, b) => b.etat.pourcentage - a.etat.pourcentage);
  const sansPlafond = categoriesDepense.filter((c) => !donnees.budgets[c.id]);

  remplir(conteneur,
    carteBudgetGlobalEditable(donnees, totalDepenses, actions),
    creer('h2', { class: 'titre-section' }, 'Par catégorie'),
    avecPlafond.length > 0
      ? creer('ul', { class: 'liste carte liste--budgets' }, avecPlafond.map(({ categorie, etat }) => ligneBudget(categorie, etat, actions)))
      : creer('p', { class: 'aide aide--centre' }, 'Aucun plafond pour l’instant. Touche une catégorie ci-dessous pour en définir un.'),
    sansPlafond.length > 0 && [
      creer('h2', { class: 'titre-section' }, 'Sans plafond'),
      creer('ul', { class: 'liste carte' }, sansPlafond.map((c) => ligneSansPlafond(c, depensesParCategorie.get(c.id) ?? 0, actions))),
    ],
  );
}

/* ===================== Réglages ===================== */

// Icône « corbeille » (tracés SVG)
const TRACES_CORBEILLE = ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6M14 11v6'];

// Texte d'utilisation d'une catégorie : « 12 transactions » ou « Pas encore utilisée »
function texteUtilisation(utilisations) {
  if (utilisations.total === 0) return 'Pas encore utilisée';
  const morceaux = [];
  if (utilisations.transactions > 0) morceaux.push(`${utilisations.transactions} transaction${utilisations.transactions > 1 ? 's' : ''}`);
  if (utilisations.recurrentes > 0) morceaux.push(`${utilisations.recurrentes} mensuelle${utilisations.recurrentes > 1 ? 's' : ''}`);
  return morceaux.join(' · ');
}

// Liste des catégories d'un type, avec bouton de suppression et bouton d'ajout
function sectionCategories(titre, type, donnees, actions) {
  // Le compte PEA se gère dans sa section de l'onglet Épargne
  const categories = donnees.categories.filter((c) => c.type === type && c.id !== donnees.pea?.compteId);
  return [
    creer('h2', { class: 'titre-section' }, titre),
    creer('div', { class: 'carte carte--liste' },
      creer('ul', { class: 'liste' }, categories.map((c) => creer('li', { class: 'ligne-reglage' },
        badgeCategorie(c),
        creer('span', { class: 'ligne-transaction__texte' },
          creer('span', { class: 'ligne-transaction__nom' }, c.nom),
          creer('span', { class: 'ligne-transaction__note' }, texteUtilisation(compterUtilisations(c.id, donnees)))),
        creer('button', { type: 'button', class: 'bouton-icone bouton-icone--danger', 'aria-label': `Supprimer la catégorie ${c.nom}`, onclick: () => actions.supprimerCategorie(c) },
          icone(...TRACES_CORBEILLE))))),
      creer('div', { class: 'pied-liste' },
        creer('button', { type: 'button', class: 'bouton bouton--secondaire bouton--plein', onclick: () => actions.ajouterCategorie(type) },
          type === 'epargne' ? '+ Ajouter un compte' : '+ Ajouter une catégorie'))),
  ];
}

// Liste des transactions mensuelles (modèles récurrents) avec bouton « Arrêter »
function sectionRecurrentes(donnees, actions) {
  const categorie = indexerCategories(donnees.categories);
  const contenu = donnees.recurrentes.length === 0
    ? creer('p', { class: 'aide aide--carte' }, 'Coche « Chaque mois » en ajoutant une transaction (loyer, abonnement, bourse…) pour qu’elle soit ajoutée automatiquement.')
    : creer('ul', { class: 'liste' }, donnees.recurrentes.map((r) => {
      const c = categorie(r.categorieId);
      return creer('li', { class: 'ligne-reglage' },
        badgeCategorie(c),
        creer('span', { class: 'ligne-transaction__texte' },
          creer('span', { class: 'ligne-transaction__nom' }, r.note || c.nom),
          creer('span', { class: 'ligne-transaction__note' },
            `${formaterMontantSigne(r.montant, r.type)} · le ${r.jour === 1 ? '1er' : r.jour} du mois`)),
        creer('button', { type: 'button', class: 'bouton bouton--secondaire', onclick: () => actions.arreterRecurrente(r) }, 'Arrêter'));
    }));
  return [
    creer('h2', { class: 'titre-section' }, 'Transactions mensuelles'),
    creer('div', { class: 'carte carte--liste' }, contenu),
  ];
}

// Liste des débuts de mois indiqués (du plus récent au plus ancien), modifiables et supprimables
function sectionDebutsMois(donnees, actions) {
  const entrees = Object.entries(donnees.debutsMois).sort(([a], [b]) => b.localeCompare(a));
  const contenu = entrees.length === 0
    ? creer('p', { class: 'aide aide--carte' }, 'Par défaut, un mois commence le 1er. Quand ta paye arrive en fin de mois, indique ce jour-là comme début du mois suivant.')
    : creer('ul', { class: 'liste' }, entrees.map(([mois, date]) => creer('li', { class: 'ligne-reglage' },
      creer('button', { type: 'button', class: 'ligne-reglage__principal', onclick: () => actions.modifierDebutMois(mois) },
        creer('span', { class: 'ligne-transaction__nom' }, nomDuMois(mois)),
        creer('span', { class: 'ligne-transaction__note' }, `commence le ${dateLongue(date)}`)),
      creer('button', { type: 'button', class: 'bouton-icone bouton-icone--danger', 'aria-label': `Faire recommencer ${nomDuMois(mois)} le 1er`, onclick: () => actions.supprimerDebutMois(mois) },
        icone(...TRACES_CORBEILLE)))));
  return [
    creer('h2', { class: 'titre-section' }, 'Début des mois'),
    creer('div', { class: 'carte carte--liste' },
      contenu,
      creer('div', { class: 'pied-liste' },
        creer('button', { type: 'button', class: 'bouton bouton--secondaire bouton--plein', onclick: actions.commencerMois },
          '+ Nouveau début de mois'))),
  ];
}

// Boutons d'export, d'import et de remise à zéro
function sectionSauvegarde(actions) {
  return [
    creer('h2', { class: 'titre-section' }, 'Sauvegarde'),
    creer('div', { class: 'carte' },
      creer('p', { class: 'aide aide--sous-champ' }, 'Tes données restent uniquement sur cet appareil. Exporte-les de temps en temps pour ne rien perdre.'),
      creer('div', { class: 'actions-colonne' },
        creer('button', { type: 'button', class: 'bouton bouton--plein', onclick: actions.exporterJSON }, 'Sauvegarder (JSON)'),
        creer('button', { type: 'button', class: 'bouton bouton--secondaire bouton--plein', onclick: actions.exporterCSV }, 'Exporter pour Excel (CSV)'),
        creer('button', { type: 'button', class: 'bouton bouton--secondaire bouton--plein', onclick: actions.importer }, 'Importer une sauvegarde'))),
    creer('div', { class: 'carte' },
      creer('button', { type: 'button', class: 'bouton bouton--contour-danger bouton--plein', onclick: actions.toutEffacer }, 'Effacer toutes les données')),
  ];
}

// Section « Apparence » : thème (Automatique / Clair / Sombre) et animation du fond
function sectionApparence(preferences, actions) {
  const option = ([valeur, texte]) => [
    creer('input', {
      type: 'radio', name: 'theme', id: `theme-${valeur}`, value: valeur,
      checked: preferences.theme === valeur,
      onchange: () => actions.changerTheme(valeur),
    }),
    creer('label', { for: `theme-${valeur}` }, texte),
  ];
  return [
    creer('h2', { class: 'titre-section' }, 'Apparence'),
    creer('div', { class: 'carte' },
      creer('p', { class: 'aide aide--sous-champ' }, 'Thème'),
      creer('div', { class: 'segment', role: 'radiogroup', 'aria-label': 'Thème' }, THEMES.map(option)),
      creer('label', { class: 'interrupteur' },
        creer('span', {}, 'Animer le fond'),
        creer('input', {
          type: 'checkbox', role: 'switch', checked: preferences.fondAnime,
          onchange: (evenement) => actions.basculerFondAnime(evenement.target.checked),
        })),
      creer('p', { class: 'aide' }, 'Le mode discret (masquer les montants) s’active avec l’œil, sur l’accueil.')),
  ];
}

// Écran Réglages : apparence, catégories, transactions mensuelles, débuts de mois, sauvegarde
export function rendreReglages(conteneur, { donnees, preferences, actions }) {
  remplir(conteneur,
    sectionApparence(preferences, actions),
    sectionCategories('Catégories de dépenses', 'depense', donnees, actions),
    sectionCategories('Catégories de revenus', 'revenu', donnees, actions),
    sectionRecurrentes(donnees, actions),
    sectionDebutsMois(donnees, actions),
    sectionSauvegarde(actions),
    creer('p', { class: 'aide a-propos' }, 'Mon Budget · version 1.1', creer('br'), 'Aucun compte, aucun serveur : tout reste sur ton téléphone.'),
  );
}

/* ===================== Épargne ===================== */

// Mouvement net d'un compte sur le mois : versements − retraits (hors frais)
function netDuMoisPour(duMois, compteId) {
  let net = 0;
  for (const t of duMois) {
    if (t.categorieId !== compteId) continue;
    if (t.type === 'epargne') net += t.montant;
    if (t.type === 'retrait') net -= t.montant;
  }
  return net;
}

// Pastille du mois : « Novembre : +150,00 € » (verte), « −40,00 € » (rouge) ou « rien ce mois-ci » (neutre)
function puceDuMois(mois, net) {
  const nom = majuscule(nomDuMoisSeul(mois));
  if (net === 0) return creer('span', { class: 'heros__puce heros__puce--neutre' }, `${nom} : aucun mouvement`);
  return creer('span', { class: `heros__puce ${net < 0 ? 'heros__puce--negatif' : ''}` }, `${nom} : ${texteMontantSigne(net)}`);
}

// Carte « héros » du compte épargne : solde en grand, mouvement du mois, objectif, boutons rapides
function carteCompteEpargne(compte, solde, soldeInitial, objectif, net, mois, actions) {
  return creer('div', { class: 'carte carte-solde heros' },
    creer('div', { class: 'heros__entete' },
      creer('p', { class: 'carte-solde__label' }, `${compte.emoji} Compte épargne`),
      creer('button', { type: 'button', class: 'heros__lien', onclick: () => actions.modifierCompte(compte.id) }, 'Modifier')),
    creer('p', { class: 'carte-solde__montant montant' }, montantAvecCentimes(formaterMontant(solde))),
    creer('div', { class: 'heros__mois' }, puceDuMois(mois, net)),
    objectif
      ? creer('div', { class: 'heros__objectif' }, blocObjectif(solde, objectif, 'var(--heros-texte)', compte.nom))
      : creer('button', { type: 'button', class: 'heros__lien heros__lien--bloc', onclick: () => actions.modifierCompte(compte.id) },
        soldeInitial ? '+ Fixer un objectif' : '+ Indiquer le solde actuel et un objectif'),
    creer('div', { class: 'heros__actions' },
      creer('button', { type: 'button', class: 'bouton', onclick: () => actions.ajouterEpargne('epargne', compte.id) }, 'Verser'),
      creer('button', { type: 'button', class: 'bouton bouton--secondaire', onclick: () => actions.ajouterEpargne('retrait', compte.id) }, 'Retirer')),
  );
}

// Bloc objectif d'un compte : barre de progression + « 32 % · reste 680 € »
function blocObjectif(solde, objectif, couleur, nom) {
  const atteint = solde >= objectif;
  const pourcent = pourcentage(Math.max(solde, 0), objectif);
  return creer('span', { class: 'objectif' },
    creerBarreProgression(Math.max(solde, 0) / objectif, couleur, `${nom} : ${pourcent} % de l’objectif`),
    creer('span', { class: 'objectif__pied' },
      creer('span', {}, `${pourcent} % de ${formaterMontantCourt(objectif)}`),
      creer('span', { class: 'montant' }, atteint ? 'Objectif atteint 🎉' : `Reste ${formaterMontantCourt(objectif - solde)}`)));
}

// Écran Épargne : deux cartes séparées, le compte épargne puis le PEA (ce ne sont pas les mêmes placements)
export function rendreEpargne(conteneur, { donnees, mois, actions }) {
  const fin = finPeriode(mois, donnees.debutsMois);
  const soldes = calculerSoldesEpargne(donnees.transactions, { dateLimite: fin, soldesInitiaux: donnees.soldesInitiaux });
  const pea = donnees.pea;
  const compte = donnees.categories.find((c) => c.id === ID_COMPTE_EPARGNE);
  const duMois = transactionsDuMois(donnees.transactions, mois, donnees.debutsMois);
  const resume = pea ? resumerPea(pea, donnees.transactions, donnees.soldesInitiaux[pea.compteId] ?? 0, fin) : null;
  remplir(conteneur,
    carteCompteEpargne(compte, soldes.get(ID_COMPTE_EPARGNE) ?? 0, donnees.soldesInitiaux[ID_COMPTE_EPARGNE],
      donnees.objectifs[ID_COMPTE_EPARGNE], netDuMoisPour(duMois, ID_COMPTE_EPARGNE), mois, actions),
    sectionPea(donnees, resume, netDuMoisPour(duMois, pea?.compteId), actions),
  );
}

/* ===================== Section PEA ===================== */

// « +240,00 € » ou « −150,00 € »
function texteMontantSigne(centimes) {
  return (centimes >= 0 ? '+' : '−') + formaterMontant(Math.abs(centimes));
}

// Pourcentage en dixièmes : 76 → « +7,6 % »
function textePourcentDixiemes(pourMille) {
  const valeur = (Math.abs(pourMille) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${pourMille >= 0 ? '+' : '−'}${valeur} %`;
}

// Durée en mois lisible : 29 → « 2 ans et 5 mois »
function texteDuree(mois) {
  const annees = Math.floor(mois / 12);
  const reste = mois % 12;
  const morceaux = [];
  if (annees > 0) morceaux.push(`${annees} an${annees > 1 ? 's' : ''}`);
  if (reste > 0) morceaux.push(`${reste} mois`);
  return morceaux.join(' et ') || 'moins d’un mois';
}

// Ligne « avantage fiscal » : compte à rebours des 5 ans, ou avantage acquis
function ligneAvantageFiscal(dateOuverture) {
  if (!dateOuverture) return null;
  const avantage = avantageFiscal(dateOuverture, aujourdhui());
  return creer('p', { class: `pea__fiscal ${avantage.acquis ? 'pea__fiscal--acquis' : ''}` },
    avantage.acquis
      ? `✓ Plus de 5 ans : avantage fiscal acquis depuis le ${dateLongue(avantage.dateAcquisition)}`
      : `⏳ Avantage fiscal dans ${texteDuree(avantage.moisRestants)} (${dateLongue(avantage.dateAcquisition)} ${avantage.dateAcquisition.slice(0, 4)})`);
}

// Mention du dernier relevé, mise en avant s'il faut refaire le point
function ligneDernierReleve(pea, resume) {
  const enRetard = rappelNecessaire(pea.releves, aujourdhui());
  if (!resume.releve) {
    return creer('p', { class: 'pea__rappel pea__rappel--actif' }, 'Aucun relevé : indique la valeur actuelle de ton PEA pour voir sa plus-value.');
  }
  const jours = ecartJours(resume.releve.date, aujourdhui());
  return creer('p', { class: `pea__rappel ${enRetard ? 'pea__rappel--actif' : ''}` },
    enRetard
      ? `Fais le point : dernier relevé il y a ${jours} jours (${dateLongue(resume.releve.date)}).`
      : `Dernier relevé le ${dateLongue(resume.releve.date)}${resume.valeur !== resume.releve.valeur ? ' (valeur estimée avec tes versements et retraits depuis)' : ''}.`);
}

// Frais de versement : taux appliqué et total déjà payé
function ligneFrais(pea, transactions) {
  const taux = ((pea.tauxFrais ?? TAUX_FRAIS_DEFAUT) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const paye = totalFrais(transactions, pea.compteId);
  return creer('p', { class: 'pea__fiscal' },
    `Frais de ${taux} % sur chaque versement${paye > 0 ? ` · ${formaterMontant(paye)} payés au total` : ''}`);
}

// Historique des relevés, repliable (balise <details> native)
function historiqueReleves(pea, actions) {
  const releves = trierReleves(pea.releves).reverse();
  if (releves.length === 0) return null;
  return creer('details', { class: 'pea__historique' },
    creer('summary', {}, `Historique des relevés (${releves.length})`),
    creer('ul', { class: 'liste' }, releves.map((r) => creer('li', {},
      creer('button', { type: 'button', class: 'ligne-releve', onclick: () => actions.modifierReleve(r) },
        creer('span', {}, dateLongue(r.date), ' ', r.date.slice(0, 4)),
        creer('strong', { class: 'montant' }, formaterMontant(r.valeur)))))));
}

// Texte court de l'avantage fiscal, pour la carte : « avr. 2029 » (date des 5 ans) ou « Acquis ✓ »
function texteFiscalCourt(dateOuverture) {
  if (!dateOuverture) return '—';
  const avantage = avantageFiscal(dateOuverture, aujourdhui());
  if (avantage.acquis) return 'Acquis ✓';
  // « avr. 2029 » : la date où les 5 ans seront atteints
  const [annee, mois] = avantage.dateAcquisition.split('-');
  return `${new Date(Number(annee), Number(mois) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' })} ${annee}`;
}

// Carte « héros » du PEA : valeur en grand, plus-value en pastille, investi / frais / fiscalité
function cartePea(pea, resume, transactions, actions) {
  const pv = resume.plusValue;
  const valeur = resume.valeur ?? resume.investi;
  const pastille = pv
    ? creer('span', { class: `heros__puce ${pv.montant < 0 ? 'heros__puce--negatif' : ''}` },
      `${pv.montant < 0 ? 'Moins' : 'Plus'}-value : ${texteMontantSigne(pv.montant)}`,
      pv.pourMille !== null && pv.pourMille !== undefined ? ` (${textePourcentDixiemes(pv.pourMille)})` : '')
    : creer('span', { class: 'heros__puce heros__puce--neutre' }, 'Fais un premier relevé');
  const total = (libelle, texte) => creer('div', { class: 'heros__total' },
    creer('span', { class: 'heros__total-label' }, libelle),
    creer('span', { class: 'heros__total-montant montant' }, texte));
  return creer('div', { class: 'carte carte-solde heros' },
    creer('div', { class: 'heros__entete' },
      creer('p', { class: 'carte-solde__label' }, `📈 PEA${resume.valeur !== null && resume.releve && resume.valeur !== resume.releve.valeur ? ' · valeur estimée' : ''}`),
      creer('button', { type: 'button', class: 'heros__lien', onclick: actions.parametresPea }, 'Paramètres')),
    creer('p', { class: 'carte-solde__montant montant' }, montantAvecCentimes(formaterMontant(valeur))),
    creer('div', { class: 'heros__mois' }, pastille),
    creer('div', { class: 'heros__totaux' },
      total('Investi', formaterMontantCourtArrondi(resume.investi)),
      total('Frais payés', formaterMontantCourtArrondi(totalFrais(transactions, pea.compteId))),
      total('5 ans le', texteFiscalCourt(pea.dateOuverture))),
    creer('div', { class: 'heros__actions' },
      creer('button', { type: 'button', class: 'bouton', onclick: () => actions.ajouterReleve() }, 'Faire le point'),
      creer('button', { type: 'button', class: 'bouton bouton--secondaire', onclick: () => actions.ajouterEpargne('epargne', pea.compteId) }, 'Verser')),
  );
}

// Section PEA : la carte héros, puis une carte de détails (relevé, graphique, historique)
function sectionPea(donnees, resume, net, actions) {
  const pea = donnees.pea;
  if (!pea) {
    return creer('div', { class: 'carte carte-nouveau-mois' },
      creer('p', {}, creer('strong', {}, '📈 Suis ton PEA'), creer('br'),
        creer('span', { class: 'aide' }, 'Relève sa valeur chaque mois pour voir ta plus-value et son évolution.')),
      creer('button', { type: 'button', class: 'bouton bouton--secondaire bouton--plein', onclick: actions.parametresPea }, 'Ajouter mon PEA'));
  }
  const serie = serieEvolution(pea, donnees.transactions, donnees.soldesInitiaux[pea.compteId] ?? 0);
  return [
    cartePea(pea, resume, donnees.transactions, actions),
    creer('div', { class: 'carte pea' },
      creer('h2', { class: 'carte__titre' }, 'Évolution'),
      serie.length >= 2
        ? creerGraphiqueEvolution(serie, { formaterMontant: formaterMontantCourtArrondi, formaterDate: dateCourte })
        : creer('p', { class: 'aide' }, 'Le graphique d’évolution apparaîtra à partir de 2 relevés.'),
      ligneDernierReleve(pea, resume),
      net > 0 && creer('p', { class: 'aide' }, `${formaterMontant(net)} versés ce mois-ci`),
      ligneAvantageFiscal(pea.dateOuverture),
      ligneFrais(pea, donnees.transactions),
      historiqueReleves(pea, actions)),
  ];
}

// Montant arrondi à l'euro pour les échelles du graphique : 324 050 → « 3 241 € »
function formaterMontantCourtArrondi(centimes) {
  return formaterMontantCourt(Math.round(centimes / 100) * 100);
}
