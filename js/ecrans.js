// Rendu des 5 écrans (Accueil, Historique, Épargne, Budgets, Réglages).
// Chaque fonction « rendreXxx » reçoit le conteneur de l'écran et un contexte :
//   { donnees, mois, filtre, actions }
// Elle redessine entièrement l'écran à partir des données (aucun état caché dans le DOM).
// Les clics sont transmis à app.js via les fonctions de « actions ».

import { creer, remplir, etatVide, badgeCategorie, icone } from './ui.js';
import { formaterMontant, formaterMontantCourt, formaterMontantSigne } from './money.js';
import { nomDuMoisSeul, deMois, libelleJour, finDuMois } from './dates.js';
import {
  transactionsDuMois, calculerTotaux, calculerSoldeCumule, calculerTotalParCategorie,
  calculerEtatBudget, pourcentage, grouperParJour, categoriesUtilisees, compterUtilisations,
  calculerSoldesEpargne, estEpargne,
} from './calculs.js';
import { creerGraphiqueBarres, creerJauge, infosNiveau, creerBarreProgression } from './charts.js';

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

// Carte principale : le solde du mois, en très grand
function carteSolde(totaux, mois) {
  const positif = totaux.solde >= 0;
  let message = 'Tu dépenses plus que tu ne gagnes ce mois-ci';
  if (positif) message = totaux.solde > 0 ? 'Il te reste de la marge 👍' : 'Tu es à l’équilibre';
  if (!positif && totaux.epargne > 0 && totaux.solde + totaux.epargne >= 0) message = 'Tu as mis de côté plus que ta marge du mois';
  return creer('div', { class: 'carte carte-solde' },
    creer('p', { class: 'carte-solde__label' }, `Solde ${deMois(mois)}`),
    creer('p', { class: `carte-solde__montant montant ${positif ? '' : 'carte-solde__montant--negatif'}` },
      (positif && totaux.solde > 0 ? '+' : '') + formaterMontant(totaux.solde)),
    creer('p', { class: 'carte-solde__message' }, message),
    creer('p', { class: 'aide' }, 'Revenus − dépenses − épargne'),
  );
}

// Trois tuiles côte à côte : revenus, dépenses et épargne nette du mois
function tuilesTotaux(totaux) {
  const tuile = (libelle, montant, classe, symbole) => creer('div', { class: `tuile ${classe}` },
    creer('p', { class: 'tuile__label' }, creer('span', { 'aria-hidden': 'true' }, symbole), ` ${libelle}`),
    creer('p', { class: 'tuile__montant montant' }, formaterMontant(montant)));
  return creer('div', { class: 'tuiles' },
    tuile('Revenus', totaux.revenus, 'tuile--revenus', '↑'),
    tuile('Dépenses', totaux.depenses, 'tuile--depenses', '↓'),
    tuile('Épargne', totaux.epargne, 'tuile--epargne', '⇢'));
}

// Ligne discrète : solde cumulé depuis la première transaction jusqu'à la fin du mois
function ligneSoldeCumule(cumul, mois) {
  return creer('div', { class: 'carte ligne-info' },
    creer('span', {}, 'Solde cumulé', creer('br'),
      creer('span', { class: 'aide' }, `jusqu’à fin ${nomDuMoisSeul(mois)}, épargne déduite`)),
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
  if (transaction.note) return transaction.note;
  if (transaction.type === 'epargne') return 'Mis de côté';
  if (transaction.type === 'retrait') return 'Retiré de l’épargne';
  return '';
}

// Une ligne de transaction cliquable (ouvre la modification)
function ligneTransaction(transaction, categorie, actions) {
  const recurrente = transaction.recurrenteId !== null;
  return creer('li', {},
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
      formaterMontantSigne(transaction.montant, transaction.type)),
    ));
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
  const duMois = transactionsDuMois(donnees.transactions, mois);
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
    filtreActif ? resumeFiltre(visibles, categorie(filtreActif)) : creer('p', { class: 'aide aide--centre' }, 'Touche une transaction pour la modifier ou la supprimer.'),
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
    creerBlocJauge('Budget global du mois', etat));
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
  const duMois = transactionsDuMois(donnees.transactions, mois);
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
  const categories = donnees.categories.filter((c) => c.type === type);
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

// Écran Réglages : catégories, transactions mensuelles, sauvegarde
export function rendreReglages(conteneur, { donnees, actions }) {
  remplir(conteneur,
    sectionCategories('Catégories de dépenses', 'depense', donnees, actions),
    sectionCategories('Catégories de revenus', 'revenu', donnees, actions),
    sectionCategories('Comptes d’épargne', 'epargne', donnees, actions),
    sectionRecurrentes(donnees, actions),
    sectionSauvegarde(actions),
    creer('p', { class: 'aide a-propos' }, 'Mon Budget · version 1.0', creer('br'), 'Aucun compte, aucun serveur : tout reste sur ton téléphone.'),
  );
}

/* ===================== Épargne ===================== */

// Carte principale : total épargné (tous comptes) et mouvement net du mois
function carteTotalEpargne(total, netDuMois, mois, actions) {
  let resume = `Rien mis de côté en ${nomDuMoisSeul(mois)}`;
  if (netDuMois > 0) resume = `+${formaterMontant(netDuMois)} mis de côté ce mois-ci`;
  if (netDuMois < 0) resume = `${formaterMontant(-netDuMois)} retirés ce mois-ci`;
  return creer('div', { class: 'carte carte-solde' },
    creer('p', { class: 'carte-solde__label' }, `Épargne totale fin ${nomDuMoisSeul(mois)}`),
    creer('p', { class: 'carte-solde__montant montant' }, formaterMontant(total)),
    creer('p', { class: 'carte-solde__message' }, resume),
    creer('div', { class: 'actions-ligne' },
      creer('button', { type: 'button', class: 'bouton', onclick: () => actions.ajouterEpargne('epargne') }, 'Mettre de côté'),
      creer('button', { type: 'button', class: 'bouton bouton--secondaire', onclick: () => actions.ajouterEpargne('retrait') }, 'Retirer')),
  );
}

// Bloc objectif d'un compte : barre de progression + « 32 % · reste 680 € » (ou invitation)
function blocObjectif(solde, objectif, couleur, nom) {
  if (!objectif) return creer('span', { class: 'lien-action' }, 'Définir un objectif');
  const atteint = solde >= objectif;
  const pourcent = pourcentage(Math.max(solde, 0), objectif);
  return creer('span', { class: 'objectif' },
    creerBarreProgression(Math.max(solde, 0) / objectif, couleur, `${nom} : ${pourcent} % de l’objectif`),
    creer('span', { class: 'objectif__pied' },
      creer('span', {}, `${pourcent} % de ${formaterMontantCourt(objectif)}`),
      creer('span', { class: 'montant' }, atteint ? 'Objectif atteint 🎉' : `Reste ${formaterMontantCourt(objectif - solde)}`)));
}

// Ligne d'un compte d'épargne cliquable (ouvre la saisie de l'objectif)
function ligneCompte(compte, solde, objectif, actions) {
  return creer('li', {},
    creer('button', { type: 'button', class: 'ligne-compte', onclick: () => actions.modifierObjectif(compte.id) },
      creer('span', { class: 'ligne-compte__haut' },
        badgeCategorie(compte),
        creer('span', { class: 'ligne-transaction__nom' }, compte.nom),
        creer('strong', { class: 'montant' }, formaterMontant(solde))),
      blocObjectif(solde, objectif, `var(--serie-${compte.couleur})`, compte.nom)));
}

// Écran Épargne : total, boutons rapides, puis chaque compte avec son objectif
export function rendreEpargne(conteneur, { donnees, mois, actions }) {
  const soldes = calculerSoldesEpargne(donnees.transactions, finDuMois(mois));
  const comptes = donnees.categories.filter((c) => c.type === 'epargne');
  const total = comptes.reduce((s, c) => s + (soldes.get(c.id) ?? 0), 0);
  const netDuMois = calculerTotaux(transactionsDuMois(donnees.transactions, mois)).epargne;
  const aucunMouvement = !donnees.transactions.some((t) => estEpargne(t.type));
  remplir(conteneur,
    carteTotalEpargne(total, netDuMois, mois, actions),
    aucunMouvement && creer('p', { class: 'aide aide--centre' },
      'Mets de l’argent de côté pour un projet ou les imprévus : il est déduit de ton solde du mois et s’accumule ici.'),
    creer('h2', { class: 'titre-section' }, 'Mes comptes'),
    creer('ul', { class: 'liste carte carte--liste' },
      comptes.map((c) => ligneCompte(c, soldes.get(c.id) ?? 0, donnees.objectifs[c.id], actions))),
    creer('p', { class: 'aide aide--centre' }, 'Touche un compte pour définir son objectif. Ajoute ou supprime des comptes dans Réglages.'),
  );
}
